import { Check, Copy } from "lucide-react";
import { common, createLowlight } from "lowlight";
import { createElement, useMemo, useState } from "react";

const lowlight = createLowlight(common);

interface HighlightNode {
  type: "text" | "element";
  value?: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HighlightNode[];
}
function renderHighlightNode(node: HighlightNode, key: string): React.ReactNode {
  if (node.type === "text") return node.value ?? "";
  const tagName = node.tagName === "span" ? "span" : "span";
  return createElement(
    tagName,
    { key, className: node.properties?.className?.join(" ") },
    node.children?.map((child, index) => renderHighlightNode(child, `${key}-${index}`)),
  );
}

function highlightedSource(source: string, language: string): React.ReactNode {
  if (!lowlight.registered(language)) return source;
  try {
    const tree = lowlight.highlight(language, source);
    return tree.children.map((node, index) => renderHighlightNode(node as HighlightNode, String(index)));
  } catch {
    return source;
  }
}

export function MarkdownCodeBlock({
  source,
  language,
  status,
}: {
  source: string;
  language: string;
  status?: React.ReactNode;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const highlighted = useMemo(() => highlightedSource(source, language), [language, source]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <section className="ideanote-markdown-code-block" aria-label={`${language} code block`}>
      <header className="ideanote-markdown-code-block__header">
        <span className="ideanote-markdown-code-block__language">{language === "text" ? "Plain text" : language}</span>
        <div className="ideanote-markdown-code-block__actions">
          {status}
          <button type="button" onClick={() => void copy()} aria-label="Copy code">
            {copyState === "copied" ? <Check size={13} /> : <Copy size={13} />}
            <span>{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}</span>
          </button>
        </div>
      </header>
      <pre><code className={`hljs language-${language}`}>{highlighted}</code></pre>
    </section>
  );
}
