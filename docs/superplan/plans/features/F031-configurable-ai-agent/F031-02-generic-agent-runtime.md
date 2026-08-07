---
id: "F031-02"
title: "Deliver the Editor-agnostic Agent Runtime"
type: "feature"
status: "complete"
summary: "Integrate a native open-source Agent runtime, open Agent Skills, a reusable right-sidebar host, and the first IdeaSketch extension with reviewed reversible changes."
source: "docs/superplan/human/features.md"
created: "2026-08-08"
order: 32
depends_on: ["F031-01", "04", "05", "06", "F009"]
parent: "F031"
---

# Deliver the Editor-agnostic Agent Runtime Plan

**Goal:** Let one in-app Agent operate any registered editor through injected Skills, Tools, Context, and Change Review adapters, beginning with IdeaSketch but without embedding `.is` knowledge in the runtime or panel.
**Scope:** Add a Rust Agent runtime behind an IdeaNote-owned provider/runtime boundary using a pinned maintained open-source Rust framework; implement progressive loading of the open Agent Skills `SKILL.md` format; stream typed run, message, Tool Activity, approval, error, and completion events to React; and use composable open-source React Agent primitives behind IdeaNote styling. Extend the File Type Registry with an optional Agent extension descriptor. Build a generic Right Sidebar Host that has one physical panel and switches between the Agent surface and the active editor's contributed navigator, so IdeaSketch Pages/Cameras and Agent never create competing right columns. Add the first IdeaSketch extension with current-document/Page/selection context, read tools, proposal-only mutation tools, editor-specific Change Review rendering, apply-through-current-session behavior, and one-step Undo. AI-disabled state mounts none of this; AI-enabled without a configured provider renders setup guidance only.
**Non-Goals:** This plan does not implement Markdown, IdeaTable, or IdeaWorkflow editors; background autonomous jobs; multi-agent orchestration; unrestricted Workspace indexing; arbitrary local-file, shell, network, or script tools; direct model writes to disk; automatic approval of mutations; cloud-hosted conversation storage; billing UI; or remove the legacy MCP runtime. It does not make Rig, assistant-ui, provider SDK types, or the Agent Skills parser part of IdeaNote's public editor extension contract.
**Architecture:** Rust owns provider credentials, model requests, conversation/run state, cancellation, limits, and the open-source runtime adapter. Pin the selected runtime version and hide it behind `AgentRuntime` and `ModelProvider` traits because upstream documents continuing breaking changes. Skills follow the open Agent Skills folder format and load progressively: discovery metadata first, full instructions only after the active file type activates the skill. The frontend `AgentExtension` supplies tool schemas, current editor context, a trusted executor, and Change Review renderer. At run start the active extension sends its tool descriptors and a bounded context snapshot to Rust. When the model requests a tool, Rust emits a typed request and pauses; the frontend routes it to the active extension and returns a structured result. Read tools return bounded data. Mutation tools create an opaque typed `AgentChangeSet` tied to document id, Page id where relevant, base revision, and source fingerprint; they do not mutate or save. Approval applies through the mounted editor's existing model/change/dirty/save boundary, rejects stale revisions/external conflicts, and records an undo snapshot. The app-level `RightSidebarHost` owns visibility, width, active surface, and divider; editors contribute navigator content rather than adding another outer column.
**Baseline:** The current application has no model/provider runtime, Agent session state, Skill loader, generic Tool registry, Change Set, or Agent UI. IdeaSketch owns a fixed right-side Pages/Cameras navigator inside its editor. File Type Definition only declares parse/serialize/editor behavior. The Rust backend already has async Tauri infrastructure and canonical file services but its AI-like automation boundary is the separate stdio MCP server. Current editor/recovery protections already track document revisions, external changes, snapshots, dirty state, and safe persistence and must remain authoritative.
**Exit Criteria:** With AI enabled and a provider configured, the app-wide Agent can stream a conversation for either Workspace or Single File mode, discover only the active editor's extension, progressively load its Skill, display Tool Activity, cancel a run, and survive normal panel/editor switching without exposing credentials. Opening an IdeaSketch file activates the IdeaSketch Skill and tools; a representative request reads the current Page, proposes a new Page with editable Excalidraw elements, shows a format-aware review, writes nothing before approval, rejects approval after a revision/external-change mismatch, applies through the existing Document Session after approval, and offers Undo. Switching to an unsupported/unregistered file supplies no editor-specific tools and cannot mutate it. Turning AI off tears down the panel/runtime and prevents initialization or provider access. The single Right Sidebar Host can show Agent or the IdeaSketch Navigator without simultaneous right columns, preserves Pages/Cameras behavior, remains usable at supported widths, and restores Canvas pointer alignment. Provider/tool/run tests use offline fakes; focused, full, build, native/browser, security, and conflict/recovery verification pass.

## Task 1: Establish Open-source Runtime and Extension Contracts

**Outcome:** IdeaNote owns stable interfaces around the selected Agent framework, Skills format, UI primitives, and editor-extension boundary.
**Files:**
- Create: `src-tauri/src/agent/mod.rs`
- Create: `src-tauri/src/agent/runtime.rs`
- Create: `src-tauri/src/agent/provider.rs`
- Create: `src-tauri/src/agent/session.rs`
- Create: `src-tauri/src/agent/skills.rs`
- Create: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/agent/types.ts`
- Create: `src/lib/agent/agentExtensionRegistry.ts`
- Create: `src/lib/agent/agentClient.ts`
- Modify: `src/lib/fileTypeRegistry.ts`
- Test: `src-tauri/src/agent/runtime.rs`
- Test: `src-tauri/src/agent/skills.rs`
- Test: `tests/agentExtensionRegistry.test.mjs`

**Change Map:**
- Rust runtime adapter: exact-pinned maintained framework dependency, provider-neutral request/stream interface, deterministic fake provider, cancellation/step/token bounds, redacted errors, and no frontend secret exposure
- Skill loader: Agent Skills discovery metadata, safe packaged-root resolution, full-instruction activation, validation, duplicate-id rejection, and no arbitrary Workspace scripts/assets execution
- shared Agent types: sessions, messages, typed stream events, tool schemas/calls/results, approvals, run state, and errors
- frontend extension registry: active file-type lookup, contributed skill ids/tool descriptors/context/executor/reviewer, and safe unsupported fallback
- File Type Definition: optional Agent extension id only; shared document/editor code remains format-agnostic

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- `node --test tests/agentExtensionRegistry.test.mjs tests/fileTypeRegistry.test.mjs`
- Cases: fake-provider streaming/cancellation; no configured provider; step limit; Skill metadata-only discovery then activation; missing/malformed Skill; extension switch; unsupported file has no tools; disabled gate makes no runtime command.

- [x] Pin and wrap the selected open-source Rust runtime instead of exposing its APIs across the application.
- [x] Implement the open Agent Skills discovery/activation contract with packaged, read-only assets.
- [x] Add typed cross-process run/tool/review events and the editor Agent extension registry.

## Task 2: Build One Reusable Right Sidebar and Agent Surface

**Outcome:** Agent conversation and editor-contributed navigation share one app-level right panel without compressing the editor through duplicate sidebars.
**Files:**
- Create: `src/components/RightSidebarHost.tsx`
- Create: `src/components/AgentPanel.tsx`
- Create: `src/components/agent/AgentConversation.tsx`
- Create: `src/components/agent/AgentToolActivity.tsx`
- Create: `src/components/agent/AgentComposer.tsx`
- Create: `src/hooks/useAgentRuntime.ts`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/IdeaSketchNavigator.tsx`
- Modify: `src/components/CanvasPresentationControls.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Test: `tests/rightSidebarHost.test.mjs`
- Test: `tests/agentPanel.test.mjs`
- Modify: `tests/ideaSketchNavigator.test.mjs`
- Modify: `tests/panelDividerWiring.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`

**Change Map:**
- `RightSidebarHost`: one bounded/resizable/collapsible physical panel, Agent/editor surface switching, activation-gate handling, focus restoration, and no simultaneous outer right columns
- IdeaSketch contribution: move existing Pages/Cameras navigator ownership into a contributed editor surface while retaining active Page, Camera, Present, and drawing behavior
- Agent Panel: assistant-ui primitives through a custom Tauri runtime adapter, IdeaNote styling, conversation, Tool Activity, cancellation, empty/setup/error states, and no provider-specific UI assumptions
- editor/app wiring: active document/extension context, run teardown on AI disable, safe document switch behavior, and Canvas size/pointer refresh after sidebar transitions

**Verification:**
- `node --test tests/rightSidebarHost.test.mjs tests/agentPanel.test.mjs tests/ideaSketchNavigator.test.mjs tests/panelDividerWiring.test.mjs tests/slideCanvasProps.test.mjs tests/canvasPresentationControls.test.mjs`
- Browser/Tauri cases: AI disabled; enabled/unconfigured; configured streaming; cancel; switch Agent/Navigator; collapse/resize; Page/Camera actions; 1200px/1024px/minimum-width layout; Canvas pointer/viewport stability.

- [x] Recompose the current editor navigator and new Agent into one generic app-level sidebar host.
- [x] Wire the open-source React Agent primitives through an IdeaNote-owned custom runtime and visual system.
- [x] Preserve all IdeaSketch navigator, Camera, Present, focus, resize, and Canvas alignment behavior.

## Task 3: Add the IdeaSketch Skill, Context, and Proposal Tools

**Outcome:** IdeaSketch becomes the first reusable Agent extension without leaking `.is` knowledge into the generic runtime.
**Files:**
- Create: `src-tauri/agent-skills/ideasketch/SKILL.md`
- Create: `src-tauri/agent-skills/ideasketch/references/excalidraw-elements.md`
- Create: `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- Create: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Create: `src/components/agent/IdeaSketchChangeReview.tsx`
- Modify: `src/lib/fileTypeRegistry.ts`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/hooks/useEditorSession.ts`
- Test: `tests/ideaSketchAgentExtension.test.mjs`
- Test: `tests/agentChangeReview.test.mjs`
- Modify: `tests/ideaSketchReducer.test.mjs`
- Modify: `tests/editorSession.test.mjs`

**Change Map:**
- IdeaSketch Skill: when to activate, Page/element terminology, editable-scene constraints, supported/unsupported content, proposal-first workflow, and reference routing
- context provider: bounded document outline, active Page, selection, Cameras, revision/source fingerprint, and explicit omission/truncation markers
- tools: read outline/Page/selection and propose new Page or element changes; every mutation returns an opaque extension-owned operation set plus human-readable summary and never calls save/write commands
- review renderer: Page/element/viewport changes, unsupported retained content, source target, stale/conflict warning, approve/revise/reject actions, and accessible summaries

**Verification:**
- `node --test tests/ideaSketchAgentExtension.test.mjs tests/agentChangeReview.test.mjs tests/ideaSketchReducer.test.mjs tests/editorSession.test.mjs`
- Cases: correct activation; context bounds; unselected/unsupported content; deterministic tool schemas; source Page unchanged for new-Page proposal; no write before approval; malformed tool arguments rejected; unsupported file receives no IdeaSketch Skill/tool.

- [x] Package the IdeaSketch capability as one open-format Skill plus extension-owned tools/context/review.
- [x] Keep read tools bounded and make every mutation proposal-only.
- [x] Prove that future synthetic editor extensions can register different Skills and Tools without changing runtime or panel code.

## Task 4: Apply Reviewed Changes Safely and Reversibly

**Outcome:** Approved Agent changes use the existing document safety kernel and can be undone without bypassing external-change or recovery protections.
**Files:**
- Create: `src/lib/agent/changeSet.ts`
- Create: `src/lib/agent/approvalState.ts`
- Modify: `src/lib/appStoreReducer.ts`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/lib/editorSession.ts`
- Modify: `src/lib/externalFileChanges.ts`
- Test: `tests/agentChangeSet.test.mjs`
- Test: `tests/agentApprovalState.test.mjs`
- Modify: `tests/externalFileChanges.test.mjs`
- Modify: `tests/recovery.test.mjs`

**Change Map:**
- generic Change Set: extension id, document/session id, base revision/fingerprint, opaque operations, preview summary, status, and one-use approval identity
- approval state: review/revise/reject/apply/cancel/undo transitions with no hidden auto-approval
- apply path: mounted editor extension validates and transforms the current model, then uses normal model-change/dirty/autosave-or-explicit-save behavior; no direct disk write or MCP command
- stale/conflict protection: reject changed document/Page/source state and require regeneration after external modification, read-only/missing status, or incompatible editor switch
- undo: pre-apply snapshot restored through the same editor/session boundary and retained by recovery rules until safely saved/discarded

**Verification:**
- `node --test tests/agentChangeSet.test.mjs tests/agentApprovalState.test.mjs tests/ideaSketchAgentExtension.test.mjs tests/externalFileChanges.test.mjs tests/recovery.test.mjs tests/appStoreReducer.test.mjs`
- Native cases: Workspace and Standalone proposals; approve; reject; revise; double-apply rejected; external edit before approval; read-only/missing target; Undo; autosave/explicit save; crash recovery after approved dirty change.

- [x] Require explicit review for every mutation and reject stale or externally changed targets.
- [x] Apply only through the existing document model and persistence pipeline.
- [x] Deliver one-step Undo and recovery-safe behavior for approved changes.

## Task 5: Verify the Generic Runtime and First Extension

**Outcome:** The replacement Agent capability is safe and complete enough for legacy MCP removal.
**Files:**
- Modify: `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`

**Change Map:**
- plan evidence: dependency licenses/versions, offline runtime tests, Skill loading, generic-extension proof, UI/accessibility, proposal/apply/undo, conflict/recovery, and disabled lifecycle

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `git diff --check`
- Native acceptance with a temporary `.is`: configure provider, run read and mutation requests, inspect Tool Activity/review, approve/save/reopen, Undo, conflict rejection, switch Agent/Navigator, disable AI, and confirm no secrets in logs or persisted app/Workspace JSON.

- [x] Run focused tests while iterating and the complete high-risk regression/security/build matrix after implementation stabilizes.
- [x] Record end-to-end evidence for generic extension isolation, reviewed persistence, recovery, and complete disabled teardown.

## Completion Evidence

- Open-source boundaries: the backend exact-pins `rig-core = 0.41.0` behind IdeaNote-owned Agent modules; packaged Skills use the open Agent Skills `SKILL.md` format with metadata-only discovery and active-skill loading. The React surface uses `@assistant-ui/react` external-store runtime, Thread/Message/Composer primitives, established Radix controls, and an IdeaNote-owned adapter instead of exposing framework types to editor extensions.
- Generic extension proof: `AgentExtension` supplies Skill id, bounded context, Tool descriptors, proposal parsing, and review ownership. IdeaSketch is registered only through File Type Registry metadata, and a synthetic Markdown-like extension test registers a different Skill and Tool set without changing the Rust runtime, Agent panel, or sidebar host.
- Native runtime proof: offline OpenAI-compatible SSE tests exercise the real Rig adapter, verify streamed text, confirm prior user/assistant history and bearer authorization reach the provider request, and prove cancellation stops an active provider stream. Skills, session cancellation, and typed runtime tests are included in the 74/74 Rust result.
- IdeaSketch safety: context is bounded to document outline and active Page data. Proposal Tools cover Page add/delete/reorder and element replacement. Every mutation produces a Change Set; Apply verifies document/extension identity, revision, source fingerprint, status, and external-source marker before entering the existing editor reducer/session pipeline. Reject, stale handling, and one-step Undo are covered without direct Agent save/write commands.
- Sidebar/UI acceptance: one 220–420 px resizable right sidebar switches between Navigator and Agent, preserving Pages/Cameras behavior and avoiding simultaneous right columns. Browser checks verified Navigator/Agent switching, configuration-required guidance, AI-disabled teardown, and restored AI enablement.
- Verification: `node --test tests/*.test.mjs` passed 271/271; `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed 74/74; `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`, `npm run build`, and `git diff --check` passed. The build retains only existing Excalidraw import-overlap and large-chunk informational warnings.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `src/lib/fileTypeRegistry.ts`
- `src/components/EditorLayout.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/IdeaSketchNavigator.tsx`
- `src/lib/editorSession.ts`
- `src/lib/externalFileChanges.ts`
- `src-tauri/src/lib.rs`
- `https://github.com/0xPlaygrounds/rig`
- `https://github.com/agentskills/agentskills`
- `https://github.com/assistant-ui/assistant-ui`
