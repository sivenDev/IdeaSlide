---
id: "F044-03"
title: "Add Complete Settings and Agent Experiences"
type: "feature"
status: "complete"
summary: "Recreate the current Settings Center and generic Agent lifecycle with deterministic mocked credentials, runtimes, Threads, Skills, streaming, Tools, and editor-native edits."
source: "docs/superplan/human/features.md"
created: "2026-08-11"
order: 53
depends_on: ["F044-02"]
parent: "F044"
---

# Add Complete Settings and Agent Experiences Plan

**Goal:** Make the redesigned demo fully reviewable as an AI workspace product by reproducing the current Settings and Agent interaction model against deterministic local mocks.
**Scope:** Extend only the isolated F044 demo. Replace the F043 two-page Settings placeholder with a registry-driven Settings Center containing General, AI Provider, Agent, and IdeaSketch sections. Implement Light/Dark/System, mock versioned settings persistence, AI gate, OpenAI-compatible Base URL/Model, automatic retry/max attempts, credential configured/unconfigured/replacement/removal states without returning a saved key, automatic Runtime selection status, Agent policy controls and reset, source-delivery/Tool Activity visibility, IdeaSketch laser preference, and managed bundled/custom Skill administration. Replace the static Agent thread with a deterministic mock Agent runtime that supports configuration-required, ready, disabled, running, cancelled, failed, retryable, and fallback states; context-gated panel mounting; new/resumed Threads; local history; rename/archive/permanent-delete confirmation; composer Skill selection; prompt submission; visible incremental/burst/atomic presentation; steering; cancellation; retry; chronological public activity and Tool items; runtime inspector; context pressure; diagnostics; and direct editor read/mutation Tool workflows through the F044-02 adapters and native Undo. All backend-shaped operations go through mock credential, runtime, thread, Skill, and Turn APIs.
**Non-Goals:** This plan does not send network requests, store real secrets, discover installed Codex, read real Skill directories, expose hidden reasoning, execute arbitrary files/shell/network/MCP, auto-approve document writes, add background agents, provide multiple simultaneous agents, estimate token usage, alter production settings, or claim mock encryption/security. The mock Agent may recognize bounded review prompts and presets; it is not a general language model.
**Architecture:** Register Settings sections from a local contribution registry so future demo editors can add sections without changing the dialog shell. Mock settings persist in the demo platform store and may use namespaced browser storage solely to preserve review choices across reloads; credential APIs expose only `configured`. `MockAgentRuntime` emits the same categories of normalized application events as the production frontend consumes: Thread/Turn lifecycle, message deltas, public activity, plans, Tool activity, runtime/capability updates, context updates, diagnostics, telemetry, completion, cancellation, and failure. Canned deterministic Turn scripts are selected by prompt intent and active editor type, with bounded timers that allow visible streaming/cancellation tests. The Tool broker requires current-document context reads before mutation and delegates mutations to F044-02 editor adapters. Agent UI is application-owned and format-neutral; only descriptors/context/tool contracts vary by registered editor. Welcome has no Agent lifecycle or toggle. AI disabled unmounts all Agent UI; credential missing shows configuration guidance rather than a fake response.
**Baseline:** F044-02 supplies real IdeaSketch and Markdown editors, session/revision safety, format-aware context/read/mutation adapters, and native Undo. F043 has a minimal modal with appearance and explanatory Agent copy plus a static right column. Production currently includes registry-driven Settings, encrypted-credential status semantics, automatic Runtime selection, configurable Agent policy, managed Skills, persistent local Threads, Runtime Inspector, normalized activity/Tool UI, streaming/cancellation/retry, and generic editor Tool execution.
**Exit Criteria:** Settings opens from the footer, `Command/Ctrl + ,`, editor entry point, and command palette; has accessible category navigation; persists theme and mock preferences; validates all production ranges/relationships; and truthfully represents mock credential/runtime behavior. AI disabled removes the Agent toggle/panel and prevents mock Turn/Skill/runtime activity. Missing credential shows a Settings action. With AI ready and an active file, closed Agent uses the robot affordance and open Agent uses the panel icon. Users can create, submit, steer, cancel, retry, rename, archive, show archived, resume, and permanently delete Threads with proper disabled/running constraints. The transcript preserves chronological assistant/public activity/Tool events, supports Skill selection, and distinguishes incremental/burst/atomic delivery without implying hidden reasoning. Runtime Inspector shows runtime/model/capabilities/health, exact-or-unavailable context, policy, Skills, delivery telemetry, and safe diagnostics. IdeaSketch and Markdown read/mutation scripts validate active revision/state, apply one native editor transaction, become dirty/autosave, and support one-step native Undo. Focused mock Agent/Settings tests, responsive browser QA, clean console, and no production changes pass.

## Task 1: Build the Registry-driven Settings Center and Mock Preferences

**Outcome:** Every current application/editor setting can be reviewed from the approved desktop configuration surface.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/components/settings/SettingsCenter.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/settings/GeneralSettings.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/settings/AiProviderSettings.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/settings/AgentSettings.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/settings/IdeaSketchSettings.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/settings/SettingsField.jsx`
- Create: `.temp/f041-native-workbench-review/src/lib/settingsRegistry.js`
- Create: `.temp/f041-native-workbench-review/src/mock/mockSettingsApi.js`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Test: `.temp/f041-native-workbench-review/tests/settingsExperience.test.mjs`

**Change Map:**
- Settings shell: registered categories, save/error states, dialog focus, footer/editor/shortcut/palette entry points
- General/IdeaSketch: Light/Dark/System and Preview laser preference
- Provider: URL, model, retry policy, credential status/input visibility/replace/remove without saved-key exposure
- Agent policy: AI gate, Runtime status, maximum steps, exact-context thresholds, diagnostic/replay counts, Tool/delivery visibility, and reset

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/settingsExperience.test.mjs`
- Browser cases: all entry/close paths; persistence across reload; System change; range/relationship normalization; credential replace/remove; saving/error; AI gate unmount.

- [x] Replace the placeholder modal with all current Settings sections and validation.
- [x] Implement mock settings/credential APIs with truthful security language.
- [x] Preserve the restrained F043 modal geometry and native token system.

## Task 2: Add Managed Skill and Runtime Selection Experiences

**Outcome:** Users can review automatic Runtime evidence and manage bundled/custom Skills without real filesystem or process discovery.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/components/settings/AgentSkillManager.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/agent/AgentSkillPicker.jsx`
- Create: `.temp/f041-native-workbench-review/src/mock/mockAgentCatalogApi.js`
- Create: `.temp/f041-native-workbench-review/src/mock/agentFixtures.js`
- Modify: `.temp/f041-native-workbench-review/src/components/settings/AgentSettings.jsx`
- Test: `.temp/f041-native-workbench-review/tests/agentCatalogExperience.test.mjs`

**Change Map:**
- Runtime catalog: healthy Codex, Compatibility fallback, incompatible/missing diagnostics, and editor Tool gate
- bundled Skills: mandatory editor contributions and resource metadata
- custom Skills: mock folder import, validation errors, enable, autonomous activation, editor scope, refresh, remove confirmation
- composer picker: explicit compatible Skill selection and disabled/running states

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/agentCatalogExperience.test.mjs`
- Browser cases: import valid/invalid Skill; refresh; enable/disable; all/specific editor scopes; AI-disabled management; Runtime catalog variants.

- [x] Implement deterministic Runtime discovery/selection evidence.
- [x] Recreate managed Skill administration and composer selection.
- [x] Keep Skills instruction-only and unable to widen mock editor Tools.

## Task 3: Implement Threads, Transcript, Composer, and Runtime Inspector

**Outcome:** The full generic Agent panel can be experienced without a model or Tauri process.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/components/agent/AgentPanel.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/agent/AgentThreadHeader.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/agent/AgentThreadHistory.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/agent/AgentTranscript.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/agent/AgentComposer.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/agent/AgentRuntimeInspector.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/agent/AgentToolActivity.jsx`
- Create: `.temp/f041-native-workbench-review/src/mock/mockAgentRuntime.js`
- Create: `.temp/f041-native-workbench-review/src/lib/agentStore.js`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Test: `.temp/f041-native-workbench-review/tests/agentInteraction.test.mjs`
- Test: `.temp/f041-native-workbench-review/tests/agentThreadHistory.test.mjs`
- Test: `.temp/f041-native-workbench-review/tests/agentRuntimeInspector.test.mjs`

**Change Map:**
- Thread lifecycle: new, persist, paginate, resume, rename, archive, show archived, permanent delete, and running constraints
- Turn lifecycle: submit, deterministic event projection, steering, cancel, retry, terminal failure, and presentation pacing
- transcript: safe Markdown, public activity, plans, Tool chronology, errors, empty/configuration states
- Inspector: effective runtime/model/capabilities/health, exact context, policy snapshot, Skill provenance, telemetry, and diagnostics

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/agentInteraction.test.mjs .temp/f041-native-workbench-review/tests/agentThreadHistory.test.mjs .temp/f041-native-workbench-review/tests/agentRuntimeInspector.test.mjs`
- Browser cases: incremental/burst/atomic scripts; steer; cancel; retry; configuration failure; fallback; context pressure; history lifecycle; running delete disabled; Tool Activity visibility.

- [x] Implement normalized mock Agent events and the complete application-owned panel.
- [x] Deliver Thread/history/composer/Inspector flows with honest lifecycle states.
- [x] Preserve event chronology and never display or imply hidden reasoning.

## Task 4: Route Mock Agent Tools Through Both Active Editors

**Outcome:** Agent-assisted editing is directly experienceable and remains bounded by the current document/session/editor contracts.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/lib/mockAgentToolBroker.js`
- Modify: `.temp/f041-native-workbench-review/src/mock/mockAgentRuntime.js`
- Modify: `.temp/f041-native-workbench-review/src/lib/editorAgentAdapters.js`
- Modify: `.temp/f041-native-workbench-review/src/components/agent/AgentTranscript.jsx`
- Modify: `.temp/f041-native-workbench-review/src/editors/ideasketch/IdeaSketchEditor.jsx`
- Modify: `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownEditor.jsx`
- Test: `.temp/f041-native-workbench-review/tests/agentEditorTools.test.mjs`

**Change Map:**
- broker: bounded steps, prerequisites, duplicate call handling, cancellation, result chronology, and safe summaries
- IdeaSketch: read structure/selection and one clean-diagram or scene mutation transaction
- Markdown: read outline/selection and one bounded range or section mutation transaction
- validation: active binding, revision, source fingerprint, read-only/conflict/missing/external state, and mounted editor

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/agentEditorTools.test.mjs`
- Browser cases: read then mutate; stale/restricted rejection; switch target during Turn; cancel during Tool; direct editor transaction; dirty/autosave; one-step native Undo in both editors.

- [x] Implement one generic mock Tool broker and editor-specific adapters.
- [x] Prove both editors receive safe direct edits without Agent-owned persistence or history.
- [x] Deliver F044-03 in a separate commit after complete Agent/Settings browser QA.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F037-agent-runtime-visibility-and-custom-skills/F037-01-runtime-diagnostics-and-configurable-policy.md`
- `docs/superplan/plans/features/F037-agent-runtime-visibility-and-custom-skills/F037-02-managed-custom-agent-skills.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-02-ideasketch-and-markdown-editor-experiences.md`
- `src/components/SettingsCenter.tsx`
- `src/components/AgentPanel.tsx`
- `src/components/settings/AgentSettings.tsx`
- `src/components/settings/AgentSkillManager.tsx`
- `src/components/agent/AgentRuntimeInspector.tsx`
