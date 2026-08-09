---
id: "B028"
title: "Show Real Agent Read Tools in Execution Order"
type: "bugfix"
status: "complete"
summary: "Require a real current-Page read before canvas mutation and render Tool and assistant activity in true execution order."
source: "docs/superplan/human/bugs.md"
created: "2026-08-09"
order: 28
depends_on: ["B025", "B027"]
parent: ""
---

# Show Real Agent Read Tools in Execution Order Plan

**Goal:** Make Agent editing visibly read the live editor state before mutation and present every Tool and assistant segment in the order it actually executes.
**Scope:** Remove active-Page elements from turn-start context; add generic Tool prerequisite metadata and require `read_active_page` to complete successfully before `replace_page_elements`; segment streamed assistant Items around Tool execution; stop exposing Codex reasoning-summary deltas as public activity; and preserve the existing frontend SDK mutation, native IdeaSketch Undo/Redo, stale-target, read-only, external-change, switched-document, and cancellation guards.
**Non-Goals:** This fix does not fabricate read activity, expose hidden chain-of-thought, remove legitimate public assistant text, change Provider credentials or retry policy, replace the Codex runtime, restore MCP, add direct JSON/archive mutation, add prerequisites to unrelated Page-structure Tools, or redesign Thread history.
**Architecture:** Generic Tool descriptors declare optional prerequisite Tool names. Rust validates the dependency graph, tracks successful Tool completions per Turn, and rejects a dependent Tool until its prerequisites have completed successfully. Editor extensions remain responsible for format-specific live reads and frontend SDK mutations. IdeaSketch turn-start Context carries metadata only, making `read_active_page` the authoritative bounded scene read. The native runtime emitter closes the current assistant segment before each Tool row and starts later text in a new Item, while Codex reasoning-summary events are ignored rather than relabeled as public activity.
**Baseline:** B025 provides streamed lifecycle and Tool Items, and B027 routes active-Page replacement through Excalidraw's native SDK history. The current IdeaSketch Context also injects up to 80 Page elements, so the model can skip `read_active_page`. The native emitter reuses one assistant Item for an entire Turn, leaving pre-Tool text above later Tool rows while finalization replaces that Item with the full response. Codex `item/reasoning/summaryTextDelta` is currently mapped to public activity.
**Reproduction:** Open a saved `.is` file and ask the Agent to optimize the current Page layout. The persisted Turn contains `replace_page_elements` but no `read_active_page`; the UI shows only the mutation Tool. Assistant narration appears before the Tool row, and reasoning-summary fragments can be concatenated into a misleading public activity line.
**Root Cause:** Full scene data crosses the initial generic Context boundary, making the explicit read Tool redundant to the model. Tool execution has no enforceable prerequisite contract. Separately, one emitter-owned assistant Item spans text before and after Tool calls, so Item insertion order cannot represent chronological execution, and a Codex reasoning-summary delta is incorrectly treated as public narration.
**Exit Criteria:** A real edit Turn executes and displays `read_active_page` Running/Completed before `replace_page_elements` Running/Completed, and the final assistant message appears after the Tool rows. Mutation is rejected when the read is absent or failed. Turn-start Context contains Page metadata but no elements. Codex reasoning summaries do not appear as public activity. Existing native SDK application, IdeaSketch Undo/Redo, persistence, streaming, lifecycle, cancellation, and safety regressions continue to pass.

## Task 1: Lock the Read-Before-Mutation Contract

**Outcome:** Focused regressions prove that current-Page mutation cannot bypass a real successful read and that initial Context no longer contains the scene.
**Files:**
- Modify: `tests/ideaSketchAgentExtension.test.mjs`
- Modify: `tests/agentToolHost.test.mjs`
- Modify: `src-tauri/src/agent/tool_broker.rs`
- Modify: relevant Rust Agent tests

**Change Map:**
- lean Context: retain active Page identity and counts but omit element payloads
- Tool descriptor: express `replace_page_elements` dependency on `read_active_page`
- broker enforcement: validate prerequisite names and reject missing, self-referential, failed, or incomplete dependencies
- successful completion: satisfy prerequisites only after the prerequisite Tool result succeeds within the same Turn

**Verification:**
- `node --test tests/ideaSketchAgentExtension.test.mjs tests/agentToolHost.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml agent::tool_broker -- --nocapture`

- [x] Add focused behavior regressions for lean Context and the read-before-mutation boundary.
- [x] Add generic descriptor and broker prerequisite enforcement.
- [x] Keep editor-specific read and mutation behavior outside generic Agent Core.

## Task 2: Preserve Chronological Runtime Activity

**Outcome:** Assistant text and Tool rows render in their actual execution sequence without reasoning-summary leakage.
**Files:**
- Modify: `src-tauri/src/agent/runtime.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/adapters/codex_app_server.rs`
- Modify: relevant Rust Agent tests
- Modify: relevant frontend Agent tests when the public event contract changes

**Change Map:**
- assistant segmentation: complete the current assistant Item before every Tool start/request and allocate a new Item for subsequent text
- finalization: finalize only the current segment and return the actual final text without reinserting earlier narration
- no-final-text case: emit one concise deterministic completion after Tool activity when the runtime supplies no post-Tool answer
- Codex boundary: ignore `item/reasoning/summaryTextDelta`; retain `item/agentMessage/delta`, lifecycle, Plans, and real Tool events

**Verification:**
- Focused Rust cases: text → read Tool → text → mutation Tool → final text; Tool-only completion; cancellation; Compatibility Tool progress; Codex reasoning summary ignored.
- Focused frontend transcript/store tests for ordered Item rendering and streamed final Markdown.

- [x] Add chronological segmentation and reasoning-summary regressions.
- [x] Segment both Codex Tool requests and Compatibility Tool starts.
- [x] Preserve exactly-once terminal lifecycle and streamed assistant content.

## Task 3: Verify Native Editor Behavior and Deliver B028

**Outcome:** The corrected Tool sequence is proven in the desktop app without regressing editor safety, native history, or persistence.
**Files:**
- Modify: directly affected implementation and regression files
- Modify: `src-tauri/agent-skills/ideasketch/SKILL.md`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B028-show-real-agent-read-tools-in-execution-order.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- Skill contract: require prerequisite reads before dependent mutations and describe lean Context accurately
- native acceptance: use a disposable saved `.is`, observe both real Tools in order, confirm final response placement, native Undo/Redo, autosave, reopen, and archive integrity
- safety matrix: preserve stale revision, switched document, read-only, external-change, cancellation, and non-mounted Page rejection
- delivery: complete B028 only after focused and full verification and commit only B028 changes

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native disposable `.is` edit: read Tool before mutation Tool, final response after Tools, native Undo/Redo, autosave and reopen.

- [x] Run focused and complete automated/build/package verification.
- [x] Complete native saved-file ordering, mutation, history, persistence, and safety acceptance.
- [x] Mark B028 done, refresh Superplan state, inspect the final diff, and create the separate `fix(B028)` commit.

## Completion Evidence

- The focused Context regression failed against the previous implementation because `activePage` still contained elements and the mutation descriptor had no prerequisite. It now passes with metadata-only Context and `replace_page_elements.requires = ["read_active_page"]`.
- Rust Broker regressions prove missing, failed, self-referential, unregistered, and cyclic prerequisites fail closed; only a successful same-Turn read unlocks the dependent mutation.
- Native Channel tests serialize the exact chronological sequence `assistant → read Tool → assistant → mutation Tool → final assistant`, and the frontend reducer retains that Item order. A Tool-only completion creates a new deterministic final message instead of repeating pre-Tool narration.
- Codex adapter coverage proves `item/reasoning/summaryTextDelta` produces no public Event while `item/agentMessage/delta`, Plans, lifecycle, and real Tool requests remain available.
- An opt-in live test against the installed pinned Codex runtime completed in 14.21 seconds and requested exactly `read_active_page` followed by `replace_page_elements`, then produced a non-empty final answer.
- The unchanged B027 frontend SDK transaction boundary remains covered by the complete suites: active-Page replacement still uses immediate Excalidraw capture, native Undo/Redo, normal autosave/persistence, and stale/read-only/external-change/switched-document/cancellation guards. The prior B027 native saved-file evidence remains valid because B028 does not change editor application code.
- macOS Computer Use could not obtain a window for IdeaNote or Finder in this run (`cgWindowNotFound` / `AXError.cannotComplete`), so visible ordering was verified through the exact native Channel envelope and frontend reducer contract rather than a screenshot-only assertion.
- Final verification passed: 319 frontend tests, 127 Rust tests, `cargo fmt --check`, `cargo clippy --all-targets` with only pre-existing dead-code warnings, `npm run build`, `npm run tauri build -- --debug`, installed-Codex prerequisite smoke, and `git diff --check`. Debug `.app` and `.dmg` bundles were produced.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B025-fix-agent-fallback-hangs-cancellation-and-activity-presentation.md`
- `docs/superplan/plans/bugs/B027-use-ideasketch-native-undo-for-agent-canvas-edits.md`
- `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- `src-tauri/src/agent/tool_broker.rs`
- `src-tauri/src/agent/runtime.rs`
- `src-tauri/src/agent/adapters/codex_app_server.rs`
