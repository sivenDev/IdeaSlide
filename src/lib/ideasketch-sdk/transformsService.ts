import { buildIdeaSketchOperation } from "./operationSchemas.ts";
import {
  sdkRejected,
  sdkSucceeded,
  type DocumentSnapshotId,
  type ElementRef,
  type IdeaSketchConvertSelectionStyleInput,
  type IdeaSketchSdkMutationResult,
  type IdeaSketchSdkScope,
  type IdeaSketchSceneReadResult,
  type IdeaSketchSceneApplyPlanInput,
  type IdeaSketchPageApplyPlanInput,
  type IdeaSketchSceneNamespace,
  type IdeaSketchPagesNamespace,
  type SceneSnapshotId,
  type SdkResult,
} from "./types.ts";

export interface IdeaSketchTransformsServiceInput {
  isActive: () => boolean;
  getScopes: () => readonly IdeaSketchSdkScope[];
  isMethodAvailable: (namespace: string, method: string) => boolean;
  scene: Pick<IdeaSketchSceneNamespace, "getElements" | "applyPlan">;
  pages: Pick<IdeaSketchPagesNamespace, "applyPlan">;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function strictObject(value: unknown): Record<string, unknown> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  try {
    const prototype = Object.getPrototypeOf(record);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(record)) {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (typeof key !== "string" || !descriptor?.enumerable || !("value" in descriptor)) return undefined;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return undefined;
  }
}

function unknownFields(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function opaque(value: unknown, prefix: string): value is string {
  return typeof value === "string"
    && value.startsWith(prefix)
    && value.length > prefix.length
    && !/[\u0000-\u0020\u007f]/.test(value);
}

function parseRefs(value: unknown): SdkResult<readonly ElementRef[]> {
  if (!Array.isArray(value) || value.some((ref) => typeof ref !== "string" || !opaque(ref, "element:"))) {
    return sdkRejected("invalid_request", "selectedRefs must contain only ElementRef values.");
  }
  if (new Set(value).size !== value.length) return sdkRejected("invalid_request", "selectedRefs must not contain duplicates.");
  if (value.length === 0) return sdkRejected("invalid_request", "selectedRefs must not be empty.");
  return sdkSucceeded(Object.freeze([...value].sort()) as readonly ElementRef[]);
}

function parseInput(rawInput: unknown): SdkResult<IdeaSketchConvertSelectionStyleInput> {
  const input = strictObject(rawInput);
  if (!input) return sdkRejected("invalid_request", "Transform options must be an object.");
  const unknown = unknownFields(input, ["requestId", "snapshotId", "selectedRefs", "target", "preset", "documentSnapshotId", "signal"]);
  if (unknown.length > 0) return sdkRejected("invalid_request", `Unknown transform option field(s): ${unknown.join(", ")}.`);
  if (typeof input.requestId !== "string" || input.requestId.trim().length === 0) return sdkRejected("invalid_request", "requestId must be a non-empty string.");
  if (!opaque(input.snapshotId, "scene-snapshot:")) return sdkRejected("invalid_request", "snapshotId is malformed.");
  const refs = parseRefs(input.selectedRefs);
  if (refs.status !== "succeeded") return refs;
  if (input.target !== "current-page" && input.target !== "new-page") return sdkRejected("invalid_request", "target must be current-page or new-page.");
  if (input.preset !== "formal") return sdkRejected("unsupported_operation", "Only the formal style preset is supported.");
  if (input.target === "new-page" && !opaque(input.documentSnapshotId, "document-snapshot:")) return sdkRejected("invalid_request", "documentSnapshotId is required when target is new-page.");
  if (input.target === "current-page" && input.documentSnapshotId !== undefined) return sdkRejected("invalid_request", "documentSnapshotId is only valid when target is new-page.");
  if (input.signal !== undefined && !(typeof input.signal === "object" && input.signal !== null && typeof (input.signal as AbortSignal).aborted === "boolean" && typeof (input.signal as AbortSignal).addEventListener === "function")) return sdkRejected("invalid_request", "signal must be an AbortSignal.");
  return sdkSucceeded({
    requestId: input.requestId,
    snapshotId: input.snapshotId as SceneSnapshotId,
    selectedRefs: refs.value,
    target: input.target,
    preset: "formal",
    ...(input.documentSnapshotId !== undefined ? { documentSnapshotId: input.documentSnapshotId as DocumentSnapshotId } : {}),
    ...(input.signal !== undefined ? { signal: input.signal as AbortSignal } : {}),
  });
}

function guard<Value>(input: IdeaSketchTransformsServiceInput, namespace: string, method: string): SdkResult<Value> | undefined {
  if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
  if (!input.getScopes().includes("scene.write")) return sdkRejected("capability_denied", "The caller cannot transform the scene.");
  if (!input.isMethodAvailable(namespace, method)) return sdkRejected("unsupported_operation", `The ${namespace}.${method} method is not available.`);
  return undefined;
}

function mutationReady(scene: IdeaSketchSceneReadResult, refs: readonly ElementRef[]) {
  const ready = new Set(scene.coverage.mutationReadyRefs.map(String));
  const identity = new Set(scene.coverage.identityRefs.map(String));
  for (const ref of refs) {
    if (!identity.has(ref)) return sdkRejected("incomplete_read", `The target ${ref} is not covered by the scene snapshot.`);
    if (!ready.has(ref)) return sdkRejected("incomplete_read", `The target ${ref} is not mutation-ready; read its complete relation closure first.`);
    const element = scene.elements.find((candidate) => candidate.ref === ref);
    if (!element || element.deleted) return sdkRejected("target_not_found", `The target ${ref} does not exist.`);
    if (!element.relationsComplete || element.relationsMalformed) return sdkRejected("incomplete_read", `The relation closure for ${ref} is incomplete.`);
    if (element.isCamera) return sdkRejected("unsupported_operation", "Camera refs cannot be transformed by the style preset.");
  }
  return sdkSucceeded(undefined);
}

export function createIdeaSketchTransformsService(input: IdeaSketchTransformsServiceInput) {
  async function convertSelectionStyle(rawInput: unknown): Promise<SdkResult<IdeaSketchSdkMutationResult>> {
    try {
      const unavailable = guard<IdeaSketchSdkMutationResult>(input, "transforms", "convertSelectionStyle");
      if (unavailable) return unavailable;
      const parsed = parseInput(rawInput);
      if (parsed.status !== "succeeded") return parsed;
      const options = parsed.value;
      const expanded = await input.scene.getElements({ snapshotId: options.snapshotId, refs: options.selectedRefs });
      if (expanded.status !== "succeeded") return expanded;
      const ready = mutationReady(expanded.value, options.selectedRefs);
      if (ready.status === "rejected") return ready;
      if (options.target === "current-page") {
        const operation = buildIdeaSketchOperation("apply-style-preset", {
          selectedRefs: options.selectedRefs,
          preset: options.preset,
        });
        if (operation.status === "rejected") return operation;
        const plan: IdeaSketchSceneApplyPlanInput = {
          requestId: options.requestId,
          snapshotId: options.snapshotId,
          operations: [operation.value],
          ...(options.signal ? { signal: options.signal } : {}),
        };
        return input.scene.applyPlan(plan);
      }
      if (!options.documentSnapshotId) return sdkRejected("invalid_request", "documentSnapshotId is required when target is new-page.");
      if (!input.getScopes().includes("document.structure.write")) return sdkRejected("capability_denied", "The caller cannot create a Page from the selection.");
      if (!input.isMethodAvailable("pages", "applyPlan")) return sdkRejected("unsupported_operation", "The pages.applyPlan method is not available.");
      const operation = buildIdeaSketchOperation("create-page-from-selection", {
        ref: `temp:transform-${options.requestId}`,
        sourcePageRef: expanded.value.pageRef,
        selectedRefs: options.selectedRefs,
        preset: options.preset,
      });
      if (operation.status === "rejected") return operation;
      const plan: IdeaSketchPageApplyPlanInput = {
        requestId: options.requestId,
        documentSnapshotId: options.documentSnapshotId,
        sceneSnapshotId: options.snapshotId,
        operations: [operation.value as Extract<IdeaSketchPageApplyPlanInput["operations"][number], { kind: "create-page-from-selection" }>],
        ...(options.signal ? { signal: options.signal } : {}),
      };
      return input.pages.applyPlan(plan);
    } catch {
      return sdkRejected("internal_error", "The selection transform could not be applied safely.", true);
    }
  }

  return { convertSelectionStyle };
}
