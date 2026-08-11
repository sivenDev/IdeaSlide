export function buildOutline(source) {
  return source.split(/\r?\n/).map((line, index) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    return match ? { level: match[1].length, text: match[2].trim(), line: index + 1 } : null;
  }).filter(Boolean);
}

export function normalizeLineEndings(source, mode) {
  const lf = source.replace(/\r\n/g, "\n");
  return mode === "crlf" ? lf.replace(/\n/g, "\r\n") : lf;
}

export function insertMarkdown(view, before, after = before, placeholder = "text") {
  const selection = view.state.selection.main;
  const selected = view.state.sliceDoc(selection.from, selection.to) || placeholder;
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: `${before}${selected}${after}` },
    selection: { anchor: selection.from + before.length, head: selection.from + before.length + selected.length },
    scrollIntoView: true,
  });
  view.focus();
}
