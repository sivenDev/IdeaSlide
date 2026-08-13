import DOMPurify from "dompurify";
import { sanitizePreviewCss } from "./markdownPreview";

const HTML_PREVIEW_TAGS = [
  "a", "abbr", "article", "aside", "b", "blockquote", "br", "caption", "code", "col", "colgroup",
  "dd", "del", "details", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "h1", "h2",
  "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "ins", "kbd", "li", "main", "mark",
  "nav", "ol", "p", "pre", "q", "s", "samp", "section", "small", "span", "strong", "style",
  "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul", "var",
];

const HTML_PREVIEW_ATTRIBUTES = [
  "alt", "aria-label", "class", "colspan", "datetime", "dir", "height", "id", "lang", "role", "rowspan",
  "scope", "span", "start", "style", "title", "width",
];

export function sanitizeHtmlFragment(source: string): string {
  const scrubbedStyles = source
    .replace(
      /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
      (_match, open: string, css: string, close: string) => `${open}${sanitizePreviewCss(css)}${close}`,
    )
    .replace(
      /\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi,
      (_match, quote: string, css: string) => ` style=${quote}${sanitizePreviewCss(css)}${quote}`,
    );
  return DOMPurify.sanitize(scrubbedStyles, {
    ALLOWED_TAGS: HTML_PREVIEW_TAGS,
    ALLOWED_ATTR: HTML_PREVIEW_ATTRIBUTES,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  }).trim();
}
