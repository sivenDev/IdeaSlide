---
id: "F031-01"
title: "Add the Settings Center and AI Enablement Gate"
type: "feature"
status: "complete"
summary: "Deliver versioned global settings, secure AI credentials, registry-driven sections, and a default-on AI gate that fully disables Agent activation when turned off."
source: "docs/superplan/human/features.md"
created: "2026-08-08"
order: 31
depends_on: ["02", "03", "05", "06", "F016"]
parent: "F031"
---

# Add the Settings Center and AI Enablement Gate Plan

**Goal:** Give IdeaNote one reusable configuration surface and make AI availability an explicit, safe application setting before the Agent runtime is introduced.
**Scope:** Revise the accepted PRD to authorize an editor-agnostic Agent before the remaining editors, establish a versioned global settings contract, add secure provider-credential storage outside Workspace files, and deliver a Settings Center reachable from Home and the editor. AI is enabled by default. Turning it off removes Agent entry points and prevents runtime initialization, Skill discovery, Tool registration, provider access, background work, and Agent event subscriptions. An enabled but unconfigured AI state remains visible and directs the user to provider configuration without attempting a model request. The Settings Center exposes General, AI Provider, Agent, and registry-contributed Editor sections; IdeaSketch contributes the first editor section while future editors can register their own settings without changing the Settings shell.
**Non-Goals:** This plan does not implement model calls, conversations, Agent tools, Change Review, Workspace-specific setting overrides, settings sync, multiple user profiles, arbitrary plugin settings, or remove MCP runtime code. It does not store API keys in `.ideanote`, application JSON, frontend storage, logs, recovery data, or conversation history.
**Architecture:** A typed settings domain owns defaults, schema versioning, validation, and migrations. Non-secret global values persist through the maintained Tauri Store plugin in the application configuration directory; provider credentials are addressed by stable credential ids and stored through the native OS credential vault from Rust. A React `SettingsProvider` loads one immutable snapshot and exposes typed update operations. A `SettingsSectionRegistry` contributes section metadata and optional editor-specific panels, while the existing File Type Registry references a section id instead of importing Settings UI. `ai.enabled` defaults to `true`; one derived activation gate is the only authority used by later Agent UI/runtime code. Provider configuration and AI enablement are independent: enabled-without-provider is a setup state, while disabled means no Agent lifecycle exists.
**Baseline:** IdeaNote has no general settings service or Settings UI. Home exposes only file/workspace actions and recent history. The editor title bar exposes document commands. Global recents persist separately, File Type Definition has no settings or Agent extension metadata, provider credentials have no storage boundary, and the accepted PRD still postpones AI Agent until every planned editor is complete.
**Exit Criteria:** Home and the active editor can open the same accessible English Settings Center. General, AI Provider, Agent, and IdeaSketch sections are generated through one registry; adding a synthetic editor settings definition in tests makes it appear without modifying the Settings shell. A fresh installation resolves `ai.enabled` to `true`. Disabling AI survives restart and yields no Agent entry point, runtime initialization request, Skill/Tool discovery, provider access, or Agent event subscription. Re-enabling AI restores the entry point; if no provider credential is configured, the Agent surface can only navigate to Settings and no request is attempted. Non-secret settings round-trip through a versioned app-level store, credentials round-trip only through the OS vault, and Workspace opening remains side-effect free with no `.ideanote` creation. Focused settings/security/UI tests, complete regressions, production builds, native settings smoke, and diff checks pass.

## Task 1: Authorize the Generic Agent and Configuration Contract

**Outcome:** Product authority describes a reusable Agent, default-on disable switch, Settings Center, secure credentials, and legacy MCP retirement without preserving the old editor-order gate.
**Files:**
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/workspace-format.md`
- Test: `tests/settings.test.mjs`

**Change Map:**
- `docs/superplan/human/prd.md`: current-phase Agent authorization, editor-extension model, AI default/disabled semantics, Settings entry points, secure configuration policy, review-before-write requirement, and MCP replacement direction
- `docs/workspace-format.md`: confirm that global settings and credentials remain outside `.ideanote`; reserve only explicit future Workspace overrides under versioned Workspace metadata
- settings contract tests: defaults, version handling, disabled lifecycle invariants, provider-required state, and registry section discovery

**Verification:**
- `node --test tests/settings.test.mjs`
- Inspect every PRD occurrence of Agent/MCP/editor sequencing and confirm the revised statements are mutually consistent.

- [x] Replace the obsolete "Agent only after every editor" decision with the reusable runtime plus file-type extension model.
- [x] Define default-on AI, complete disabled behavior, provider-required behavior, and secure storage boundaries.
- [x] Keep real files, dual-mode single core, lazy Workspace metadata, and review-before-write as non-negotiable product constraints.

## Task 2: Persist Typed Settings and Native Credentials

**Outcome:** Application configuration is versioned and testable, while provider secrets never cross into general settings persistence.
**Files:**
- Create: `src-tauri/src/settings.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/capabilities/default.json`
- Create: `src/lib/settings.ts`
- Create: `src/hooks/useSettings.tsx`
- Test: `src-tauri/src/settings.rs`
- Test: `tests/settings.test.mjs`

**Change Map:**
- Rust settings service: schema-versioned load/save commands, OS-vault credential create/read/delete/status operations, redacted diagnostics, and no Workspace-path input
- Tauri setup/capabilities: maintained Store integration plus narrowly registered credential commands and permissions
- frontend settings domain: typed defaults with `ai.enabled: true`, validation/migration, provider/model references without secrets, and one derived `AgentActivationState`
- `SettingsProvider`: startup hydration, atomic snapshot updates, error states, and testable activation gating

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml settings -- --nocapture`
- `node --test tests/settings.test.mjs`
- Cases: fresh defaults; corrupt/unknown settings fallback with diagnostics; restart round-trip; credential values absent from settings JSON, logs, and command responses; disabled state causes no initialization command.

- [x] Add versioned non-secret settings persistence with safe defaults and migration coverage.
- [x] Store provider credentials only in the native credential vault and expose redacted status to the frontend.
- [x] Make one activation-state selector authoritative for all later Agent lifecycle decisions.

## Task 3: Build the Registry-driven Settings Center

**Outcome:** Users can configure application, AI, Agent, and editor settings through one reusable surface from either Home or the editor.
**Files:**
- Create: `src/lib/settingsSectionRegistry.ts`
- Create: `src/components/SettingsCenter.tsx`
- Create: `src/components/settings/GeneralSettings.tsx`
- Create: `src/components/settings/AiProviderSettings.tsx`
- Create: `src/components/settings/AgentSettings.tsx`
- Create: `src/components/settings/IdeaSketchSettings.tsx`
- Modify: `src/lib/fileTypeRegistry.ts`
- Modify: `src/components/LaunchScreen.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Test: `tests/settingsCenter.test.mjs`
- Modify: `tests/launchScreen.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`

**Change Map:**
- settings registry: stable section ids, ordering, global/editor ownership, capability metadata, and test injection
- `FileTypeDefinition`: optional settings section reference without importing editor-specific configuration into shared shell code
- Settings Center: accessible navigation, dirty/save/error states, AI enable switch, provider/model fields, credential replacement/removal, and English setup guidance
- Home/editor entry points: one Settings action on Home and one compact title-bar or overflow action using the same dialog state
- AI gating: hide later Agent controls when disabled and expose a provider-configuration link only when enabled but incomplete

**Verification:**
- `node --test tests/settings.test.mjs tests/settingsCenter.test.mjs tests/launchScreen.test.mjs tests/editorChromeNavigation.test.mjs tests/fileTypeRegistry.test.mjs`
- Browser/Tauri smoke: open Settings from Home and editor; disable/restart/re-enable AI; configure and remove a credential; verify keyboard focus, errors, compact-window layout, and no Workspace metadata side effect.

- [x] Compose Settings from generic and editor-contributed sections using established Radix controls.
- [x] Add Home and editor entry points without duplicating state or configuration logic.
- [x] Verify default-on, disabled, enabled-unconfigured, credential-present, error, and restart states.

## Task 4: Verify the Settings and Activation Boundary

**Outcome:** Settings can safely become the prerequisite for the Agent runtime plan.
**Files:**
- Modify: `docs/superplan/plans/features/F031-configurable-ai-agent/F031-01-settings-and-ai-gating.md`

**Change Map:**
- plan evidence: PRD consistency, settings migrations, credential isolation, UI/accessibility, and complete AI-disabled lifecycle results

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `git diff --check`

- [x] Run focused checks during implementation and the complete relevant regression/build matrix after behavior stabilizes.
- [x] Record native credential and default/disabled/re-enabled acceptance evidence before completion.

## Completion Evidence

- Product contract: `docs/superplan/human/prd.md` now authorizes the editor-agnostic Agent phase, default-on AI gate, provider-required state, secure credentials, reviewed mutations, and legacy MCP retirement without weakening the real-file, shared-core, or lazy-metadata principles. `docs/workspace-format.md` explicitly keeps global settings and credentials outside `.ideanote`.
- Settings implementation: versioned non-secret settings use the maintained Tauri Store plugin, normalize corrupt or older values to safe defaults, and expose one `AgentActivationState`. `ai.enabled` defaults to `true`; the disabled state removes Agent entry points and runtime mounting, while enabled-without-credential remains setup-only.
- Credential boundary: Rust keyring commands store, inspect, and remove the provider key through application-scoped OS-vault identifiers and return only redacted configured status. Credential values are absent from the settings model, browser persistence, Workspace metadata, recovery, and Agent history.
- Registry/UI proof: General, AI Provider, Agent, and IdeaSketch sections share one Settings Center reachable from Home and editor chrome. Registry tests prove a synthetic future editor section appears without changing the Settings shell.
- Browser acceptance: the HTML app at `http://127.0.0.1:1420/` verified both Settings entry points, all four sections, default-on AI, provider-required guidance, dynamic Agent removal while AI is disabled, and restoration after re-enabling. The final browser setting was restored to enabled.
- Verification: `node --test tests/*.test.mjs` passed 271/271; `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed 74/74; `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`, `npm run build`, and `git diff --check` passed.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/02-directory-workspace-foundation.md`
- `docs/superplan/plans/03-multifile-workspace-shell.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/features/F016-refine-launch-actions-and-add-recent-workspaces.md`
- `src/lib/fileTypeRegistry.ts`
- `src/components/LaunchScreen.tsx`
- `src/components/Toolbar.tsx`
- `src-tauri/src/recent_files.rs`
