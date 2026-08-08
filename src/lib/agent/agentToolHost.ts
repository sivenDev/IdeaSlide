import Ajv, { type ValidateFunction } from "ajv";
import type {
  AgentExtension,
  AgentToolCall,
  AgentToolExecutionContext,
  AgentToolExecutor,
  AgentToolFailureResult,
  AgentToolResult,
} from "./types";

const MAX_TOOL_RESULT_BYTES = 64 * 1024;

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

function boundedContent(value: unknown): { content: unknown; truncated: boolean } {
  const encoded = JSON.stringify(value);
  if (encoded.length <= MAX_TOOL_RESULT_BYTES) return { content: value, truncated: false };
  return {
    content: { truncated: true, preview: encoded.slice(0, MAX_TOOL_RESULT_BYTES) },
    truncated: true,
  };
}

export function createAgentToolHost<TModel>({
  extension,
  context,
}: {
  extension: AgentExtension<TModel>;
  context: AgentToolExecutionContext<TModel>;
}): AgentToolExecutor {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validators = new Map<string, ValidateFunction>();
  const ledger = new Map<string, { signature: string; result: Promise<AgentToolResult> }>();
  const cancelled = new Set<string>();

  const execute = async (call: AgentToolCall, signal?: AbortSignal): Promise<AgentToolResult> => {
    const signature = JSON.stringify({ name: call.name, arguments: call.arguments });
    const previous = ledger.get(call.callId);
    if (previous) {
      return previous.signature === signature
        ? previous.result
        : failure(call, `Tool call id ${call.callId} was reused with different arguments.`, "toolValidationFailed");
    }

    const operation = (async (): Promise<AgentToolResult> => {
      if (signal?.aborted || cancelled.has(call.callId)) {
        return failure(call, "Editor Tool call was cancelled.", "toolExecutionFailed");
      }
      const descriptor = extension.tools.find((tool) => tool.name === call.name);
      if (!descriptor) {
        return failure(call, `Editor Tool is not registered: ${call.name}`, "toolValidationFailed");
      }
      let validate = validators.get(call.name);
      if (!validate) {
        validate = ajv.compile(descriptor.inputSchema);
        validators.set(call.name, validate);
      }
      if (!validate(call.arguments)) {
        return failure(
          call,
          `Invalid ${call.name} arguments: ${ajv.errorsText(validate.errors, { separator: "; " })}`,
          "toolValidationFailed",
        );
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
        if (result.kind === "read") {
          const bounded = boundedContent(result.content);
          return { ...result, ...bounded, truncated: result.truncated || bounded.truncated };
        }
        return result;
      } catch (cause) {
        return failure(call, cause instanceof Error ? cause.message : String(cause), "toolExecutionFailed");
      }
    })();
    ledger.set(call.callId, { signature, result: operation });
    return operation;
  };

  return {
    execute,
    cancel(callId) {
      cancelled.add(callId);
    },
  };
}
