import { createElement, useEffect, useMemo, useState } from "react";
import type { ComponentPropsWithoutRef, RefObject } from "react";
import GithubSlugger from "github-slugger";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { readDocumentImage } from "../lib/tauriCommands";
import {
  classifyCodeBlock,
  indexSpecialCodeBlocks,
  markdownHtmlSchema,
  normalizeCodeLanguage,
  stripMarkdownFrontmatter,
} from "../lib/markdownPreview";
import { HtmlCodePreview } from "./HtmlCodePreview";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";
import { MermaidCodePreview } from "./MermaidCodePreview";

function MarkdownPreviewImage({
  src = "",
  alt = "",
  title,
  documentFullPath,
}: {
  src?: string;
  alt?: string;
  title?: string;
  documentFullPath?: string;
}) {
  const [resolved, setResolved] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(src)) {
      setResolved(src);
      return;
    }
    if (!documentFullPath || !src || /^\w+:\/\//.test(src) || !("__TAURI_INTERNALS__" in window)) {
      setResolved(undefined);
      setFailed(Boolean(src));
      return;
    }
    let cancelled = false;
    readDocumentImage(documentFullPath, src)
      .then((value) => { if (!cancelled) setResolved(value); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [documentFullPath, src]);
  if (resolved) return <img src={resolved} alt={alt} title={title} />;
  return <span className="ideanote-markdown-image-status inline-flex rounded-md border border-dashed px-2 py-1 text-xs">{failed ? `Image unavailable: ${alt || src}` : "Loading image…"}</span>;
}

interface CodeProps extends ComponentPropsWithoutRef<"code"> {
  node?: { position?: { start: { line: number }; end: { line: number } } };
}

export function MarkdownPreview({
  text,
  previewRef,
  documentFullPath,
  onOpenDocumentLink,
  onScrollRatio,
}: {
  text: string;
  previewRef: RefObject<HTMLDivElement | null>;
  documentFullPath?: string;
  onOpenDocumentLink?: (href: string) => void;
  onScrollRatio?: (ratio: number) => void;
}) {
  const renderedText = useMemo(() => stripMarkdownFrontmatter(text), [text]);
  const specialBlockIndexes = useMemo(() => indexSpecialCodeBlocks(renderedText), [renderedText]);
  const components = useMemo<Components>(() => {
    const slugger = new GithubSlugger();
    const heading = (level: number) => ({ children }: { children?: React.ReactNode }) => {
      const headingText = String(children ?? "");
      return createElement(`h${level}`, { id: slugger.slug(headingText) }, children);
    };
    return {
      h1: heading(1), h2: heading(2), h3: heading(3),
      h4: heading(4), h5: heading(5), h6: heading(6),
      a: ({ href = "", children }) => (
        <a
          href={href}
          onClick={(event) => {
            event.preventDefault();
            if (href.startsWith("#")) {
              previewRef.current?.querySelector<HTMLElement>(`#${CSS.escape(href.slice(1))}`)?.scrollIntoView({ behavior: "smooth" });
            } else if (/^https?:\/\//i.test(href)) {
              void openUrl(href);
            } else if (href) {
              onOpenDocumentLink?.(href);
            }
          }}
        >{children}</a>
      ),
      img: ({ src = "", alt = "", title }) => (
        <MarkdownPreviewImage
          src={typeof src === "string" ? src : ""}
          alt={alt ?? ""}
          title={title ?? undefined}
          documentFullPath={documentFullPath}
        />
      ),
      pre: ({ children }) => <>{children}</>,
      code: ({ className = "", children, node, ...props }: CodeProps) => {
        const source = String(children ?? "").replace(/\n$/, "");
        const fenced = /^language-/.test(className) || Boolean(node?.position && node.position.start.line !== node.position.end.line);
        if (!fenced) return <code className={className} {...props}>{children}</code>;
        const language = normalizeCodeLanguage(className);
        const specialBlockIndex = node?.position
          ? specialBlockIndexes.get(node.position.start.line) ?? 0
          : 0;
        const descriptor = classifyCodeBlock(source, language, specialBlockIndex);
        if (descriptor.kind === "mermaid") return <MermaidCodePreview source={source} />;
        if (descriptor.kind === "html") return <HtmlCodePreview source={source} />;
        return (
          <MarkdownCodeBlock
            source={source}
            language={descriptor.language}
            status={descriptor.message ? <span className="ideanote-markdown-code-block__limit">{descriptor.message}</span> : undefined}
          />
        );
      },
    };
  }, [documentFullPath, onOpenDocumentLink, previewRef, specialBlockIndexes]);

  return (
    <div
      ref={previewRef}
      className="ideanote-markdown-preview h-full overflow-auto"
      onScroll={() => {
        const element = previewRef.current;
        if (!element) return;
        const range = element.scrollHeight - element.clientHeight;
        onScrollRatio?.(range > 0 ? element.scrollTop / range : 0);
      }}
    >
      <div className="mx-auto max-w-[780px] px-10 py-10 pb-32">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownHtmlSchema]]}
          components={components}
        >{renderedText}</ReactMarkdown>
      </div>
    </div>
  );
}
