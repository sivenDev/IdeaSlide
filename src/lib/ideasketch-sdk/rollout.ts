import { sdkRejected, sdkSucceeded, type SdkResult, type SdkSyncResult } from "./types.ts";

export type IdeaSketchRolloutImplementation = "sdk" | "legacy";
export type IdeaSketchRolloutNamespace =
  | "pages"
  | "scene"
  | "cameras"
  | "selection"
  | "view"
  | "transforms"
  | "presentation"
  | "io"
  | "events";

export interface IdeaSketchRolloutSelection {
  callerId: string;
  namespace: IdeaSketchRolloutNamespace;
  implementation: IdeaSketchRolloutImplementation;
  fallbackAllowed: boolean;
  selectedAt: number;
}

export interface IdeaSketchRolloutMutationGate {
  readonly callerId: string;
  readonly namespace: IdeaSketchRolloutNamespace;
  readonly implementation: IdeaSketchRolloutImplementation;
  readonly scheduled: boolean;
  readonly committed: boolean;
}

export interface IdeaSketchRolloutDiagnostic {
  readonly type: "selected" | "fallback-rejected" | "mixed-path-rejected";
  readonly callerId: string;
  readonly namespace: IdeaSketchRolloutNamespace;
  readonly implementation?: IdeaSketchRolloutImplementation;
  readonly message: string;
  readonly at: number;
}

export interface IdeaSketchRolloutController {
  select(input: {
    callerId: string;
    namespace: IdeaSketchRolloutNamespace;
    sdkAvailable: boolean;
    legacyAvailable?: boolean;
    allowLegacyFallback?: boolean;
  }): SdkSyncResult<IdeaSketchRolloutSelection>;
  beginMutation(selection: IdeaSketchRolloutSelection): SdkSyncResult<IdeaSketchRolloutMutationGate>;
  markScheduled(gate: IdeaSketchRolloutMutationGate): SdkResult<IdeaSketchRolloutMutationGate>;
  markCommitted(gate: IdeaSketchRolloutMutationGate): SdkResult<IdeaSketchRolloutMutationGate>;
  fallback(selection: IdeaSketchRolloutSelection, gate?: IdeaSketchRolloutMutationGate): SdkSyncResult<IdeaSketchRolloutSelection>;
  diagnostics(): readonly IdeaSketchRolloutDiagnostic[];
}

const MAX_DIAGNOSTICS = 64;
const NAMESPACES = new Set<IdeaSketchRolloutNamespace>(["pages", "scene", "cameras", "selection", "view", "transforms", "presentation", "io", "events"]);

function keyFor(callerId: string, namespace: IdeaSketchRolloutNamespace) {
  return `${callerId}\u0000${namespace}`;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !/[\u0000-\u0020\u007f]/.test(value);
}

export function createIdeaSketchRolloutController(now: () => number = () => Date.now()): IdeaSketchRolloutController {
  const selections = new Map<string, IdeaSketchRolloutSelection>();
  const records: IdeaSketchRolloutDiagnostic[] = [];
  const report = (diagnostic: IdeaSketchRolloutDiagnostic) => {
    records.push(Object.freeze(diagnostic));
    if (records.length > MAX_DIAGNOSTICS) records.splice(0, records.length - MAX_DIAGNOSTICS);
  };

  function select(input: {
    callerId: string;
    namespace: IdeaSketchRolloutNamespace;
    sdkAvailable: boolean;
    legacyAvailable?: boolean;
    allowLegacyFallback?: boolean;
  }): SdkSyncResult<IdeaSketchRolloutSelection> {
    if (!validId(input.callerId)) return sdkRejected("invalid_request", "A rollout caller id is required.");
    if (!NAMESPACES.has(input.namespace)) return sdkRejected("invalid_request", "The rollout namespace is invalid.");
    if (typeof input.sdkAvailable !== "boolean" || (input.legacyAvailable !== undefined && typeof input.legacyAvailable !== "boolean")) {
      return sdkRejected("invalid_request", "Rollout availability flags must be boolean.");
    }
    const key = keyFor(input.callerId, input.namespace);
    const existing = selections.get(key);
    const implementation: IdeaSketchRolloutImplementation | undefined = input.sdkAvailable
      ? "sdk"
      : input.allowLegacyFallback && input.legacyAvailable
        ? "legacy"
        : undefined;
    if (!implementation) return sdkRejected("unsupported_operation", `No IdeaSketch implementation is available for ${input.namespace}.`);
    if (existing && existing.implementation !== implementation) {
      const message = `The ${input.namespace} namespace already selected ${existing.implementation}; mixed rollout paths are forbidden.`;
      report({ type: "mixed-path-rejected", callerId: input.callerId, namespace: input.namespace, message, at: now() });
      return sdkRejected("editor_busy", message, true);
    }
    const selection = existing ?? Object.freeze({
      callerId: input.callerId,
      namespace: input.namespace,
      implementation,
      fallbackAllowed: Boolean(input.allowLegacyFallback && input.legacyAvailable),
      selectedAt: now(),
    });
    selections.set(key, selection);
    if (!existing) report({ type: "selected", callerId: input.callerId, namespace: input.namespace, implementation, message: `Selected ${implementation} implementation for ${input.namespace}.`, at: selection.selectedAt });
    return sdkSucceeded(selection);
  }

  function beginMutation(selection: IdeaSketchRolloutSelection): SdkSyncResult<IdeaSketchRolloutMutationGate> {
    if (!selections.has(keyFor(selection.callerId, selection.namespace))) return sdkRejected("invalid_request", "The rollout selection is not registered.");
    return sdkSucceeded(Object.freeze({ ...selection, scheduled: false, committed: false }));
  }

  function markScheduled(gate: IdeaSketchRolloutMutationGate): SdkResult<IdeaSketchRolloutMutationGate> {
    if (gate.committed) return sdkRejected("invalid_request", "A committed rollout mutation cannot be rescheduled.");
    return sdkSucceeded(Object.freeze({ ...gate, scheduled: true }));
  }

  function markCommitted(gate: IdeaSketchRolloutMutationGate): SdkResult<IdeaSketchRolloutMutationGate> {
    if (!gate.scheduled) return sdkRejected("invalid_request", "A rollout mutation must be scheduled before commit.");
    return sdkSucceeded(Object.freeze({ ...gate, committed: true }));
  }

  function fallback(selection: IdeaSketchRolloutSelection, gate?: IdeaSketchRolloutMutationGate): SdkSyncResult<IdeaSketchRolloutSelection> {
    if (gate?.scheduled || gate?.committed) return sdkRejected("editor_busy", "Rollout fallback is only allowed before mutation scheduling.", true);
    const key = keyFor(selection.callerId, selection.namespace);
    const current = selections.get(key);
    if (!current || current.implementation !== "sdk" || !current.fallbackAllowed) return sdkRejected("unsupported_operation", "Legacy rollout fallback is not enabled.");
    const next = Object.freeze({ ...current, implementation: "legacy", selectedAt: now() });
    selections.set(key, next);
    report({ type: "selected", callerId: next.callerId, namespace: next.namespace, implementation: "legacy", message: `Selected legacy implementation for ${next.namespace} before mutation scheduling.`, at: next.selectedAt });
    return sdkSucceeded(next);
  }

  return { select, beginMutation, markScheduled, markCommitted, fallback, diagnostics: () => Object.freeze([...records]) };
}
