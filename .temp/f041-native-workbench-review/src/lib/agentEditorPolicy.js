export function editorToolDecision(document, editorAdapter) {
  if (!editorAdapter) return { ok: false, detail: "The active editor adapter is unavailable." };
  if (document?.readOnly || document?.conflict || document?.missing) return { ok: false, detail: "The active document is protected from Agent edits." };
  return { ok: true, detail: "Editor Tool may run." };
}
