---
id: "B035"
title: "Restore Editor Tool Rebinding and Terminal Agent Actions"
type: "bugfix"
status: "complete"
summary: "Rebind Codex to the active editor Tool set and show Copy plus completion duration only on the settled final response."
source: "docs/superplan/human/bugs.md"
created: "2026-08-12"
order: 35
depends_on: ["F046-03"]
parent: ""
---

# Restore Editor Tool Rebinding and Terminal Agent Actions Plan

**Goal:** Keep Agent Tools aligned with the active editor across persistent conversations and make response actions appear only when the final answer is genuinely complete.
**Scope:** Add a stable signature for the exact editor and managed-host Tool descriptors registered with Codex; persist that signature beside the upstream Thread id; resume an upstream Thread only when its signature matches the current Turn; otherwise start a new upstream Thread with the current dynamic Tools and bounded visible local conversation replay. Remove the successful completion duration from the Working lifecycle row, place a left-aligned compact timer icon plus elapsed duration beside Copy on the final assistant response, omit the preceding runtime/model/reasoning text, and hide the entire final action rail until both the authoritative Turn and the paced text presentation have settled. Preserve real Thread history, Tool prerequisites, direct reversible editor edits, cancellation, retry/fallback, diagnostics, Skills, and the reviewed B034 Agent layout.
**Non-Goals:** This bugfix does not add or rename editor Tools; expose hidden reasoning; add voting buttons; show final actions on welcome, failed, cancelled, or intermediate assistant segments; change editor mutation, Undo/Redo, save, Recovery, or filesystem behavior; replace Codex or Compatibility; clear user conversation history; make `thread/resume` accept unsupported fields; or complete/commit B034 without visual approval.
**Architecture:** The Rust Agent Core computes an opaque deterministic signature from the complete normalized Tool descriptor set after managed host Tools are captured. `AgentThreadRuntimeMetadata` persists the signature with the upstream Thread id, and each new request returns that prior signature to Rust. Codex resume is allowed only when the prior and current signatures match; missing legacy metadata or any mismatch starts a fresh upstream Thread because Codex 0.147.0 exposes `dynamicTools` on `thread/start` but not `thread/resume`. The local IdeaNote Thread remains stable and supplies its existing bounded visible replay to the fresh upstream Thread, so changing Markdown/IdeaSketch capability sets does not discard the user-facing conversation. The normalized Turn remains the authority for completion; presentation state is only an additional display gate. The final assistant segment derives elapsed time from `createdAt`/`completedAt`, while successful primary lifecycle activity is removed rather than persisted as a second completion location.
**Baseline:** `AgentPanel` always passes the last Codex `upstreamThreadId`, independent of the current editor Tool set. `CodexTurnDriver` therefore resumes any existing upstream Thread, while `CodexAppServerAdapter::start_conversation` is the only path that sends `dynamicTools`. Local persisted evidence reproduced a Thread created with Markdown Tools; switching the same IdeaNote conversation to IdeaSketch leaves Codex with the persisted Markdown registrations even though the UI reports six current IdeaSketch Tools. The installed `codex-cli 0.147.0` experimental TypeScript schema confirms `ThreadStartParams.dynamicTools` and confirms that `ThreadResumeParams` has no dynamic-Tool replacement field. On completion, `agentStore` rewrites the main lifecycle row to `Completed in …`; `AgentTranscript` attaches evidence to the last assistant segment even while the Turn is running; and `AgentItem` renders Copy whenever that segment's presentation is momentarily settled between source chunks.
**Reproduction:** Open a Markdown document, run an Agent Turn so Codex creates an upstream Thread with Markdown Tools, then keep the same IdeaNote conversation and open an IdeaSketch `.is` document. Ask the Agent to inspect or modify the active Page. The transcript reports current editor Tools, but Codex says `read_active_page` and `replace_page_elements` are not registered because it resumed the Markdown-backed upstream Thread. Separately, run a streaming answer: Copy can appear during a settled gap before the Turn completes, and after completion `Completed in …` remains in the Working row rather than beside the final response action.
**Root Cause:** IdeaNote persists only the upstream Thread id, not the Tool capability identity that was bound when the upstream Thread was created. Codex correctly restores its persisted dynamic Tools on resume, but the current adapter assumes those Tools always match the active editor. Since the protocol cannot replace them during resume, editor switching produces a split-brain state between the current UI/Tool Broker and the upstream model. The response action rail is gated by Turn evidence plus presentation state, not terminal Turn state, while duration is encoded by mutating a lifecycle label instead of being derived at the final response boundary.
**Exit Criteria:** Reusing one local conversation across Markdown and IdeaSketch starts a new upstream Codex Thread exactly when the complete Tool signature changes, registers the current editor Tools, carries bounded visible prior conversation context, and then resumes that new upstream Thread on subsequent same-signature Turns. Legacy records without a signature rebind once safely. A real `.is` Turn can execute `read_active_page` and a prerequisite-gated `replace_page_elements` through the existing trusted Tool Broker and editor SDK with native Undo/Redo and no direct file write. While a Turn is running or final text is still revealing, no Copy or completion duration appears. After successful settled completion, only the last assistant segment shows the concise left-aligned response rail with Copy and a timer icon plus `N.Ns`; runtime/model/reasoning text, like/dislike buttons, and terminal duration in the Working location are absent. Focused frontend/Rust regressions, installed-Codex smoke where enabled, complete build checks, Superplan validation, diff hygiene, and a B035-only commit pass without completing B034.

## Task 1: Rebind Persistent Codex Threads to the Exact Active Tool Set

**Outcome:** A persistent local conversation cannot resume an upstream Codex Thread whose dynamic Tools belong to another editor or older descriptor set.
**Files:**
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/protocol.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/agent/repository.rs`
- Modify: `src-tauri/src/agent/runtime.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/adapters/codex_app_server.rs`
- Test: `tests/agentStore.test.mjs`
- Test: `tests/agentThreadRepository.test.mjs`
- Test: relevant Rust Agent adapter/repository tests

**Change Map:**
- Tool identity: canonicalize the complete post-Skill descriptor set and compute one deterministic opaque signature without persisting Tool results, document content, or secrets
- persisted runtime mapping: add optional `upstreamToolSignature` with backward-compatible hydration/serialization; missing legacy values force a safe one-time rebind
- resume gate: send the current upstream id only when the persisted signature matches; otherwise use `thread/start` so `dynamicTools` contains the current IdeaSketch/Markdown/host descriptors
- continuity bridge: include only the already bounded visible `request.messages` when rebinding, clearly separating replay from the current request and never replaying hidden reasoning or Tool payloads
- runtime evidence: emit and persist the signature paired with the newly selected upstream Thread id, while retaining automatic Codex/Compatibility selection and existing fallback safety

**Verification:**
- `node --test tests/agentStore.test.mjs tests/agentThreadRepository.test.mjs tests/agentRuntimeSelection.test.mjs tests/agentSecondEditorReuse.test.mjs`
- `cd src-tauri && cargo test agent::adapters && cargo test agent::repository`
- Rust fixtures: first Markdown start registers Markdown Tools; matching follow-up resumes; Markdown→IdeaSketch mismatch starts a fresh Thread with IdeaSketch Tools and bounded replay; legacy missing signature rebinds once; host-Tool descriptor change rebinds; cancellation/fallback does not overwrite a healthy prior mapping.

- [x] Add failing regressions that reproduce stale Markdown Tools after switching the same conversation to IdeaSketch.
- [x] Add signature persistence and the exact-match resume gate at the Rust-owned runtime boundary.
- [x] Prove cross-editor rebinding preserves local history, Tool prerequisites, safety, and same-signature resume behavior.

## Task 2: Move Completion Duration and Copy to the Settled Final Response

**Outcome:** Working remains an in-progress lifecycle signal, while the completed response owns its final actions and duration.
**Files:**
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `src/components/agent/AgentTranscript.tsx`
- Modify: `src/components/agent/AgentItem.tsx`
- Modify: `src/index.css`
- Modify: `tests/agentStore.test.mjs`
- Modify: `tests/agentItems.test.mjs`
- Modify: `tests/agentInteraction.test.mjs`
- Modify: `tests/agentTextPresentation.test.mjs`

**Change Map:**
- successful lifecycle: remove the primary Preparing/Working item at successful terminal reduction and normalize legacy completed rows out of hydrated presentation
- final-response projection: attach terminal status and elapsed milliseconds only to the last assistant segment of a user-initiated Turn, never to welcome or intermediate segments
- action gate: require `turn.status === completed`, completed assistant content, and non-revealing presentation before rendering the response rail
- response rail: omit runtime/model/reasoning text, left-align Copy with a timer icon and `N.Ns` at the conversation end, retain an accessible completion label, and add no feedback/voting controls
- pacing safety: settled gaps during a running burst cannot expose Copy; completion while revealing waits until the exact final bytes settle

**Verification:**
- `node --test tests/agentStore.test.mjs tests/agentItems.test.mjs tests/agentInteraction.test.mjs tests/agentTextPresentation.test.mjs tests/agentTurnEvidence.test.mjs`
- Cases: running assistant with a temporarily settled presentation; multi-segment Tool Turn; completion while revealing; hydrated completed Turn; welcome; failure; cancellation; retry; Copy clipboard feedback; exact one-decimal duration; no completed Working row and no like/dislike buttons.

- [x] Capture the premature Copy and misplaced completion duration as focused failing regressions.
- [x] Make terminal Turn state and settled presentation jointly own the final action rail.
- [x] Verify chronology, evidence, pacing, retry, failure, and persisted-history behavior remain truthful.

## Task 3: Prove Real IdeaSketch Tools and Deliver B035 Independently

**Outcome:** The repaired interaction works in the native app and is recorded without absorbing or completing the ongoing B034 visual-parity work.
**Files:**
- Modify: directly affected B035 implementation and regression files discovered during validation
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B035-restore-editor-tool-rebinding-and-terminal-agent-actions.md`

**Change Map:**
- native Tool proof: one disposable conversation switches Markdown→IdeaSketch, visibly executes `read_active_page` before `replace_page_elements`, applies through the mounted editor SDK, and supports native Undo/Redo
- terminal UI proof: capture running, completion-while-revealing, and settled states; confirm Copy/duration appear only in the last state and the Working location disappears after success
- regression matrix: same-editor resume, restart/legacy migration, cancellation, fallback, Tool failure, history persistence, Light/Dark/System, and B034 Agent geometry
- workflow isolation: stage only B035 hunks in overlapping files, leave unrelated B034 changes uncommitted/in progress, validate the staged diff, and create one `fix(B035)` commit

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo build`
- `IDEANOTE_CODEX_SMOKE=1 cd src-tauri && cargo test installed_codex_executes_dynamic_editor_tool_smoke_when_enabled -- --nocapture` when the pinned local runtime is available
- Native disposable Markdown→IdeaSketch conversation, Tool sequence, visible edit, Undo/Redo, final action timing, restart, and no direct file-write/privacy audit.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git diff --cached --check`

- [x] Run the focused failure/fix loop, then one stabilized complete frontend/Rust/build/native matrix.
- [x] Present the repaired Tool registration and final-response states for review without claiming B034 completion.
- [x] Mark B035 complete/done and create the isolated B035 commit while preserving the remaining dirty B034 worktree.

## Completion Evidence

- Follow-up persisted-Turn inspection proved current IdeaSketch Turns already captured six editor Tools and successfully executed `read_active_page` plus prerequisite-gated `replace_page_elements`; the remaining empty state was the availability activity disclosure, whose event stored only counts and no expandable catalog. The native event now persists the bounded Tool name/description/prerequisite catalog, omits the misleading zero-host count, and the UI renders legacy no-detail rows as non-expandable instead of opening an empty body.
- Focused Agent regressions passed for Store lifecycle cleanup, terminal response actions, paced presentation, Turn evidence, repository hydration, runtime selection, and second-editor reuse.
- Complete frontend regression passed with `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`.
- TypeScript and production frontend build passed with `npm run build`; Vite reported only its existing dynamic-import and large-chunk advisories.
- Complete Rust regression passed 155/155 with `cargo test`, and `cargo build` completed successfully.
- Installed `codex-cli 0.147.0` smoke passed with dynamic editor Tools, including the ordered `read_active_page` prerequisite before `replace_page_elements` and a non-empty final response.
- The Rust-owned SHA-256 Tool signature is order-stable, persisted with the upstream Thread id, forces a safe one-time rebind for legacy or mismatched metadata, and replays only bounded visible user/assistant messages.
- Successful completion removes the Working lifecycle row; Copy and one-decimal completion duration render only on the final assistant segment after both the Turn and paced presentation settle.
- The final response rail omits runtime/model/reasoning text and left-aligns Copy with a timer icon plus the one-decimal elapsed duration; the full `Completed in …` phrase remains only as its accessible label.
- B034 visual-parity changes remain uncommitted and `in_progress`; the B035 commit is isolated from those pending changes.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-03-rich-runtime-comparison.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `docs/superplan/plans/features/F035-agent-history-codex-runtime-and-streaming-activity.md`
- `docs/superplan/plans/features/F037-agent-runtime-visibility-and-custom-skills/F037-01-runtime-diagnostics-and-configurable-policy.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-02-markdown-agent-skill-and-tools.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-03-real-agent-panel.md`
- `docs/superplan/plans/bugs/B025-fix-agent-fallback-hangs-cancellation-and-activity-presentation.md`
- `docs/superplan/plans/bugs/B028-show-real-agent-read-tools-in-execution-order.md`
- `docs/superplan/plans/bugs/B029-make-burst-agent-answers-visibly-progressive.md`
- `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`
- `src-tauri/src/agent/adapters/codex_app_server.rs`
- `src/components/agent/AgentItem.tsx`
- Official Codex app-server documentation: `https://learn.chatgpt.com/docs/app-server#start-or-resume-a-thread`
- Installed Codex `0.147.0` experimental generated TypeScript schemas for `ThreadStartParams`, `ThreadResumeParams`, and `DynamicToolSpec`
