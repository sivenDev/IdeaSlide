---
id: "F038-02"
title: "Add the Markdown Agent Skill and Native Editor Tools"
type: "feature"
status: "complete"
summary: "Add bounded Markdown reads and direct CodeMirror range edits as a reusable editor Agent Extension with native Undo and no direct file writes."
source: "docs/superplan/human/features.md"
created: "2026-08-10"
order: 45
depends_on: ["F038-01", "B028"]
parent: "F038"
---

# Add the Markdown Agent Skill and Native Editor Tools Plan

**Goal:** Let the existing Agent understand and edit the active Markdown document through the same runtime, Tool Broker, activity UI, and safety contract used by IdeaSketch.
**Scope:** Package a Markdown `SKILL.md`; extend packaged editor-Skill discovery from one hard-coded entry to a small generic bundled registry; register a Markdown Agent Extension through the File Type Registry; provide bounded outline, document, and line/range read Tools; add one direct range-replacement Tool that requires a successful live `read_markdown_range`; bind every Turn to document id, revision, source fingerprint, status, and source-modified marker; and apply a valid replacement through one mounted CodeMirror `EditorView.dispatch` transaction so it appears immediately, participates in native Undo/Redo, and reaches dirty/autosave/Recovery/save only through the normal editor lifecycle. Preserve chronological Tool Activity, cancellation, duplicate-call handling, stale/switch/conflict/read-only rejection, Codex and Compatibility parity, and complete editor/runtime separation.
**Non-Goals:** This plan does not give the Agent direct filesystem, Workspace scan, shell, script, network, MCP, Save, Save As, Recovery, link-opening, or image-writing Tools; expose hidden reasoning; synthesize fake Tool activity; bypass read prerequisites; mutate an unmounted Markdown model; replace the generic Agent runtime/panel; or add Markdown logic to Rust runtime adapters. It does not promise native Undo for any future Markdown operation that cannot be expressed as one CodeMirror transaction.
**Architecture:** The packaged Skill describes Markdown/GFM semantics and routes the model toward the smallest bounded read before editing. Rust's packaged Skill loader becomes an id-to-embedded-asset registry shared by IdeaSketch and Markdown; it remains metadata/instruction loading only and does not gain editor semantics. The TypeScript Markdown extension owns schemas, context, outline/range projection, source fingerprints, range hashes, and opaque Change Set operations. Turn-start Context contains only file metadata, line/character counts, heading summary, selection coordinates, and truncation flags, never the full document. `read_markdown_outline`, `read_markdown_document`, and `read_markdown_range` return bounded line-numbered source with revision/fingerprint evidence; large documents require range reads. `replace_markdown_range.requires = ["read_markdown_range"]`, validates line/column bounds plus the exact captured range hash, and returns one revision-bound mutation envelope. The generic direct-apply adapter revalidates the active binding, then `MarkdownEditor` converts the operation to CodeMirror offsets and dispatches exactly one captured transaction. CodeMirror change events remain the only route to the document model and persistence. The existing Rust Tool Broker, runtime adapters, Agent Panel, store, and activity projection receive only normalized dynamic descriptors/calls/results and require no Markdown branch.
**Baseline:** F033-04 proved a synthetic Markdown-like extension can reuse the generic Agent SDK, F036 removed Change Review in favor of direct editor application, B027 established that editor SDK history is authoritative, and B028 requires a real read before dependent mutation and renders Tools in execution order. The production registry still contains only the IdeaSketch extension. F038-01 will provide the real Markdown model, mounted CodeMirror SDK, safe document lifecycle, and editor registration needed for a production second-editor proof.
**Exit Criteria:** Opening a Markdown document activates only the Markdown Skill and Tools while retaining the same Thread/runtime/panel. A read-only request visibly executes the appropriate bounded read Tool. An edit request executes `read_markdown_range` before `replace_markdown_range`, then applies one visible CodeMirror transaction with no review card or direct file write; native Undo restores the exact prior source and Redo reapplies it; dirty state, autosave/Recovery, save, reopen, and preview update follow the normal Markdown editor pipeline. Mutation without a successful exact range read, with mismatched range hash, stale revision/fingerprint/source marker, switched or unmounted editor, external change, read-only/missing target, invalid range/UTF-16 boundary, duplicate/late result, cancellation, or oversized replacement fails with no model or file mutation. Codex and Compatibility expose the same Tool surface and ordered activity. Switching between IdeaSketch, Markdown, and unsupported files changes extension capabilities without production changes to the generic Tool Broker, runtime adapters, Agent Panel, store, or activity UI. Focused, complete frontend/Rust, strict build, package, privacy, and native saved-file verification pass.

## Task 1: Define the Markdown Skill, Context, and Bounded Read Contract

**Outcome:** The Agent receives enough Markdown structure to choose a real bounded read without injecting full document content at Turn start.
**Files:**
- Create: `src-tauri/agent-skills/markdown/SKILL.md`
- Create: `src-tauri/agent-skills/markdown/references/gfm-editing.md`
- Modify: `src-tauri/src/agent/skills.rs`
- Create: `src/lib/agent/extensions/markdownAgentExtension.ts`
- Create: `src/lib/agent/extensions/markdownAgentTools.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/fileTypeRegistry.ts`
- Modify: `src/lib/agent/agentExtensionRegistry.ts`
- Test: `tests/markdownAgentExtension.test.mjs`
- Modify: `tests/agentExtensionRegistry.test.mjs`
- Modify: `tests/agentToolHost.test.mjs`
- Modify: `tests/agentSecondEditorReuse.test.mjs`
- Test: `src-tauri/src/agent/skills.rs`

**Change Map:**
- Skill: GFM/source terminology, outline-first workflow, precise range edits, link/reference preservation, formatting constraints, and explicit unsupported capabilities
- packaged discovery: generic bundled editor-Skill registry that resolves IdeaSketch and Markdown by id without runtime/editor branches and remains compatible with the later managed-Skills plan
- lean Context: document identity, counts, line-ending policy, bounded heading summary, selection location, and omission/truncation markers without full source
- reads: deterministic schemas and line-numbered bounded outputs for outline, whole document under a strict size limit, and explicit ranges
- prerequisite metadata: replacement requires a successful `read_markdown_range` in the same Turn and carries that read's exact range hash
- registration: File Type Definition links the Markdown file type to its extension without changing generic Agent selection

**Verification:**
- `node --test tests/markdownAgentExtension.test.mjs tests/agentExtensionRegistry.test.mjs tests/agentToolHost.test.mjs tests/agentSecondEditorReuse.test.mjs`
- Cases: correct activation; unsupported file; lean Context; outline bounds; short document read; large document refuses whole read and requires range; range validation; result truncation; prerequisite descriptor; no Save/filesystem capability.

- [x] Package the Markdown Skill, generalize bundled discovery, and lock bounded disclosure with failing tests.
- [x] Implement distinct outline/document/range reads with deterministic schemas and output limits.
- [x] Replace the synthetic second-editor proof with the production Markdown registration while keeping the synthetic isolation regression where useful.

## Task 2: Apply Range Replacements Through One CodeMirror Transaction

**Outcome:** A valid Agent edit is one normal Markdown editor action with native history and no model-first mutation path.
**Files:**
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `src/hooks/useCodeMirrorEditor.ts`
- Modify: `src/lib/agent/extensions/markdownAgentExtension.ts`
- Modify: `src/lib/agent/extensions/markdownAgentTools.ts`
- Modify: `src/lib/agent/changeSet.ts`
- Modify: `src/components/EditorLayout.tsx`
- Test: `tests/markdownAgentExtension.test.mjs`
- Test: `tests/markdownAgentDirectEditorContract.test.mjs`
- Modify: `tests/agentChangeSet.test.mjs`
- Modify: `tests/markdownEditorContract.test.mjs`
- Modify: `tests/recovery.test.mjs`

**Change Map:**
- operation: line/column range, captured source/range fingerprint, replacement text and size bound, base revision/status/source marker, and one-use identity
- apply boundary: active mounted document/extension revalidation, safe CodeMirror offset conversion, UTF-16/surrogate boundary protection, range-hash comparison, and exactly one `dispatch` change transaction
- propagation: CodeMirror update listener emits model/dirty/revision changes; preview, autosave, Recovery, and explicit save observe the same resulting source
- native history: no Agent snapshot stack, Agent Undo button, special keyboard interception, direct reducer replacement, or file write

**Verification:**
- Focused Markdown Agent/editor tests.
- Cases: replace/insert/delete; beginning/end of document; multiline Unicode; one native Undo/Redo step; preview refresh; Recovery snapshot; invalid/split surrogate range; stale hash; unmounted target; no direct IPC write.

- [x] Add behavior-level tests that fail unless the mounted CodeMirror SDK receives exactly one transaction.
- [x] Implement range-hash revalidation and transaction application through the live binding.
- [x] Prove editor-native history and normal persistence propagation without Agent-owned Undo state.

## Task 3: Prove Runtime Reuse, Ordering, Cancellation, and Fail-closed Safety

**Outcome:** Markdown Tool execution is truthful and safe across both runtimes and every document lifecycle edge case without changing generic production Runtime or Agent UI code.
**Files:**
- Modify: `tests/agentInteraction.test.mjs`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/markdownAgentExtension.test.mjs`
- Modify: `tests/agentToolHost.test.mjs`
- Modify: `tests/agentSecondEditorReuse.test.mjs`
- Test: `src-tauri/src/agent/tool_broker.rs`
- Test: `src-tauri/src/agent/runtime.rs`
- Test: `src-tauri/src/agent/adapters/codex_app_server.rs`

**Change Map:**
- unchanged broker: existing prerequisite bookkeeping, bounded results, stable call ids, duplicate/late suppression, and editor-applied mutation validation accept the dynamic Markdown descriptors without a format branch
- unchanged lifecycle/UI: read Running/Completed before mutation Running/Completed, final assistant output after Tools, exactly-once terminal state, Stop propagation, and no reasoning-summary substitution
- binding safety: document switch, AI disable, editor unmount, external change, Recovery restore, and revision changes invalidate pending mutation rather than retargeting it
- runtime parity: Codex dynamic Tools and Compatibility Tool calls use the same normalized descriptors and result contract

**Verification:**
- `node --test tests/agentInteraction.test.mjs tests/agentPanel.test.mjs tests/markdownAgentExtension.test.mjs tests/agentToolHost.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- Cases: read→mutation→final order; read failure; cancellation before/during/after read; duplicate mutation; late result; editor switch; external conflict; read-only/missing; AI disable; Codex and Compatibility descriptor parity.

- [x] Extend generic contract tests with real Markdown operations and fail the plan if production Runtime/UI branching is required.
- [x] Preserve exact Tool/activity ordering and cancellation across both runtime paths.
- [x] Verify every stale, duplicate, late, oversized, or unavailable target fails without editor or disk mutation.

## Task 4: Verify the Production Second-editor Agent and Deliver F038

**Outcome:** The complete Markdown editor/Agent pair is proven in real saved files and the F038 request can close with isolated delivery evidence.
**Files:**
- Modify: directly affected implementation and regression files
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/rfcs/001-codex-style-generic-agent.md`
- Modify: `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-02-markdown-agent-skill-and-tools.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- native acceptance: saved Workspace and Standalone Markdown files, real read and range-replacement Tools, ordered activity, immediate editor result, native Undo/Redo, autosave/save/reopen, Recovery, and byte/line-ending inspection
- extension switching: IdeaSketch→Markdown→unsupported→Markdown without Tool leakage, retargeting, Thread corruption, or generic UI changes
- safety/privacy: no direct file writes, MCP, secrets, hidden reasoning, unbounded document snapshots, unsafe links, or Markdown source persisted in Agent history beyond bounded Tool result policy
- delivery: complete F038-02 and mark F038 done only after F038-01 and F038-02 are complete, refresh the index, inspect the final diff, and create a separate `feat(F038-02)` commit

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native matrix: request outline/read/edit on disposable LF and CRLF Markdown files; observe real Tools in order; Undo/Redo through CodeMirror; autosave/save/reopen; Stop before mutation; stale/external/read-only/switch rejection; restart Thread; repeat on Codex and Compatibility when available; verify IdeaSketch Tools remain isolated.

- [x] Run focused failure/fix loops and the complete frontend/Rust/build/package matrix.
- [x] Complete native saved-file, runtime-parity, native-history, persistence, safety, privacy, and extension-switching acceptance.
- [x] Record evidence, complete both F038 plans and the human request, refresh Superplan state, and create the isolated F038-02 commit.

## Delivery Evidence

- `node --test tests/*.test.mjs`: 339 passed, 0 failed. Focused Markdown/Agent coverage proves lean Context, Skill/Tool activation, bounded outline/document/range reads, UTF-16 and surrogate safety, exact range/source fingerprints, prerequisite descriptors, generic Tool-host reuse, direct-apply rejection cases, one CodeMirror transaction, native-history ownership, Recovery integration, cancellation, ordered activity, and extension isolation.
- `cargo test --manifest-path src-tauri/Cargo.toml --quiet`: 135 passed, 0 failed; focused `cargo test ... agent -- --nocapture`: 56 passed. This includes packaged Skill discovery/loading, Codex/Compatibility dynamic Tool contracts, prerequisite bookkeeping, applied-result enforcement, duplicate/late suppression, cancellation, fallback, and no-MCP/non-editor-tool gates.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`, `npm run build`, and `git diff --check`: passed. Rust reports only the existing unused future-adapter warnings; Vite reports the existing Excalidraw import and large-chunk warnings.
- `npm run tauri build -- --debug`: passed and produced `src-tauri/target/debug/bundle/macos/IdeaNote.app` and `src-tauri/target/debug/bundle/dmg/IdeaNote_0.1.0_aarch64.dmg`.
- Browser acceptance at `http://127.0.0.1:1420/`: creating `Untitled.md` activated the Markdown editor while retaining the application-level right Agent column; the Agent target changed to `Untitled.md`; Markdown input updated Outline and GFM preview. The browser-only frontend correctly remained configuration-gated because native credential commands are unavailable there.
- Architecture and safety inspection: Markdown semantics exist only in the Markdown Skill, Agent Extension, File Type/Editor registries, and Markdown editor binding. No Markdown branch was added to the Rust Tool Broker/runtime adapters or generic Agent Panel/store/activity UI. Mutation applies through one mounted `EditorView.dispatch` and reaches the model only through CodeMirror's update listener; no Agent filesystem command or custom Undo stack exists.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-01-generic-document-kernel-and-markdown-editor.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `docs/superplan/plans/features/F036-direct-agent-editor-edits-with-undo.md`
- `docs/superplan/plans/bugs/B027-use-ideasketch-native-undo-for-agent-canvas-edits.md`
- `docs/superplan/plans/bugs/B028-show-real-agent-read-tools-in-execution-order.md`
- `src/lib/agent/agentExtensionRegistry.ts`
- `src/lib/agent/agentToolHost.ts`
- `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- `src/components/IdeaSketchEditor.tsx`
- `src-tauri/src/agent/tool_broker.rs`
