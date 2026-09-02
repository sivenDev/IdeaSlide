import { canonicalPayloadDigest } from "./canonicalDigest.ts";
import type { IdeaSketchRequestLedger, ReservedRequestHandle } from "./requestLedger.ts";
import {
  sdkCancelled,
  sdkRejected,
  sdkSucceeded,
  type IdeaSketchSdkMutationResult,
  type SdkResult,
  type SdkSyncResult,
} from "./types.ts";

export type IdeaSketchMutationKind = "scene" | "document";

export function createDocumentMutationScheduler() {
  const tails = new Map<string, Promise<void>>();
  return {
    async run<Result>(documentSessionId: string, task: () => Promise<Result>): Promise<Result> {
      const previous = tails.get(documentSessionId) ?? Promise.resolve();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const nextTail = previous.catch(() => undefined).then(() => gate);
      tails.set(documentSessionId, nextTail);
      await previous.catch(() => undefined);
      try {
        return await task();
      } finally {
        release();
        if (tails.get(documentSessionId) === nextTail) tails.delete(documentSessionId);
      }
    },
  };
}

export type DocumentMutationScheduler = ReturnType<typeof createDocumentMutationScheduler>;

export interface IdeaSketchMutationCommitReceipt {
  settlement: PromiseLike<void>;
}

interface MutationResultInput {
  requestId: string;
  kind: IdeaSketchMutationKind;
  beforeDigest: string;
  afterDigest: string;
  beforeEditVersion: number;
  afterEditVersion: number;
}

function defaultMutationResult(input: MutationResultInput): IdeaSketchSdkMutationResult {
  return {
    changeSetId: `change:${input.requestId}`,
    requestId: input.requestId,
    outcome: input.beforeDigest === input.afterDigest ? "noop" : "applied",
    beforeDigest: input.beforeDigest,
    afterDigest: input.afterDigest,
    beforeEditVersion: input.beforeEditVersion,
    afterEditVersion: input.afterEditVersion,
    createdRefs: {},
    updatedRefs: [],
    deletedRefs: [],
    cascadedRefs: [],
    operations: [],
    diagnostics: [],
    history: input.beforeDigest === input.afterDigest
      ? { nativeCanvas: "none", document: "none", agentCustom: "not-supported" }
      : input.kind === "scene"
        ? { nativeCanvas: "created", document: "none", agentCustom: "not-supported" }
        : { nativeCanvas: "none", document: "unavailable", agentCustom: "not-supported" },
  };
}

function normalizeMutationResult(
  input: MutationResultInput,
  createResult?: (input: MutationResultInput) => IdeaSketchSdkMutationResult,
): IdeaSketchSdkMutationResult {
  const result = (createResult ?? defaultMutationResult)(input);
  const noop = input.beforeDigest === input.afterDigest;
  return {
    ...result,
    requestId: input.requestId,
    outcome: noop ? "noop" : "applied",
    beforeDigest: input.beforeDigest,
    afterDigest: input.afterDigest,
    beforeEditVersion: input.beforeEditVersion,
    afterEditVersion: input.afterEditVersion,
    history: noop
      ? { nativeCanvas: "none", document: "none", agentCustom: "not-supported" }
      : input.kind === "scene"
        ? { nativeCanvas: "created", document: "none", agentCustom: "not-supported" }
        : { nativeCanvas: "none", document: "unavailable", agentCustom: "not-supported" },
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" && value !== null) || typeof value === "function"
  ) && "then" in value && typeof value.then === "function";
}

export interface ExecuteSdkMutationInput<State> {
  kind: IdeaSketchMutationKind;
  documentSessionId: string;
  requestId: string;
  payload: unknown;
  scheduler: DocumentMutationScheduler;
  ledger: IdeaSketchRequestLedger;
  reservedRequestHandle?: ReservedRequestHandle;
  signal?: AbortSignal;
  beforeExecute?: () => SdkSyncResult<void>;
  readState: () => State;
  cloneState?: (state: State) => State;
  computeDigest: (state: State) => Promise<string>;
  authorize?: (state: State) => boolean;
  validateSnapshot?: (state: State) => boolean;
  prepare: (state: State) => Promise<State> | State;
  validatePostconditions?: (state: State) => boolean;
  finalValidate: (before: State) => SdkSyncResult<void>;
  commit: (state: State) => void | IdeaSketchMutationCommitReceipt;
  getEditVersion: () => number;
  createResult?: (input: MutationResultInput) => IdeaSketchSdkMutationResult;
}

export async function executeSdkMutation<State>(
  input: ExecuteSdkMutationInput<State>,
): Promise<SdkResult<IdeaSketchSdkMutationResult>> {
  return input.scheduler.run(input.documentSessionId, async () => {
    const cloneState = input.cloneState ?? ((state: State) => structuredClone(state));
    let handle = input.reservedRequestHandle;
    if (handle) {
      const consumed = input.ledger.consumeCompositeReservation(handle, { requestId: input.requestId });
      if (consumed.status === "rejected") return consumed;
    } else {
      let payloadDigest: string;
      try {
        payloadDigest = await canonicalPayloadDigest(input.payload);
      } catch {
        return sdkRejected("invalid_request", "The mutation payload must be strict JSON data.");
      }
      const reservation = input.ledger.reserve({ requestId: input.requestId, payloadDigest });
      if (reservation.status === "rejected") return reservation;
      if (reservation.value.kind === "joined") return reservation.value.result;
      if (reservation.value.kind === "replay") return reservation.value.result;
      handle = reservation.value.handle;
    }

    const finish = (result: SdkResult<IdeaSketchSdkMutationResult>) => {
      const completed = input.ledger.complete(handle!, result);
      return completed.status === "succeeded"
        ? result
        : sdkRejected("internal_error", "The mutation request could not be terminalized safely.");
    };
    if (input.beforeExecute) {
      let guard: SdkSyncResult<void>;
      try {
        guard = input.beforeExecute();
      } catch {
        return finish(sdkRejected("internal_error", "The mutation request guard failed."));
      }
      if (guard.status === "rejected") return finish(guard);
    }
    if (input.signal?.aborted) return finish(sdkCancelled());

    let before: State;
    let beforeDigest: string;
    let beforeEditVersion: number;
    try {
      before = cloneState(input.readState());
      if (input.authorize && !input.authorize(before)) {
        return finish(sdkRejected("capability_denied", "The caller is not authorized for this mutation."));
      }
      if (input.validateSnapshot && !input.validateSnapshot(before)) {
        return finish(sdkRejected("snapshot_stale", "The mutation snapshot is stale.", true));
      }
      beforeDigest = await input.computeDigest(before);
      beforeEditVersion = input.getEditVersion();
    } catch {
      return finish(sdkRejected("internal_error", "The mutation target could not be read safely.", true));
    }

    let next: State;
    try {
      next = await input.prepare(cloneState(before));
    } catch (error) {
      if (input.signal?.aborted || isAbortError(error)) return finish(sdkCancelled());
      if (
        typeof error === "object"
        && error !== null
        && "code" in error
        && typeof (error as { code?: unknown }).code === "string"
      ) {
        const details = error as { code: string; message?: unknown; retryable?: unknown };
        const knownCodes = new Set([
          "invalid_request", "internal_error", "protocol_mismatch", "unsupported_operation", "capability_denied",
          "confirmation_required", "editor_unavailable", "desktop_unavailable", "editor_busy", "session_closed",
          "presentation_session_not_found", "read_only", "snapshot_required", "snapshot_stale", "incomplete_read",
          "target_not_found", "cross_page_target", "relation_conflict", "locked_target", "limit_exceeded",
          "import_token_expired", "request_not_found", "idempotency_conflict", "request_ledger_full",
          "cancelled_before_commit", "external_change", "commit_indeterminate",
        ]);
        if (knownCodes.has(details.code)) {
          return finish(sdkRejected(
            details.code as Parameters<typeof sdkRejected>[0],
            typeof details.message === "string" ? details.message : "The mutation plan was rejected.",
            details.retryable === true,
          ));
        }
      }
      return finish(sdkRejected("invalid_request", "The mutation plan could not be prepared."));
    }

    let expectedAfterDigest: string;
    try {
      if (input.validatePostconditions && !input.validatePostconditions(next)) {
        return finish(sdkRejected("relation_conflict", "The mutation postconditions failed."));
      }
      expectedAfterDigest = await input.computeDigest(next);
    } catch {
      return finish(sdkRejected("internal_error", "The mutation result could not be validated."));
    }
    if (input.signal?.aborted) return finish(sdkCancelled());

    let finalGuard: SdkSyncResult<void>;
    try {
      finalGuard = input.finalValidate(before);
    } catch {
      return finish(sdkRejected("internal_error", "The final mutation guard could not be evaluated.", true));
    }
    if (
      !finalGuard
      || typeof finalGuard !== "object"
      || (finalGuard.status !== "succeeded" && finalGuard.status !== "rejected")
    ) {
      return finish(sdkRejected("internal_error", "The final mutation guard returned an invalid result.", true));
    }
    if (finalGuard.status === "rejected") return finish(finalGuard);
    if (input.signal?.aborted) return finish(sdkCancelled());

    const readLiveDigest = async () => input.computeDigest(cloneState(input.readState()));
    const createSucceededResult = () => sdkSucceeded(normalizeMutationResult({
      requestId: input.requestId,
      kind: input.kind,
      beforeDigest,
      afterDigest: expectedAfterDigest,
      beforeEditVersion,
      afterEditVersion: input.getEditVersion(),
    }, input.createResult));
    const markIndeterminate = () => input.ledger.markIndeterminate(handle!, {
      beforeDigest,
      expectedAfterDigest,
      getLiveDigest: readLiveDigest,
      createSucceededResult,
    });

    if (expectedAfterDigest === beforeDigest) {
      try {
        return finish(sdkSucceeded(normalizeMutationResult({
          requestId: input.requestId,
          kind: input.kind,
          beforeDigest,
          afterDigest: beforeDigest,
          beforeEditVersion,
          afterEditVersion: beforeEditVersion,
        }, input.createResult)));
      } catch {
        return finish(sdkRejected("internal_error", "The no-op mutation result could not be created."));
      }
    }

    const classifyCommitFailure = async () => {
      try {
        const liveDigest = await readLiveDigest();
        if (liveDigest === expectedAfterDigest) {
          try {
            return finish(createSucceededResult());
          } catch {
            return markIndeterminate();
          }
        }
        if (liveDigest === beforeDigest) {
          return finish(sdkRejected("internal_error", "The host rejected the mutation before it was applied.", true));
        }
      } catch {
        // The commit boundary cannot be observed safely, so reconciliation owns the result.
      }
      return markIndeterminate();
    };

    if (Object.prototype.toString.call(input.commit) === "[object AsyncFunction]") {
      return finish(sdkRejected(
        "internal_error",
        "The host commit adapter must initiate its write synchronously.",
        true,
      ));
    }

    let commitReceipt: void | IdeaSketchMutationCommitReceipt;
    try {
      commitReceipt = input.commit(next);
    } catch {
      return classifyCommitFailure();
    }

    if (commitReceipt !== undefined) {
      try {
        if (isPromiseLike(commitReceipt)) {
          void Promise.resolve(commitReceipt).catch(() => undefined);
          return markIndeterminate();
        }
        if (
          typeof commitReceipt !== "object"
          || commitReceipt === null
          || !("settlement" in commitReceipt)
          || !isPromiseLike(commitReceipt.settlement)
        ) {
          return markIndeterminate();
        }
        try {
          await commitReceipt.settlement;
        } catch {
          return classifyCommitFailure();
        }
      } catch {
        return markIndeterminate();
      }
    }

    let afterDigest: string;
    try {
      afterDigest = await readLiveDigest();
    } catch {
      return markIndeterminate();
    }
    if (afterDigest !== expectedAfterDigest) {
      if (afterDigest === beforeDigest) {
        return finish(sdkRejected("internal_error", "The host did not apply the mutation.", true));
      }
      return markIndeterminate();
    }
    try {
      return finish(createSucceededResult());
    } catch {
      return markIndeterminate();
    }
  });
}
