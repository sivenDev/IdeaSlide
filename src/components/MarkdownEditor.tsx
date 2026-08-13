import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import GithubSlugger from "github-slugger";
import {
  Eye,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  Rows3,
  Undo2,
} from "lucide-react";
import type {
  DocumentModel,
  DocumentSession,
  MarkdownDocument,
  MarkdownEditorState,
  MarkdownViewMode,
} from "../types";
import { useAutoSave } from "../hooks/useAutoSave";
import { useCodeMirrorEditor } from "../hooks/useCodeMirrorEditor";
import { useSettings } from "../hooks/useSettings";
import { normalizeMarkdownLineEndings, updateMarkdownText } from "../lib/markdownDocument";
import { createAgentToolHost } from "../lib/agent/agentToolHost";
import { markdownAgentExtension } from "../lib/agent/extensions/markdownAgentExtension";
import {
  resolveMarkdownAgentEdit,
  type MarkdownAgentOperation,
} from "../lib/agent/extensions/markdownAgentTools";
import type {
  ActiveAgentEditorBinding,
  AgentChangeSet,
} from "../lib/agent/types";
import { MarkdownPreview } from "./MarkdownPreview";

interface MarkdownEditorProps {
  document: DocumentSession<MarkdownDocument>;
  readOnly?: boolean;
  onModelChange: (sessionId: string, model: MarkdownDocument) => void;
  onEditorStateChange: (sessionId: string, editorState: MarkdownEditorState) => void;
  onRegisterSnapshot: (sessionId: string, provider?: () => DocumentModel) => void;
  onAutoSave: (sessionId: string, model: DocumentModel) => Promise<void>;
  onAutoSaveComplete: (sessionId: string) => void;
  onWriteRecovery: (sessionId: string, model: DocumentModel) => Promise<void>;
  onAgentBindingChange: (binding: ActiveAgentEditorBinding | undefined, documentId: string) => void;
  onOpenDocumentLink?: (href: string) => void;
  documentFullPath?: string;
}

function markdownSelectionContext(view: EditorView | undefined): string | undefined {
  if (!view) return undefined;
  const { anchor, head } = view.state.selection.main;
  const anchorLine = view.state.doc.lineAt(anchor);
  const headLine = view.state.doc.lineAt(head);
  return `${anchorLine.number}:${anchor - anchorLine.from}-${headLine.number}:${head - headLine.from}`;
}

interface MarkdownHeading {
  level: number;
  text: string;
  line: number;
  offset: number;
  id: string;
}

function projectHeadings(text: string): MarkdownHeading[] {
  const slugger = new GithubSlugger();
  let offset = 0;
  const headings: MarkdownHeading[] = [];
  text.split("\n").forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      const headingText = match[2].trim();
      headings.push({
        level: match[1].length,
        text: headingText,
        line: index + 1,
        offset,
        id: slugger.slug(headingText),
      });
    }
    offset += line.length + 1;
  });
  return headings;
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="ideanote-markdown-icon-button flex h-7 w-7 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

export function MarkdownEditor({
  document,
  readOnly = false,
  onModelChange,
  onEditorStateChange,
  onRegisterSnapshot,
  onAutoSave,
  onAutoSaveComplete,
  onWriteRecovery,
  onAgentBindingChange,
  onOpenDocumentLink,
  documentFullPath,
}: MarkdownEditorProps) {
  const { hydrated, settings } = useSettings();
  const model = document.model;
  if (!model) throw new Error("Markdown document model is missing");
  const modelRef = useRef(model);
  const editVersionRef = useRef(document.revision);
  const previewRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);
  const initialState = document.editorState?.markdown;
  const [viewMode, setViewMode] = useState<MarkdownViewMode>(initialState?.viewMode ?? "split");
  const [showOutline, setShowOutline] = useState(
    initialState?.showOutline ?? settings.markdown.openOutlineByDefault,
  );
  const outlineDefaultApplied = useRef(typeof initialState?.showOutline === "boolean");
  const [scrollSync, setScrollSync] = useState(initialState?.scrollSync ?? true);
  const [splitRatio, setSplitRatio] = useState(initialState?.splitRatio ?? 0.5);
  const splitRatioRef = useRef(splitRatio);
  const [resizingSplit, setResizingSplit] = useState(false);
  const [previewStale, setPreviewStale] = useState(false);
  const [previewText, setPreviewText] = useState(model.text);

  useEffect(() => {
    modelRef.current = document.model!;
  }, [document.model]);

  useEffect(() => {
    if (!hydrated || outlineDefaultApplied.current) return;
    outlineDefaultApplied.current = true;
    setShowOutline(settings.markdown.openOutlineByDefault);
  }, [hydrated, settings.markdown.openOutlineByDefault]);

  useEffect(() => {
    setPreviewStale(true);
    const timeout = window.setTimeout(() => {
      setPreviewText(model.text);
      setPreviewStale(false);
    }, model.text.length > 100_000 ? 500 : 120);
    return () => window.clearTimeout(timeout);
  }, [model]);

  const updateEditorState = useCallback((patch: Partial<MarkdownEditorState>) => {
    const next: MarkdownEditorState = {
      viewMode,
      showOutline,
      scrollSync,
      splitRatio,
      ...patch,
    };
    if (patch.viewMode) setViewMode(patch.viewMode);
    if (typeof patch.showOutline === "boolean") setShowOutline(patch.showOutline);
    if (typeof patch.scrollSync === "boolean") setScrollSync(patch.scrollSync);
    onEditorStateChange(document.id, next);
  }, [document.id, onEditorStateChange, scrollSync, showOutline, splitRatio, viewMode]);

  useEffect(() => {
    if (!resizingSplit) return;
    const handleMove = (event: MouseEvent) => {
      const bounds = splitContainerRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0) return;
      const nextRatio = Math.max(0.28, Math.min(0.72, (event.clientX - bounds.left) / bounds.width));
      splitRatioRef.current = nextRatio;
      setSplitRatio(nextRatio);
    };
    const handleUp = () => {
      setResizingSplit(false);
      onEditorStateChange(document.id, { viewMode, showOutline, scrollSync, splitRatio: splitRatioRef.current });
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp, { once: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [document.id, onEditorStateChange, resizingSplit, scrollSync, showOutline, viewMode]);

  const handleSourceScroll = useCallback((ratio: number) => {
    if (!scrollSync || syncingScroll.current || !previewRef.current) return;
    syncingScroll.current = true;
    const preview = previewRef.current;
    preview.scrollTop = ratio * Math.max(0, preview.scrollHeight - preview.clientHeight);
    requestAnimationFrame(() => { syncingScroll.current = false; });
  }, [scrollSync]);

  const handleTextChange = useCallback((text: string) => {
    if (readOnly) return;
    const next = updateMarkdownText(modelRef.current, text);
    if (next === modelRef.current) return;
    modelRef.current = next;
    editVersionRef.current += 1;
    onModelChange(document.id, next);
  }, [document.id, onModelChange, readOnly]);

  const editor = useCodeMirrorEditor({
    value: model.text,
    readOnly,
    showLineNumbers: settings.markdown.showLineNumbers,
    onChange: handleTextChange,
    onScroll: handleSourceScroll,
  });

  useEffect(() => {
    if (viewMode === "preview") return;
    const frame = requestAnimationFrame(() => {
      editor.requestMeasure();
      editor.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [viewMode]);

  useEffect(() => {
    onRegisterSnapshot(document.id, () => modelRef.current);
    return () => onRegisterSnapshot(document.id, undefined);
  }, [document.id, onRegisterSnapshot]);

  useAutoSave({
    enabled: Boolean(document.filePath) && !readOnly && document.status === "editable",
    sessionId: document.id,
    filePath: document.filePath,
    revision: document.revision,
    isDirty: document.isDirty,
    getModel: () => modelRef.current,
    getEditVersion: () => editVersionRef.current,
    onSave: (model) => onAutoSave(document.id, model),
    onSaveComplete: () => onAutoSaveComplete(document.id),
    onSaveError: (error) => console.error(`Markdown auto-save failed for ${document.displayName}:`, error),
  });

  useEffect(() => {
    if (!document.isDirty || readOnly) return;
    const timeout = window.setTimeout(() => {
      void onWriteRecovery(document.id, modelRef.current).catch((error) => {
        console.warn("Markdown recovery draft could not be written:", error);
      });
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [document.id, document.isDirty, document.revision, onWriteRecovery, readOnly]);

  const handleApplyAgentChangeSet = useCallback((changeSet: AgentChangeSet): boolean => {
    const view = editor.getView();
    if (!view) return false;
    const liveText = view.state.doc.toString();
    const resolved = resolveMarkdownAgentEdit(
      changeSet as AgentChangeSet<MarkdownAgentOperation>,
      {
        documentId: document.id,
        revision: document.revision,
        documentStatus: document.status,
        sourceModified: document.sourceModified,
        readOnly,
        model: { ...modelRef.current, text: liveText },
      },
    );
    if (!resolved) return false;
    const { from, to, replacement } = resolved;
    view.dispatch({
      changes: { from, to, insert: replacement },
    });
    return true;
  }, [document.id, document.revision, document.sourceModified, document.status, editor, readOnly]);

  const agentBindingStateRef = useRef({
    document,
    readOnly,
    applyChangeSet: handleApplyAgentChangeSet,
  });
  agentBindingStateRef.current = {
    document,
    readOnly,
    applyChangeSet: handleApplyAgentChangeSet,
  };
  const agentBinding = useMemo<ActiveAgentEditorBinding>(() => ({
    get document() { return agentBindingStateRef.current.document; },
    extensionId: markdownAgentExtension.id,
    fileType: markdownAgentExtension.fileType,
    skillId: markdownAgentExtension.skillId,
    tools: markdownAgentExtension.tools,
    get activeContextId() { return markdownSelectionContext(editor.getView()); },
    get readOnly() { return agentBindingStateRef.current.readOnly; },
    buildContext: () => markdownAgentExtension.buildContext(
      modelRef.current,
      markdownSelectionContext(editor.getView()),
      agentBindingStateRef.current.document.revision,
    ),
    createToolExecutor: () => createAgentToolHost({
      extension: markdownAgentExtension,
      context: {
        documentId: agentBindingStateRef.current.document.id,
        revision: agentBindingStateRef.current.document.revision,
        documentStatus: agentBindingStateRef.current.document.status,
        sourceModified: agentBindingStateRef.current.document.sourceModified,
        activeContextId: markdownSelectionContext(editor.getView()),
        model: structuredClone(modelRef.current),
      },
    }),
    describeChangeSet: (changeSet) => markdownAgentExtension.describeChangeSet(
      changeSet as AgentChangeSet<MarkdownAgentOperation>,
    ),
    applyChangeSet: (changeSet) => agentBindingStateRef.current.applyChangeSet(changeSet),
  }), [document.id]);

  useEffect(() => {
    onAgentBindingChange(agentBinding, document.id);
  }, [agentBinding, document.id, onAgentBindingChange]);

  useEffect(() => () => {
    onAgentBindingChange(undefined, document.id);
  }, [document.id, onAgentBindingChange]);

  const headings = useMemo(() => projectHeadings(previewText), [previewText]);
  const jumpToHeading = (heading: MarkdownHeading) => {
    const view = editor.getView();
    if (!view) return;
    view.dispatch({
      selection: { anchor: Math.min(heading.offset, view.state.doc.length) },
      effects: EditorView.scrollIntoView(Math.min(heading.offset, view.state.doc.length), { y: "center" }),
    });
    view.focus();
  };

  const preview = (
    <MarkdownPreview
      text={previewText}
      previewRef={previewRef}
      documentFullPath={documentFullPath}
      onOpenDocumentLink={onOpenDocumentLink}
      onScrollRatio={(ratio) => {
        if (!scrollSync || syncingScroll.current) return;
        syncingScroll.current = true;
        editor.scrollToRatio(ratio);
        requestAnimationFrame(() => { syncingScroll.current = false; });
      }}
    />
  );

  return (
    <div className="ideanote-markdown-editor flex h-full min-h-0 flex-col">
      <div className="ideanote-markdown-toolbar flex h-10 flex-none items-center justify-start gap-2 px-2.5">
        <div className="flex items-center gap-0.5">
          <ToolbarButton label={showOutline ? "Hide outline" : "Show outline"} onClick={() => updateEditorState({ showOutline: !showOutline })}>
            {showOutline ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </ToolbarButton>
        </div>
        <div className="flex items-center gap-2">
          {model.lineEnding === "mixed" && !model.normalization && (
            <label className="ideanote-markdown-normalization flex items-center gap-1.5 text-[11px] font-medium">
              Normalize line endings
              <select
                className="h-7 rounded-md px-1.5 text-[11px] outline-none"
                defaultValue=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  const next = normalizeMarkdownLineEndings(modelRef.current, event.target.value as "lf" | "crlf");
                  modelRef.current = next;
                  onModelChange(document.id, next);
                }}
              >
                <option value="" disabled>Choose…</option>
                <option value="lf">LF</option>
                <option value="crlf">CRLF</option>
              </select>
            </label>
          )}
          <button type="button" onClick={() => updateEditorState({ scrollSync: !scrollSync })} className={`ideanote-markdown-sync rounded-md px-2 py-1 text-[11px] font-medium ${scrollSync ? "is-active" : ""}`}>Sync scroll</button>
          <div className="ideanote-markdown-view-modes flex rounded-lg p-0.5" aria-label="Markdown view mode">
            {([
              ["edit", <ListTree key="edit" size={13} />, "Edit"],
              ["split", <Rows3 key="split" size={13} />, "Split"],
              ["preview", <Eye key="preview" size={13} />, "Preview"],
            ] as const).map(([mode, icon, label]) => (
              <button key={mode} type="button" title={label} aria-pressed={viewMode === mode} onClick={() => updateEditorState({ viewMode: mode })} className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium ${viewMode === mode ? "is-active" : ""}`}>
                {icon}<span>{label}</span>
              </button>
            ))}
          </div>
          {viewMode !== "preview" && (
            <div className="ideanote-markdown-history" aria-label="Markdown history">
              <ToolbarButton label="Undo" disabled={readOnly || !editor.canUndo} onClick={editor.undo}><Undo2 size={14} /></ToolbarButton>
              <ToolbarButton label="Redo" disabled={readOnly || !editor.canRedo} onClick={editor.redo}><Redo2 size={14} /></ToolbarButton>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {showOutline && (
          <aside className="ideanote-markdown-outline w-52 flex-none overflow-auto px-2 py-3" aria-label="Document outline">
            <div className="ideanote-markdown-outline__label px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em]">Outline</div>
            {headings.length === 0 ? (
              <div className="ideanote-markdown-outline__empty px-2 py-6 text-xs leading-5">Add headings to navigate this document.</div>
            ) : headings.map((heading) => (
              <button key={`${heading.line}-${heading.id}`} type="button" onClick={() => jumpToHeading(heading)} className="ideanote-markdown-outline__item block w-full truncate rounded-md py-1.5 pr-2 text-left text-xs" style={{ paddingLeft: `${8 + (heading.level - 1) * 10}px` }} title={heading.text}>
                {heading.text}
              </button>
            ))}
          </aside>
        )}
        <div ref={splitContainerRef} className={`relative flex min-w-0 flex-1 ${resizingSplit ? "select-none" : ""}`}>
          <div
            className={`relative min-w-0 overflow-hidden ${viewMode === "preview" ? "invisible" : ""}`}
            aria-hidden={viewMode === "preview"}
            style={{ width: viewMode === "preview" ? 0 : viewMode === "split" ? `${splitRatio * 100}%` : "100%" }}
          >
            <div ref={editor.hostRef} className="ideanote-markdown-source h-full" aria-label="Markdown source editor" />
          </div>
          {viewMode === "split" && (
            <div
              role="separator"
              aria-label="Resize Markdown source and preview"
              aria-orientation="vertical"
              className={`ideanote-markdown-split-divider relative z-10 w-px flex-none cursor-col-resize before:absolute before:-left-1.5 before:top-0 before:h-full before:w-3 ${resizingSplit ? "is-resizing" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault();
                setResizingSplit(true);
              }}
            />
          )}
          {(viewMode === "preview" || viewMode === "split") && (
            <div className="min-w-0" style={{ width: viewMode === "split" ? `${(1 - splitRatio) * 100}%` : "100%" }}>{preview}</div>
          )}
          {previewStale && viewMode !== "edit" && (
            <div className="ideanote-markdown-preview-status pointer-events-none absolute right-4 top-3 rounded-full px-2 py-1 text-[10px] font-medium">Updating preview…</div>
          )}
        </div>
      </div>
    </div>
  );
}
