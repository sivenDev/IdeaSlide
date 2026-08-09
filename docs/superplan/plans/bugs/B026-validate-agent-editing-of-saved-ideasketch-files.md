---
id: "B026"
title: "Validate Agent Editing of Saved IdeaSketch Files"
type: "bugfix"
status: "approved"
summary: "Prove every supported IdeaSketch Agent Tool against real saved .is files and repair every failure until the full edit, save, reopen, and safety matrix passes."
source: "docs/superplan/human/bugs.md"
created: "2026-08-09"
order: 26
depends_on: ["F036"]
parent: ""
---

# Validate Agent Editing of Saved IdeaSketch Files Plan

**Goal:** Prove that the generic Agent can safely and durably edit real saved `.is` files through every supported IdeaSketch Tool, not merely mutate an unsaved in-memory document.
**Scope:** Build disposable saved IdeaSketch fixtures; exercise `read_document_outline`, `read_active_page`, `add_page`, `delete_page`, `reorder_page`, and `replace_page_elements`; verify immediate editor application, one-step Undo/Redo, autosave or explicit save, close/reopen persistence, file-format integrity, stale/cross-document/read-only rejection, cancellation safety, stable Tool identity, and Standalone/Workspace parity. Every discovered failure is reproduced, covered by the smallest reliable regression, repaired at its first incorrect source, and reverified through the complete checklist.
**Non-Goals:** This validation does not add unsupported Agent operations such as Page rename, Camera-specific mutation, arbitrary Excalidraw commands, direct file writes, approval for reversible editor changes, MCP restoration, a new editor, or fabricated model behavior. It does not mutate meaningful user documents or expose configured credentials, prompts, private reasoning, or file contents outside the disposable fixtures.
**Architecture:** Rust remains authoritative for runtime, cancellation, Tool correlation, and terminal lifecycle. The generic frontend Tool host routes only registered IdeaSketch Tools; mutation Tools produce revision- and fingerprint-bound Change Sets that the active editor binding revalidates and applies before returning a successful Tool result. `IdeaSketchEditor` remains the sole mutation boundary and owns bounded Agent Undo/Redo history, while its normal dirty/autosave/safe-write pipeline remains the sole persistence boundary. Native validation uses isolated disposable files and Threads, while deterministic frontend/Rust tests lock safety invariants that must not depend on model wording.
**Baseline:** B024 proved one unsaved add-Page proposal, Apply, and Undo without saving. B025 proved one unsaved replace-elements proposal, Apply, Undo, Tool identity, and lifecycle stability. F036 replaces that review flow with direct editor mutations and editor-owned Undo/Redo. No delivery has yet exercised all four direct mutation Tools on saved `.is` files, waited for normal persistence, closed and reopened the files, compared the on-disk structure, or covered stale, read-only, cross-document, cancellation, and Workspace parity in one explicit matrix.
**Reproduction:** Review the B024 and B025 native evidence or repeat their disposable-document flows: both stop at review-mediated in-memory mutation/Undo, and neither provides saved-file before/after hashes, reopen evidence, or one result per supported direct IdeaSketch Tool. Therefore the claim that Agent editing of saved `.is` files is fully verified cannot currently be reproduced.
**Root Cause:** The earlier acceptance matrices treated “Change Review can Apply and Undo an editor mutation” as equivalent to “Agent can edit a real `.is` file end to end.” They grouped editor integration as one capability instead of enumerating every Tool and every persistence/safety state, so saved-file durability, direct-application timing, Redo, and negative-path coverage were omitted.
**Exit Criteria:** Every checklist row below has current evidence. Each mutation Tool applies only the intended document state through the active editor before reporting success; one editor Undo restores the complete captured state; Redo reapplies it; a fresh direct mutation persists through the normal save pipeline; close/reopen and direct `.is` parsing confirm the durable result; and no temporary/recovery artifact corrupts the target. Stale, switched, read-only, last-Page, cancelled, externally changed, duplicate, or late mutations fail closed without editor or file changes. One representative edit passes in Workspace mode as well as Standalone mode. All regressions, frontend/Rust suites, production build, debug package, native matrix, persistence inspection, and final diff checks pass with no unresolved defect.

## Validation Checklist

| ID | Capability | Required observable result |
| --- | --- | --- |
| IS-A01 | Saved fixture and binding | A disposable valid `.is` opens as the active document; Agent shows the correct filename, active Page, IdeaSketch Skill, and six editor Tools. |
| IS-A02 | Read document outline | Agent calls `read_document_outline`; Page ids, titles, order, element counts, and active Page summary match the fixture; file hash is unchanged. |
| IS-A03 | Read active Page | Agent calls `read_active_page`; returned Page identity and bounded scene match the active Page; file hash is unchanged. |
| IS-A04 | Add Page direct apply | `add_page` adds the requested titled Page and editable elements before the Tool reports success, with no review surface or direct file write. |
| IS-A05 | Add Page undo/redo/persist | One editor Undo restores the baseline; Redo restores the add; a fresh direct add persists after save, close, reopen, and direct parse. |
| IS-A06 | Replace elements direct apply | `replace_page_elements` replaces only the target Page scene while preserving Page identity, title, and order before reporting success. |
| IS-A07 | Replace elements undo/redo/persist | Undo restores the target elements; Redo restores the replacement; a fresh direct replacement persists after save, close, reopen, and direct parse. |
| IS-A08 | Reorder Page direct apply | `reorder_page` moves the correct Page to the zero-based destination and changes no Page content before reporting success. |
| IS-A09 | Reorder undo/redo/persist | Undo restores Page order; Redo restores the reorder; a fresh direct reorder persists after save, close, reopen, and direct parse. |
| IS-A10 | Delete Page direct apply | `delete_page` removes only the targeted existing non-last Page before reporting success. |
| IS-A11 | Delete undo/redo/persist | Undo restores the Page; Redo removes it again; a fresh direct delete persists after save, close, reopen, and direct parse. |
| IS-A12 | Last-Page protection | A one-Page document cannot produce or apply a valid delete Change Set and remains byte-identical. |
| IS-A13 | Stale revision/fingerprint | Manual editor mutation before direct application makes the mutation fail closed and requests a fresh Tool call; no Agent operation is applied. |
| IS-A14 | Cross-document switch | Switching to another `.is` before direct application cannot mutate either document through the captured Change Set. |
| IS-A15 | External file change | External modification before direct application prevents the Agent mutation or persistence from silently overwriting the changed source. |
| IS-A16 | Read-only target | Reads remain available, but direct mutation is unavailable or rejected and the file stays unchanged. |
| IS-A17 | Cancellation safety | Stop before Tool completion reaches cancelled promptly, emits no mutation success or review Item, and changes no editor or file state. |
| IS-A18 | Tool identity and lifecycle | Every real Tool row has one stable non-empty call id from start through result; the Turn ends exactly once and never remains Working. |
| IS-A19 | Workspace parity | One representative replace-elements flow passes inside a disposable Workspace and persists through its normal Workspace save path. |
| IS-A20 | File and persistence integrity | Final `.is` archives parse successfully, retain schema/Page identity and unaffected content, contain no direct-Agent-write artifacts, and no Thread persists as running. |

## Task 1: Establish Deterministic Saved-file Evidence

**Outcome:** Every native scenario starts from an isolated, inspectable `.is` baseline with reproducible file and editor assertions.
**Files:**
- Test: `tests/ideaSketchAgentExtension.test.mjs`
- Test: `tests/agentToolHost.test.mjs`
- Test: `tests/editorSession.test.mjs`
- Test: `src-tauri/src/document_formats/idea_sketch.rs`
- Create or Modify: focused fixture/verification helpers only if the existing test utilities cannot express hashes, archive parsing, and expected Page state
- Modify: `docs/superplan/plans/bugs/B026-validate-agent-editing-of-saved-ideasketch-files.md`

**Change Map:**
- disposable fixtures: create separate multi-Page Standalone and Workspace files with stable Page ids, titles, order, and simple editable elements
- evidence capture: record pre-proposal, post-proposal, post-Apply, post-Undo, and post-reopen hashes plus parsed Page summaries without logging document bodies or credentials
- native isolation: use disposable Threads and temporary directories; preserve exact targets for safe cleanup or Trash recovery

**Verification:**
- Direct parse/roundtrip through the canonical IdeaSketch v1 reader and writer.
- Checklist: IS-A01, plus baseline/hash/parse prerequisites for IS-A02 through IS-A20.

- [ ] Create deterministic saved Standalone and Workspace fixtures with exact baseline summaries.
- [ ] Establish hash, parse, UI-state, Thread-state, and cleanup evidence collection.
- [ ] Confirm the fixtures open through the registry and remain valid before Agent activity.

## Task 2: Verify Reads and Direct-mutation Safety Boundaries

**Outcome:** Agent can inspect the active saved `.is` accurately, while every direct mutation is correctly bound to the active editor and every invalid target fails closed.
**Files:**
- Test: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Test: `src/lib/agent/agentToolHost.ts`
- Test: `src/components/AgentPanel.tsx`
- Test: `src/components/IdeaSketchEditor.tsx`
- Test: `tests/ideaSketchAgentExtension.test.mjs`
- Test: `tests/agentToolHost.test.mjs`
- Test: `tests/agentChangeSet.test.mjs`
- Modify: directly affected source and focused regression files when a failure is reproduced

**Change Map:**
- read accuracy: compare outline and active-Page Tool results with the parsed fixture and visible navigator
- persistence boundary: verify reads never change the file and direct mutations reach disk only through the normal editor save pipeline
- fail-closed matrix: last Page, stale revision/fingerprint, cross-document switch, external source change, read-only target, cancellation, duplicate/late result, and stable Tool identity

**Verification:**
- Focused frontend and Rust Tool/cancellation tests.
- Native checklist: IS-A02 through IS-A18.

- [ ] Run both read Tools against the saved fixture and compare bounded results with canonical parse/UI state.
- [ ] Prove all four mutation Tools apply exactly once through the active editor, report success only after application, and never write the file directly.
- [ ] Execute every stale/read-only/cross-document/external-change/cancellation negative path and repair each failure before continuing.

## Task 3: Verify Every Mutation Through Direct Apply, Undo/Redo, Save, and Reopen

**Outcome:** All four supported mutation Tools produce immediate, correctly reversible editor changes and correct durable `.is` files.
**Files:**
- Test: `src/components/IdeaSketchEditor.tsx`
- Test: `src/lib/ideaSketchReducer.ts`
- Test: `src/hooks/useEditorSession.ts`
- Test: `src/lib/editorSession.ts`
- Test: `src-tauri/src/document_formats/idea_sketch.rs`
- Test: `tests/ideaSketchAgentExtension.test.mjs`
- Test: `tests/ideaSketchReducer.test.mjs`
- Test: `tests/editorSession.test.mjs`
- Modify: directly affected source and focused regression files when a failure is reproduced

**Change Map:**
- add Page: requested title/elements, one-step Undo/Redo, fresh direct mutation, durable reopen
- replace elements: target-only scene replacement, identity/title/order preservation, Undo/Redo, durable reopen
- reorder Page: order-only mutation, active-Page consistency, Undo/Redo, durable reopen
- delete Page: target-only removal, deterministic active-Page fallback, Undo/Redo, durable reopen
- persistence: wait for the normal Saved boundary, close/reopen through the registry, then compare UI and canonical parse with expected state

**Verification:**
- Native Standalone checklist: IS-A04 through IS-A11 and IS-A20.
- Native Workspace checklist: IS-A19.
- Focused reducer/session/format regressions for every failure discovered.

- [ ] Complete add-Page direct apply, Undo, Redo, fresh mutation, save, close, reopen, and parse verification.
- [ ] Complete replace-elements direct apply, Undo, Redo, fresh mutation, save, close, reopen, and parse verification.
- [ ] Complete reorder-Page direct apply, Undo, Redo, fresh mutation, save, close, reopen, and parse verification.
- [ ] Complete delete-Page direct apply, Undo, Redo, fresh mutation, save, close, reopen, and parse verification.
- [ ] Repeat one representative replacement inside a disposable Workspace and verify Workspace persistence parity.

## Task 4: Repair, Repeat, and Deliver the Complete Matrix

**Outcome:** B026 closes only after every checklist row has passing evidence and no discovered `.is` editing defect remains unresolved.
**Files:**
- Modify: every source/test file directly required by reproduced failures
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B026-validate-agent-editing-of-saved-ideasketch-files.md`

**Change Map:**
- repair loop: reproduce, add the smallest reliable regression, fix the first incorrect source, rerun the affected row, then restart the complete saved-file matrix
- final evidence: one result per IS-A01 through IS-A20, automated/native proof mapping, saved archive summaries, and explicit cleanup outcome
- delivery: complete B026 only with current full-suite/build/package/native evidence and a separate task commit

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native checklist IS-A01 through IS-A20 repeated from clean disposable fixtures after the final code change.

- [ ] Add regressions and repair every defect found by the saved-file validation loop.
- [ ] Repeat IS-A01 through IS-A20 after the final fix and record exact evidence for every row.
- [ ] Complete B026, refresh Superplan state, inspect the final diff, clean or archive disposable artifacts safely, and create a separate `fix(B026)` commit.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B024-align-tauri-versions-and-verify-agent-editing.md`
- `docs/superplan/plans/bugs/B025-fix-agent-fallback-hangs-cancellation-and-activity-presentation.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `docs/superplan/plans/features/F035-agent-history-codex-runtime-and-streaming-activity.md`
- `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- `src/lib/agent/agentToolHost.ts`
- `src/components/IdeaSketchEditor.tsx`
- `src/lib/editorSession.ts`
- `src-tauri/src/document_formats/idea_sketch.rs`
