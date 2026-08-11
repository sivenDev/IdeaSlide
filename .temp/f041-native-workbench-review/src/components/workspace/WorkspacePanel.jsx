import {
  ChevronRight,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { fileTypeRegistry, isVisibleEntry } from "../../lib/fileTypeRegistry.js";

function FileBadge({ type }) {
  const definition = fileTypeRegistry[type] ?? fileTypeRegistry.unsupported;
  return <span className={`file-glyph file-glyph--${definition.tone}`}>{definition.badge}</span>;
}

function EntryRow({ entry, depth, workspace, state, dispatch, onOpen, onEntryAction }) {
  const key = `${workspace.id}:${entry.path}`;
  const isDirectory = entry.kind === "directory";
  const expanded = state.expandedDirectories.has(key);
  const active = state.selectedPath === key;
  if (!isVisibleEntry(entry)) return null;

  return (
    <div className="tree-entry-wrap">
      <div className={`tree-entry ${active ? "is-active" : ""}`} style={{ "--tree-depth": depth }}>
        <button
          type="button"
          className="tree-entry__main"
          onClick={() => isDirectory ? dispatch({ type: "toggle-directory", key }) : onOpen(workspace.id, entry.path)}
          aria-expanded={isDirectory ? expanded : undefined}
        >
          {isDirectory ? <ChevronRight className={`tree-chevron ${expanded ? "is-open" : ""}`} size={13} /> : <span className="tree-chevron" />}
          {isDirectory ? (expanded ? <FolderOpen size={14} /> : <Folder size={14} />) : <FileBadge type={entry.type} />}
          <span className="tree-entry__name">{entry.name}</span>
          {state.sessions[`workspace:${workspace.id}:${entry.path}`]?.dirty && <span className="dirty-dot" aria-label="Unsaved changes" />}
        </button>
        <button className="row-action" type="button" aria-label={`Actions for ${entry.name}`} onClick={() => onEntryAction(workspace, entry)}><MoreHorizontal size={14} /></button>
      </div>
      {isDirectory && expanded && (
        <div>
          {entry.children.filter(isVisibleEntry).length === 0 && <div className="tree-empty" style={{ "--tree-depth": depth + 1 }}>Empty folder</div>}
          {entry.children.map((child) => <EntryRow key={child.id} entry={child} depth={depth + 1} workspace={workspace} state={state} dispatch={dispatch} onOpen={onOpen} onEntryAction={onEntryAction} />)}
        </div>
      )}
    </div>
  );
}

export function WorkspacePanel({ state, dispatch, onOpen, onOpenRecent, onAddWorkspace, onCreate, onEntryAction, onSettings, onRemoveRecent }) {
  return (
    <aside className="workspace-region" aria-label="Workspace">
      <div className="workspace-crown" data-tauri-drag-region />
      <div className="workspace-toolbar">
        <span>Workspaces</span>
        <div className="inline-actions">
          <button className="icon-button" type="button" aria-label="New workspace item" onClick={onCreate}><FilePlus2 size={14} /></button>
          <button className="icon-button" type="button" aria-label="Add Workspace" onClick={onAddWorkspace}><Plus size={15} /></button>
        </div>
      </div>

      <nav className="workspace-tree" aria-label="Workspaces and recent files">
        {state.workspaces.map((workspace) => {
          const expanded = state.expandedWorkspaces.has(workspace.id);
          return (
            <section className="tree-group" key={workspace.id}>
              <button className="workspace-root" type="button" aria-expanded={expanded} onClick={() => dispatch({ type: "toggle-workspace-root", id: workspace.id })}>
                <ChevronRight className={`tree-chevron ${expanded ? "is-open" : ""}`} size={13} />
                {expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
                <span>{workspace.name}</span>
                {workspace.readOnly && <span className="workspace-pill">Read-only</span>}
              </button>
              {expanded && (
                <div className="workspace-children">
                  {workspace.entries.filter(isVisibleEntry).map((entry) => (
                    <EntryRow key={entry.id} entry={entry} depth={0} workspace={workspace} state={state} dispatch={dispatch} onOpen={onOpen} onEntryAction={onEntryAction} />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <section className="recents-section" aria-labelledby="recents-title">
          <div className="recents-heading" id="recents-title">Recents</div>
          <div className="recent-list">
            {state.recents.map((recent) => (
              <div className="recent-row" key={recent.id}>
                <button type="button" className="recent-main" onClick={() => onOpenRecent(recent)}>
                  {recent.kind === "workspace" ? <Folder size={14} /> : <FileBadge type={recent.label.endsWith(".is") ? "ideasketch" : recent.label.endsWith(".md") ? "markdown" : "unsupported"} />}
                  <span><strong>{recent.label}</strong><small>{recent.detail}</small></span>
                </button>
                <button className="row-action" type="button" aria-label={`Remove ${recent.label} from Recents`} onClick={() => onRemoveRecent(recent.id)}><X size={13} /></button>
              </div>
            ))}
            {!state.recents.length && <p className="empty-copy">Files you open will appear here.</p>}
          </div>
        </section>

        {state.notice && <p className={`workspace-notice workspace-notice--${state.notice.tone ?? "info"}`} role="status">{state.notice.message}</p>}
      </nav>

      <div className="workspace-foot">
        <button className="foot-action" type="button" onClick={onSettings}><Settings size={15} /><span>Settings</span><kbd>⌘,</kbd></button>
      </div>
    </aside>
  );
}

export function NewEntryMenu({ workspace, onChoose, onClose }) {
  return (
    <div className="popover-menu new-entry-menu" role="menu">
      <div className="popover-label">Create in {workspace?.name ?? "workspace"}</div>
      <button type="button" role="menuitem" onClick={() => onChoose("ideasketch")}><span className="file-glyph file-glyph--blue">IS</span>New IdeaSketch</button>
      <button type="button" role="menuitem" onClick={() => onChoose("markdown")}><span className="file-glyph file-glyph--slate">MD</span>New Markdown</button>
      <button type="button" role="menuitem" onClick={() => onChoose("directory")}><FolderPlus size={15} />New Folder</button>
      <button type="button" role="menuitem" onClick={onClose}><X size={15} />Cancel</button>
    </div>
  );
}

export function EntryActionMenu({ workspace, entry, onRename, onMove, onTrash, onClose }) {
  return (
    <div className="popover-menu entry-action-menu" role="menu">
      <div className="popover-label">{entry.name}</div>
      <button type="button" role="menuitem" onClick={onRename}>Rename</button>
      <button type="button" role="menuitem" onClick={onMove}>Move to Archive</button>
      <button className="danger-action" type="button" role="menuitem" onClick={onTrash}><Trash2 size={14} />Move to Trash</button>
      <button type="button" role="menuitem" onClick={onClose}>Cancel</button>
    </div>
  );
}
