import { cancelAgent, runAgent, submitAgentToolResult } from "./agentClient";
import type {
  AgentMessage,
  AgentPolicySettings,
  AgentRetryPolicy,
  AgentRunRequest,
  AgentToolCall,
  AgentToolDescriptor,
  AgentToolExecutor,
  AgentToolFailureResult,
} from "./types";
export { selectAgentRuntime } from "./runtimeSelection";
import {
  COMPATIBILITY_AGENT_CAPABILITIES,
  createSettledTurnCompletedEvent,
  type AgentCapabilities,
  type AgentEvent,
  type AgentTurnBindingSnapshot,
} from "./protocol";

export interface StartAgentTurnInput {
  threadId: string;
  turnId: string;
  retryOfTurnId?: string;
  upstreamThreadId?: string;
  prompt: string;
  binding: AgentTurnBindingSnapshot;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  retry: AgentRetryPolicy;
  policy: AgentPolicySettings;
  selectedSkillIds: string[];
  context: Record<string, unknown>;
  tools: AgentToolDescriptor[];
  messages: AgentMessage[];
  toolExecutor: AgentToolExecutor;
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
  resolveApproval?: (turnId: string, requestId: string, approved: boolean) => Promise<boolean>;
}

interface ActiveNativeTurn {
  executor: AgentToolExecutor;
  activeCallIds: Set<string>;
}

function failedToolResult(call: AgentToolCall, cause: unknown): AgentToolFailureResult {
  const message = cause instanceof Error ? cause.message : String(cause);
  return {
    kind: "failure",
    callId: call.callId,
    name: call.name,
    success: false,
    summary: message,
    error: {
      code: "toolExecutionFailed",
      message,
      recovery: "Retry the Tool or refresh the editor context.",
      diagnosticId: crypto.randomUUID(),
      retryable: true,
    },
    truncated: false,
    persistable: true,
  };
}

export function createNativeAgentRuntime(): AgentRuntime {
  const activeTurns = new Map<string, ActiveNativeTurn>();

  return {
    id: "native-agent-core",
    label: "Agent Core",
    capabilities: COMPATIBILITY_AGENT_CAPABILITIES,
    async startTurn(input, emit) {
      const active: ActiveNativeTurn = {
        executor: input.toolExecutor,
        activeCallIds: new Set(),
      };
      activeTurns.set(input.turnId, active);
      const request: AgentRunRequest = {
        runId: input.turnId,
        threadId: input.threadId,
        retryOfTurnId: input.retryOfTurnId,
        upstreamThreadId: input.upstreamThreadId,
        prompt: input.prompt,
        binding: input.binding,
        baseUrl: input.baseUrl,
        model: input.model,
        systemPrompt: input.systemPrompt,
        retry: input.retry,
        policy: input.policy,
        skillId: input.binding.skillId,
        selectedSkillIds: input.selectedSkillIds,
        context: input.context,
        tools: input.tools,
        messages: input.messages.map(({ role, content }) => ({ role, content })),
      };

      try {
        const response = await runAgent(request, (event) => {
          const current = activeTurns.get(input.turnId);
          if (!current) return;
          if (event.type === "event") {
            emit(event.event);
            return;
          }
          const { call } = event;
          current.activeCallIds.add(call.callId);
          void current.executor.execute(call)
            .catch((cause) => failedToolResult(call, cause))
            .then(async (result) => {
              if (!activeTurns.has(input.turnId)) return;
              await submitAgentToolResult(input.turnId, result);
            })
            .finally(() => current.activeCallIds.delete(call.callId));
        });
        emit(createSettledTurnCompletedEvent({
          threadId: input.threadId,
          turnId: input.turnId,
          nextSequence: response.nextSequence,
          assistantItemId: response.assistantItemId,
          finalText: response.text,
        }));
        return {
          runId: response.runId,
          text: response.text,
          nextSequence: response.nextSequence,
          assistantItemId: response.assistantItemId,
        };
      } finally {
        activeTurns.delete(input.turnId);
      }
    },
    async cancelTurn(turnId) {
      const active = activeTurns.get(turnId);
      if (active) {
        for (const callId of active.activeCallIds) active.executor.cancel(callId);
      }
      const cancelled = await cancelAgent(turnId);
      activeTurns.delete(turnId);
      return cancelled;
    },
  };
}
