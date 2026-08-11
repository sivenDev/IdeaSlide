---
id: "F046-02"
title: "Align Settings, Themes, and the Production Markdown Editor"
type: "feature"
status: "draft"
summary: "Migrate the reviewed Settings and Markdown interaction model onto the existing persistent settings and production CodeMirror/document services."
source: "docs/superplan/human/features.md"
created: "2026-08-11"
order: 57
depends_on: ["F046-01", "B033"]
parent: "F046"
---

# Align Settings, Themes, and the Production Markdown Editor Plan

**Goal:** Make production Settings and Markdown match the approved demo experience without replacing real credential, persistence, document, or editor-history boundaries.
**Scope:** Recompose Settings into concise Application, AI, and Editors navigation with consistent maintained controls and minimal explanatory copy. Preserve Light/Dark/System; move the AI feature gate into Agent settings; present provider token as a normal password input; add an explicit provider Test action; expose Model selection only from the successfully returned catalog; keep bundled/system Skills enabled and permit only imported custom Skills to toggle. Add persisted Markdown `showLineNumbers`, defaulting off. Migrate the B033 Markdown layout: Outline at far left, Edit/Split/Preview with one always-mounted CodeMirror host, no formatting Tools menu, editor-local Undo/Redo at lower left, and stable line-number reconfiguration.
**Non-Goals:** This plan does not expose stored credentials, remove secure credential storage, make model testing a mock success, change Markdown parsing/GFM/image/link safety, normalize line endings silently, alter Agent Tool permissions, replace CodeMirror, add new Markdown formatting commands, or modify the existing production IdeaSketch/Excalidraw editor beyond shared theme/settings props already required by its production contract. It does not ship Review Scenarios or fake provider/model catalogs.
**Architecture:** The existing versioned settings schema remains the only preference source. A schema migration adds Markdown line-number state while normalizing missing legacy values to `false`. Secure token commands continue to return configured status only. Provider testing becomes an explicit Tauri command/service that validates the proposed base URL and credential, returns a bounded normalized model catalog, never persists or logs plaintext, and does not mutate the selected model until the user saves. Settings sections stay registry-driven so editor-specific settings remain isolated. Shared checkboxes/switches/selects/password fields use maintained Radix/native primitives with one tokenized visual contract. CodeMirror remains mounted for the document-session lifetime; view modes hide/reveal layout regions rather than replacing the editor host, and a `Compartment` reconfigures line-number gutters without rebuilding `EditorState` or history. Theme resolution continues through root semantic tokens, with the reviewed palette expressed for both resolved schemes and System live changes.
**Baseline:** Production already has a Settings Center, versioned persistence, General appearance, secure AI credential status/write/delete, Agent policy/Skill management, editor contribution registry, CodeMirror Markdown editor, safe preview renderer, outline projection, split resizing, native history, line-ending preservation, Markdown Agent binding, and Light/Dark/System runtime. Its navigation/copy/control hierarchy predates the reviewed demo; provider configuration predates the Test-then-Model flow; the settings schema lacks Markdown line numbers; the production Markdown toolbar still contains the older formatting/history/search composition and its view-host lifecycle must be aligned with B033.
**Exit Criteria:** Settings uses concise English categories and consistent controls without redundant descriptions. Appearance switches immediately and persists for Light, Dark, and System. AI enabled lives under Agent. Provider token is a password control; Test reports truthful progress/success/failure, never reveals the saved token, and populates a selectable model list only from the tested provider result. Bundled/system Skills have no disable affordance; imported custom Skills alone can toggle. Markdown Line numbers defaults off, persists, and reconfigures an active editor without losing focus, selection, native Undo/Redo, Agent adapter identity, or dirty/session state. Outline is the leftmost Markdown navigation control. Repeated Preview -> Split/Edit transitions never show a blank editor. Markdown top chrome has no formatting Tools menu or Undo/Redo; lower-left Undo/Redo invokes the same CodeMirror history and remains contained at all supported widths. Markdown parsing, preview, links/images, scroll sync, line endings, save/recovery/external-change protection, direct Agent edits, Light/Dark/System, and production IdeaSketch behavior remain intact.

## Task 1: Recompose Settings and Shared Controls

**Outcome:** Settings has the reviewed information hierarchy, common control language, and stable persisted migration.
**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/hooks/useSettings.tsx`
- Modify: `src/components/SettingsCenter.tsx`
- Modify: `src/components/settings/GeneralSettings.tsx`
- Modify: `src/components/settings/AgentSettings.tsx`
- Modify: `src/components/settings/AgentSkillManager.tsx`
- Create: `src/components/settings/MarkdownSettings.tsx`
- Create: `src/components/settings/SettingsSwitch.tsx`
- Modify: `src/index.css`
- Modify: `tests/settings.test.mjs`
- Modify: `tests/settingsCenter.test.mjs`
- Modify: `tests/agentSkillManager.test.mjs`

**Change Map:**
- settings schema: add default-off `markdown.showLineNumbers`, legacy normalization, and versioned persistence
- navigation: concise Application / AI / Editors groups with AI gate under Agent and editor-owned Markdown contribution
- shared controls: one switch/checkbox/select/password/focus/disabled/error visual contract; remove duplicate explanatory copy
- Skills: system/bundled rows are immutable-on, custom imported rows alone expose enable/disable

**Verification:**
- `node --test tests/settings.test.mjs tests/settingsCenter.test.mjs tests/agentSkillManager.test.mjs`
- Cases: legacy migration; Light/Dark/System; AI gate; keyboard navigation; unified checkbox/switch states; bundled Skill immutable; custom Skill toggle; Settings save/error/reopen.

- [ ] Add settings migration and UI contracts for the reviewed hierarchy and control rules.
- [ ] Recompose registered sections without duplicating settings state in components.
- [ ] Verify persistence, accessibility, themes, and immutable bundled Skills.

## Task 2: Add Secure Provider Testing and Model Discovery

**Outcome:** Provider configuration offers a real Test-before-Model workflow without weakening credential handling.
**Files:**
- Modify: `src/components/settings/AiProviderSettings.tsx`
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src-tauri/src/settings.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `tests/settingsCenter.test.mjs`
- Test: `src-tauri/src/settings.rs`
- Create: `src-tauri/src/provider_probe.rs`

**Change Map:**
- credential field: normal password semantics, configured placeholder, replacement-on-save, and no saved-secret readback
- provider probe: validate endpoint/credential, bounded timeout/response, normalized model ids, safe error categories, and secret-free diagnostics
- Model control: disabled until successful test, populated from the latest matching provider probe, invalidated when URL/token changes
- persistence: saving provider/model remains separate from transient test state and cannot silently store an untested plaintext token

**Verification:**
- `node --test tests/settingsCenter.test.mjs`
- `cd src-tauri && cargo test provider_probe settings`
- Cases with a controlled local HTTP fixture: success catalog; auth failure; invalid URL; timeout; malformed/oversized response; changed credentials invalidate catalog; cancellation/close; logs and command payload results contain no token.

- [ ] Add failing frontend/Rust contracts for Test-before-Model and secret-free failures.
- [ ] Implement the narrow Tauri provider-probe boundary and reviewed compact form.
- [ ] Verify real success/error states without contacting or mutating an unintended provider account.

## Task 3: Migrate the Reviewed Markdown Interaction Model

**Outcome:** Production Markdown keeps its full safety/features while adopting the stable B033 navigation and history layout.
**Files:**
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `src/hooks/useCodeMirrorEditor.ts`
- Modify: `src/components/DocumentEditorHost.tsx`
- Modify: `src/components/settings/MarkdownSettings.tsx`
- Modify: `src/index.css`
- Modify: `tests/markdownEditorContract.test.mjs`
- Modify: `tests/settingsCenter.test.mjs`
- Create: `tests/markdownEditorRefinement.test.mjs`

**Change Map:**
- editor lifetime: one CodeMirror host/view across Edit, Split, and Preview; measure/focus recovery after hidden layout states
- top navigation: Outline first, then view mode and line-ending state only; remove formatting/Search/history toolbar buttons
- native history: lower-left Undo/Redo pair delegates to the mounted CodeMirror view and reflects availability/accessibility
- line numbers: settings-driven `Compartment` reconfiguration without remounting state, adapter, or history

**Verification:**
- `node --test tests/markdownEditorContract.test.mjs tests/markdownEditorRefinement.test.mjs tests/settingsCenter.test.mjs`
- Cases: type/select; Preview -> Split/Edit repeatedly; Undo/Redo before/after transitions; Outline open/closed; split resize; default-off and live line-number changes; Markdown Agent read/edit plus native Undo; links/images; scroll sync; LF/CRLF; read-only/conflict/recovery states; themes and target widths.

- [ ] Capture production regressions for the blank-host risk and default-off line-number preference.
- [ ] Preserve the production Markdown model/preview/Agent boundaries while changing only editor composition.
- [ ] Verify native history, selection, session identity, and rendering across every view transition.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/bugs/B030-refine-navigation-menus-settings-and-agent-history.md`
- `docs/superplan/plans/bugs/B031-refine-compact-menus-labels-and-custom-skills.md`
- `docs/superplan/plans/bugs/B033-refine-markdown-editor-navigation-view-switching-and-controls.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-01-settings-and-ai-gating.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-01-generic-document-kernel-and-markdown-editor.md`
- `.temp/f041-native-workbench-review/src/components/settings/SettingsCenter.jsx`
- `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownEditor.jsx`
- `src/components/SettingsCenter.tsx`
- `src/components/MarkdownEditor.tsx`
- `src/lib/settings.ts`
- `src-tauri/src/settings.rs`
