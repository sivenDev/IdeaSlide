export const reviewScenarios = [
  { id: "normal", group: "Baseline", label: "Normal workspace", description: "Reset all fixtures, failures, document patches, and review preferences." },
  { id: "window-macos-fullscreen", group: "Window", label: "macOS Fullscreen", description: "Hide macOS traffic lights and reclaim the left titlebar area.", windowState: { platform: "macos", fullscreen: true } },
  { id: "window-windows-windowed", group: "Window", label: "Windows Windowed", description: "Reserve the Windows caption-button area on the right.", windowState: { platform: "windows", fullscreen: false } },
  { id: "read-only", group: "Filesystem", label: "Read-only document", description: "Protect the active document while keeping its Workspace writable." },
  { id: "save-failure", group: "Filesystem", label: "Save failure", description: "The next manual or automatic document save fails and writes mock recovery." },
  { id: "metadata-failure", group: "Filesystem", label: "Workspace-state warning", description: "Document save succeeds while simulated Workspace metadata persistence warns." },
  { id: "external-clean", group: "External changes", label: "External change · clean", description: "Mark the active clean source as externally modified and offer reload." },
  { id: "external-dirty", group: "External changes", label: "External change · dirty", description: "Protect a dirty document behind an explicit conflict decision." },
  { id: "renamed", group: "External changes", label: "File renamed", description: "Simulate a watcher reporting that the active file moved to a new path." },
  { id: "missing-file", group: "External changes", label: "File deleted", description: "Make the active file missing without silently discarding its session." },
  { id: "missing-root", group: "External changes", label: "Workspace root missing", description: "Expose a concrete missing-root status in Workspaces." },
  { id: "recovery", group: "Recovery", label: "Recovery available", description: "Offer Restore or Discard for a deterministic unsaved recovery draft." },
  { id: "recovery-corrupt", group: "Recovery", label: "Corrupt recovery", description: "Show an actionable recovery error while preserving the source." },
  { id: "unsupported", group: "Documents", label: "Unsupported file", description: "Explicitly open a CSV through the safe read-only fallback." },
  { id: "mixed-endings", group: "Documents", label: "Mixed Markdown endings", description: "Open the fixture that requires an explicit LF or CRLF choice." },
  { id: "recent-missing", group: "Documents", label: "Recent target missing", description: "Add a missing Recent whose open action returns a concrete error." },
  { id: "ai-disabled", group: "Agent", label: "AI disabled", description: "Remove all Agent activation and runtime UI through the global gate." },
  { id: "provider-required", group: "Agent", label: "Provider configuration required", description: "Show Agent configuration guidance without faking a response." },
  { id: "runtime-fallback", group: "Agent", label: "Compatibility fallback", description: "Select the compatibility runtime and expose reduced capability evidence." },
  { id: "agent-failure", group: "Agent", label: "Agent terminal failure", description: "Prepare the composer workflow for the deterministic “fail” prompt and Retry." },
  { id: "context-pressure", group: "Agent", label: "Context warning", description: "Lower the New Thread threshold so the next Turn shows context pressure." },
  { id: "invalid-skill", group: "Agent", label: "Invalid custom Skill", description: "Add a disabled invalid Skill with a visible validation explanation." },
  { id: "tool-rejected", group: "Agent", label: "Editor Tool rejected", description: "Protect the active document so Agent mutation Tools fail safely." },
];

const byId = new Map(reviewScenarios.map((scenario) => [scenario.id, scenario]));
const defaultWindowState = { platform: "macos", fullscreen: false };

function applyWindowState(windowApi, state = defaultWindowState) {
  windowApi?.setPlatform?.(state.platform);
  windowApi?.setFullscreen?.(state.fullscreen);
}

export const reviewStorageKeys = [
  "ideanote-complete-review-settings-v1",
  "ideanote-review-agent-threads-v1",
  "ideanote-review-layout-v1",
  "ideanote-review-ideasketch-navigator-width",
  "ideanote-review-theme",
];

export function resetReviewEnvironment({ desktopApi, windowApi, storage = globalThis.localStorage }) {
  desktopApi.failures.clear();
  desktopApi.reset();
  applyWindowState(windowApi);
  reviewStorageKeys.forEach((key) => storage?.removeItem?.(key));
  return desktopApi.snapshot();
}

const documentScenarioIds = new Set([
  "read-only", "save-failure", "metadata-failure", "external-clean", "external-dirty",
  "renamed", "missing-file", "recovery", "recovery-corrupt", "tool-rejected",
  "agent-failure", "context-pressure", "provider-required", "runtime-fallback", "invalid-skill",
]);

export async function applyReviewScenario(id, { desktopApi, settings, activeDocument, windowApi }) {
  const scenario = byId.get(id) ?? byId.get("normal");
  desktopApi.failures.clear();
  desktopApi.reset();
  applyWindowState(windowApi, scenario.windowState);
  const nextSettings = structuredClone(settings);
  nextSettings.aiEnabled = true;
  nextSettings.provider.credentialConfigured = true;
  nextSettings.agent.runtime = "automatic";
  nextSettings.agent.exactContextWarning = 78;
  nextSettings.skills = nextSettings.skills.filter((skill) => skill.valid !== false);
  let documentPatch = {
    readOnly: false,
    conflict: false,
    missing: false,
    recoveryAvailable: false,
    recoveryError: null,
    recoveryContent: null,
    metadataWarning: null,
    sourceModified: false,
    externalClean: false,
    renamedFrom: null,
    problemDismissed: false,
    ...(activeDocument?.renamedFrom ? { path: activeDocument.renamedFrom } : {}),
  };
  let openTarget = null;
  let message = scenario.description;

  if (id === "normal") {
    resetReviewEnvironment({ desktopApi, windowApi });
    nextSettings.theme = "light";
  }
  if (!activeDocument && documentScenarioIds.has(id)) openTarget = { mode: "workspace", workspaceId: "ws-product", path: "Planning/product-brief.md" };
  if (id === "read-only") {
    documentPatch = { ...documentPatch, readOnly: true, status: "read-only" };
  }
  if (id === "save-failure") desktopApi.injectFailure("saveDocument", "The simulated disk rejected this save. A recovery draft remains available.");
  if (id === "metadata-failure") documentPatch = { ...documentPatch, metadataWarning: "Document saved. Workspace view state could not be persisted in the mock backend." };
  if (id === "external-clean") documentPatch = { ...documentPatch, sourceModified: true, externalClean: true };
  if (id === "external-dirty") documentPatch = { ...documentPatch, conflict: true, dirty: true, status: "dirty" };
  if (id === "renamed" && activeDocument) documentPatch = { ...documentPatch, renamedFrom: activeDocument.path, path: activeDocument.path.replace(/(\.[^.]+)$/, "-renamed$1"), sourceModified: true };
  if (id === "missing-file") documentPatch = { ...documentPatch, missing: true };
  if (id === "missing-root") {
    const workspace = desktopApi.data.workspaces.find((item) => item.id === "ws-product");
    if (workspace) workspace.missing = true;
    desktopApi.emit({ type: "workspace-missing", workspaceId: "ws-product" });
  }
  if (id === "recovery") documentPatch = { ...documentPatch, recoveryAvailable: true, recoveryContent: activeDocument?.type === "markdown" ? `${activeDocument.content}\n\n> Restored review draft.\n` : activeDocument?.content };
  if (id === "recovery-corrupt") documentPatch = { ...documentPatch, recoveryError: "The mock recovery record is corrupt. The source document is still unchanged." };
  if (id === "unsupported") openTarget = { mode: "standalone", standaloneId: "standalone-unsupported" };
  if (id === "mixed-endings") openTarget = { mode: "workspace", workspaceId: "ws-product", path: "Research/field-notes.md" };
  if (id === "recent-missing") desktopApi.data.recents.unshift({ id: "recent-missing-target", kind: "standalone", standaloneId: "missing-target", label: "missing-review.md", detail: "Single File · unavailable" });
  if (id === "ai-disabled") nextSettings.aiEnabled = false;
  if (id === "provider-required") { nextSettings.aiEnabled = true; nextSettings.provider.credentialConfigured = false; }
  if (id === "runtime-fallback") nextSettings.agent.runtime = "compatibility";
  if (id === "agent-failure") message = "Open Agent and send “fail” to review terminal failure, Retry, and diagnostics.";
  if (id === "context-pressure") nextSettings.agent.exactContextWarning = 45;
  if (id === "invalid-skill") nextSettings.skills.push({ id: "invalid-review-skill", name: "Broken Review Skill", source: "custom", enabled: false, scope: "all", autonomous: false, valid: false, path: "/Mock/Skills/broken/SKILL.md", error: "Missing required name frontmatter" });
  if (id === "tool-rejected") documentPatch = { ...documentPatch, conflict: true };

  return { scenario, settings: nextSettings, documentPatch, openTarget, message };
}
