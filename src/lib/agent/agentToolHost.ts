import type {
  AgentExtension,
  AgentToolCall,
  AgentToolExecutionContext,
  AgentToolExecutor,
  AgentToolFailureResult,
  AgentToolResult,
  ActiveAgentEditorBinding,
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
      if (result.kind === "mutation") {
        const changeSet = result.changeSet;
        if (
          changeSet.status !== "proposed"
          || changeSet.extensionId !== extension.id
          || changeSet.documentId !== context.documentId
          || changeSet.baseRevision !== context.revision
        ) {
          return failure(call, "Mutation Tool returned an unsafe or retargeted Change Set.", "toolExecutionFailed");
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
    mutationToolNames: Object.freeze(extension.tools.filter((tool) => tool.effect !== "read").map((tool) => tool.name)),
  };
}

function capturedBindingMatches(
  capturedTarget: {
    documentId: string;
    extensionId: string;
    revision: number;
    documentStatus: ActiveAgentEditorBinding["document"]["status"];
    sourceModified?: string;
  },
  binding: Pick<ActiveAgentEditorBinding, "document" | "extensionId" | "readOnly"> | undefined,
) {
  return Boolean(
    binding
    && !binding.readOnly
    && binding.extensionId === capturedTarget.extensionId
    && binding.document.id === capturedTarget.documentId
    && binding.document.status === "editable"
    && binding.document.status === capturedTarget.documentStatus
    && binding.document.revision === capturedTarget.revision
    && binding.document.sourceModified === capturedTarget.sourceModified,
  );
}

export function createDirectApplyToolExecutor({
  executor,
  capturedTarget,
  getActiveBinding,
  isActive,
}: {
  executor: AgentToolExecutor;
  capturedTarget: {
    documentId: string;
    extensionId: string;
    revision: number;
    documentStatus: ActiveAgentEditorBinding["document"]["status"];
    sourceModified?: string;
  };
  getActiveBinding: () => Pick<ActiveAgentEditorBinding, "document" | "extensionId" | "readOnly" | "applyChangeSet"> | undefined;
  isActive: () => boolean;
}): AgentToolExecutor {
  const cancelled = new Set<string>();
  return {
    async execute(call, signal) {
      if (executor.mutationToolNames?.includes(call.name)) {
        if (
          signal?.aborted
          || cancelled.has(call.callId)
          || !isActive()
          || !capturedBindingMatches(capturedTarget, getActiveBinding())
        ) {
          return failure(call, "The active editor changed before the mutation could be applied.", "toolExecutionFailed");
        }
      }
      const result = await executor.execute(call, signal);
      if (result.kind !== "mutation") return result;
      if (result.appliedByExecutor) {
        if (result.changeSet.status !== "applied") {
          return failure(call, "The canonical editor executor returned an unapplied mutation.", "toolExecutionFailed");
        }
        return result;
      }
      const binding = getActiveBinding();
      const changeSet = result.changeSet;
      if (!capturedBindingMatches(capturedTarget, binding)
        || signal?.aborted
        || cancelled.has(call.callId)
        || !isActive()
        || binding?.document.revision !== changeSet.baseRevision
        || binding?.document.sourceModified !== changeSet.baseSourceModified) {
        return failure(call, "The active editor changed before the mutation could be applied.", "toolExecutionFailed");
      }
      if (!binding.applyChangeSet(changeSet)) {
        return failure(call, "The active editor rejected the mutation as stale or unsafe.", "toolExecutionFailed");
      }
      return {
        ...result,
        summary: `Applied: ${result.summary}`,
        changeSet: { ...changeSet, status: "applied" },
      };
    },
    cancel(callId) {
      cancelled.add(callId);
      executor.cancel(callId);
    },
    async dispose() {
      await executor.dispose?.();
    },
    mutationToolNames: executor.mutationToolNames,
  };
}
