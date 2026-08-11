import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { AgentPanel } from "../components/agent/AgentPanel.jsx";
import { CommandPalette } from "../components/commands/CommandPalette.jsx";
import { buildCommandCatalog, commandById } from "../components/commands/commandRegistry.js";
import { ConfirmDialog, MockPickerDialog, TextEntryDialog, UnsavedChangesDialog } from "../components/dialogs/Dialogs.jsx";
import { EditorHost } from "../components/editor/EditorHost.jsx";
import { ResizableDivider } from "../components/layout/ResizableDivider.jsx";
import { WindowChrome } from "../components/layout/WindowChrome.jsx";
import { SettingsCenter } from "../components/settings/SettingsCenter.jsx";
import { WorkspacePanel } from "../components/workspace/WorkspacePanel.jsx";
import { mockDesktopApi } from "../mock/mockDesktopApi.js";
import { defaultSettings, mockSettingsApi } from "../mock/mockSettingsApi.js";
import { mockWindowApi, windowChromeInsets } from "../mock/mockWindowApi.js";
import { applyReviewScenario } from "../scenarios/reviewScenarioRegistry.js";
import { activeDocument, demoReducer, initialState } from "./demoStore.js";

const LAYOUT_KEY = "ideanote-review-layout-v1";
const clone = (value) => structuredClone(value);

function effectiveTheme(theme) {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function reviewFrame() {
  const match = new URLSearchParams(window.location.search).get("frame")?.match(/^(\d{3,4})x(\d{3,4})$/);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

function initialLayout(reviewWidth = window.innerWidth) {
  const compact = reviewWidth < 1000;
  const fallback = { workspace: compact ? 218 : 254, agent: compact ? 286 : 352 };
  try {
    const stored = { ...fallback, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}") };
    return compact ? { workspace: Math.min(220, stored.workspace), agent: Math.min(286, stored.agent) } : stored;
  } catch { return fallback; }
}

function targetSessionId(target) {
  return target.mode === "workspace"
    ? `workspace:${target.workspaceId}:${target.path}`
    : `standalone:${target.standaloneId ?? target.id}`;
}

export function DemoApp() {
  const frame = useMemo(reviewFrame, []);
  const [state, dispatch] = useReducer(demoReducer, initialState);
  const [entryName, setEntryName] = useState("");
  const [entryKind, setEntryKind] = useState("markdown");
  const [createTarget, setCreateTarget] = useState(null);
  const [workspaceActionTarget, setWorkspaceActionTarget] = useState(null);
  const [entryActionTarget, setEntryActionTarget] = useState(null);
  const [recentActionTarget, setRecentActionTarget] = useState(null);
  const [editorAdapter, setEditorAdapter] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [layout, setLayout] = useState(() => initialLayout(frame?.width));
  const [windowState, setWindowState] = useState(() => mockWindowApi.getState());
  const document = activeDocument(state);
  const activeWorkspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId) ?? state.workspaces[0];

  const beginCreate = (target, kind = "markdown") => {
    if (!target) return;
    setCreateTarget(target);
    setEntryKind(kind);
    setEntryName(kind === "directory" ? "New Folder" : kind === "ideasketch" ? "Untitled Sketch" : "Untitled Note");
    dispatch({ type: "set-modal", modal: "create-entry" });
  };

  const refresh = useCallback(async () => {
    try {
      const data = await mockDesktopApi.listHome();
      dispatch({ type: state.ready ? "refresh-home" : "hydrate", payload: data });
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
    }
  }, [state.ready]);

  const patchDocument = (patch, sessionId = document?.sessionId) => {
    if (sessionId) dispatch({ type: "patch-document", sessionId, patch });
  };

  const saveDocument = async (target = document) => {
    if (!target || target.readOnly || target.conflict || target.missing) return false;
    dispatch({ type: "document-saving", sessionId: target.sessionId });
    try {
      const result = await mockDesktopApi.saveDocument(target);
      dispatch({ type: "document-saved", sessionId: target.sessionId, result });
      return true;
    } catch (error) {
      dispatch({ type: "document-save-error", sessionId: target.sessionId, error: error.message });
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
      await mockDesktopApi.writeRecovery(target.sessionId, target.content).catch(() => {});
      patchDocument({ recoveryAvailable: true, recoveryContent: clone(target.content) }, target.sessionId);
      return false;
    }
  };

  const saveAsDocument = async (target = document) => {
    if (!target) return false;
    try {
      const path = await mockDesktopApi.chooseSavePath(target.name);
      patchDocument({
        path,
        name: path.split("/").at(-1),
        readOnly: false,
        conflict: false,
        missing: false,
        sourceModified: false,
        externalClean: false,
        renamedFrom: null,
        dirty: false,
        status: "clean",
        originalContent: clone(target.content),
        revision: target.revision + 1,
      }, target.sessionId);
      dispatch({ type: "set-notice", notice: { tone: "info", message: `Saved a deterministic copy to ${path}.` } });
      return true;
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
      return false;
    }
  };

  const openFile = async (target, bypassGate = false, replace = false) => {
    const sessionId = targetSessionId(target);
    if (!bypassGate && document?.dirty && document.sessionId !== sessionId) {
      dispatch({ type: "request-open", target });
      return null;
    }
    try {
      const file = target.mode === "standalone"
        ? await mockDesktopApi.openStandalone(target.standaloneId ?? target.id)
        : await mockDesktopApi.openWorkspaceFile(target.workspaceId, target.path);
      dispatch({ type: "open-document", file, replace });
      refresh();
      return { file, sessionId: targetSessionId(file) };
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
      return null;
    }
  };

  const reloadDocument = async () => {
    if (!document) return;
    const target = document.mode === "workspace"
      ? { mode: "workspace", workspaceId: document.workspaceId, path: document.renamedFrom ?? document.path }
      : { mode: "standalone", standaloneId: document.id };
    const reopened = await openFile(target, true, true);
    if (reopened) dispatch({ type: "set-notice", notice: { tone: "info", message: "Reloaded the deterministic source. Unsaved editor changes were discarded by your choice." } });
  };

  const openRecent = async (recent) => {
    try {
      await openFile({ mode: "standalone", standaloneId: recent.standaloneId });
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
    }
  };

  const executeRecentAction = async (action, target = recentActionTarget) => {
    const recent = target?.recent ?? target;
    if (!recent) return;
    try {
      if (action === "rename") {
        const renamed = await mockDesktopApi.renameStandalone(recent.standaloneId, entryName.trim());
        if (document?.mode === "standalone" && document.id === recent.standaloneId) patchDocument({ name: renamed.name, path: renamed.path });
      }
      if (action === "reveal") {
        await mockDesktopApi.revealInFinder(recent.path ?? recent.label);
        dispatch({ type: "set-notice", notice: { tone: "info", message: `Show in Finder is simulated for ${recent.label}.` } });
      }
      if (action === "remove") await mockDesktopApi.removeRecent(recent.id);
      dispatch({ type: "set-modal", modal: null });
      setRecentActionTarget(null);
      setEntryName("");
      await refresh();
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
    }
  };

  const beginRecentAction = (recent, action) => {
    const target = { recent };
    setRecentActionTarget(target);
    if (action === "rename") {
      setEntryName(recent.label);
      dispatch({ type: "set-modal", modal: "rename-recent" });
    } else executeRecentAction(action, target);
  };

  const applyScenario = async (id) => {
    const outcome = await applyReviewScenario(id, {
      desktopApi: mockDesktopApi,
      settings,
      activeDocument: document,
      windowApi: mockWindowApi,
    });
    const nextSettings = id === "normal" ? clone(defaultSettings) : outcome.settings;
    setSettings(nextSettings);
    dispatch({ type: "set-theme", theme: nextSettings.theme });

    if (id === "normal") {
      const data = await mockDesktopApi.listHome();
      dispatch({ type: "reset-review", payload: data, theme: "light" });
      dispatch({ type: "set-notice", notice: null });
      return nextSettings;
    }

    let sessionId = document?.sessionId;
    let openedFile = null;
    if (outcome.openTarget) {
      const opened = await openFile(outcome.openTarget, true, true);
      sessionId = opened?.sessionId ?? sessionId;
      openedFile = opened?.file ?? null;
    }
    if (sessionId) {
      const patch = { ...outcome.documentPatch };
      if (patch.recoveryAvailable && patch.recoveryContent == null && openedFile) patch.recoveryContent = openedFile.type === "markdown" ? `${openedFile.content}\n\n> Restored review draft.\n` : clone(openedFile.content);
      dispatch({ type: "patch-document", sessionId, patch });
    }
    dispatch({ type: "set-scenario", id: outcome.scenario.id });
    dispatch({ type: "set-notice", notice: { tone: "info", message: outcome.message } });
    await refresh();
    return nextSettings;
  };

  const handleCreate = async () => {
    if (!createTarget) return;
    try {
      const entry = await mockDesktopApi.createEntry(createTarget.workspaceId, createTarget.directoryPath, entryKind, entryName.trim());
      dispatch({ type: "set-modal", modal: null });
      setCreateTarget(null);
      setEntryName("");
      await refresh();
      if (entry.kind === "file") await openFile({ mode: "workspace", workspaceId: createTarget.workspaceId, path: entry.path }, true);
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
    }
  };

  const executeEntryAction = async (action, target = entryActionTarget) => {
    if (!target) return;
    const { workspace, entry } = target;
    try {
      if (action === "rename") await mockDesktopApi.renameEntry(workspace.id, entry.path, entryName.trim());
      if (action === "trash") await mockDesktopApi.trashEntry(workspace.id, entry.path);
      if (action === "reveal") {
        await mockDesktopApi.revealInFinder(`${workspace.path}/${entry.path}`);
        dispatch({ type: "set-notice", notice: { tone: "info", message: `Show in Finder is simulated for ${entry.path}.` } });
      }
      dispatch({ type: "set-modal", modal: null });
      setEntryActionTarget(null);
      setEntryName("");
      await refresh();
      if (document?.workspaceId === workspace.id && (document.path === entry.path || document.path.startsWith(`${entry.path}/`)) && action === "trash") dispatch({ type: "close-document" });
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
    }
  };

  const executeWorkspaceAction = async (action, target = workspaceActionTarget) => {
    const workspace = target?.workspace ?? target;
    if (!workspace) return;
    try {
      if (action === "rename") {
        const renamed = await mockDesktopApi.renameWorkspace(workspace.id, entryName.trim());
        if (document?.workspaceId === workspace.id) patchDocument({ workspaceName: renamed.name });
      }
      if (action === "reveal") {
        await mockDesktopApi.revealInFinder(workspace.path);
        dispatch({ type: "set-notice", notice: { tone: "info", message: `Show in Finder is simulated for ${workspace.name}.` } });
      }
      if (action === "remove") {
        if (document?.workspaceId === workspace.id && document.dirty) throw new Error("Save or close the active document before removing this Workspace.");
        await mockDesktopApi.removeWorkspace(workspace.id);
        if (document?.workspaceId === workspace.id) dispatch({ type: "close-document" });
      }
      dispatch({ type: "set-modal", modal: null });
      setWorkspaceActionTarget(null);
      setEntryName("");
      await refresh();
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
    }
  };

  const beginWorkspaceAction = (workspace, action) => {
    const target = { workspace };
    setWorkspaceActionTarget(target);
    if (action === "rename") {
      setEntryName(workspace.name);
      dispatch({ type: "set-modal", modal: "rename-workspace" });
    } else if (action === "remove") dispatch({ type: "set-modal", modal: "remove-workspace" });
    else executeWorkspaceAction(action, target);
  };

  const beginEntryAction = (workspace, entry, action) => {
    const target = { workspace, entry };
    setEntryActionTarget(target);
    if (action === "rename") {
      setEntryName(entry.name);
      dispatch({ type: "set-modal", modal: "rename-entry" });
    } else if (action === "trash") dispatch({ type: "set-modal", modal: "trash-entry" });
    else executeEntryAction(action, target);
  };

  const moveWorkspaceEntry = async ({ workspaceId, path, destinationPath }) => {
    try {
      const moved = await mockDesktopApi.moveEntry(workspaceId, path, destinationPath);
      dispatch({ type: "remap-workspace-path", workspaceId, previousPath: path, nextPath: moved.path });
      await refresh();
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
    }
  };

  const commands = useMemo(() => buildCommandCatalog({ document, recents: state.recents, workspaceOpen: state.workspaceOpen, agentOpen: state.agentOpen, aiEnabled: settings.aiEnabled }), [document, state.recents, state.workspaceOpen, state.agentOpen, settings.aiEnabled]);
  const runCommand = async (id) => {
    if (!commandById(commands, id)) return;
    dispatch({ type: "set-command", open: false });
    if (id === "open-recent") await openRecent(state.recents[0]);
    if (id === "open-workspace") dispatch({ type: "set-modal", modal: "workspace-picker" });
    if (id === "open-settings") dispatch({ type: "set-modal", modal: "settings" });
    if (id === "new-ideasketch" || id === "new-markdown") {
      const kind = id === "new-ideasketch" ? "ideasketch" : "markdown";
      beginCreate(activeWorkspace && { workspaceId: activeWorkspace.id, directoryPath: "", label: activeWorkspace.name }, kind);
    }
    if (id === "save") await saveDocument();
    if (id === "save-as") await saveAsDocument();
    if (id === "toggle-workspaces") dispatch({ type: "toggle-workspace" });
    if (id === "toggle-agent") dispatch({ type: "toggle-agent" });
    if (id === "reset-scenario") await applyScenario("normal");
    if (id === "review-exit") {
      if (document?.dirty) dispatch({ type: "request-open", target: { exit: true } });
      else dispatch({ type: "set-notice", notice: { tone: "info", message: "Mock application exit approved. The browser remains open for review." } });
    }
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => { mockSettingsApi.load().then((loaded) => { setSettings(loaded); dispatch({ type: "set-theme", theme: loaded.theme }); }); }, []);
  useEffect(() => mockDesktopApi.subscribe(() => refresh()), [refresh]);
  useEffect(() => { if (!settings.aiEnabled && state.agentOpen) dispatch({ type: "toggle-agent" }); }, [settings.aiEnabled, state.agentOpen]);
  useEffect(() => { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); }, [layout]);
  useEffect(() => mockWindowApi.subscribe(setWindowState), []);
  useEffect(() => {
    const root = window.document.documentElement;
    const apply = () => { root.dataset.theme = effectiveTheme(state.theme); };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    localStorage.setItem("ideanote-review-theme", state.theme);
    return () => media.removeEventListener("change", apply);
  }, [state.theme]);

  useEffect(() => {
    if (!document?.dirty || document.readOnly || document.conflict || document.missing || document.sourceModified || document.recoveryAvailable) return;
    const timer = window.setTimeout(() => saveDocument(document), 1400);
    return () => window.clearTimeout(timer);
  }, [document?.dirty, document?.revision]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key === ",") { event.preventDefault(); dispatch({ type: "set-modal", modal: "settings" }); }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "s" && document) { event.preventDefault(); saveAsDocument(document); }
      else if (modifier && event.key.toLowerCase() === "s" && document) { event.preventDefault(); saveDocument(document); }
      if (modifier && event.key.toLowerCase() === "k") { event.preventDefault(); dispatch({ type: "set-command", open: true }); }
      if (event.key === "Escape") {
        if (state.commandOpen) dispatch({ type: "set-command", open: false });
        else if (state.modal) dispatch({ type: "set-modal", modal: null });
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [document, state.commandOpen, state.modal]);

  const pendingOpen = state.pendingOpen;
  const shellClass = `app-shell ${state.workspaceOpen ? "" : "workspace-closed"} ${state.agentOpen && document ? "" : "agent-closed"}`;
  const availableWidth = frame?.width ?? window.innerWidth;
  let workspaceWidth = state.workspaceOpen ? layout.workspace : 0;
  let agentWidth = state.agentOpen && document ? layout.agent : 0;
  const excessWidth = Math.max(0, workspaceWidth + agentWidth - Math.max(340, availableWidth - 340));
  if (excessWidth) {
    const agentReduction = Math.min(excessWidth, Math.max(0, agentWidth - 260));
    agentWidth -= agentReduction;
    workspaceWidth -= Math.min(excessWidth - agentReduction, Math.max(0, workspaceWidth - 190));
  }
  const workspaceMax = Math.max(190, Math.min(360, availableWidth - agentWidth - 340));
  const agentMax = Math.max(260, Math.min(440, availableWidth - workspaceWidth - 340));
  const chromeInsets = windowChromeInsets(windowState);
  const shellStyle = {
    "--workspace-column": `${workspaceWidth}px`,
    "--agent-column": `${agentWidth}px`,
    "--native-left-safe": `${chromeInsets.left}px`,
    "--native-right-safe": `${chromeInsets.right}px`,
    ...(frame ? { width: frame.width, height: frame.height } : {}),
  };
  const completePending = async (mode) => {
    if (pendingOpen?.exit) {
      dispatch({ type: "cancel-open" });
      dispatch({ type: "set-notice", notice: { tone: "info", message: `Mock application exit approved after ${mode}. The browser remains open for review.` } });
    } else if (pendingOpen?.close) dispatch({ type: "close-document" });
    else await openFile(pendingOpen, true);
  };

  if (!state.ready) return <div className="loading-screen">Preparing deterministic mock workspace…</div>;

  return (
    <main className={shellClass} data-document={document ? "file" : "welcome"} data-window-platform={windowState.platform} data-window-fullscreen={windowState.fullscreen ? "true" : "false"} style={shellStyle}>
      <WindowChrome state={windowState} workspaceOpen={state.workspaceOpen} onToggleWorkspace={() => dispatch({ type: "toggle-workspace" })} />
      {state.workspaceOpen && <WorkspacePanel state={state} dispatch={dispatch} onOpen={(workspaceId, path) => openFile({ mode: "workspace", workspaceId, path })} onOpenRecent={openRecent} onAddWorkspace={() => dispatch({ type: "set-modal", modal: "workspace-picker" })} onCreate={beginCreate} onWorkspaceAction={beginWorkspaceAction} onEntryAction={beginEntryAction} onRecentAction={beginRecentAction} onMoveEntry={moveWorkspaceEntry} onSettings={() => dispatch({ type: "set-modal", modal: "settings" })} />}
      <EditorHost document={document} onSaveAs={() => saveAsDocument()} onClose={() => document?.dirty ? dispatch({ type: "request-open", target: { close: true } }) : dispatch({ type: "close-document" })} onChange={(content) => dispatch({ type: "update-document", sessionId: document.sessionId, content })} onOpenRecent={() => state.recents[0] && openRecent(state.recents[0])} onOpenFile={() => dispatch({ type: "set-modal", modal: "file-picker" })} onNewFile={() => beginCreate(activeWorkspace && { workspaceId: activeWorkspace.id, directoryPath: "", label: activeWorkspace.name })} agentOpen={state.agentOpen} onToggleAgent={() => dispatch({ type: "toggle-agent" })} onRegisterAdapter={setEditorAdapter} laserEnabled={settings.ideaSketch.laserEnabled} agentEnabled={settings.aiEnabled} onPatchDocument={patchDocument} onReloadDocument={reloadDocument} />
      {state.agentOpen && document && settings.aiEnabled && <AgentPanel document={document} settings={settings} editorAdapter={editorAdapter} onOpenSettings={() => dispatch({ type: "set-modal", modal: "settings" })} onToggleAgent={() => dispatch({ type: "toggle-agent" })} />}

      {state.workspaceOpen && <ResizableDivider label="Resize Workspaces" value={workspaceWidth} min={190} max={workspaceMax} mode="overlay" style={{ left: workspaceWidth - 4 }} onChange={(value) => setLayout((current) => ({ ...current, workspace: value }))} />}
      {state.agentOpen && document && <ResizableDivider label="Resize Agent" value={agentWidth} min={260} max={agentMax} direction={-1} mode="overlay" style={{ right: agentWidth - 4 }} onChange={(value) => setLayout((current) => ({ ...current, agent: value }))} />}

      {state.commandOpen && <CommandPalette commands={commands} onRun={runCommand} onClose={() => dispatch({ type: "set-command", open: false })} />}
      {state.modal === "settings" && <SettingsCenter settings={settings} activeScenario={state.activeScenario} onScenario={applyScenario} onSettings={(saved) => { setSettings(saved); dispatch({ type: "set-theme", theme: saved.theme }); }} onTheme={(theme) => dispatch({ type: "set-theme", theme })} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "workspace-picker" && <MockPickerDialog kind="workspace" onChoose={async () => { const workspace = await mockDesktopApi.chooseWorkspace(); dispatch({ type: "set-modal", modal: null }); dispatch({ type: "toggle-workspace-root", id: workspace.id }); refresh(); }} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "file-picker" && <MockPickerDialog kind="file" onChoose={async () => { const file = await mockDesktopApi.chooseFile(); dispatch({ type: "set-modal", modal: null }); openFile({ mode: "standalone", standaloneId: file.id }); }} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "create-entry" && <TextEntryDialog title={entryKind === "directory" ? "New Folder" : entryKind === "ideasketch" ? "New IdeaSketch" : "New Markdown"} description={`Create inside ${createTarget?.label ?? "Workspace"}`} label="Name" value={entryName} setValue={setEntryName} confirmLabel="Create" onConfirm={handleCreate} onClose={() => { dispatch({ type: "set-modal", modal: null }); setCreateTarget(null); }} />}
      {state.modal === "rename-workspace" && <TextEntryDialog title="Rename Workspace" description={workspaceActionTarget?.workspace.path} label="Name" value={entryName} setValue={setEntryName} confirmLabel="Rename" onConfirm={() => executeWorkspaceAction("rename")} onClose={() => { dispatch({ type: "set-modal", modal: null }); setWorkspaceActionTarget(null); }} />}
      {state.modal === "rename-entry" && <TextEntryDialog title="Rename item" description={entryActionTarget?.entry.path} label="Name" value={entryName} setValue={setEntryName} confirmLabel="Rename" onConfirm={() => executeEntryAction("rename")} onClose={() => { dispatch({ type: "set-modal", modal: null }); setEntryActionTarget(null); }} />}
      {state.modal === "rename-recent" && <TextEntryDialog title="Rename Recent File" description={recentActionTarget?.recent.path} label="Name" value={entryName} setValue={setEntryName} confirmLabel="Rename" onConfirm={() => executeRecentAction("rename")} onClose={() => { dispatch({ type: "set-modal", modal: null }); setRecentActionTarget(null); }} />}
      {state.modal === "trash-entry" && <ConfirmDialog title="Move item to Trash?" message="This removes the item from the in-memory mock workspace. Resetting the review restores it." confirmLabel="Move to Trash" danger onConfirm={() => executeEntryAction("trash")} onClose={() => { dispatch({ type: "set-modal", modal: null }); setEntryActionTarget(null); }} />}
      {state.modal === "remove-workspace" && <ConfirmDialog title="Remove Workspace?" message="This removes the Workspace from the review sidebar only. It does not represent deleting files from disk." confirmLabel="Remove Workspace" danger onConfirm={() => executeWorkspaceAction("remove")} onClose={() => { dispatch({ type: "set-modal", modal: null }); setWorkspaceActionTarget(null); }} />}
      {state.modal === "unsaved" && <UnsavedChangesDialog document={document} onCancel={() => dispatch({ type: "cancel-open" })} onDiscard={() => { dispatch({ type: "discard-document", sessionId: document.sessionId }); completePending("discarding changes"); }} onSave={async () => { if (await saveDocument(document)) await completePending("saving changes"); }} />}
    </main>
  );
}
