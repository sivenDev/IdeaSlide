---
id: "F037-02"
title: "Add Managed Custom Agent Skills"
type: "feature"
status: "complete"
summary: "Let users safely import, manage, and invoke standard custom Skills without allowing Skills to widen Agent or editor capabilities."
source: "docs/superplan/human/features.md"
created: "2026-08-10"
order: 43
depends_on: ["F037-01", "F038-02"]
parent: "F037"
---

# Add Managed Custom Agent Skills Plan

**Goal:** Let users extend the application-level Agent with reusable workflow instructions while preserving one runtime-neutral Skill standard and the existing editor Tool security boundary.
**Scope:** Extend the existing IdeaNote-owned bundled Skill registry into one normalized registry covering the current IdeaSketch and Markdown editor Skills plus user-imported Skills. Accept the open Agent Skills directory shape with required `SKILL.md` `name` and `description`, progressive metadata-first loading, optional bounded text references, optional non-executable assets, and a safe subset of `agents/openai.yaml` interface/invocation metadata. Import local folders into an application-managed Skill store using atomic copies and validation; list, enable/disable, refresh, remove, inspect errors, control implicit invocation, and restrict compatible editor scopes in Settings > Agent. Preserve bundled Skill discovery and embedded references; keep the active editor Skill mandatory and additive, and never let custom Skills replace it. Support explicit custom-Skill selection from the composer and runtime-initiated implicit activation through IdeaNote-owned read-only Skill activation/reference Tools so Codex and Compatibility follow the same behavior. Capture Skill identity, origin, content digest/version, activation mode, and editor scope at Turn start or activation so in-flight behavior remains stable and history stays explainable.
**Non-Goals:** This plan does not execute Skill scripts; install dependencies; register or configure MCP; add shell, arbitrary filesystem, network, browser, or process capabilities; allow a Skill to define editor Tools or bypass Tool prerequisites, validation, cancellation, maximum-step, direct frontend editor-SDK mutation, native Undo/Redo, safe-save, or external-change rules; load arbitrary Codex user/repository Skills outside IdeaNote's managed registry; add a remote marketplace, plugin publishing, cloud sync, Workspace-scoped Skill configuration, automatic internet installation, or multi-agent roles; silently override bundled Skill ids; or make binary assets executable or directly writable into documents.
**Architecture:** Rust owns the Skill registry, import transaction, canonical-path and symlink checks, frontmatter parsing, safe metadata normalization, content hashing, bounded resource reads, duplicate/reserved-id policy, and atomic application-data persistence. Internal Skill ids are origin-qualified and stable; user-facing `name` remains standard metadata. Bundled/editor, user, and future plugin origins implement one registry contract, with the existing `BUNDLED_SKILLS` entries retained as read-only registry members rather than replaced by managed copies. The frontend receives metadata and management status only. A bounded catalog of enabled compatible Skill names/descriptions is supplied to the runtime. Explicit selections load their immutable snapshot before model work; implicit use requires the model to call an IdeaNote-owned `activate_skill` Tool, after which full instructions are injected and bounded references are available through `read_skill_reference`. These host Tools are not editor Tools and cannot return arbitrary paths. Custom Skill instructions may name existing Tool capabilities, but activation validates them against the captured editor Tool catalog and never creates or widens permissions. The mandatory active editor Skill and captured editor extension remain authoritative for Tool descriptors and direct SDK execution; no registry, Runtime, Tool Broker, Agent Panel, or store branch may depend on IdeaSketch, Markdown, or document format. The Turn records safe provenance, not full instructions or reference content. AI disable stops automatic discovery, activation, resource serving, and runtime injection; explicit Settings management may operate only on persisted/imported Skill metadata and files and cannot initialize a model runtime.
**Baseline:** `src-tauri/src/agent/skills.rs` now has a generic `BUNDLED_SKILLS` registry with `ideasketch` and `markdown`, metadata-only discovery, full instruction loading, and embedded Markdown reference support. `src-tauri/agent-skills/markdown/` and `src/lib/agent/extensions/markdownAgentExtension.ts` prove the second-editor path, while IdeaSketch and Markdown mutations execute through captured Excalidraw or CodeMirror SDK transactions and use native Undo/Redo. `AgentSkillMetadata` still contains only id/name/description. `AgentExtension.skillId` remains singular and the active editor binding passes that mandatory id into each Turn. `prompt_with_context` eagerly inserts the full active editor Skill into every preamble. There is no user-managed origin, import repository, enablement state, validation UI, Skill version, explicit picker, implicit activation, opaque bounded reference-reading Tool, or immutable custom-Skill provenance. The generic Tool Broker, runtime adapters, Agent Panel, store, and activity UI already accept both editor extensions without format branches and remain the authority this feature must preserve.
**Exit Criteria:** Settings lists bundled and custom Skills with origin, source, enabled state, invocation policy, compatible editors, version digest, validation state, and last refresh. A user can import a valid instruction-only or reference-bearing Skill folder, enable it, explicitly select it for a Turn, allow or disable implicit invocation, refresh it by deliberate re-import, and remove only the managed custom copy. Invalid metadata, duplicate/reserved ids, unsupported dependencies/scripts, excessive files/sizes, traversal, symlink, and malformed reference cases fail with safe actionable errors and no partial registry state. The matching bundled IdeaSketch or Markdown Skill remains present and mandatory for every supported editor Turn, while selected or activated custom Skills are additive. Codex and Compatibility can autonomously activate an eligible implicit Skill through the normalized host Tool and read only bounded in-root text references; neither runtime gains arbitrary filesystem access. A Turn keeps one immutable activated Skill snapshot even if Settings change during execution and persists only safe provenance. AI disable prevents runtime discovery/activation/resource access. Complete frontend, Rust, build, package, privacy, import/restart, cross-runtime, IdeaSketch/Markdown Tool, native Undo/Redo, unsupported-editor isolation, and no-format-branch acceptance pass.

## Task 1: Define the Standard Skill Registry and Invocation Contract

**Outcome:** Product and protocol documentation define origins, lifecycle, invocation, resources, provenance, and capability boundaries independently of any runtime or editor.
**Files:**
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/rfcs/001-codex-style-generic-agent.md`
- Modify: `src/lib/agent/types.ts`
- Modify: `src/lib/agent/protocol.ts`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `tests/agentProtocol.test.mjs`
- Modify: `tests/agentExtensionRegistry.test.mjs`
- Modify: `tests/agentSecondEditorReuse.test.mjs`

**Change Map:**
- registry metadata: origin, stable internal id, standard name/description, enabled/valid state, digest/version, source label, compatible editor scopes, implicit policy, resources, and safe validation diagnostics while preserving current bundled ids and references
- Turn binding: mandatory IdeaSketch-or-Markdown editor Skill selected through the generic extension registry plus zero or more custom Skill selections/activations and immutable provenance snapshots
- invocation: explicit selection and runtime-neutral implicit activation; exact behavior when a Skill becomes disabled, invalid, missing, or incompatible
- capability boundary: Skill requirements resolve only against captured existing host/editor capabilities; dependencies, scripts, MCP, and arbitrary Tools are unsupported
- resource contract: progressive `SKILL.md` and bounded in-root text-reference reads with no raw absolute paths

**Verification:**
- `node --test tests/agentProtocol.test.mjs tests/agentExtensionRegistry.test.mjs tests/settings.test.mjs`
- Rust serialization/validation tests for origins, duplicate names/ids, invocation modes, provenance, unsupported metadata, and missing resources.

- [x] Add failing normalized contracts for built-in/custom origins, additive editor Skills, invocation, resource handles, validation, and Turn provenance.
- [x] Update PRD/RFC authority using the open Agent Skills standard while documenting IdeaNote's intentionally narrower executable boundary.
- [x] Keep runtime brands, editor formats, filesystem paths, and framework types out of the public frontend contract.

## Task 2: Build the Native Managed Skill Repository and Safe Import Pipeline

**Outcome:** Custom Skill folders become validated, atomically managed application data rather than arbitrary runtime filesystem access.
**Files:**
- Create: `src-tauri/src/agent/skill_registry.rs`
- Modify: `src-tauri/src/agent/skills.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src/lib/agent/agentClient.ts`
- Test: `src-tauri/src/agent/skill_registry.rs`
- Test: `src-tauri/src/agent/skills.rs`
- Test: `tests/agentSkillRepository.test.mjs`

**Change Map:**
- managed repository: application-data root, schema/version manifest, read-only bundled/user origins, atomic staging/rename, restart hydration, refresh/re-import, remove, and corruption recovery without copying or shadowing the bundled registry
- import validation: canonical source, no symlinks or traversal, required `SKILL.md`, standard frontmatter, reserved/duplicate policy, bounded file count/depth/size, UTF-8 references, non-executable assets, and unsupported script/dependency rejection
- metadata parsing: standard fields plus safe optional display and implicit-invocation metadata; ignore no security-relevant field silently
- commands/capabilities: list, import, enable/disable, update invocation/scope, refresh, inspect, and remove custom Skills with narrow Tauri permissions and redacted errors
- resource service: stable opaque reference ids and bounded reads rooted in the captured immutable Skill snapshot

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent::skill_registry -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml agent::skills -- --nocapture`
- `node --test tests/agentSkillRepository.test.mjs tests/settings.test.mjs`
- Fixtures: valid minimal/reference/assets folders; duplicate/reserved names; malformed YAML; scripts/dependencies; symlink file/folder; traversal; too many/deep/large files; interrupted import; corrupt manifest; refresh; remove; restart; AI-disabled management without runtime activation.

- [x] Add failing repository/import tests including interrupted and adversarial filesystem cases.
- [x] Implement atomic managed copies and normalized metadata without watching or trusting external source folders.
- [x] Expose only bounded opaque resources and safe management commands.

## Task 3: Add Progressive Explicit and Autonomous Skill Activation

**Outcome:** Both native runtime paths activate the same immutable Skill snapshots while Skills remain instructions rather than capability providers.
**Files:**
- Modify: `src-tauri/src/agent/runtime.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `src-tauri/src/agent/tool_broker.rs`
- Modify: `src-tauri/src/agent/adapters/mod.rs`
- Modify: `src-tauri/src/agent/adapters/codex_app_server.rs`
- Modify: `src/lib/agent/agentRuntime.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `src/hooks/useAgentThread.ts`
- Modify: `tests/agentInteraction.test.mjs`
- Modify: `tests/agentStore.test.mjs`
- Modify: `tests/agentSecondEditorReuse.test.mjs`
- Modify: `tests/markdownAgentExtension.test.mjs`
- Test: relevant Rust Agent runtime/adapter/broker modules

**Change Map:**
- catalog: bounded metadata-first prompt/catalog for enabled compatible custom Skills, with omission diagnostics when the catalog budget is exceeded
- explicit activation: composer-selected Skills load before model work alongside the mandatory editor Skill
- implicit activation: normalized `activate_skill` host Tool chosen by the model, full instruction injection, idempotency, captured version, and explicit denial for invalid/incompatible/disabled Skills
- references: normalized `read_skill_reference` host Tool serves bounded captured text and participates in Tool chronology without masquerading as an editor Tool
- capability validation: declared Skill requirements match existing captured editor/host Tool ids; no descriptor or schema can be added by Skill content
- lifecycle: maximum-step accounting, cancellation, late result rejection, Thread persistence provenance, AI teardown, and parity across Codex/Compatibility and IdeaSketch/Markdown without format-aware host routing

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml agent -- --nocapture`
- `node --test tests/agentInteraction.test.mjs tests/agentStore.test.mjs tests/agentItems.test.mjs tests/agentSecondEditorReuse.test.mjs`
- Cases: mandatory IdeaSketch Skill; mandatory Markdown Skill; explicit custom Skill; model-chosen implicit Skill; implicit disabled; same Skill twice; reference read; incompatible Tool requirement; change during Turn; cancellation; max-step boundary; Codex/Compatibility parity; unsupported editor; cross-editor scope isolation; no generic format branch.

- [x] Add failing cross-runtime activation/resource/immutability fixtures before changing prompt or Tool routing.
- [x] Implement host-owned Skill Tools separately from editor Tool descriptors and executors.
- [x] Persist only safe Skill provenance while keeping full instructions/resources out of Thread history and diagnostics.

## Task 4: Add Skill Management and Selection UI, Then Complete Acceptance

**Outcome:** Users can understand and control installed Skills from Settings and select them naturally in Agent Turns.
**Files:**
- Create: `src/components/settings/AgentSkillManager.tsx`
- Create: `src/components/agent/AgentSkillPicker.tsx`
- Modify: `src/components/settings/AgentSettings.tsx`
- Modify: `src/components/agent/AgentComposer.tsx`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/lib/agent/agentClient.ts`
- Modify: `src/index.css`
- Test: `tests/agentSkillManager.test.mjs`
- Test: `tests/agentSkillPicker.test.mjs`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/settings.test.mjs`
- Modify: `docs/superplan/plans/features/F037-agent-runtime-visibility-and-custom-skills/F037-02-managed-custom-agent-skills.md`

**Change Map:**
- Settings manager: bundled/custom sections, import folder, enable/disable, implicit invocation, compatible editor scope, refresh/re-import, remove confirmation, validation details, source/version/resource summary, and disabled-AI explanation
- composer: accessible `$` mention/picker, selected-Skill chips, incompatibility feedback, mandatory editor Skill indication, and captured selection at submit
- transcript/inspector: concise Skill activation Tool chronology and Turn provenance without dumping instructions or private resources
- accessibility/layout: keyboard search/select/remove, focus restoration after dialogs, screen-reader labels, narrow Agent/Settings layouts, and non-color validation state
- acceptance: application restart, custom import/update/remove, runtime parity, IdeaSketch and Markdown Tool safety, Excalidraw and CodeMirror native Undo/Redo, AI disable/enable, privacy, unsupported-editor isolation, and no external folder mutation

**Verification:**
- `node --test tests/agentSkillManager.test.mjs tests/agentSkillPicker.test.mjs tests/agentPanel.test.mjs tests/settings.test.mjs tests/agentInteraction.test.mjs`
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native matrix: import/enable/explicit/implicit/reference/restart/refresh/remove; invalid and adversarial folders; Codex and Compatibility; IdeaSketch and Markdown read/mutation with Excalidraw/CodeMirror native Undo/Redo; cross-editor compatible/incompatible scopes; unsupported editor; AI disable/enable; no scripts/MCP/new Tools/arbitrary paths/secrets/instruction bodies in history.

- [x] Build accessible Settings management and composer selection against the normalized registry.
- [x] Run focused failure/fix loops for every import, activation, lifecycle, and Tool-safety scenario until clean.
- [x] Complete F037-02, mark F037 done only after both child plans complete, refresh Superplan, inspect the final diff, and create the separate `feat(F037)` task commit.

## Verification Evidence

- Frontend regression: `node --test tests/*.test.mjs` passed (354 tests).
- Native regression: `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed (145 tests), including focused Agent (66), Skill registry (6), and real Codex smoke (3) coverage.
- Build and quality: `npm run build`, `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`, and `git diff --check` passed; Clippy retained only pre-existing warnings.
- Packaging: `npm run tauri build -- --debug` produced the macOS application bundle and arm64 DMG.
- UI acceptance: browser Settings management and composer interaction passed visual/semantic inspection. Desktop visual automation could not acquire the native macOS window, so no desktop visual-pass claim is recorded; native, package, protocol, and browser evidence cover the delivered behavior.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/rfcs/001-codex-style-generic-agent.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-01-settings-and-ai-gating.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `docs/superplan/plans/features/F036-direct-agent-editor-edits-with-undo.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-02-markdown-agent-skill-and-tools.md`
- `src-tauri/src/agent/skills.rs`
- `src-tauri/agent-skills/markdown/`
- `src-tauri/src/agent/runtime.rs`
- `src-tauri/src/agent/tool_broker.rs`
- `src/lib/agent/types.ts`
- `src/lib/agent/agentExtensionRegistry.ts`
- `src/lib/agent/extensions/markdownAgentExtension.ts`
- `src/components/settings/AgentSettings.tsx`
- Official OpenAI Skills documentation: `https://learn.chatgpt.com/docs/build-skills`
- Open Agent Skills standard: `https://agentskills.io`
