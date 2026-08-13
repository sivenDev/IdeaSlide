import { Code2, Eye } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildHtmlPreviewDocument,
  estimateHtmlPreviewHeight,
} from "../lib/markdownPreview";
import { sanitizeHtmlFragment } from "../lib/htmlPreviewSecurity";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";

export function HtmlCodePreview({ source }: { source: string }) {
  const [mode, setMode] = useState<"preview" | "source">("preview");
  const sanitized = useMemo(() => sanitizeHtmlFragment(source), [source]);
  const previewDocument = useMemo(() => buildHtmlPreviewDocument(sanitized), [sanitized]);

  const status = (
    <div className="ideanote-markdown-code-block__modes" aria-label="HTML code view">
      <button type="button" className={mode === "preview" ? "is-active" : ""} aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>
        <Eye size={12} /> Preview
      </button>
      <button type="button" className={mode === "source" ? "is-active" : ""} aria-pressed={mode === "source"} onClick={() => setMode("source")}>
        <Code2 size={12} /> Source
      </button>
    </div>
  );

  if (mode === "source") return <MarkdownCodeBlock source={source} language="html" status={status} />;

  return (
    <section className="ideanote-markdown-code-block is-preview" aria-label="HTML preview block">
      <header className="ideanote-markdown-code-block__header">
        <span className="ideanote-markdown-code-block__language">HTML · sandboxed</span>
        {status}
      </header>
      {sanitized ? (
        <iframe
          className="ideanote-markdown-html-preview"
          title="Sandboxed HTML preview"
          sandbox=""
          srcDoc={previewDocument}
          style={{ height: `${estimateHtmlPreviewHeight(sanitized)}px` }}
        />
      ) : (
        <div className="ideanote-markdown-code-block__notice">Preview contains no supported HTML.</div>
      )}
    </section>
  );
}
