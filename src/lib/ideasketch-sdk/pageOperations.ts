import {
  buildIdeaSketchOperation,
  validateOperationPlan,
  type IdeaSketchOperationLimits,
} from "./operationSchemas.ts";
import { IDEA_SKETCH_PAGE_OPERATION_KINDS } from "./capabilities.ts";
import type {
  IdeaSketchOperation,
  IdeaSketchOperationInput,
  IdeaSketchOperationOf,
  IdeaSketchPageOperation,
  SdkSyncResult,
} from "./types.ts";
import type { IdeaSketchOperationKind } from "./operationSchemas.ts";

/**
 * Page operations use the same strict envelope as scene operations, but this
 * helper makes the document boundary explicit for callers and adapters.
 */
export function buildIdeaSketchPageOperation<K extends IdeaSketchOperationKind>(
  kind: K,
  input: IdeaSketchOperationInput<K>,
  limits?: Partial<IdeaSketchOperationLimits>,
): SdkSyncResult<IdeaSketchOperationOf<K>>;
export function buildIdeaSketchPageOperation(
  kind: string,
  input: unknown,
  limits?: Partial<IdeaSketchOperationLimits>,
): SdkSyncResult<IdeaSketchPageOperation>;
export function buildIdeaSketchPageOperation(
  kind: string,
  input: unknown,
  limits: Partial<IdeaSketchOperationLimits> = {},
): SdkSyncResult<IdeaSketchPageOperation> {
  if (!IDEA_SKETCH_PAGE_OPERATION_KINDS.includes(kind as never)) {
    return {
      status: "rejected",
      error: {
        code: "unsupported_operation",
        message: `The ${kind} operation is not a Page operation.`,
        retryable: false,
      },
    };
  }
  return buildIdeaSketchOperation(kind as never, input, limits) as SdkSyncResult<IdeaSketchPageOperation>;
}

export function validateIdeaSketchPagePlan(
  operations: unknown,
  limits: Partial<IdeaSketchOperationLimits> = {},
): SdkSyncResult<readonly IdeaSketchPageOperation[]> {
  const validated = validateOperationPlan(operations, limits);
  if (validated.status === "rejected") return validated;
  if (validated.value.some((operation) => !IDEA_SKETCH_PAGE_OPERATION_KINDS.includes(operation.kind as never))) {
    return {
      status: "rejected",
      error: {
        code: "unsupported_operation",
        message: "Page plans may contain only Page operation kinds.",
        retryable: false,
      },
    };
  }
  return { status: "succeeded", value: validated.value as readonly IdeaSketchPageOperation[] };
}

export function isIdeaSketchPageOperation(
  operation: IdeaSketchOperation,
): operation is IdeaSketchPageOperation {
  return IDEA_SKETCH_PAGE_OPERATION_KINDS.includes(operation.kind as never);
}
