import { PanelLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { AgentPanel } from "../components/agent/AgentPanel.jsx";
import { ConfirmDialog, MockPickerDialog, TextEntryDialog, UnsavedChangesDialog } from "../components/dialogs/Dialogs.jsx";
import { EditorHost } from "../components/editor/EditorHost.jsx";
import { SettingsCenter } from "../components/settings/SettingsCenter.jsx";
import { EntryActionMenu, NewEntryMenu, WorkspacePanel } from "../components/workspace/WorkspacePanel.jsx";
import { mockDesktopApi } from "../mock/mockDesktopApi.js";
import { defaultSettings, mockSettingsApi } from "../mock/mockSettingsApi.js";
import { activeDocument, demoReducer, initialState } from "./demoStore.js";

function effectiveTheme(theme) {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function DemoApp() {
  const [state, dispatch] = useReducer(demoReducer, initialState);
  const [entryName, setEntryName] = useState("");
  const [entryKind, setEntryKind] = useState("markdown");
  const [editorAdapter, setEditorAdapter] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const document = activeDocument(state);
  const activeWorkspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId) ?? state.workspaces[0];

  const refresh = useCallback(async () => {
    const data = await mockDesktopApi.listHome();
    dispatch({ type: state.ready ? "refresh-home" : "hydrate", payload: data });
  }, [state.ready]);

  useEffect(() => { refresh(); }, []);
  useEffect(() => { mockSettingsApi.load().then((loaded) => { setSettings(loaded); dispatch({ type: "set-theme", theme: loaded.theme }); }); }, []);
  useEffect(() => mockDesktopApi.subscribe(() => refresh()), [refresh]);
  useEffect(() => { if (!settings.aiEnabled && state.agentOpen) dispatch({ type: "toggle-agent" }); }, [settings.aiEnabled, state.agentOpen]);
  useEffect(() => {
    const root = window.document.documentElement;
    const apply = () => root.dataset.theme = effectiveTheme(state.theme);
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    localStorage.setItem("ideanote-review-theme", state.theme);
    return () => media.removeEventListener("change", apply);
  }, [state.theme]);

  useEffect(() => {
    if (!document?.dirty || document.readOnly || document.conflict || document.missing) return;
    const timer = window.setTimeout(async () => {
      dispatch({ type: "document-saving", sessionId: document.sessionId });
      try {
        const result = await mockDesktopApi.saveDocument(document);
        dispatch({ type: "document-saved", sessionId: document.sessionId, result });
      } catch (error) {
        dispatch({ type: "document-save-error", sessionId: document.sessionId, error: error.message });
        await mockDesktopApi.writeRecovery(document.sessionId, document.content).catch(() => {});
      }
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [document?.dirty, document?.revision]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") { event.preventDefault(); dispatch({ type: "set-modal", modal: "settings" }); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && document) { event.preventDefault(); saveDocument(document); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); dispatch({ type: "set-command", open: true }); }
      if (event.key === "Escape") { dispatch({ type: "set-modal", modal: null }); dispatch({ type: "set-context-menu", menu: null }); dispatch({ type: "set-command", open: false }); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [document]);

  const saveDocument = async (target = document) => {
    if (!target || target.readOnly) return false;
    dispatch({ type: "document-saving", sessionId: target.sessionId });
    try {
      const result = await mockDesktopApi.saveDocument(target);
      dispatch({ type: "document-saved", sessionId: target.sessionId, result });
      return true;
    } catch (error) {
      dispatch({ type: "document-save-error", sessionId: target.sessionId, error: error.message });
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
      return false;
    }
  };

  const openFile = async (target, bypassGate = false) => {
    const targetSessionId = target.mode === "workspace" ? `workspace:${target.workspaceId}:${target.path}` : `standalone:${target.standaloneId ?? target.id}`;
    if (!bypassGate && document?.dirty && document.sessionId !== targetSessionId) {
      dispatch({ type: "request-open", target });
      return;
    }
    try {
      const file = target.mode === "standalone"
        ? await mockDesktopApi.openStandalone(target.standaloneId ?? target.id)
        : await mockDesktopApi.openWorkspaceFile(target.workspaceId, target.path);
      dispatch({ type: "open-document", file });
      refresh();
    } catch (error) {
      dispatch({ type: "set-notice", notice: { tone: "danger", message: error.message } });
    }
  };

  const openRecent = async (recent) => {
    if (recent.kind === "workspace") {
      await mockDesktopApi.openWorkspace(recent.workspaceId);
      dispatch({ type: "toggle-workspace-root", id: recent.workspaceId });
      refresh();
      return;
    }
    openFile(recent.kind === "standalone" ? { mode: "standalone", standaloneId: recent.standaloneId } : { mode: "workspace", workspaceId: recent.workspaceId, path: recent.path });
  };

  const handleCreate = async () => {
    if (!activeWorkspace) return;
    try {
      const entry = await mockDesktopApi.createEntry(activeWorkspace.id, "", entryKind, entryName.trim());
      dispatch({ type: "set-modal", modal: null });
      setEntryName("");
      await refresh();
      if (entry.kind === "file") openFile({ mode: "workspace", workspaceId: activeWorkspace.id, path: entry.path }, true);
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

  const pendingOpen = state.pendingOpen;
  const shellClass = `app-shell ${state.workspaceOpen ? "" : "workspace-closed"} ${state.agentOpen && document ? "" : "agent-closed"}`;
  if (!state.ready) return <div className="loading-screen">Preparing deterministic mock workspace…</div>;

  return (
    <main className={shellClass} data-document={document ? "file" : "welcome"}>
      <div className="window-controls"><div className="traffic-lights" aria-hidden="true"><span /><span /><span /></div><button className="panel-toggle panel-toggle--workspace" type="button" aria-label={state.workspaceOpen ? "Hide Workspaces" : "Show Workspaces"} aria-pressed={state.workspaceOpen} data-tooltip={state.workspaceOpen ? "Hide Workspaces" : "Show Workspaces"} onClick={() => dispatch({ type: "toggle-workspace" })}><PanelLeft size={16} /></button></div>
      {state.workspaceOpen && <WorkspacePanel state={state} dispatch={dispatch} onOpen={(workspaceId, path) => openFile({ mode: "workspace", workspaceId, path })} onOpenRecent={openRecent} onAddWorkspace={() => dispatch({ type: "set-modal", modal: "workspace-picker" })} onCreate={() => dispatch({ type: "set-context-menu", menu: { kind: "new" } })} onEntryAction={(workspace, entry) => dispatch({ type: "set-context-menu", menu: { kind: "entry", workspace, entry } })} onSettings={() => dispatch({ type: "set-modal", modal: "settings" })} onRemoveRecent={async (id) => { await mockDesktopApi.removeRecent(id); refresh(); }} />}
      <EditorHost document={document} onSave={() => saveDocument()} onClose={() => document?.dirty ? dispatch({ type: "request-open", target: { close: true } }) : dispatch({ type: "close-document" })} onChange={(content) => dispatch({ type: "update-document", sessionId: document.sessionId, content })} onOpenRecent={() => state.recents[0] && openRecent(state.recents[0])} onOpenFile={() => dispatch({ type: "set-modal", modal: "file-picker" })} onNewFile={() => dispatch({ type: "set-context-menu", menu: { kind: "new" } })} agentOpen={state.agentOpen} onToggleAgent={() => dispatch({ type: "toggle-agent" })} onRegisterAdapter={setEditorAdapter} laserEnabled={settings.ideaSketch.laserEnabled} agentEnabled={settings.aiEnabled} />
      {state.agentOpen && document && settings.aiEnabled && <AgentPanel document={document} settings={settings} editorAdapter={editorAdapter} onOpenSettings={() => dispatch({ type: "set-modal", modal: "settings" })} />}

      {state.contextMenu?.kind === "new" && <NewEntryMenu workspace={activeWorkspace} onChoose={(kind) => { setEntryKind(kind); setEntryName(kind === "directory" ? "New Folder" : kind === "ideasketch" ? "Untitled Sketch" : "Untitled Note"); dispatch({ type: "set-modal", modal: "create-entry" }); }} onClose={() => dispatch({ type: "set-context-menu", menu: null })} />}
      {state.contextMenu?.kind === "entry" && <EntryActionMenu workspace={state.contextMenu.workspace} entry={state.contextMenu.entry} onRename={() => { setEntryName(state.contextMenu.entry.name); dispatch({ type: "set-modal", modal: "rename-entry" }); }} onMove={() => executeEntryAction("move")} onTrash={() => dispatch({ type: "set-modal", modal: "trash-entry" })} onClose={() => dispatch({ type: "set-context-menu", menu: null })} />}

      {state.modal === "settings" && <SettingsCenter settings={settings} onSettings={(saved) => { setSettings(saved); dispatch({ type: "set-theme", theme: saved.theme }); }} onTheme={(theme) => dispatch({ type: "set-theme", theme })} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "workspace-picker" && <MockPickerDialog kind="workspace" onChoose={async () => { const workspace = await mockDesktopApi.chooseWorkspace(); dispatch({ type: "set-modal", modal: null }); dispatch({ type: "toggle-workspace-root", id: workspace.id }); refresh(); }} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "file-picker" && <MockPickerDialog kind="file" onChoose={async () => { const file = await mockDesktopApi.chooseFile(); dispatch({ type: "set-modal", modal: null }); openFile({ mode: "standalone", standaloneId: file.id }); }} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "create-entry" && <TextEntryDialog title={entryKind === "directory" ? "New Folder" : entryKind === "ideasketch" ? "New IdeaSketch" : "New Markdown"} description={`Create inside ${activeWorkspace?.name}`} label="Name" value={entryName} setValue={setEntryName} confirmLabel="Create" onConfirm={handleCreate} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "rename-entry" && <TextEntryDialog title="Rename item" description={state.contextMenu?.entry.path} label="Name" value={entryName} setValue={setEntryName} confirmLabel="Rename" onConfirm={() => executeEntryAction("rename")} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "trash-entry" && <ConfirmDialog title="Move item to Trash?" message="This removes the item from the in-memory mock workspace. Resetting the review restores it." confirmLabel="Move to Trash" danger onConfirm={() => executeEntryAction("trash")} onClose={() => dispatch({ type: "set-modal", modal: null })} />}
      {state.modal === "unsaved" && <UnsavedChangesDialog document={document} onCancel={() => dispatch({ type: "cancel-open" })} onDiscard={() => { dispatch({ type: "discard-document", sessionId: document.sessionId }); if (pendingOpen?.close) dispatch({ type: "close-document" }); else openFile(pendingOpen, true); }} onSave={async () => { if (await saveDocument(document)) { if (pendingOpen?.close) dispatch({ type: "close-document" }); else openFile(pendingOpen, true); } }} />}
    </main>
  );
}
