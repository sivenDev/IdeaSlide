export function createDocumentSession(file) {
  const sessionId = file.mode === "workspace"
    ? `workspace:${file.workspaceId}:${file.path}`
    : `standalone:${file.id ?? file.path}`;
  return {
    ...file,
    sessionId,
    originalContent: structuredClone(file.content),
    dirty: false,
    status: file.readOnly ? "read-only" : "clean",
    revision: 1,
    sourceFingerprint: `opened-${Date.now()}`,
    error: null,
    conflict: Boolean(file.conflict),
    missing: Boolean(file.missing),
    recoveryAvailable: Boolean(file.recoveryAvailable),
  };
}

export function updateSessionContent(session, content) {
  return {
    ...session,
    content,
    dirty: true,
    status: session.readOnly ? "read-only" : "dirty",
    revision: session.revision + 1,
    error: null,
  };
}

export function discardSession(session) {
  return {
    ...session,
    content: structuredClone(session.originalContent),
    dirty: false,
    status: session.readOnly ? "read-only" : "clean",
    revision: session.revision + 1,
    error: null,
  };
}

export function savedSession(session, result) {
  return {
    ...session,
    originalContent: structuredClone(session.content),
    dirty: false,
    status: session.readOnly ? "read-only" : "clean",
    revision: session.revision + 1,
    sourceFingerprint: result.fingerprint,
    savedAt: result.savedAt,
    error: null,
  };
}

export function documentCondition(session) {
  if (!session) return { label: "Welcome", tone: "neutral" };
  if (session.missing) return { label: "Missing", tone: "danger" };
  if (session.conflict) return { label: "External conflict", tone: "danger" };
  if (session.recoveryAvailable) return { label: "Recovery available", tone: "warning" };
  if (session.status === "saving") return { label: "Saving simulated copy", tone: "progress" };
  if (session.status === "error") return { label: session.error || "Save failed", tone: "danger" };
  if (session.readOnly) return { label: "Read-only mock", tone: "warning" };
  if (session.dirty) return { label: "Unsaved changes", tone: "dirty" };
  return { label: "Saved in mock workspace", tone: "clean" };
}
