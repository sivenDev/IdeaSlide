import type {
  AgentExtension,
  AgentToolCall,
  AgentToolExecutionContext,
  AgentToolExecutor,
  AgentToolFailureResult,
  AgentToolResult,
} from "./types";

function failure(
  call: AgentToolCall,
  message: string,
  code: "toolValidationFailed" | "toolExecutionFailed",
): AgentToolFailureResult {
  return {
    kind: "failure",
    callId: call.callId,
    name: call.name,
    success: false,
    summary: message,
    error: {
      code,
      message,
      recovery: code === "toolValidationFailed"
        ? "Retry with arguments that match the registered editor Tool schema."
        : "Retry the Tool or refresh the editor context.",
      diagnosticId: crypto.randomUUID(),
      retryable: code === "toolExecutionFailed",
    },
    truncated: false,
    persistable: true,
  };
}

export function createAgentToolHost<TModel>({
  extension,
  context,
}: {
  extension: AgentExtension<TModel>;
  context: AgentToolExecutionContext<TModel>;
}): AgentToolExecutor {
  const cancelled = new Set<string>();

  const execute = async (call: AgentToolCall, signal?: AbortSignal): Promise<AgentToolResult> => {
    if (signal?.aborted || cancelled.has(call.callId)) {
      return failure(call, "Editor Tool call was cancelled.", "toolExecutionFailed");
    }
    const descriptor = extension.tools.find((tool) => tool.name === call.name);
    if (!descriptor) {
      return failure(call, `Editor Tool is not registered: ${call.name}`, "toolValidationFailed");
    }
    try {
      const result = await extension.executeTool(call, context);
      if (result.callId !== call.callId || result.name !== call.name) {
        return failure(call, "Editor Tool returned a mismatched call identity.", "toolExecutionFailed");
      }
      if (result.kind === "proposal") {
        const changeSet = result.changeSet;
        if (
          changeSet.status !== "proposed"
          || changeSet.extensionId !== extension.id
          || changeSet.documentId !== context.documentId
          || changeSet.baseRevision !== context.revision
        ) {
          return failure(call, "Proposal Tool returned an unsafe or retargeted Change Set.", "toolExecutionFailed");
        }
        return result;
      }
      return result;
    } catch (cause) {
      return failure(call, cause instanceof Error ? cause.message : String(cause), "toolExecutionFailed");
    }
  };

  return {
    execute,
    cancel(callId) {
      cancelled.add(callId);
    },
  };
}
