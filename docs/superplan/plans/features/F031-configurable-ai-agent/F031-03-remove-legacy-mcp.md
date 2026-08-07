---
id: "F031-03"
title: "Remove the Legacy MCP Runtime"
type: "feature"
status: "draft"
summary: "Delete the legacy stdio MCP server, hidden renderer, frontend bridge, dependency, and active documentation after Agent replacement coverage is proven."
source: "docs/superplan/human/features.md"
created: "2026-08-08"
order: 33
depends_on: ["F031-02"]
parent: "F031"
---

# Remove the Legacy MCP Runtime Plan

**Goal:** Leave IdeaNote with one in-app Agent architecture by deleting the obsolete MCP runtime and every production-only integration boundary that supported it.
**Scope:** Prove that the generic Agent plus IdeaSketch extension covers the reusable file/Page read and mutation outcomes needed by the product, then remove the `--mcp` and `--visible` startup behavior, stdio MCP server, `rmcp` dependency, MCP service/tool/session modules, hidden MCP renderer window, renderer-ready state, MCP-only Tauri commands/events/capabilities, visible-MCP read-only frontend mode, MCP renderer bridge, and active user/developer documentation that instructs users to run or configure the MCP server. Preserve the independent hidden `preview-renderer` used by current Page thumbnails/preview flows. Retain immutable historical Superplan delivery records and explicitly historical design documents as history rather than rewriting their evidence.
**Non-Goals:** This plan does not remove the Model Context Protocol concept from third-party history, rename unrelated technical `idea-slide` identifiers, delete generic file-format/document services merely because MCP called them, change the new Agent's Tool/Skill contract, remove the preview renderer, or add another external automation protocol. It does not claim protocol compatibility between the removed MCP server and the in-app Agent.
**Architecture:** MCP-specific adapters are deleted only after F031-02 behavior tests prove replacement outcomes. Pure document and IdeaSketch logic remains in canonical format/editor modules or the new Agent extension; no surviving production module may import from an `mcp` namespace. `src-tauri/src/lib.rs` returns to one normal application startup path plus the existing preview-renderer setup. `AppContent` recognizes only the preview renderer, has no MCP visibility/read-only state, and never invokes MCP commands. Tauri capabilities list only surviving windows. Current documentation describes Agent Skills/Tools and Settings; completed plan evidence remains untouched and is excluded from zero-reference searches by explicit historical paths.
**Baseline:** `src-tauri/src/mcp/` contains the stdio server, services, tools, session manager, preview bridge, schemas, and tests. `src-tauri/src/lib.rs` parses `--mcp`, manages MCP readiness/visibility, creates `mcp-renderer`, hides or retitles the main window, and starts the server. `src/App.tsx` initializes the MCP renderer and makes the visible MCP editor read-only. `src/lib/mcpRenderer.ts` renders Excalidraw scenes for MCP preview requests. `rmcp` is a direct Cargo dependency, Tauri capabilities include `mcp-renderer`, and active documentation still describes MCP usage. The separate `preview-renderer` and `src/lib/previewRenderer.ts` are current application infrastructure and must remain.
**Exit Criteria:** The `src-tauri/src/mcp/` tree and `src/lib/mcpRenderer.ts` are absent. The binary ignores no undocumented MCP mode because `--mcp`/`--visible` parsing and server startup no longer exist; normal and file-association startup remain correct. Cargo has no direct or transitive dependency introduced solely by `rmcp`, the capability window list excludes `mcp-renderer`, and production source contains no MCP command, event, state, renderer label, or visible-mode read-only branch. The preview renderer still initializes, renders thumbnails/previews, and retains required permissions. Active README/current-product documentation contains no setup or usage instructions for the removed server, while historical Superplan/Superpowers evidence stays intact. Equivalent Agent tests cover current file outline/Page reads, Page creation/reorder/content proposals, reviewed apply, preview/review display where required, and safe persistence. Full frontend/Rust regressions, builds, startup/file-association/preview/Agent native smokes, lockfile inspection, and scoped zero-reference searches pass.

## Task 1: Lock the MCP Replacement and Deletion Matrix

**Outcome:** Every removed MCP capability is classified as replaced, obsolete, or preserved in a non-MCP canonical service before deletion starts.
**Files:**
- Create: `tests/mcpRemoval.test.mjs`
- Modify: `tests/ideaSketchAgentExtension.test.mjs`
- Modify: `tests/agentChangeReview.test.mjs`
- Test: `src-tauri/src/document_formats/idea_sketch.rs`
- Test: `src-tauri/src/agent/`

**Change Map:**
- replacement matrix: file/document inspection, Page list/read/create/delete/reorder/content changes, incremental proposal behavior, preview/review needs, and UI refresh outcomes
- deletion contract: forbidden production paths/symbols/dependencies/events/window labels/CLI flags plus explicit historical-path exclusions
- preserved services: canonical document format, Workspace, safe-write, preview renderer, editor session, and Agent extension ownership

**Verification:**
- `node --test tests/mcpRemoval.test.mjs tests/ideaSketchAgentExtension.test.mjs tests/agentChangeReview.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml document_formats -- --nocapture`

- [ ] Map every MCP tool/runtime/renderer responsibility to replacement, deletion, or preserved canonical ownership.
- [ ] Add failing zero-reference/dependency/startup contracts before removing production code.
- [ ] Confirm Agent mutations remain review-only until applied through the document session.

## Task 2: Delete the Backend MCP Runtime and Startup Mode

**Outcome:** Tauri starts only the IdeaNote application and surviving preview infrastructure, with no stdio automation server or MCP-specific state.
**Files:**
- Remove: `src-tauri/src/mcp/`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/capabilities/default.json`
- Test: `tests/mcpRemoval.test.mjs`
- Modify: `src-tauri/src/document_formats/idea_sketch.rs`

**Change Map:**
- Rust module tree: remove MCP server, schemas, handlers, service wrappers, session manager, render bridge, and MCP-scoped tests
- app startup: remove CLI mode detection, hidden/visible main-window behavior, MCP readiness/visibility state, `mcp_renderer_ready`/`is_mcp_visible`, MCP renderer creation, and stdio task
- dependency/capabilities: remove `rmcp` and MCP-only transitive lock entries when unused; remove `mcp-renderer` from allowed windows while preserving `preview-renderer`
- canonical format tests: retain any formerly MCP-only Page invariants that remain product requirements under Agent tools

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo tree --manifest-path src-tauri/Cargo.toml -i rmcp` must report no package.
- Source contract: no production `mod mcp`, `--mcp`, `McpRendererReady`, `McpVisible`, `mcp_renderer_ready`, `is_mcp_visible`, `mcp-renderer`, or `mcp::start_server` references.

- [ ] Remove the complete MCP backend tree and startup lifecycle.
- [ ] Preserve canonical IdeaSketch/file behavior tests outside the deleted namespace where still required.
- [ ] Remove MCP-only dependencies and capabilities without touching preview-renderer support.

## Task 3: Remove the Frontend Bridge and Active MCP Documentation

**Outcome:** The React application and current documentation expose only the new Settings/Agent architecture.
**Files:**
- Remove: `src/lib/mcpRenderer.ts`
- Modify: `src/App.tsx`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Remove: `docs/mcp-comparison.md`
- Modify where active MCP instructions exist: `docs/file-format.md`
- Modify where active MCP instructions exist: `docs/workspace-format.md`
- Modify: `tests/mcpRemoval.test.mjs`
- Modify: `tests/tauriCommands.test.mjs`

**Change Map:**
- `AppContent`: preview-renderer-only detection/initialization, no MCP renderer import, no visible-mode query, no MCP-derived read-only editor state
- active docs: remove installation, launch, comparison, and usage guidance for the retired server; point automation capability to the in-app Agent extension model where appropriate
- historical boundary: do not edit completed Superplan delivery evidence or `docs/superpowers/plans/2026-03-15-mcp-server.md` except if a separate explicit archival marker is required by repository navigation

**Verification:**
- `node --test tests/mcpRemoval.test.mjs tests/tauriCommands.test.mjs tests/pageThumbnails.test.mjs tests/slideThumbnails.test.mjs tests/previewKeys.test.mjs`
- `npm run build`
- Scoped search across production and active documentation finds no MCP runtime/usage references; historical plan paths are reported separately and accepted.
- Browser/Tauri smoke: normal launch, hidden preview renderer, Page thumbnails/previews, file association, configured Agent run, and AI-disabled launch.

- [ ] Delete the frontend MCP renderer and visible-MCP read-only behavior.
- [ ] Remove current-product MCP instructions while preserving explicit historical evidence.
- [ ] Verify the preview renderer and Agent UI remain independent and functional.

## Task 4: Verify Complete MCP Retirement

**Outcome:** No executable or active-documentation MCP surface remains, and the new Agent is the sole AI automation architecture.
**Files:**
- Modify: `docs/superplan/plans/features/F031-configurable-ai-agent/F031-03-remove-legacy-mcp.md`

**Change Map:**
- plan evidence: replacement matrix, deleted files/dependencies/events/windows, zero-reference results, preview preservation, Agent regression, startup/file association, and documentation scope

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `git diff --check`
- Native acceptance: normal launch, Home/Settings, Workspace and Single File edit/save, Page preview/thumbnail, Agent read/propose/review/apply/undo, AI disabled startup, file association, and confirmation that `--mcp` no longer creates a mode/server/window.

- [ ] Run the focused removal checks during deletion and the complete regression/build/startup matrix once stable.
- [ ] Record scoped zero-reference, lockfile, preview-renderer, Agent replacement, and native startup evidence before completion.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/01-shared-document-kernel-and-is-v1.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/features/F002-workspace-resource-explorer.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `src-tauri/src/mcp/`
- `src-tauri/src/lib.rs`
- `src/App.tsx`
- `src/lib/mcpRenderer.ts`
- `src/lib/previewRenderer.ts`
- `src-tauri/capabilities/default.json`
