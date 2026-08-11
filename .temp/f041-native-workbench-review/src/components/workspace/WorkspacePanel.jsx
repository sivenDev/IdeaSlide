import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
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
import { useState } from "react";
import { fileTypeRegistry, isVisibleEntry } from "../../lib/fileTypeRegistry.js";
import { AppMenu, AppMenuItem, AppMenuSeparator } from "../primitives/AppMenu.jsx";

function FileBadge({ type }) {
  const definition = fileTypeRegistry[type] ?? fileTypeRegistry.unsupported;
  return <span className={`file-glyph file-glyph--${definition.tone}`}>{definition.badge}</span>;
}

function EntryRow({ entry, depth, workspace, state, dispatch, onOpen, onCreate, onEntryAction }) {
  const key = `${workspace.id}:${entry.path}`;
  const isDirectory = entry.kind === "directory";
  const expanded = state.expandedDirectories.has(key);
  const active = state.selectedPath === key;
  const dragId = `entry:${workspace.id}:${entry.path}`;
  const dropId = `directory:${workspace.id}:${entry.path}`;
  const dragData = { type: "workspace-entry", workspaceId: workspace.id, path: entry.path, kind: entry.kind, name: entry.name, fileType: entry.type };
  const dropData = { type: "workspace-target", workspaceId: workspace.id, path: entry.path, kind: "directory", name: entry.name };
  const { attributes, listeners, setNodeRef: setDragRef, transform, transition, isDragging } = useDraggable({ id: dragId, data: dragData, disabled: workspace.missing });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dropId, data: dropData, disabled: !isDirectory || workspace.missing });
  const setRowRef = (node) => {
    setDragRef(node);
    if (isDirectory) setDropRef(node);
  };
  if (!isVisibleEntry(entry)) return null;

  return (
    <div className={`tree-entry-wrap ${isOver ? "is-drop-target" : ""}`}>
      <div
        ref={setRowRef}
        className={`tree-entry ${isDirectory ? "tree-entry--directory" : "tree-entry--file"} ${active ? "is-active" : ""} ${isDragging ? "is-dragging" : ""}`}
        style={{ "--tree-depth": depth, transform: CSS.Translate.toString(transform), transition }}
      >
        <button
          type="button"
          className="tree-entry__main"
          onClick={() => isDirectory ? dispatch({ type: "toggle-directory", key }) : onOpen(workspace.id, entry.path)}
          aria-expanded={isDirectory ? expanded : undefined}
          {...attributes}
          {...listeners}
        >
          {isDirectory ? <ChevronRight className={`tree-chevron ${expanded ? "is-open" : ""}`} size={13} /> : <span className="tree-chevron" />}
          {isDirectory ? (expanded ? <FolderOpen size={14} /> : <Folder size={14} />) : <FileBadge type={entry.type} />}
          <span className="tree-entry__name">{entry.name}</span>
          {state.sessions[`workspace:${workspace.id}:${entry.path}`]?.dirty && <span className="dirty-dot" aria-label="Unsaved changes" />}
        </button>
        <div className="tree-row-actions">
          {isDirectory && (
            <AppMenu
              align="end"
              trigger={<button className="row-action row-action--create" type="button" aria-label={`Create in ${entry.name}`}><Plus size={14} /></button>}
            >
              <AppMenuItem onSelect={() => onCreate({ workspaceId: workspace.id, directoryPath: entry.path, label: entry.name }, "ideasketch")}><span className="file-glyph file-glyph--blue">IS</span>New IdeaSketch</AppMenuItem>
              <AppMenuItem onSelect={() => onCreate({ workspaceId: workspace.id, directoryPath: entry.path, label: entry.name }, "markdown")}><span className="file-glyph file-glyph--slate">MD</span>New Markdown</AppMenuItem>
              <AppMenuSeparator />
              <AppMenuItem icon={FolderPlus} onSelect={() => onCreate({ workspaceId: workspace.id, directoryPath: entry.path, label: entry.name }, "directory")}>New Folder</AppMenuItem>
            </AppMenu>
          )}
          <AppMenu
            side="right"
            align="start"
            sideOffset={3}
            contentClassName="app-menu--compact"
            trigger={<button className="row-action" type="button" aria-label={`Actions for ${entry.name}`}><MoreHorizontal size={14} /></button>}
          >
            <AppMenuItem icon={Pencil} onSelect={() => onEntryAction(workspace, entry, "rename")}>Rename</AppMenuItem>
            <AppMenuItem icon={ExternalLink} onSelect={() => onEntryAction(workspace, entry, "reveal")}>Show in Finder</AppMenuItem>
            <AppMenuSeparator />
            <AppMenuItem icon={Trash2} danger onSelect={() => onEntryAction(workspace, entry, "trash")}>Move to Trash</AppMenuItem>
          </AppMenu>
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

function WorkspaceRootRow({ workspace, state, dispatch, onCreate, onWorkspaceAction }) {
  const expanded = state.expandedWorkspaces.has(workspace.id);
  const { setNodeRef, isOver } = useDroppable({
    id: `workspace-root:${workspace.id}`,
    data: { type: "workspace-target", workspaceId: workspace.id, path: "", kind: "workspace", name: workspace.name },
    disabled: workspace.missing,
  });
  return (
    <div ref={setNodeRef} className={`workspace-root-row ${isOver ? "is-drop-target" : ""}`}>
      <button className="workspace-root" type="button" aria-expanded={expanded} onClick={() => dispatch({ type: "toggle-workspace-root", id: workspace.id })}>
        <ChevronRight className={`tree-chevron ${expanded ? "is-open" : ""}`} size={13} />
        {expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
        <span>{workspace.name}</span>
        {workspace.missing && <span className="workspace-pill workspace-pill--danger">Missing</span>}
      </button>
      <div className="tree-row-actions tree-row-actions--workspace">
        <AppMenu
          align="end"
          trigger={<button className="row-action row-action--create" type="button" aria-label={`Create in ${workspace.name}`} disabled={workspace.missing}><Plus size={14} /></button>}
        >
          <AppMenuItem onSelect={() => onCreate({ workspaceId: workspace.id, directoryPath: "", label: workspace.name }, "ideasketch")}><span className="file-glyph file-glyph--blue">IS</span>New IdeaSketch</AppMenuItem>
          <AppMenuItem onSelect={() => onCreate({ workspaceId: workspace.id, directoryPath: "", label: workspace.name }, "markdown")}><span className="file-glyph file-glyph--slate">MD</span>New Markdown</AppMenuItem>
          <AppMenuSeparator />
          <AppMenuItem icon={FolderPlus} onSelect={() => onCreate({ workspaceId: workspace.id, directoryPath: "", label: workspace.name }, "directory")}>New Folder</AppMenuItem>
        </AppMenu>
        <AppMenu
          side="right"
          align="start"
          sideOffset={3}
          contentClassName="app-menu--compact app-menu--workspace"
          trigger={<button className="row-action" type="button" aria-label={`Actions for ${workspace.name}`}><MoreHorizontal size={14} /></button>}
        >
          <AppMenuItem icon={Pencil} onSelect={() => onWorkspaceAction(workspace, "rename")}>Rename</AppMenuItem>
          <AppMenuItem icon={ExternalLink} onSelect={() => onWorkspaceAction(workspace, "reveal")}>Show in Finder</AppMenuItem>
          <AppMenuSeparator />
          <AppMenuItem icon={FolderMinus} danger disabled={Boolean(state.sessions && Object.values(state.sessions).some((session) => session.workspaceId === workspace.id && session.dirty))} onSelect={() => onWorkspaceAction(workspace, "remove")}>Remove from Workspaces</AppMenuItem>
        </AppMenu>
      </div>
    </div>
  );
}

function parentPath(path) {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

function validDrop(source, target) {
  if (!source || source.type !== "workspace-entry" || !target || target.type !== "workspace-target") return false;
  if (source.workspaceId !== target.workspaceId || parentPath(source.path) === target.path) return false;
  if (source.kind === "directory" && (target.path === source.path || target.path.startsWith(`${source.path}/`))) return false;
  return true;
}

export function WorkspacePanel({ state, dispatch, onOpen, onOpenRecent, onAddWorkspace, onCreate, onWorkspaceAction, onEntryAction, onMoveEntry, onSettings, onRemoveRecent }) {
  const [activeDrag, setActiveDrag] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const finishDrag = ({ active, over }) => {
    const source = active.data.current;
    const target = over?.data.current;
    setActiveDrag(null);
    if (!validDrop(source, target)) return;
    onMoveEntry({ workspaceId: source.workspaceId, path: source.path, destinationPath: target.path });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveDrag(active.data.current ?? null)}
      onDragCancel={() => setActiveDrag(null)}
      onDragEnd={finishDrag}
    >
      <aside className="workspace-region" aria-label="Workspace">
        <div className="workspace-crown" data-tauri-drag-region />
        <div className="workspace-toolbar"><span>Workspaces</span></div>

        <nav className="workspace-tree" aria-label="Workspaces and recent files">
          {!state.workspaces.length && <button className="workspace-empty-action" type="button" onClick={onAddWorkspace}><FolderPlus size={14} />Open Workspace</button>}
          {state.workspaces.map((workspace) => {
            const expanded = state.expandedWorkspaces.has(workspace.id);
            return (
              <section className="tree-group" key={workspace.id}>
                <WorkspaceRootRow workspace={workspace} state={state} dispatch={dispatch} onCreate={onCreate} onWorkspaceAction={onWorkspaceAction} />
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
      <DragOverlay dropAnimation={null}>
        {activeDrag && (
          <div className="workspace-drag-overlay">
            {activeDrag.kind === "directory" ? <Folder size={14} /> : <FileBadge type={activeDrag.fileType} />}
            <span>{activeDrag.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
