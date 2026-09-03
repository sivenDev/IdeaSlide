import {
  sdkRejected,
  sdkSucceeded,
  type DocumentSnapshotId,
  type SceneSnapshotId,
  type SdkSyncResult,
  type SnapshotCursor,
} from "./types.ts";

interface SnapshotTarget {
  documentId: string;
  digest: string;
  editVersion: number;
  nativeInteractionEpoch: number;
  revision?: number;
  documentStatus?: string;
  sourceMarker?: string;
  pageId?: string;
}

interface SnapshotRecord extends SnapshotTarget {
  identityRefs: string[];
  mutationReadyRefs: string[];
  complete: boolean;
}

export interface SceneSnapshotReceipt {
  snapshotId: SceneSnapshotId;
  identityRefs: readonly string[];
  mutationReadyRefs: readonly string[];
  complete: boolean;
}

export interface DocumentSnapshotReceipt {
  snapshotId: DocumentSnapshotId;
  identityRefs: readonly string[];
  complete: boolean;
}

function createOpaqueId(prefix: string) {
  return `${prefix}:${globalThis.crypto.randomUUID()}`;
}

function mergeRefs(current: readonly string[], additions: readonly string[]) {
  return [...new Set([...current, ...additions])].sort();
}

function sceneReceipt(snapshotId: SceneSnapshotId, record: SnapshotRecord): SceneSnapshotReceipt {
  return {
    snapshotId,
    identityRefs: Object.freeze([...record.identityRefs]),
    mutationReadyRefs: Object.freeze([...record.mutationReadyRefs]),
    complete: record.complete,
  };
}

export function createSnapshotStore({ sessionId }: { sessionId: string }) {
  const scenes = new Map<string, SnapshotRecord>();
  const documents = new Map<string, SnapshotRecord>();
  const cursors = new Map<string, { kind: "scene" | "document"; snapshotId: string; offset: number }>();
  let disposed = false;

  const ensureActive = (): SdkSyncResult<void> => disposed
    ? sdkRejected("session_closed", "The snapshot session is closed.")
    : sdkSucceeded(undefined);

  const validateTarget = (record: SnapshotRecord, target: SnapshotTarget) => (
    record.documentId === target.documentId
    && record.pageId === target.pageId
    && record.digest === target.digest
    && record.editVersion === target.editVersion
    && record.nativeInteractionEpoch === target.nativeInteractionEpoch
    && record.revision === target.revision
    && record.documentStatus === target.documentStatus
    && record.sourceMarker === target.sourceMarker
  );

  return {
    sessionId,
    issueScene(input: SnapshotTarget & {
      pageId: string;
      identityRefs?: readonly string[];
      mutationReadyRefs?: readonly string[];
      complete?: boolean;
      busy?: boolean;
    }): SdkSyncResult<SceneSnapshotReceipt> {
      const active = ensureActive();
      if (active.status === "rejected") return active;
      if (input.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
      const snapshotId = createOpaqueId("scene-snapshot") as SceneSnapshotId;
      const record: SnapshotRecord = {
        documentId: input.documentId,
        pageId: input.pageId,
        digest: input.digest,
        editVersion: input.editVersion,
        nativeInteractionEpoch: input.nativeInteractionEpoch,
        revision: input.revision,
        documentStatus: input.documentStatus,
        sourceMarker: input.sourceMarker,
        identityRefs: mergeRefs([], input.identityRefs ?? []),
        mutationReadyRefs: mergeRefs([], input.mutationReadyRefs ?? []),
        complete: Boolean(input.complete),
      };
      scenes.set(snapshotId, record);
      return sdkSucceeded(sceneReceipt(snapshotId, record));
    },
    extendSceneCoverage(input: {
      snapshotId: SceneSnapshotId;
      identityRefs?: readonly string[];
      mutationReadyRefs?: readonly string[];
      complete?: boolean;
    }): SdkSyncResult<SceneSnapshotReceipt> {
      const active = ensureActive();
      if (active.status === "rejected") return active;
      const record = scenes.get(input.snapshotId);
      if (!record) return sdkRejected("snapshot_required", "The scene snapshot does not exist.");
      record.identityRefs = mergeRefs(record.identityRefs, input.identityRefs ?? []);
      record.mutationReadyRefs = mergeRefs(record.mutationReadyRefs, input.mutationReadyRefs ?? []);
      record.complete = record.complete || Boolean(input.complete);
      return sdkSucceeded(sceneReceipt(input.snapshotId, record));
    },
    getScene(snapshotId: SceneSnapshotId, target: SnapshotTarget & { pageId: string }): SdkSyncResult<SceneSnapshotReceipt> {
      const active = ensureActive();
      if (active.status === "rejected") return active;
      const record = scenes.get(snapshotId);
      if (!record) return sdkRejected("snapshot_required", "The scene snapshot does not exist.");
      if (!validateTarget(record, target)) return sdkRejected("snapshot_stale", "The scene snapshot is stale.", true);
      return sdkSucceeded(sceneReceipt(snapshotId, record));
    },
    issueDocument(input: SnapshotTarget & { identityRefs?: readonly string[]; complete?: boolean; busy?: boolean }): SdkSyncResult<DocumentSnapshotReceipt> {
      const active = ensureActive();
      if (active.status === "rejected") return active;
      if (input.busy) return sdkRejected("editor_busy", "A native editor interaction is in progress.", true);
      const snapshotId = createOpaqueId("document-snapshot") as DocumentSnapshotId;
      const record: SnapshotRecord = {
        ...input,
        identityRefs: mergeRefs([], input.identityRefs ?? []),
        mutationReadyRefs: [],
        complete: Boolean(input.complete),
      };
      documents.set(snapshotId, record);
      return sdkSucceeded({
        snapshotId,
        identityRefs: Object.freeze([...record.identityRefs]),
        complete: record.complete,
      });
    },
    extendDocumentCoverage(input: {
      snapshotId: DocumentSnapshotId;
      identityRefs?: readonly string[];
      complete?: boolean;
    }): SdkSyncResult<DocumentSnapshotReceipt> {
      const active = ensureActive();
      if (active.status === "rejected") return active;
      const record = documents.get(input.snapshotId);
      if (!record) return sdkRejected("snapshot_required", "The document snapshot does not exist.");
      record.identityRefs = mergeRefs(record.identityRefs, input.identityRefs ?? []);
      record.complete = record.complete || Boolean(input.complete);
      return sdkSucceeded({
        snapshotId: input.snapshotId,
        identityRefs: Object.freeze([...record.identityRefs]),
        complete: record.complete,
      });
    },
    getDocument(snapshotId: DocumentSnapshotId, target: SnapshotTarget): SdkSyncResult<DocumentSnapshotReceipt> {
      const active = ensureActive();
      if (active.status === "rejected") return active;
      const record = documents.get(snapshotId);
      if (!record) return sdkRejected("snapshot_required", "The document snapshot does not exist.");
      if (!validateTarget(record, target)) return sdkRejected("snapshot_stale", "The document snapshot is stale.", true);
      return sdkSucceeded({
        snapshotId,
        identityRefs: Object.freeze([...record.identityRefs]),
        complete: record.complete,
      });
    },
    issueCursor(kind: "scene" | "document", snapshotId: SceneSnapshotId | DocumentSnapshotId, offset: number): SdkSyncResult<SnapshotCursor> {
      const active = ensureActive();
      if (active.status === "rejected") return active;
      const exists = kind === "scene" ? scenes.has(snapshotId) : documents.has(snapshotId);
      if (!exists || !Number.isInteger(offset) || offset < 0) {
        return sdkRejected("invalid_request", "The snapshot cursor request is invalid.");
      }
      const cursor = createOpaqueId("snapshot-cursor") as SnapshotCursor;
      cursors.set(cursor, { kind, snapshotId, offset });
      return sdkSucceeded(cursor);
    },
    resolveCursor(cursor: SnapshotCursor) {
      const active = ensureActive();
      if (active.status === "rejected") return active;
      const value = cursors.get(cursor);
      return value ? sdkSucceeded({ ...value }) : sdkRejected("snapshot_required", "The snapshot cursor does not exist.");
    },
    invalidateAll() {
      scenes.clear();
      documents.clear();
      cursors.clear();
    },
    dispose() {
      disposed = true;
      scenes.clear();
      documents.clear();
      cursors.clear();
    },
  };
}
