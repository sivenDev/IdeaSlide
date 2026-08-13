import { defaultKeymap, history, historyKeymap, redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { Braces, Columns2, Eye, PanelLeftClose, PanelLeftOpen, Redo2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildOutline, normalizeLineEndings } from "./markdownModel.js";

function SafeLink({ href = "", children }) {
  const blocked = /^(javascript|data|file):/i.test(href);
  const external = /^https?:/i.test(href);
  if (blocked) return <span className="markdown-link-blocked" title="Blocked unsafe link">{children}</span>;
  return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{children}</a>;
}

export function MarkdownEditor({ document, onChange, onRegisterAdapter, showLineNumbers = false }) {
  const mountRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const lineNumberCompartment = useMemo(() => new Compartment(), []);
  const [mode, setMode] = useState("split");
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [sourceWidth, setSourceWidth] = useState(52);
  const [lineEnding, setLineEnding] = useState(document.lineEnding === "mixed" ? "mixed" : "lf");
  const outline = useMemo(() => buildOutline(document.content), [document.content]);
  onChangeRef.current = onChange;

  useEffect(() => {
    const theme = EditorView.theme({
      "&": { height: "100%", backgroundColor: "transparent", color: "var(--graphite)" },
      ".cm-content": { padding: "24px 30px 64px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12px", lineHeight: "1.7" },
      ".cm-gutters": { backgroundColor: "var(--frost)", color: "var(--muted)", border: "0", fontSize: "9px" },
      ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--selection) 42%, transparent)" },
      ".cm-scroller": { overflow: "auto" },
    });
    const state = EditorState.create({
      doc: document.content,
      extensions: [
        lineNumberCompartment.of(showLineNumbers ? lineNumbers() : []),
        highlightActiveLine(), history(), markdown(), EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]), theme,
        EditorView.editable.of(!document.readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: mountRef.current });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, [document.sessionId, document.readOnly, lineNumberCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: lineNumberCompartment.reconfigure(showLineNumbers ? lineNumbers() : []),
    });
  }, [lineNumberCompartment, showLineNumbers]);

  useEffect(() => {
    if (mode !== "preview") viewRef.current?.requestMeasure();
  }, [mode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === document.content) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: document.content } });
  }, [document.content]);

  useEffect(() => {
    onRegisterAdapter?.({
      type: "markdown",
      getContext: () => ({ selection: viewRef.current?.state.sliceDoc(viewRef.current.state.selection.main.from, viewRef.current.state.selection.main.to) ?? "", outline: buildOutline(viewRef.current?.state.doc.toString() ?? document.content) }),
      applyTransaction: (text) => {
        const view = viewRef.current;
        if (!view || document.readOnly) return false;
        const selection = view.state.selection.main;
        view.dispatch({ changes: { from: selection.from, to: selection.to, insert: text }, scrollIntoView: true });
        return true;
      },
      undo: () => viewRef.current ? undo(viewRef.current) : false,
    });
    return () => onRegisterAdapter?.(null);
  }, [document.sessionId, document.readOnly, onRegisterAdapter]);

  const jumpToLine = (line) => {
    const view = viewRef.current;
    if (!view) return;
    const target = view.state.doc.line(Math.min(line, view.state.doc.lines));
    view.dispatch({ selection: { anchor: target.from }, scrollIntoView: true });
    view.focus();
  };
  const normalize = (next) => {
    setLineEnding(next);
    const normalized = normalizeLineEndings(viewRef.current?.state.doc.toString() ?? document.content, next);
    if (normalized !== document.content) onChange(normalized);
  };

  return (
    <div className="markdown-editor">
      <div className="editor-native-toolbar">
        <button className="markdown-outline-toggle" type="button" aria-label={outlineOpen ? "Hide Outline" : "Show Outline"} title={outlineOpen ? "Hide Outline" : "Show Outline"} onClick={() => setOutlineOpen((value) => !value)}>
          {outlineOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          <span>Outline</span>
        </button>
        <div className="segmented-control" aria-label="Markdown view mode">{[
          ["edit", Braces, "Edit"], ["split", Columns2, "Split"], ["preview", Eye, "Preview"],
        ].map(([value, Icon, label]) => <button key={value} type="button" className={mode === value ? "is-active" : ""} onClick={() => setMode(value)}><Icon size={13} />{label}</button>)}</div>
        <span className="toolbar-spacer" />
        {lineEnding === "mixed" ? <label className="line-ending-choice">Mixed endings<select value={lineEnding} onChange={(event) => normalize(event.target.value)}><option value="mixed">Choose on save</option><option value="lf">Normalize LF</option><option value="crlf">Normalize CRLF</option></select></label> : <span className="toolbar-meta">{lineEnding.toUpperCase()}</span>}
      </div>
      <div className="markdown-workspace">
        {outlineOpen && <aside className="markdown-outline"><span>Outline</span>{outline.map((item) => <button key={`${item.line}-${item.text}`} type="button" style={{ paddingLeft: 9 + (item.level - 1) * 11 }} onClick={() => jumpToLine(item.line)}>{item.text}</button>)}{!outline.length && <p>No headings yet.</p>}</aside>}
        <div className={`markdown-panes markdown-panes--${mode}`} style={{ "--source-width": `${sourceWidth}%` }}>
          <div className="markdown-source" ref={mountRef} />
          {mode === "split" && <input className="markdown-resize" aria-label="Resize Markdown source and preview" aria-valuetext={`${sourceWidth}% source width`} type="range" min="35" max="70" value={sourceWidth} onChange={(event) => setSourceWidth(Number(event.target.value))} />}
          {mode !== "edit" && <article className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: SafeLink }}>{document.content}</ReactMarkdown></article>}
          <div className="markdown-history-controls" aria-label="Markdown history controls">
            <button type="button" aria-label="Undo Markdown edit" title="Undo" onClick={() => viewRef.current && undo(viewRef.current)}><Undo2 size={14} /></button>
            <button type="button" aria-label="Redo Markdown edit" title="Redo" onClick={() => viewRef.current && redo(viewRef.current)}><Redo2 size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
