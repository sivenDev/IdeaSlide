import {
  sdkCancelled,
  sdkRejected,
  sdkSucceeded,
  type IdeaSketchSdkMutationResult,
  type ReconciliationToken,
  type SdkIndeterminate,
  type SdkResult,
  type SdkSyncResult,
} from "./types.ts";

declare const reservedRequestBrand: unique symbol;
declare const disposalTicketBrand: unique symbol;

export interface ReservedRequestHandle {
  readonly [reservedRequestBrand]: true;
}

interface DisposalTicket {
  readonly [disposalTicketBrand]: true;
}

type MutationResult = SdkResult<IdeaSketchSdkMutationResult>;

export interface RequestReconciliationDescriptor {
  beforeDigest: string;
  expectedAfterDigest: string;
  getLiveDigest: () => Promise<string>;
  createSucceededResult: () => MutationResult;
}

interface LedgerRecord {
  requestId: string;
  payloadDigest: string;
  state: "in-flight" | "terminal" | "indeterminate";
  phase: "host-interaction" | "mutation";
  result?: MutationResult;
  resolve: (result: MutationResult) => void;
  promise: Promise<MutationResult>;
  handle: ReservedRequestHandle;
  composite: boolean;
  compositeConsumed: boolean;
  reconciliation?: RequestReconciliationDescriptor;
  reconciliationToken?: ReconciliationToken;
}

export type RequestReservation =
  | { kind: "reserved"; handle: ReservedRequestHandle }
  | { kind: "joined"; result: Promise<MutationResult> }
  | { kind: "replay"; result: MutationResult };

function createOpaqueToken(prefix: string) {
  return `${prefix}:${globalThis.crypto.randomUUID()}`;
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

export function createRequestLedger({
  sessionId,
  capacity = 512,
}: {
  sessionId: string;
  capacity?: number;
}) {
  const records = new Map<string, LedgerRecord>();
  const handleRecords = new WeakMap<object, LedgerRecord>();
  const reconciliationRecords = new Map<string, LedgerRecord>();
  const disposalTickets = new WeakSet<object>();
  let activeDisposalTicket: DisposalTicket | undefined;
  let closing = false;
  let disposed = false;

  const closedResult = () => sdkRejected("session_closed", "The request ledger is closed.");

  const reserveInternal = (
    input: { requestId: string; payloadDigest: string },
    composite: boolean,
  ): SdkSyncResult<RequestReservation> => {
    if (disposed || closing) return closedResult();
    if (!input.requestId || !input.payloadDigest) {
      return sdkRejected("invalid_request", "A request id and payload digest are required.");
    }
    const existing = records.get(input.requestId);
    if (existing) {
      if (existing.payloadDigest !== input.payloadDigest) {
        return sdkRejected("idempotency_conflict", "The request id was already used for a different payload.");
      }
      if (existing.state === "in-flight") {
        return sdkSucceeded({ kind: "joined", result: existing.promise });
      }
      return sdkSucceeded({ kind: "replay", result: existing.result! });
    }
    if ([...records.values()].some((record) => record.state === "indeterminate")) {
      return sdkRejected(
        "commit_indeterminate",
        "A mutation remains indeterminate and must be reconciled before another mutation can be reserved.",
        true,
      );
    }
    if (records.size >= capacity) {
      return sdkRejected("request_ledger_full", "The request ledger is full.");
    }
    let resolve!: (result: MutationResult) => void;
    const promise = new Promise<MutationResult>((next) => { resolve = next; });
    const handle = Object.freeze({}) as ReservedRequestHandle;
    const record: LedgerRecord = {
      requestId: input.requestId,
      payloadDigest: input.payloadDigest,
      state: "in-flight",
      phase: composite ? "host-interaction" : "mutation",
      resolve,
      promise,
      handle,
      composite,
      compositeConsumed: false,
    };
    records.set(input.requestId, record);
    handleRecords.set(handle, record);
    return sdkSucceeded({ kind: "reserved", handle });
  };

  const getRecord = (handle: ReservedRequestHandle) => handleRecords.get(handle as object);

  const continueIndeterminate = (record: LedgerRecord) => {
    if (record.reconciliationToken) reconciliationRecords.delete(record.reconciliationToken);
    const successor = createOpaqueToken("reconciliation") as ReconciliationToken;
    record.reconciliationToken = successor;
    reconciliationRecords.set(successor, record);
    const result = deepFreeze<SdkIndeterminate>({
      status: "indeterminate",
      error: { code: "commit_indeterminate", message: "The commit remains indeterminate.", retryable: true },
      reconciliationToken: successor,
    });
    record.result = result;
    return result;
  };

  const beginDisposal = (): SdkSyncResult<DisposalTicket> => {
    if (disposed || closing) return closedResult();
    closing = true;
    if ([...records.values()].some((record) => record.state === "indeterminate")) {
      closing = false;
      return sdkRejected(
        "commit_indeterminate",
        "The session has an unresolved indeterminate mutation.",
        true,
      );
    }
    if ([...records.values()].some((record) => (
      record.state === "in-flight" && record.phase === "mutation"
    ))) {
      closing = false;
      return sdkRejected("editor_busy", "The session still has an in-flight mutation.", true);
    }
    const ticket = Object.freeze({}) as DisposalTicket;
    disposalTickets.add(ticket);
    activeDisposalTicket = ticket;
    return sdkSucceeded(ticket);
  };

  const terminalizeHostInteractions = () => {
    for (const record of records.values()) {
      if (record.state !== "in-flight" || record.phase !== "host-interaction") continue;
      const result = deepFreeze(sdkCancelled(
        "The host interaction was cancelled because the session was disposed.",
      ));
      record.state = "terminal";
      record.result = result;
      record.resolve(result);
    }
  };

  const terminalizeHostInteractionsForDisposal = (
    ticket: DisposalTicket,
  ): SdkSyncResult<void> => {
    if (
      !closing
      || activeDisposalTicket !== ticket
      || !disposalTickets.has(ticket as object)
    ) {
      return sdkRejected("invalid_request", "The disposal ticket is invalid.");
    }
    terminalizeHostInteractions();
    return sdkSucceeded(undefined);
  };

  const finishDisposal = (ticket: DisposalTicket): SdkSyncResult<void> => {
    if (
      !closing
      || activeDisposalTicket !== ticket
      || !disposalTickets.has(ticket as object)
    ) {
      return sdkRejected("invalid_request", "The disposal ticket is invalid.");
    }
    activeDisposalTicket = undefined;
    disposalTickets.delete(ticket as object);
    terminalizeHostInteractions();
    disposed = true;
    closing = false;
    records.clear();
    reconciliationRecords.clear();
    return sdkSucceeded(undefined);
  };

  return {
    sessionId,
    lookup(input: { requestId: string; payloadDigest: string }): SdkSyncResult<RequestReservation | undefined> {
      if (disposed || closing) return closedResult();
      const existing = records.get(input.requestId);
      if (!existing) return sdkSucceeded(undefined);
      if (existing.payloadDigest !== input.payloadDigest) {
        return sdkRejected("idempotency_conflict", "The request id was already used for a different payload.");
      }
      if (existing.state === "in-flight") return sdkSucceeded({ kind: "joined", result: existing.promise });
      return sdkSucceeded({ kind: "replay", result: existing.result! });
    },
    reserve(input: { requestId: string; payloadDigest: string }) {
      return reserveInternal(input, false);
    },
    reserveComposite(input: { requestId: string; payloadDigest: string }) {
      return reserveInternal(input, true);
    },
    consumeCompositeReservation(
      handle: ReservedRequestHandle,
      input: { requestId: string },
    ): SdkSyncResult<{ requestId: string; payloadDigest: string }> {
      if (disposed || closing) return closedResult();
      const record = getRecord(handle);
      if (
        !record
        || !record.composite
        || record.requestId !== input.requestId
        || record.state !== "in-flight"
        || record.compositeConsumed
      ) {
        return sdkRejected("invalid_request", "The composite request reservation is invalid or already consumed.");
      }
      record.compositeConsumed = true;
      record.phase = "mutation";
      return sdkSucceeded({ requestId: record.requestId, payloadDigest: record.payloadDigest });
    },
    complete(handle: ReservedRequestHandle, result: MutationResult): SdkSyncResult<void> {
      if (disposed) return closedResult();
      const record = getRecord(handle);
      if (!record || record.state !== "in-flight") {
        return sdkRejected("invalid_request", "The request reservation is not active.");
      }
      if (result.status === "indeterminate") {
        return sdkRejected("invalid_request", "Indeterminate requests must be terminalized with reconciliation state.");
      }
      const frozenResult = deepFreeze(result);
      record.state = "terminal";
      record.result = frozenResult;
      record.resolve(frozenResult);
      return sdkSucceeded(undefined);
    },
    markIndeterminate(
      handle: ReservedRequestHandle,
      reconciliation: RequestReconciliationDescriptor,
    ): SdkIndeterminate {
      const record = getRecord(handle);
      if (disposed || !record || record.state !== "in-flight") {
        return deepFreeze({
          status: "indeterminate",
          error: { code: "commit_indeterminate", message: "The request reservation could not be reconciled.", retryable: false },
          reconciliationToken: createOpaqueToken("reconciliation") as ReconciliationToken,
        });
      }
      record.reconciliation = reconciliation;
      record.state = "indeterminate";
      const result = continueIndeterminate(record);
      record.resolve(result);
      return result;
    },
    getMutationResult(requestId: string): MutationResult {
      if (disposed || closing) return closedResult();
      const record = records.get(requestId);
      if (!record) return sdkRejected("request_not_found", "The mutation request was not found.");
      if (record.state === "in-flight") {
        return sdkRejected("editor_busy", "The mutation request is still in flight.", true);
      }
      return record.result!;
    },
    async reconcile(input: {
      reconciliationToken: ReconciliationToken;
    }): Promise<MutationResult> {
      if (disposed || closing) return closedResult();
      const record = reconciliationRecords.get(input.reconciliationToken);
      const reconciliation = record?.reconciliation;
      if (!record || record.state !== "indeterminate" || !reconciliation) {
        return sdkRejected("request_not_found", "The reconciliation token was not found.");
      }
      reconciliationRecords.delete(input.reconciliationToken);
      if (record.reconciliationToken === input.reconciliationToken) {
        record.reconciliationToken = undefined;
      }
      let liveDigest: string;
      try {
        liveDigest = await reconciliation.getLiveDigest();
      } catch {
        return continueIndeterminate(record);
      }
      if (liveDigest === reconciliation.expectedAfterDigest) {
        let result: MutationResult;
        try {
          result = deepFreeze(reconciliation.createSucceededResult());
        } catch {
          return continueIndeterminate(record);
        }
        if (result.status !== "succeeded") return continueIndeterminate(record);
        record.state = "terminal";
        record.result = result;
        record.reconciliation = undefined;
        return result;
      }
      if (liveDigest === reconciliation.beforeDigest) {
        const result = deepFreeze(sdkRejected(
          "commit_indeterminate",
          "The live state proves that the original commit was not applied.",
          true,
        ));
        record.state = "terminal";
        record.result = result;
        record.reconciliation = undefined;
        return result;
      }
      return continueIndeterminate(record);
    },
    hasInFlight() {
      return [...records.values()].some((record) => record.state === "in-flight");
    },
    hasHostInteractionInFlight() {
      return [...records.values()].some((record) => (
        record.state === "in-flight" && record.phase === "host-interaction"
      ));
    },
    hasIndeterminate() {
      return [...records.values()].some((record) => record.state === "indeterminate");
    },
    beginDisposal,
    terminalizeHostInteractionsForDisposal,
    cancelDisposal(ticket: DisposalTicket) {
      if (
        disposed
        || activeDisposalTicket !== ticket
        || !disposalTickets.has(ticket as object)
      ) return;
      activeDisposalTicket = undefined;
      disposalTickets.delete(ticket as object);
      closing = false;
    },
    finishDisposal,
    dispose(): SdkSyncResult<void> {
      const started = beginDisposal();
      if (started.status === "rejected") return started;
      return finishDisposal(started.value);
    },
  };
}

export type IdeaSketchRequestLedger = ReturnType<typeof createRequestLedger>;
