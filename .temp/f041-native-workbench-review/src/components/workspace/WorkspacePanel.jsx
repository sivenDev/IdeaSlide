import {
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Folder,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
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

function menuAnchor(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    left: Math.max(8, Math.min(rect.right + 6, window.innerWidth - 230)),
    top: Math.max(8, Math.min(rect.top, window.innerHeight - 248)),
  };
}

function EntryRow({ entry, depth, workspace, state, dispatch, onOpen, onCreate, onEntryAction }) {
  const key = `${workspace.id}:${entry.path}`;
  const isDirectory = entry.kind === "directory";
  const expanded = state.expandedDirectories.has(key);
  const active = state.selectedPath === key;
  if (!isVisibleEntry(entry)) return null;

  return (
    <div className="tree-entry-wrap">
      <div className={`tree-entry ${isDirectory ? "tree-entry--directory" : "tree-entry--file"} ${active ? "is-active" : ""}`} style={{ "--tree-depth": depth }}>
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
        <div className="tree-row-actions">
          {isDirectory && <button className="row-action row-action--create" type="button" aria-label={`Create in ${entry.name}`} onClick={(event) => onCreate({ workspaceId: workspace.id, directoryPath: entry.path, label: entry.name }, menuAnchor(event))}><Plus size={14} /></button>}
          <button className="row-action" type="button" aria-label={`Actions for ${entry.name}`} onClick={(event) => onEntryAction(workspace, entry, menuAnchor(event))}><MoreHorizontal size={14} /></button>
        </div>
      </div>
      {isDirectory && expanded && (
        <div>
          {entry.children.filter(isVisibleEntry).length === 0 && <div className="tree-empty" style={{ "--tree-depth": depth + 1 }}>Empty folder</div>}
          {entry.children.map((child) => <EntryRow key={child.id} entry={child} depth={depth + 1} workspace={workspace} state={state} dispatch={dispatch} onOpen={onOpen} onCreate={onCreate} onEntryAction={onEntryAction} />)}
        </div>
      )}
    </div>
  );
}

export function WorkspacePanel({ state, dispatch, onOpen, onOpenRecent, onAddWorkspace, onCreate, onWorkspaceAction, onEntryAction, onSettings, onRemoveRecent }) {
  return (
    <aside className="workspace-region" aria-label="Workspace">
      <div className="workspace-crown" data-tauri-drag-region />
      <div className="workspace-toolbar">
        <span>Workspaces</span>
      </div>

      <nav className="workspace-tree" aria-label="Workspaces and recent files">
        {!state.workspaces.length && <button className="workspace-empty-action" type="button" onClick={onAddWorkspace}><FolderPlus size={14} />Open Workspace</button>}
        {state.workspaces.map((workspace) => {
          const expanded = state.expandedWorkspaces.has(workspace.id);
          return (
            <section className="tree-group" key={workspace.id}>
              <div className="workspace-root-row">
                <button className="workspace-root" type="button" aria-expanded={expanded} onClick={() => dispatch({ type: "toggle-workspace-root", id: workspace.id })}>
                  <ChevronRight className={`tree-chevron ${expanded ? "is-open" : ""}`} size={13} />
                  {expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
                  <span>{workspace.name}</span>
                  {workspace.missing && <span className="workspace-pill workspace-pill--danger">Missing</span>}
                  {workspace.readOnly && <span className="workspace-pill">Read-only</span>}
                </button>
                <div className="tree-row-actions tree-row-actions--workspace">
                  <button className="row-action row-action--create" type="button" aria-label={`Create in ${workspace.name}`} disabled={workspace.readOnly || workspace.missing} onClick={(event) => onCreate({ workspaceId: workspace.id, directoryPath: "", label: workspace.name }, menuAnchor(event))}><Plus size={14} /></button>
                  <button className="row-action" type="button" aria-label={`Actions for ${workspace.name}`} onClick={(event) => onWorkspaceAction(workspace, menuAnchor(event))}><MoreHorizontal size={14} /></button>
                </div>
              </div>
              {workspace.missing && <p className="workspace-root-problem">Choose the Workspace again or remove this unavailable root. No files were discarded.</p>}
              {expanded && (
                <div className="workspace-children">
                  {workspace.entries.filter(isVisibleEntry).map((entry) => (
                    <EntryRow key={entry.id} entry={entry} depth={0} workspace={workspace} state={state} dispatch={dispatch} onOpen={onOpen} onCreate={onCreate} onEntryAction={onEntryAction} />
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
                  <FileBadge type={recent.label.endsWith(".is") ? "ideasketch" : recent.label.endsWith(".md") ? "markdown" : "unsupported"} />
                  <span><strong>{recent.label}</strong><small>{recent.detail}</small></span>
                </button>
                <button className="row-action" type="button" aria-label={`Remove ${recent.label} from Recents`} onClick={() => onRemoveRecent(recent.id)}><X size={13} /></button>
              </div>
            ))}
            {!state.recents.length && <p className="empty-copy">Standalone files you open will appear here.</p>}
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

export function NewEntryMenu({ target, anchor, onChoose, onClose }) {
  return (
    <div className="popover-menu new-entry-menu" role="menu" style={anchor}>
      <div className="popover-label">Create in {target?.label ?? "Workspace"}</div>
      <button type="button" role="menuitem" onClick={() => onChoose("ideasketch")}><span className="file-glyph file-glyph--blue">IS</span>New IdeaSketch</button>
      <button type="button" role="menuitem" onClick={() => onChoose("markdown")}><span className="file-glyph file-glyph--slate">MD</span>New Markdown</button>
      <button type="button" role="menuitem" onClick={() => onChoose("directory")}><FolderPlus size={15} />New Folder</button>
      <button type="button" role="menuitem" onClick={onClose}><X size={15} />Cancel</button>
    </div>
  );
}

export function WorkspaceActionMenu({ workspace, anchor, onRename, onReveal, onRemove, removeDisabled, onClose }) {
  return (
    <div className="popover-menu workspace-action-menu" role="menu" style={anchor}>
      <div className="popover-label">{workspace.name}</div>
      <button type="button" role="menuitem" onClick={onRename}><Pencil size={14} />Rename Workspace</button>
      <button type="button" role="menuitem" onClick={onReveal}><ExternalLink size={14} />Show in Finder</button>
      <button className="danger-action" type="button" role="menuitem" disabled={removeDisabled} onClick={onRemove}><FolderMinus size={14} />Remove from Workspaces</button>
      <button type="button" role="menuitem" onClick={onClose}><X size={15} />Cancel</button>
    </div>
  );
}

export function EntryActionMenu({ entry, anchor, onRename, onMove, onReveal, onTrash, onClose }) {
  return (
    <div className="popover-menu entry-action-menu" role="menu" style={anchor}>
      <div className="popover-label">{entry.name}</div>
      <button type="button" role="menuitem" onClick={onRename}><Pencil size={14} />Rename</button>
      {!entry.path.startsWith("Archive") && <button type="button" role="menuitem" onClick={onMove}><ArrowRight size={14} />Move to Archive</button>}
      <button type="button" role="menuitem" onClick={onReveal}><ExternalLink size={14} />Show in Finder</button>
      <button className="danger-action" type="button" role="menuitem" onClick={onTrash}><Trash2 size={14} />Move to Trash</button>
      <button type="button" role="menuitem" onClick={onClose}><X size={15} />Cancel</button>
    </div>
  );
}
