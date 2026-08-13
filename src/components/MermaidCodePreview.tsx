import DOMPurify from "dompurify";
import { Code2, Eye } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";

type MermaidModule = typeof import("mermaid");

let mermaidModulePromise: Promise<MermaidModule> | undefined;
let mermaidRenderQueue = Promise.resolve();

function loadMermaid() {
  mermaidModulePromise ??= import("mermaid");
  return mermaidModulePromise;
}
function renderMermaid(source: string, id: string, dark: boolean): Promise<string> {
  const work = async () => {
    const module = await loadMermaid();
    const mermaid = module.default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
      theme: dark ? "dark" : "neutral",
      flowchart: { htmlLabels: false },
    });
    const result = await mermaid.render(id, source);
    return DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } });
  };
  const result = mermaidRenderQueue.then(work, work);
  mermaidRenderQueue = result.then(() => undefined, () => undefined);
  return result;
}

function currentThemeIsDark() {
  return document.documentElement.dataset.theme === "dark";
}

export function MermaidCodePreview({ source }: { source: string }) {
  const reactId = useId().replace(/[^a-z0-9]/gi, "");
  const [mode, setMode] = useState<"preview" | "source">("preview");
  const [themeRevision, setThemeRevision] = useState(0);
  const [state, setState] = useState<{ svg?: string; error?: string }>({});

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeRevision((value) => value + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (mode !== "preview") return;
    let cancelled = false;
    setState({});
    const timeout = window.setTimeout(() => {
      void renderMermaid(source, `ideanote-mermaid-${reactId}-${themeRevision}`, currentThemeIsDark())
        .then((svg) => { if (!cancelled) setState({ svg }); })
        .catch((error: unknown) => {
          if (!cancelled) setState({ error: error instanceof Error ? error.message : "Mermaid could not render this diagram." });
        });
    }, 140);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [mode, reactId, source, themeRevision]);

  const status = (
    <div className="ideanote-markdown-code-block__modes" aria-label="Mermaid code view">
      <button type="button" className={mode === "preview" ? "is-active" : ""} aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>
        <Eye size={12} /> Preview
      </button>
      <button type="button" className={mode === "source" ? "is-active" : ""} aria-pressed={mode === "source"} onClick={() => setMode("source")}>
        <Code2 size={12} /> Source
      </button>
    </div>
  );

  if (mode === "source") return <MarkdownCodeBlock source={source} language="mermaid" status={status} />;

  return (
    <section className="ideanote-markdown-code-block is-preview" aria-label="Mermaid diagram block">
      <header className="ideanote-markdown-code-block__header">
        <span className="ideanote-markdown-code-block__language">Mermaid · diagram</span>
        {status}
      </header>
      {state.error ? (
        <div className="ideanote-markdown-code-block__notice is-error">Mermaid preview failed: {state.error}</div>
      ) : state.svg ? (
        <div className="ideanote-markdown-mermaid-preview" dangerouslySetInnerHTML={{ __html: state.svg }} />
      ) : (
        <div className="ideanote-markdown-code-block__notice">Rendering diagram…</div>
      )}
    </section>
  );
}
