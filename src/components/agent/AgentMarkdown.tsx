import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function plainText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(plainText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return plainText((children as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function AgentCodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(plainText(children).replace(/\n$/, ""));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="ideanote-agent-markdown__code-block">
      <button type="button" onClick={() => void copy()} aria-label="Copy code">
        {copied ? <Check aria-hidden size={11} /> : <Copy aria-hidden size={11} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

export function AgentMarkdown({ content }: { content: string }) {
  return (
    <div className="ideanote-agent-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
          ),
          pre: ({ children }) => <AgentCodeBlock>{children}</AgentCodeBlock>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
