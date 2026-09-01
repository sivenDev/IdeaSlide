---
id: "B054"
title: "Fix Agent Markdown Rendering"
type: "bugfix"
status: "complete"
summary: "Keep streaming Agent Markdown readable while preserving the exact formatted final response."
source: "docs/superplan/human/bugs.md"
created: "2026-09-01"
order: 54
depends_on: ["B029"]
parent: ""
---

# Fix Agent Markdown Rendering Plan

**Goal:** Prevent partial Agent answer delivery from exposing Markdown delimiters or collapsing block structure in the transcript.
**Scope:** Normalize the Agent Markdown rendering input for incomplete presentation snapshots, keep headings, paragraphs, lists, emphasis, and fenced code readable while text is revealing, keep code-copy controls stable until a fence is complete, and ensure settled rendering remains the exact authoritative Markdown response with raw HTML disabled and safe links preserved.
**Non-Goals:** Do not change persisted Agent content, runtime protocol events, provider behavior, Markdown editor/preview rendering, raw HTML policy, or the separate paced presentation timing contract.
**Architecture:** The presentation controller remains the source of displayed prefixes. `AgentMarkdown` will use one renderer path with a small streaming-only projection that balances incomplete block syntax and inserts missing block boundaries without mutating settled content. The projection is ephemeral and only affects the `settled=false` view; completed responses render the original bytes unchanged.
**Baseline:** `AgentItem` passes the paced `displayedContent` to `AgentMarkdown` while `presentationStatus` is `revealing`. ReactMarkdown parses that prefix as ordinary Markdown, so an incomplete `**` or fence can display literal syntax and adjacent block text until the next chunk arrives. Existing tests cover renderer dependencies and safety but not incomplete-delivery DOM behavior.
**Reproduction:** In a burst/atomic Turn, capture a presentation prefix inside an emphasis delimiter or before a closing code fence, such as `## Summary\n\nThis is **importan` or `````ts\nconst x = 1```. During `presentationStatus=revealing`, the transcript shows literal Markdown markers or inline text where the final response has a heading, paragraph, or code block.
**Root Cause:** B029 correctly projects a received prefix for visible cadence, but sends that syntactically incomplete prefix directly to ReactMarkdown. Markdown block and delimiter parsing is not incremental; incomplete emphasis/fence syntax is rendered literally and missing blank-line boundaries can merge adjacent blocks. The defect is in the presentation-only renderer projection, not in authoritative Agent content or transport ordering.
**Exit Criteria:** Streaming prefixes render without visible unmatched emphasis/fence markers, headings and paragraphs remain visually separated, code blocks do not expose unstable Copy behavior before closure, and settled output is byte-identical to the source Markdown. Existing safe-link, GFM, raw-HTML, code-copy, reduced-motion, and Agent transcript tests remain green.

## Task 1: Capture the Incomplete-Markdown Regression

**Outcome:** Focused tests distinguish incomplete streaming syntax from settled Markdown and document the observed rendering contract.
**Files:**
- Modify: `tests/agentMarkdown.test.mjs`
- Modify: `tests/agentTextPresentation.test.mjs`

**Reproduction:** Render representative presentation prefixes containing incomplete emphasis, headings followed by text, list boundaries, and an unclosed fenced code block; assert the current projection exposes the malformed intermediate form while the settled source remains correct.
**Root Cause Check:** Verify that the failing input is the `displayedContent` prefix passed by `AgentItem`, not a changed persisted `item.content` or runtime delta.
**Verification:**
- `node --test tests/agentMarkdown.test.mjs tests/agentTextPresentation.test.mjs`

- [x] Add a trustworthy focused regression for incomplete emphasis, block boundaries, and fences.
- [x] Confirm settled content remains unchanged in the fixture.

## Task 2: Stabilize Streaming Agent Markdown

**Outcome:** Incomplete displayed prefixes are rendered as readable Markdown without altering settled responses or weakening safety.
**Files:**
- Modify: `src/components/agent/AgentMarkdown.tsx`
- Create: `src/lib/agent/agentMarkdownPresentation.ts`
- Test: `tests/agentMarkdown.test.mjs`
- Test: `tests/agentItems.test.mjs`

**Change Map:**
- streaming projection: normalize line endings, preserve block boundaries, balance only incomplete emphasis/fence syntax for the ephemeral prefix, and mark unstable code-copy controls disabled until settled
- renderer contract: keep one ReactMarkdown + remark-gfm path, safe external links, and no raw HTML plugin or `dangerouslySetInnerHTML`
- visual contract: preserve whitespace, heading/list spacing, and code-block layout while the reveal indicator is active

**Verification:**
- `node --test tests/agentMarkdown.test.mjs tests/agentItems.test.mjs tests/agentTextPresentation.test.mjs`
- Assert incomplete prefixes contain no visible unmatched delimiters, block structure remains separated, settled output uses the original source, and unsafe HTML/link behavior is unchanged.

- [x] Implement the smallest streaming-only Markdown projection.
- [x] Add renderer and item-level contract assertions.
- [x] Verify settled DOM/source equivalence and accessibility behavior.

## Task 3: Complete Regression and Delivery Evidence

**Outcome:** B054 is documented as complete with focused, build, and relevant full-suite evidence.
**Files:**
- Modify: `docs/superplan/plans/bugs/B054-agent-markdown-rendering-defect.md`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`

**Verification:**
- `node --test tests/agentMarkdown.test.mjs tests/agentItems.test.mjs tests/agentTextPresentation.test.mjs`
- `npm run build`
- `git diff --check`

- [x] Record reproduction, root-cause check, and final evidence.
- [x] Mark B054 complete and the human bug done.
- [x] Create a separate `fix(B054)` delivery commit.

## Completion Evidence

- Focused Markdown/presentation/editor tests: `node --test tests/agentMarkdown.test.mjs tests/agentItems.test.mjs tests/agentTextPresentation.test.mjs tests/agentDirectEditorContract.test.mjs tests/ideaSketchAgentExtension.test.mjs tests/agentToolHost.test.mjs` (33 passed).
- Production build: `npm run build` (passed; existing Vite chunk-size and dynamic-import warnings only).
- `git diff --check` passed.

## References
- `docs/superplan/human/bugs.md#B054`
- `docs/superplan/plans/bugs/B029-make-burst-agent-answers-visibly-progressive.md`
- `src/components/agent/AgentMarkdown.tsx`
- `src/components/agent/AgentItem.tsx`
- `src/lib/agent/agentTextPresentation.ts`
- `src/lib/agent/agentMarkdownPresentation.ts`
