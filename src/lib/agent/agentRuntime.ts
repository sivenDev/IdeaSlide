import { cancelAgent, runAgent } from "./agentClient";
import type {
  AgentMessage,
  AgentProviderCapabilities,
  AgentRunRequest,
  AgentToolDescriptor,
} from "./types";
import {
  COMPATIBILITY_AGENT_CAPABILITIES,
  createAgentEventId,
  type AgentCapabilities,
  type AgentError,
  type AgentEvent,
  type AgentTurnBindingSnapshot,
} from "./protocol";

export interface StartAgentTurnInput {
  threadId: string;
  turnId: string;
  retryOfTurnId?: string;
  prompt: string;
  binding: AgentTurnBindingSnapshot;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  context: Record<string, unknown>;
  tools: AgentToolDescriptor[];
  messages: AgentMessage[];
}

export interface AgentTurnResult {
  runId: string;
  text: string;
  nextSequence: number;
  assistantItemId: string;
}

export interface AgentRuntime {
  id: string;
  label: string;
  capabilities: AgentCapabilities;
  startTurn(input: StartAgentTurnInput, emit: (event: AgentEvent) => void): Promise<AgentTurnResult>;
  cancelTurn(turnId: string): Promise<boolean>;
  steerTurn?: (turnId: string, prompt: string) => Promise<boolean>;
}

interface ActiveCompatibilityTurn {
  emit: (event: AgentEvent) => void;
  threadId: string;
  nextSequence: number;
}

type AgentEventPayload<T extends AgentEvent = AgentEvent> = T extends AgentEvent
  ? Omit<T, "eventId" | "threadId" | "turnId" | "sequence" | "at">
  : never;

function errorFromCause(cause: unknown): AgentError {
  const message = cause instanceof Error ? cause.message : String(cause);
  const lower = message.toLowerCase();
  return {
    code: lower.includes("configuration") || lower.includes("credential")
      ? "configurationRequired"
      : lower.includes("cancel")
        ? "cancelled"
        : "unknown",
    message,
    recovery: lower.includes("configuration") ? "Open Settings and verify the AI Provider configuration." : "Retry the Turn.",
    retryable: !lower.includes("configuration") && !lower.includes("credential"),
  };
}

function normalizedCapabilities(capabilities: AgentProviderCapabilities): AgentCapabilities {
  return {
    ...COMPATIBILITY_AGENT_CAPABILITIES,
    textStreaming: capabilities.textStreaming,
    reasoningSummary: capabilities.reasoningSummary,
    toolEvents: capabilities.toolEvents,
    cancellation: capabilities.cancellation,
    retry: capabilities.retry,
  };
}

export function createCompatibilityAgentRuntime(): AgentRuntime {
  const activeTurns = new Map<string, ActiveCompatibilityTurn>();

  return {
    id: "openai-compatible",
    label: "Compatibility",
    capabilities: COMPATIBILITY_AGENT_CAPABILITIES,
    async startTurn(input, emit) {
      const assistantItemId = `${input.turnId}:assistant`;
      let sequence = 0;
      const emitNext = (event: AgentEventPayload) => {
        const completeEvent = {
          ...event,
          eventId: createAgentEventId(input.turnId, sequence, event.type),
          threadId: input.threadId,
          turnId: input.turnId,
          sequence,
          at: Date.now(),
        } as AgentEvent;
        sequence += 1;
        const active = activeTurns.get(input.turnId);
        if (active) active.nextSequence = sequence;
        emit(completeEvent);
      };

      activeTurns.set(input.turnId, { emit, threadId: input.threadId, nextSequence: sequence });
      emitNext({
        type: "turnStarted",
        prompt: input.prompt,
        retryOfTurnId: input.retryOfTurnId,
        binding: input.binding,
        userItemId: `${input.turnId}:user`,
        assistantItemId,
      });
      emitNext({
        type: "itemAdded",
        item: {
          id: `${input.turnId}:skill`,
          kind: "tool",
          name: `${input.binding.skillId} Skill`,
          summary: `${input.tools.length} editor Tools available`,
          status: "completed",
          createdAt: Date.now(),
        },
      });

      const request: AgentRunRequest = {
        runId: input.turnId,
        prompt: input.prompt,
        baseUrl: input.baseUrl,
        model: input.model,
        systemPrompt: input.systemPrompt,
        skillId: input.binding.skillId,
        context: input.context,
        tools: input.tools,
        messages: input.messages.map(({ role, content }) => ({ role, content })),
      };
      let reasoningAdded = false;
      let reasoningContent = "";
      const toolItems = new Map<string, string>();

      try {
        const response = await runAgent(request, (event) => {
          if (!activeTurns.has(input.turnId)) return;
          switch (event.type) {
            case "capabilities":
              emitNext({
                type: "capabilitiesUpdated",
                capabilities: normalizedCapabilities(event.capabilities),
              });
              break;
            case "strategyFallback":
              emitNext({
                type: "itemAdded",
                item: {
                  id: `${input.turnId}:fallback`,
                  kind: "lifecycle",
                  label: event.reason,
                  status: "completed",
                  createdAt: Date.now(),
                },
              });
              break;
            case "retryScheduled":
              emitNext({
                type: "itemAdded",
                item: {
                  id: `${input.turnId}:retry:${event.attempt}`,
                  kind: "lifecycle",
                  label: `Retrying provider request (attempt ${event.attempt}) in ${event.delayMs} ms`,
                  status: "completed",
                  createdAt: Date.now(),
                },
              });
              break;
            case "reasoningSummaryDelta": {
              const itemId = `${input.turnId}:reasoning`;
              reasoningContent += event.text;
              if (!reasoningAdded) {
                reasoningAdded = true;
                emitNext({
                  type: "itemAdded",
                  item: {
                    id: itemId,
                    kind: "reasoningSummary",
                    content: "",
                    status: "running",
                    createdAt: Date.now(),
                  },
                });
              }
              emitNext({ type: "itemDelta", itemId, text: event.text });
              break;
            }
            case "textDelta":
              emitNext({ type: "itemDelta", itemId: assistantItemId, text: event.text });
              break;
            case "toolStarted": {
              if (toolItems.has(event.callId)) break;
              const itemId = `${input.turnId}:tool:${event.callId}`;
              toolItems.set(event.callId, itemId);
              emitNext({
                type: "itemAdded",
                item: {
                  id: itemId,
                  kind: "tool",
                  name: event.name,
                  callId: event.callId,
                  summary: "Provider Tool activity",
                  status: "running",
                  createdAt: Date.now(),
                },
              });
              break;
            }
            case "toolCompleted": {
              const itemId = toolItems.get(event.callId);
              if (!itemId) break;
              emitNext({
                type: "itemUpdated",
                item: {
                  id: itemId,
                  kind: "tool",
                  name: event.name,
                  callId: event.callId,
                  summary: "Provider Tool activity",
                  status: "completed",
                  createdAt: Date.now(),
                },
              });
              break;
            }
            case "telemetry":
              emitNext({ type: "telemetryUpdated", telemetry: event.telemetry });
              break;
            case "error":
              emitNext({ type: "turnFailed", assistantItemId, error: event.error });
              activeTurns.delete(input.turnId);
              break;
            case "cancelled":
              emitNext({ type: "turnCancelled", label: "Agent run cancelled" });
              activeTurns.delete(input.turnId);
              break;
            case "started":
            case "completed":
              break;
          }
        });
        if (!activeTurns.has(input.turnId)) {
          return { runId: input.turnId, text: response.text, nextSequence: sequence, assistantItemId };
        }
        if (reasoningAdded) {
          emitNext({
            type: "itemUpdated",
            item: {
              id: `${input.turnId}:reasoning`,
              kind: "reasoningSummary",
              content: reasoningContent,
              status: "completed",
              createdAt: Date.now(),
            },
          });
        }
        activeTurns.delete(input.turnId);
        return { runId: response.runId, text: response.text, nextSequence: sequence, assistantItemId };
      } catch (cause) {
        if (activeTurns.has(input.turnId)) {
          emitNext({ type: "turnFailed", assistantItemId, error: errorFromCause(cause) });
          activeTurns.delete(input.turnId);
        }
        throw cause;
      }
    },
    async cancelTurn(turnId) {
      const active = activeTurns.get(turnId);
      const cancelled = await cancelAgent(turnId);
      if (active) {
        const sequence = active.nextSequence;
        active.emit({
          type: "turnCancelled",
          eventId: createAgentEventId(turnId, sequence, "turnCancelled"),
          threadId: active.threadId,
          turnId,
          sequence,
          at: Date.now(),
          label: cancelled ? "Agent run cancelled" : "Turn stopped locally",
        });
        activeTurns.delete(turnId);
      }
      return cancelled;
    },
  };
}
