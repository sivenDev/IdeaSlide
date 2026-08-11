import { PanelLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { AgentPanel } from "../components/agent/AgentPanel.jsx";
import { CommandPalette } from "../components/commands/CommandPalette.jsx";
import { buildCommandCatalog, commandById } from "../components/commands/commandRegistry.js";
import { ConfirmDialog, MockPickerDialog, TextEntryDialog, UnsavedChangesDialog } from "../components/dialogs/Dialogs.jsx";
import { EditorHost } from "../components/editor/EditorHost.jsx";
import { ResizableDivider } from "../components/layout/ResizableDivider.jsx";
import { SettingsCenter } from "../components/settings/SettingsCenter.jsx";
import { EntryActionMenu, NewEntryMenu, WorkspacePanel } from "../components/workspace/WorkspacePanel.jsx";
import { mockDesktopApi } from "../mock/mockDesktopApi.js";
import { defaultSettings, mockSettingsApi } from "../mock/mockSettingsApi.js";
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
  const [editorAdapter, setEditorAdapter] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [layout, setLayout] = useState(() => initialLayout(frame?.width));
  const document = activeDocument(state);
  const activeWorkspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId) ?? state.workspaces[0];

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
      if (recent.kind === "workspace") {
        await mockDesktopApi.openWorkspace(recent.workspaceId);
        dispatch({ type: "toggle-workspace-root", id: recent.workspaceId });
        refresh();
        return;
      }
      await openFile(recent.kind === "standalone" ? { mode: "standalone", standaloneId: recent.standaloneId } : { mode: "workspace", workspaceId: recent.workspaceId, path: recent.path });
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
    }
  };

  const applyScenario = async (id) => {
    const outcome = await applyReviewScenario(id, { desktopApi: mockDesktopApi, settings, activeDocument: document });
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
    if (!activeWorkspace) return;
    try {
      const entry = await mockDesktopApi.createEntry(activeWorkspace.id, "", entryKind, entryName.trim());
      dispatch({ type: "set-modal", modal: null });
      setEntryName("");
      await refresh();
      if (entry.kind === "file") await openFile({ mode: "workspace", workspaceId: activeWorkspace.id, path: entry.path }, true);
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
    }
  };

  const executeEntryAction = async (action) => {
    const { workspace, entry } = state.contextMenu;
    try {
      if (action === "rename") await mockDesktopApi.renameEntry(workspace.id, entry.path, entryName.trim());
      if (action === "move") await mockDesktopApi.moveEntry(workspace.id, entry.path, "Archive");
      if (action === "trash") await mockDesktopApi.trashEntry(workspace.id, entry.path);
      dispatch({ type: "set-modal", modal: null });
      dispatch({ type: "set-context-menu", menu: null });
      setEntryName("");
      await refresh();
      if (document?.workspaceId === workspace.id && document.path === entry.path && action === "trash") dispatch({ type: "close-document" });
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
    }
  };

  const commands = useMemo(() => buildCommandCatalog({ document, recents: state.recents, workspaceOpen: state.workspaceOpen, agentOpen: state.agentOpen, aiEnabled: settings.aiEnabled }), [document, state.recents, state.workspaceOpen, state.agentOpen, settings.aiEnabled]);
  const runCommand = async (id) => {
    if (!commandById(commands, id)) return;
    dispatch({ type: "set-command", open: false });
    if (id === "open-recent") await openRecent(state.recents[0]);
    if (id === "open-settings") dispatch({ type: "set-modal", modal: "settings" });
    if (id === "new-ideasketch" || id === "new-markdown") {
      const kind = id === "new-ideasketch" ? "ideasketch" : "markdown";
      setEntryKind(kind); setEntryName(kind === "ideasketch" ? "Untitled Sketch" : "Untitled Note");
      dispatch({ type: "set-modal", modal: "create-entry" });
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
        else if (state.contextMenu) dispatch({ type: "set-context-menu", menu: null });
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [document, state.commandOpen, state.modal, state.contextMenu]);

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
  const shellStyle = { "--workspace-column": `${workspaceWidth}px`, "--agent-column": `${agentWidth}px`, ...(frame ? { width: frame.width, height: frame.height } : {}) };
  const completePending = async (mode) => {
    if (pendingOpen?.exit) {
      dispatch({ type: "cancel-open" });
      dispatch({ type: "set-notice", notice: { tone: "info", message: `Mock application exit approved after ${mode}. The browser remains open for review.` } });
    } else if (pendingOpen?.close) dispatch({ type: "close-document" });
    else await openFile(pendingOpen, true);
  };

  if (!state.ready) return <div className="loading-screen">Preparing deterministic mock workspace…</div>;

  return (
    <main className={shellClass} data-document={document ? "file" : "welcome"} style={shellStyle}>
      <div className="window-controls"><div className="traffic-lights" aria-hidden="true"><span /><span /><span /></div><button className="panel-toggle panel-toggle--workspace" type="button" aria-label={state.workspaceOpen ? "Hide Workspaces" : "Show Workspaces"} aria-pressed={state.workspaceOpen} data-tooltip={state.workspaceOpen ? "Hide Workspaces" : "Show Workspaces"} onClick={() => dispatch({ type: "toggle-workspace" })}><PanelLeft size={16} /></button></div>
      {state.workspaceOpen && <WorkspacePanel state={state} dispatch={dispatch} onOpen={(workspaceId, path) => openFile({ mode: "workspace", workspaceId, path })} onOpenRecent={openRecent} onAddWorkspace={() => dispatch({ type: "set-modal", modal: "workspace-picker" })} onCreate={() => dispatch({ type: "set-context-menu", menu: { kind: "new" } })} onEntryAction={(workspace, entry) => dispatch({ type: "set-context-menu", menu: { kind: "entry", workspace, entry } })} onSettings={() => dispatch({ type: "set-modal", modal: "settings" })} onRemoveRecent={async (id) => { await mockDesktopApi.removeRecent(id); refresh(); }} />}
      <EditorHost document={document} onSave={() => saveDocument()} onSaveAs={() => saveAsDocument()} onClose={() => document?.dirty ? dispatch({ type: "request-open", target: { close: true } }) : dispatch({ type: "close-document" })} onChange={(content) => dispatch({ type: "update-document", sessionId: document.sessionId, content })} onOpenRecent={() => state.recents[0] && openRecent(state.recents[0])} onOpenFile={() => dispatch({ type: "set-modal", modal: "file-picker" })} onNewFile={() => dispatch({ type: "set-context-menu", menu: { kind: "new" } })} agentOpen={state.agentOpen} onToggleAgent={() => dispatch({ type: "toggle-agent" })} onRegisterAdapter={setEditorAdapter} laserEnabled={settings.ideaSketch.laserEnabled} agentEnabled={settings.aiEnabled} onPatchDocument={patchDocument} onReloadDocument={reloadDocument} />
      {state.agentOpen && document && settings.aiEnabled && <AgentPanel document={document} settings={settings} editorAdapter={editorAdapter} onOpenSettings={() => dispatch({ type: "set-modal", modal: "settings" })} />}

      {state.workspaceOpen && <ResizableDivider label="Resize Workspaces" value={workspaceWidth} min={190} max={workspaceMax} mode="overlay" style={{ left: workspaceWidth - 4 }} onChange={(value) => setLayout((current) => ({ ...current, workspace: value }))} />}
      {state.agentOpen && document && <ResizableDivider label="Resize Agent" value={agentWidth} min={260} max={agentMax} direction={-1} mode="overlay" style={{ right: agentWidth - 4 }} onChange={(value) => setLayout((current) => ({ ...current, agent: value }))} />}

      {state.contextMenu?.kind === "new" && <NewEntryMenu workspace={activeWorkspace} onChoose={(kind) => { setEntryKind(kind); setEntryName(kind === "directory" ? "New Folder" : kind === "ideasketch" ? "Untitled Sketch" : "Untitled Note"); dispatch({ type: "set-modal", modal: "create-entry" }); }} onClose={() => dispatch({ type: "set-context-menu", menu: null })} />}
      {state.contextMenu?.kind === "entry" && <EntryActionMenu workspace={state.contextMenu.workspace} entry={state.contextMenu.entry} onRename={() => { setEntryName(state.contextMenu.entry.name); dispatch({ type: "set-modal", modal: "rename-entry" }); }} onMove={() => executeEntryAction("move")} onTrash={() => dispatch({ type: "set-modal", modal: "trash-entry" })} onClose={() => dispatch({ type: "set-context-menu", menu: null })} />}

      {state.commandOpen && <CommandPalette commands={commands} onRun={runCommand} onClose={() => dispatch({ type: "set-command", open: false })} />}
      {state.modal === "settings" && <SettingsCenter settings={settings} activeScenario={state.activeScenario} onScenario={applyScenario} onSettings={(saved) => { setSettings(saved); dispatch({ type: "set-theme", theme: saved.theme }); }} onTheme={(theme) => dispatch({ type: "set-theme", theme })} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "workspace-picker" && <MockPickerDialog kind="workspace" onChoose={async () => { const workspace = await mockDesktopApi.chooseWorkspace(); dispatch({ type: "set-modal", modal: null }); dispatch({ type: "toggle-workspace-root", id: workspace.id }); refresh(); }} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "file-picker" && <MockPickerDialog kind="file" onChoose={async () => { const file = await mockDesktopApi.chooseFile(); dispatch({ type: "set-modal", modal: null }); openFile({ mode: "standalone", standaloneId: file.id }); }} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "create-entry" && <TextEntryDialog title={entryKind === "directory" ? "New Folder" : entryKind === "ideasketch" ? "New IdeaSketch" : "New Markdown"} description={`Create inside ${activeWorkspace?.name}`} label="Name" value={entryName} setValue={setEntryName} confirmLabel="Create" onConfirm={handleCreate} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "rename-entry" && <TextEntryDialog title="Rename item" description={state.contextMenu?.entry.path} label="Name" value={entryName} setValue={setEntryName} confirmLabel="Rename" onConfirm={() => executeEntryAction("rename")} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "trash-entry" && <ConfirmDialog title="Move item to Trash?" message="This removes the item from the in-memory mock workspace. Resetting the review restores it." confirmLabel="Move to Trash" danger onConfirm={() => executeEntryAction("trash")} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "unsaved" && <UnsavedChangesDialog document={document} onCancel={() => dispatch({ type: "cancel-open" })} onDiscard={() => { dispatch({ type: "discard-document", sessionId: document.sessionId }); completePending("discarding changes"); }} onSave={async () => { if (await saveDocument(document)) await completePending("saving changes"); }} />}
    </main>
  );
}
