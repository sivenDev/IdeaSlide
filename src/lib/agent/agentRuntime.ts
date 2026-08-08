import { cancelAgent, runAgent } from "./agentClient";
import type { AgentMessage, AgentRunRequest, AgentToolDescriptor } from "./types";
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

      try {
        const response = await runAgent(request, (event) => {
          if (!activeTurns.has(input.turnId)) return;
          if (event.type === "textDelta") {
            emitNext({ type: "itemDelta", itemId: assistantItemId, text: event.text });
          }
        });
        if (!activeTurns.has(input.turnId)) {
          return { runId: input.turnId, text: response.text, nextSequence: sequence, assistantItemId };
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
