---
id: "F046-03"
title: "Migrate the Reviewed Agent Panel onto the Real Agent Core"
type: "feature"
status: "draft"
summary: "Adopt the reviewed conversation, composer, model, inspector, and response layout while preserving the production Rust Agent Core, Tools, Skills, Threads, and Turn chronology."
source: "docs/superplan/human/features.md"
created: "2026-08-11"
order: 58
depends_on: ["F046-02"]
parent: "F046"
---

# Migrate the Reviewed Agent Panel onto the Real Agent Core Plan

**Goal:** Give the production Agent the concise reviewed interaction model while keeping all responses, conversations, runtime evidence, Skills, and editor edits grounded in the real Rust Agent Core.
**Scope:** Recompose the right panel around a conversation selector, per-conversation Rename/Delete menu, compact New Thread and Inspector controls, dialog-based Inspector, bottom-pinned composer, model/reasoning selection, and reviewed response evidence/actions. Remove repeated Agent labels, feature explanations, Automatic Skill, Incremental, archive/history buttons, and redundant conversation navigation. Preserve real persistent Threads/Turns, streaming, cancellation, retry, steering where supported, chronological public activity and Tool events, Runtime selection/fallback, context pressure, diagnostics, managed Skills, editor binding, direct safe editor Tools, and no-hidden-reasoning policy. Each completed assistant Turn displays immutable effective model/runtime/reasoning evidence captured from that Turn rather than current Settings.
**Non-Goals:** This plan does not replace the Rust Agent Core with demo scripts, expose chain-of-thought or hidden reasoning, fabricate token/context values, let UI-selected models bypass provider/runtime capability checks, add automatic Skill selection UI, archive conversations from primary UX, execute arbitrary shell/network/MCP operations, broaden editor Tool permissions, permit Agent-owned file persistence, or change IdeaSketch/Excalidraw editor behavior. It does not delete archived historical data merely because archive controls leave the primary panel.
**Architecture:** Existing normalized Agent events and persistent Thread/Turn stores remain authoritative. The UI projects them into the reviewed transcript without rewriting chronology. The conversation selector queries active user-visible Threads; Rename/Delete go through real commands and Radix menu/confirmation primitives, with running/deletion constraints enforced in Rust and reflected in disabled states. Archived legacy Threads may remain recoverable through storage/migration policy but are not a primary navigation concept. The composer owns draft, attachment/context affordance if already supported, model selector, reasoning selector, and submit/cancel state at the panel bottom. Model and reasoning options derive from current provider/runtime capability data; a submitted Turn snapshots the effective runtime/model/reasoning/capabilities into persisted Turn metadata before execution, and response evidence always reads that snapshot. Inspector opens as a Dialog so focus loss, Escape, and focus restoration follow maintained primitives. Skills continue through the existing settings/managed catalog; bundled editor Skills remain automatic system contributions without a composer dropdown. Response action rail is intentionally concise and does not alter message content.
**Baseline:** Production already has `AgentPanel`, persistent Thread history, normalized Turn streaming/events, runtime discovery and fallback, Runtime Inspector, Skill catalog/management, Tool broker, direct editor read/mutation adapters, cancellation/retry, and Rust persistence. The current panel predates the approved demo and contains repeated headings/navigation, archive/history concepts, a separate Inspector surface, and composer/runtime presentation that do not match the reviewed hierarchy. The demo proves the desired conversation selector, compact menus, bottom composer, model/reasoning affordance, response evidence hinge, and dialog behavior against deterministic mocks.
**Exit Criteria:** The right panel contains one concise Agent crown. Its conversation selector shows real conversations; each row menu is compact, trigger-anchored, dismisses on focus loss/Escape, and contains only Rename/Delete. Delete uses a safe confirmation and respects running-state constraints. There is no Automatic Skill control, Incremental label, archive button, history button, duplicate Conversations label, or explanatory feature copy. New Thread and Inspector align right; Inspector is a focus-managed dialog. The transcript preserves real chronological user/assistant/public activity/Tool/error events. The composer stays at the bottom through empty, long, streaming, error, and narrow states; its model/reasoning controls expose only supported real options and remain coherent with Settings/provider test results. Every assistant response shows immutable effective model/runtime/reasoning evidence from its own Turn; later settings changes do not rewrite old evidence. Submit, stream, steer where supported, cancel, retry, resume, rename, delete, runtime fallback, context pressure, Skills, direct Markdown/IdeaSketch edits, native Undo, save/recovery, AI-disabled teardown, Light/Dark/System, and context-gated panel behavior continue to work without hidden reasoning.

## Task 1: Recompose Conversation Navigation and Inspector

**Outcome:** Real Threads use the reviewed selector/menu lifecycle and a maintained dialog Inspector.
**Files:**
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/agent/AgentThreadHistory.tsx`
- Modify: `src/components/agent/AgentRuntimeInspector.tsx`
- Create: `src/components/agent/AgentConversationSelector.tsx`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/repository.rs`
- Modify: `src/index.css`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/agentThreadHistory.test.mjs`
- Modify: `tests/agentRuntimeInspector.test.mjs`
- Test: `src-tauri/src/agent/repository.rs`

**Change Map:**
- crown/navigation: one conversation selector plus right-aligned New Thread/Inspector/close controls, no duplicate labels or archive/history chrome
- Thread actions: Rename/Delete only in compact Radix menus; confirmation, focus restoration, running constraints, and truthful failures
- Inspector: Dialog lifecycle instead of a dismiss-broken side surface; retain real runtime/capability/context/diagnostic evidence
- persistence compatibility: keep existing Thread data readable while removing archive from the primary interaction model

**Verification:**
- `node --test tests/agentPanel.test.mjs tests/agentThreadHistory.test.mjs tests/agentRuntimeInspector.test.mjs`
- `cd src-tauri && cargo test agent::repository`
- Cases: empty/one/many conversations; rename; delete cancel/confirm/failure/running; menu blur/Escape; selector keyboard navigation; Inspector open/Escape/outside/focus return; archived legacy records remain non-destructively compatible.

- [ ] Add contracts for the concise crown, selector, compact menus, and dialog focus lifecycle.
- [ ] Route reviewed navigation through existing persistent Thread commands rather than UI-only state.
- [ ] Verify data compatibility and running/error constraints before removing old primary controls.

## Task 2: Add Capability-backed Model/Reasoning Selection and Turn Evidence

**Outcome:** Composer choices are real, and every response permanently records what produced it.
**Files:**
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/agent/AgentComposer.tsx`
- Create: `src/components/agent/AgentModelSelector.tsx`
- Modify: `src/components/agent/AgentRuntimeInspector.tsx`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `src-tauri/src/agent/repository.rs`
- Modify: `src-tauri/src/agent/runtime.rs`
- Modify: `tests/agentPanel.test.mjs`
- Create: `tests/agentTurnEvidence.test.mjs`
- Test: `src-tauri/src/agent/repository.rs`
- Test: `src-tauri/src/agent/provider.rs`

**Change Map:**
- capability catalog: normalize supported model/reasoning options from configured provider and selected runtime; reject stale/unsupported selections server-side
- Turn start: resolve and persist immutable effective runtime/model/reasoning/capability evidence before execution
- transcript evidence: render each assistant Turn's snapshot, never the mutable current Settings value
- composer: remove Automatic Skill/Incremental controls, keep model/reasoning controls beside the bottom input, and preserve submit/cancel/running accessibility

**Verification:**
- `node --test tests/agentPanel.test.mjs tests/agentTurnEvidence.test.mjs`
- `cd src-tauri && cargo test agent::provider && cargo test agent::repository`
- Cases: Codex and compatibility runtimes; supported/unsupported reasoning; provider/model change after old Turns; fallback; retry; resumed Thread; persistence/restart; missing exact evidence shown as unavailable rather than guessed.

- [ ] Add frontend/Rust regressions for capability-backed selection and immutable evidence.
- [ ] Persist effective Turn evidence at the execution boundary and expose it through normalized types.
- [ ] Recompose the pinned composer without weakening runtime validation or cancellation.

## Task 3: Preserve Full Agent and Editor Tool Behavior in the Reviewed Transcript

**Outcome:** The simplified panel retains production streaming, activity, Skills, and safe direct editor edits.
**Files:**
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/agent/AgentTranscript.tsx`
- Modify: `src/components/agent/AgentItem.tsx`
- Modify: `src/components/agent/AgentToolActivity.tsx`
- Modify: `src/lib/agent/agentTextPresentation.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `src/index.css`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/agentItems.test.mjs`
- Modify: `tests/agentInteraction.test.mjs`
- Create: `tests/agentToolActivity.test.mjs`
- Modify: `tests/agentDirectEditorContract.test.mjs`
- Modify: `tests/markdownAgentDirectEditorContract.test.mjs`

**Change Map:**
- transcript: maintain source event order across messages, public activity, plans, Tools, failures, cancellation, and retries
- response rail: concise copy/retry/feedback-style actions only where supported, with no decorative duplicate navigation
- Skills/context: bundled/custom Skill behavior remains runtime-owned; active editor context and Tool permissions remain registry/editor-owned
- layout: transcript scrolls independently while composer remains pinned and crown/dialog geometry remains stable

**Verification:**
- `node --test tests/agentPanel.test.mjs tests/agentItems.test.mjs tests/agentInteraction.test.mjs tests/agentToolActivity.test.mjs tests/agentDirectEditorContract.test.mjs tests/markdownAgentDirectEditorContract.test.mjs`
- Native cases: new/resume Thread; stream; cancel; retry; fallback; long transcript; Tool success/failure/cancel; custom Skill enabled/disabled; bundled Skill always active; Markdown and IdeaSketch direct edits, native Undo, autosave; AI disabled and provider-required states.

- [ ] Protect event chronology and editor Tool boundaries with focused regressions.
- [ ] Apply the reviewed transcript/composer geometry without hiding lifecycle evidence.
- [ ] Verify complete Agent behavior against real Rust events and disposable documents.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F035-agent-history-codex-runtime-and-streaming-activity.md`
- `docs/superplan/plans/features/F037-agent-runtime-visibility-and-custom-skills/F037-01-runtime-diagnostics-and-configurable-policy.md`
- `docs/superplan/plans/features/F037-agent-runtime-visibility-and-custom-skills/F037-02-managed-custom-agent-skills.md`
- `docs/superplan/plans/bugs/B030-refine-navigation-menus-settings-and-agent-history.md`
- `docs/superplan/plans/bugs/B031-refine-compact-menus-labels-and-custom-skills.md`
- `docs/superplan/plans/bugs/B032-refine-agent-window-chrome-menus-and-workspace-dragging.md`
- `.temp/f041-native-workbench-review/src/components/agent/AgentPanel.jsx`
- `src/components/AgentPanel.tsx`
- `src/components/agent/AgentThreadHistory.tsx`
- `src/components/agent/AgentRuntimeInspector.tsx`
- `src-tauri/src/agent/`
