import { useCallback, useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";

interface UseCodeMirrorEditorOptions {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
  onScroll?: (ratio: number) => void;
}

export interface CodeMirrorEditorHandle {
  hostRef: React.RefObject<HTMLDivElement | null>;
  getView: () => EditorView | undefined;
  undo: () => boolean;
  redo: () => boolean;
  focus: () => void;
  replaceSelection: (text: string) => void;
  wrapSelection: (before: string, after?: string) => void;
  scrollToRatio: (ratio: number) => void;
}

export function useCodeMirrorEditor({
  value,
  readOnly,
  onChange,
  onScroll,
}: UseCodeMirrorEditorOptions): CodeMirrorEditorHandle {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | undefined>(undefined);
  const readOnlyCompartment = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onScrollRef = useRef(onScroll);
  const applyingExternalValue = useRef(false);
  onChangeRef.current = onChange;
  onScrollRef.current = onScroll;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          dropCursor(),
          highlightActiveLine(),
          markdown(),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !applyingExternalValue.current) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.domEventHandlers({
            scroll: (_event, mountedView) => {
              const element = mountedView.scrollDOM;
              const range = element.scrollHeight - element.clientHeight;
              onScrollRef.current?.(range > 0 ? element.scrollTop / range : 0);
            },
          }),
          EditorView.theme({
            "&": { height: "100%", backgroundColor: "#fbfbfc", color: "#22242b" },
            ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: "13px", lineHeight: "1.72" },
            ".cm-content": { padding: "24px 20px 96px" },
            ".cm-gutters": { backgroundColor: "#f4f5f7", color: "#a0a5ae", borderRight: "1px solid #e4e6eb" },
            ".cm-activeLine": { backgroundColor: "#f0efff70" },
            ".cm-activeLineGutter": { backgroundColor: "#e8e7fb", color: "#625dd6" },
            ".cm-selectionBackground, ::selection": { backgroundColor: "#d9d7ff !important" },
            ".cm-focused": { outline: "none" },
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)) });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    applyingExternalValue.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      annotations: Transaction.addToHistory.of(false),
    });
    applyingExternalValue.current = false;
  }, [value]);

  const replaceSelection = useCallback((text: string) => {
    const view = viewRef.current;
    if (!view || readOnly) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  }, [readOnly]);

  const wrapSelection = useCallback((before: string, after = before) => {
    const view = viewRef.current;
    if (!view || readOnly) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const insert = `${before}${selected}${after}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    });
    view.focus();
  }, [readOnly]);

  return {
    hostRef,
    getView: () => viewRef.current,
    undo: () => Boolean(viewRef.current && undo(viewRef.current)),
    redo: () => Boolean(viewRef.current && redo(viewRef.current)),
    focus: () => viewRef.current?.focus(),
    replaceSelection,
    wrapSelection,
    scrollToRatio: (ratio) => {
      const element = viewRef.current?.scrollDOM;
      if (!element) return;
      element.scrollTop = Math.max(0, Math.min(1, ratio)) * Math.max(0, element.scrollHeight - element.clientHeight);
    },
  };
}
