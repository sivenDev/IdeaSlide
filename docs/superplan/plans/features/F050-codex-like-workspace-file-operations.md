---
id: "F050"
title: "Add Codex-like Workspace File Operations to the Agent"
type: "feature"
status: "complete"
summary: "Give the Agent a structured, approval-aware read-search-patch-diff-undo workflow inside the active Workspace."
source: "docs/superplan/human/features.md"
created: "2026-08-12"
order: 50
depends_on: ["02", "05", "F033-04", "F038-02", "B035"]
parent: ""
---

# Add Codex-like Workspace File Operations to the Agent Plan

**Goal:** Give IdeaNote's Agent the productive read-search-patch-verify loop of Codex CLI for real Workspace files without granting a general-purpose shell or bypassing IdeaNote's document and filesystem protections.
**Scope:** In a real Workspace, expose application-owned Host Tools for bounded directory/glob discovery, bounded literal or regular-expression text search, full or line-range UTF-8 reads with SHA-256 digests, explicit Folder creation, atomic multi-file exact-text patch transactions, single-entry move, Trash, change-set Diff inspection, and bounded undo of Agent patch transactions. Patch creation and updates require `expectedDigest: null` for a confirmed non-existent target or the exact digest returned by a prior read for every existing target; all patch operations validate before any file changes, then commit as one rollback-safe transaction. Patch results return an opaque change-set id and bounded unified Diff; the current application session retains a small before/after ledger so a later Tool call can inspect or undo the transaction only if every affected path still matches its recorded after-state. Move, Trash, patch deletion, and any other destructive operation pause in the existing Agent approval lifecycle before execution. HTML, CSS, JavaScript, TypeScript, JSON, SVG, Markdown, and other ordinary text artifacts may participate even when they are not registered as editors. Workspace Explorer remains File Type Registry-driven, and Workspace Tools remain unavailable in Standalone mode. Keep Codex in its existing read-only sandbox; all filesystem effects execute through IdeaNote's trusted Rust Host.
**Non-Goals:** This feature does not expose arbitrary Shell, subprocess, package installation, Git commands, network, browser/preview server, code execution, MCP filesystem access, unrestricted globbing outside the root, binary asset generation/writes, standalone-file mutation, background autonomy, or automatic approval. It does not add HTML/CSS/JavaScript editors or show unsupported artifacts in Workspace Explorer. It does not let Workspace Tools overwrite any document retained as an open/protected session, directly rewrite `.is` archives, expose `.ideanote`, `.git`, dependency/vendor trees, credentials, hidden secret files, or follow Symlinks. Undo is not durable version control: it covers bounded Agent patch transactions in the current application session, rejects any path changed afterward, and does not restore Trash.
**Architecture:** A Rust `WorkspaceAgentHost` owns the capability catalog, active Workspace context, approval-aware Tool execution, patch ledger, and all native file effects. `EditorLayout` synchronizes only the current canonical root identity, read-only state, and retained/protected Workspace document paths into a managed native context with a generation number; each Tool live-checks that context immediately before disclosure or mutation. The Host layers Agent-specific disclosure policy over `WorkspaceService` without weakening Explorer filtering. Discovery/search/read are bounded and skip internal, hidden-secret, dependency, Symlink, binary, and oversized content. The multi-file patch format is a closed JSON structure containing create, exact-text replace, and delete operations; each existing target supplies an expected digest, each replacement requires an exact non-empty `oldText`, and ambiguous matches fail. The Host builds all after-images in memory, prepares staged files under `.ideanote/tmp`, validates paths/digests/protected sessions again, commits under watcher expected-write ownership, and rolls back already committed paths if any later commit fails. A bounded in-memory ledger stores only before/after bytes and metadata for successful patch transactions, exposes unified Diff, and permits compare-and-revert. Agent descriptors gain source/effect metadata so the Tool Broker can distinguish editor mutations, non-destructive Workspace host mutations, and destructive approval-gated operations. The exact Tool set plus an opaque active-Workspace capability identity salts the upstream signature, forcing B035's safe Codex rebind when Workspace capability appears, disappears, or changes.
**Baseline:** `WorkspaceService` already canonicalizes the root, rejects traversal and `.ideanote`, refuses Symlinks, creates folders, moves and trashes entries, and stages atomic writes under `.ideanote/tmp`; `WorkspaceWatcherState` suppresses application-owned event bursts; Document Sessions protect open files from external changes. The Agent currently receives only active-editor descriptors plus managed Skill Host Tools. Codex already runs read-only with dynamic Tools, the Rust Tool Broker validates schemas/prerequisites/call identity/size/step limits, normalized approval items exist in the Agent protocol, and B035 rebinds persistent upstream Threads when its stable Tool signature changes. Workspace scanning intentionally hides non-openable files, and no Agent-owned search, multi-file patch, Diff, undo ledger, or Workspace effect classification exists.
**Exit Criteria:** In Workspace mode, the expandable capability activity truthfully separates editor, Workspace, and Skill Tools and identifies read, write, and destructive effects. The Agent can discover ignored-by-Explorer text artifacts, search them with bounded path/line/snippet results, read exact line ranges and digests, create a Folder, atomically create and revise an HTML/CSS/JS set in one transaction, inspect its unified Diff, and undo it while the after-state is unchanged. A stale digest, ambiguous replacement, duplicate target, invalid patch, concurrent external edit, protected/open document, read-only transition, root switch, commit failure, hidden/internal/dependency/Symlink path, invalid UTF-8, binary/oversized file, or ledger mismatch changes no files or rolls back to the complete before-state. Move, Trash, and patch deletion visibly request approval and do nothing after rejection or cancellation. Successful writes leave no staging residue, preserve watcher chronology without save loops, and refresh supported Explorer entries through the existing event path. Workspace→Standalone and Workspace A→B force a safe Codex Tool rebind while keeping the local conversation. Full frontend/Rust/build regressions, installed-Codex smoke, native disposable-Workspace acceptance, Superplan validation, and one isolated `feat(F050)` commit pass.

## Task 1: Build Bounded Workspace Discovery, Search, and Reads

**Outcome:** The Agent can understand the current Workspace with Codex-like navigation while receiving only bounded, policy-safe text evidence.
**Files:**
- Create: `src-tauri/src/workspace_agent.rs`
- Modify: `src-tauri/src/workspace.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/workspace_agent.rs`
- Test: `src-tauri/src/workspace.rs`

**Change Map:**
- active native context: managed root/read-only/protected-path snapshot with generation changes on Workspace, session, or protection-state transitions
- `list_workspace_files`: normalized root-relative directory plus optional glob, deterministic ordering, file-kind/size/modified metadata, and strict depth/count/output budgets
- `search_workspace_text`: literal or bounded regex search, optional glob, deterministic path/line/column/snippet results, per-file/total match budgets, and no eager return of full files
- `read_workspace_text`: full or inclusive line-range reads, UTF-8 validation, line-number metadata, exact byte/line counts, truncation truth, and SHA-256 digest of the complete file
- disclosure policy: exclude `.ideanote`, `.git`, hidden secret patterns, common dependency/vendor/build trees, Symlinks, binary content, oversized files, and any root escape while allowing ordinary non-editor text artifacts

**Verification:**
- `cd src-tauri && cargo test workspace_agent -- --nocapture`
- `cd src-tauri && cargo test workspace -- --nocapture`
- Cases: directory/glob listing; literal/regex search; line-range boundaries; deterministic truncation; HTML/CSS/JS/JSON/SVG/Markdown; unsupported extension text; invalid UTF-8; binary/oversize; absolute/traversal/internal/hidden/dependency/Symlink paths; Workspace switch and Standalone absence.

- [x] Add focused failing discovery/search/read tests for every disclosure and output-budget boundary.
- [x] Implement the active native context and bounded text inspection services.
- [x] Prove non-openable artifacts are inspectable without altering Explorer's registry-driven tree.

## Task 2: Add Atomic Multi-file Patch Transactions, Diff, and Undo

**Outcome:** The Agent can make precise multi-file changes with optimistic concurrency, all-or-nothing behavior, inspectable Diff, and safe session-scoped recovery.
**Files:**
- Modify: `src-tauri/src/workspace_agent.rs`
- Modify: `src-tauri/src/workspace.rs`
- Modify: `src-tauri/src/safe_write.rs`
- Modify: `src-tauri/src/workspace_watcher.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Test: `src-tauri/src/workspace_agent.rs`
- Test: `src-tauri/src/safe_write.rs`
- Test: `src-tauri/src/workspace_watcher.rs`

**Change Map:**
- patch contract: bounded create, exact-text replace, and delete operations; unique normalized targets; `expectedDigest: null` only for new files; exact digest for existing files; unambiguous ordered replacements; explicit deletion intent
- preflight: existing-parent and writable checks, text/size policy, protected-session rejection, current digest comparison, full after-image construction, result-size and ledger-budget checks before staging
- atomic transaction: collision-free `.ideanote/tmp` staging for every after-image, watcher expected-write registration for all targets, deterministic commit order, rollback from captured before-images on partial native failure, and staging cleanup on every terminal path
- change-set ledger: opaque ids, bounded before/after snapshots, root identity and timestamps, unified Diff generation, per-session count/byte eviction, invalidation on root change, and no persistence of file content into Thread history
- compare-and-undo: recheck every after-state before an all-or-nothing reverse transaction; refuse stale, evicted, wrong-root, protected, read-only, or externally modified targets

**Verification:**
- `cd src-tauri && cargo test workspace_agent -- --nocapture`
- `cd src-tauri && cargo test safe_write workspace_watcher -- --nocapture`
- Cases: create three files atomically; multi-file replacements; digest fabricated/stale; duplicate target; ambiguous/missing old text; deletion approval marker; protected file; commit failure after one target; rollback failure diagnostics without hiding primary failure; exact Diff; successful undo; stale undo; ledger eviction; root invalidation; no staging residue or watcher save loop.

- [x] Add failure-first tests for preflight, partial commit rollback, Diff, ledger bounds, and compare-and-undo.
- [x] Implement one native multi-file transaction boundary rather than independent file writes.
- [x] Prove every failed or stale patch preserves the complete pre-operation Workspace state.

## Task 3: Integrate Workspace Effects and Approval into the Agent Runtime

**Outcome:** Both Codex and Compatibility use the same native Workspace Host, destructive effects pause for approval, and the UI reports the exact capability set.
**Files:**
- Create: `src/lib/agent/workspaceAgentTools.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/agentRuntime.ts`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/agent/AgentToolActivity.tsx`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/agent/session.rs`
- Modify: `src-tauri/src/agent/tool_broker.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Test: `tests/agentWorkspaceTools.test.mjs`
- Test: `tests/agentToolActivity.test.mjs`
- Test: `tests/agentDirectEditorContract.test.mjs`
- Test: relevant Rust Agent session, Broker, runtime, and adapter tests

**Change Map:**
- descriptor catalog: `list_workspace_files`, `search_workspace_text`, `read_workspace_text`, `create_workspace_folder`, `apply_workspace_patch`, `get_workspace_change_set`, `undo_workspace_change_set`, `move_workspace_entry`, and `trash_workspace_entry`; closed schemas plus `source: workspace` and `effect: read|write|destructive`
- native host routing: generalize Skill-only host dispatch so Workspace calls execute in Rust, editor calls still round-trip through the trusted active editor executor, and Compatibility host rounds handle both host categories without persisting raw file content
- approval lifecycle: IdeaNote-owned approval waiters emit normalized approval items before move, Trash, or deletion-bearing patch execution; `resolve_agent_approval` resumes or rejects the exact pending call; cancellation retires both approval and Tool waiters
- live protection: root generation, read-only state, and retained/protected document paths are rechecked immediately before every effect and again at patch commit
- Tool Broker: validate source/effect identity, allow applied native host-write results without an editor ChangeSet, retain all existing schema/prerequisite/duplicate/size/step/redaction rules, and never treat a rejected approval as success
- availability and signature: separate editor/Workspace/Skill counts and sources, surface effect labels accessibly, and salt the stable upstream Tool signature with an opaque active-Workspace identity so B035 rebinding covers root transitions

**Verification:**
- `node --test tests/agentWorkspaceTools.test.mjs tests/agentToolActivity.test.mjs tests/agentDirectEditorContract.test.mjs tests/agentSecondEditorReuse.test.mjs tests/agentRuntimeSelection.test.mjs`
- `cd src-tauri && cargo test agent::session && cargo test agent::tool_broker && cargo test agent::adapters && cargo test agent::tests -- --nocapture`
- Cases: Workspace/Standalone catalogs; root A/root B signatures; source/effect UI; Codex and Compatibility read/search/patch; editor routing unchanged; approval accept/reject/cancel/restart; destructive call replay; root/read-only/protected transition while awaiting approval; Tool chronology; retry/fallback; Skill behavior.

- [x] Add failing contracts for host routing, effect classification, approval lifecycle, cancellation, and signature rebinding.
- [x] Keep filesystem effects Rust-owned and active editor mutations SDK-owned.
- [x] Verify persistent Threads, chronological Tool activity, retries, Skills, and final responses remain truthful.

## Task 4: Prove the Codex-like Workflow and Update Product Contracts

**Outcome:** A disposable real Workspace demonstrates read-search-patch-diff-undo and approved destructive operations end to end without broadening product scope.
**Files:**
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/workspace-format.md`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F050-codex-like-workspace-file-operations.md`
- Modify: directly affected F050 implementation/test files discovered during verification

**Change Map:**
- product contract: distinguish registry-openable Explorer files from bounded Agent-inspectable text artifacts and define the native Workspace Host as shared infrastructure rather than an editor extension
- safety contract: document disclosure exclusions, budgets, digest requirements, exact-text patch semantics, approval effects, atomic staging/rollback, watcher ownership, session-scoped ledger/undo, and absence of shell/process/network execution
- positive native flow: list and search a disposable Workspace; line-read a reference; atomically create `site/index.html`, `site/styles.css`, and `site/script.js`; search/read/revise them; inspect Diff; undo; reapply; move with approval; Trash with approval
- negative native flow: stale digest, external edit after patch, protected Markdown, read-only root, root switch while awaiting approval, Standalone mode, rejected destructive action, binary/internal/dependency disclosure, commit fault injection, and stale undo all leave the expected files unchanged

**Verification:**
- `IDEANOTE_CODEX_SMOKE=1 cd src-tauri && cargo test installed_codex_executes_dynamic_editor_tool_smoke_when_enabled -- --nocapture` when the pinned runtime is available
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo build`
- Native disposable-Workspace acceptance for both Codex and Compatibility where available: discover/search/range-read/create/patch/Diff/undo/reapply plus approval accept/reject for move/Trash; exact file inspection; watcher chronology; restart behavior; no staging residue, hidden disclosure, or shell/process/network capability.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git diff --cached --check`

- [x] Run the high-risk focused failure/fix loop, then one stabilized full frontend/Rust/build/native matrix.
- [x] Update the PRD and Workspace format without changing Explorer's registry-driven editor boundary.
- [x] Mark F050 complete/done and create one isolated `feat(F050)` commit containing only this feature.

## Delivery Evidence

- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs` — passed.
- `npm run build` — passed; existing Vite dynamic-import and large-chunk warnings remain.
- `cargo test --manifest-path src-tauri/Cargo.toml --target-dir /tmp/ideanote-f050-target` — 166 passed.
- `cargo build --manifest-path src-tauri/Cargo.toml --target-dir /tmp/ideanote-f050-target` — passed; existing Rust dead-code warnings remain.
- `IDEANOTE_CODEX_SMOKE=1 cargo test installed_codex_executes_dynamic_editor_tool_smoke_when_enabled --manifest-path src-tauri/Cargo.toml --target-dir /tmp/ideanote-f050-target -- --nocapture` — passed with the installed pinned Codex runtime.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/workspace-format.md`
- `docs/superplan/plans/02-directory-workspace-foundation.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/features/F011-filter-workspace-files-and-centralize-temp-writes.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-02-markdown-agent-skill-and-tools.md`
- `docs/superplan/plans/bugs/B035-restore-editor-tool-rebinding-and-terminal-agent-actions.md`
- `src-tauri/src/workspace.rs`
- `src-tauri/src/workspace_watcher.rs`
- `src-tauri/src/safe_write.rs`
- `src-tauri/src/agent/mod.rs`
- `src-tauri/src/agent/session.rs`
- `src/components/AgentPanel.tsx`
- `src/components/EditorLayout.tsx`
- Official OpenAI documentation, Agent approvals and security: `https://learn.chatgpt.com/docs/agent-approvals-security#sandbox-and-approvals`
