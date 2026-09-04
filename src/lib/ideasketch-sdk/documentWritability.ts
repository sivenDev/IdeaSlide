import type { DocumentStatus } from "../../types.ts";

/**
 * These statuses remain editable in memory by the native editor. They do not
 * imply that a filesystem save is currently safe or eligible.
 */
export const IN_MEMORY_EDITABLE_DOCUMENT_STATUSES: readonly DocumentStatus[] = Object.freeze([
  "editable",
  "external-change",
  "conflict",
  "missing",
  "root-missing",
]);

const inMemoryEditableStatuses = new Set<DocumentStatus>(IN_MEMORY_EDITABLE_DOCUMENT_STATUSES);

/**
 * Trusted editor/host callers may update the in-memory model while an
 * external-file state is being surfaced. Agent and future external callers
 * remain restricted to the persistable editable state.
 */
export function isIdeaSketchDocumentWritable(input: {
  documentStatus: DocumentStatus;
  readOnly: boolean;
  servicesWritable?: boolean;
  callerProfile: string;
}): boolean {
  if (input.readOnly || input.servicesWritable === false) return false;
  if (input.callerProfile === "trusted-ui" || input.callerProfile === "host-internal") {
    return inMemoryEditableStatuses.has(input.documentStatus);
  }
  return input.documentStatus === "editable";
}
