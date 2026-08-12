---
id: "F049"
title: "Simplify AI Provider Model and Token Fields"
type: "feature"
status: "complete"
summary: "Remove duplicate Provider model selection and show configured credentials as a safe masked password value."
source: "docs/superplan/human/features.md"
created: "2026-08-12"
order: 69
depends_on: ["F048"]
parent: ""
---

# Simplify AI Provider Model and Token Fields Plan

**Goal:** Make AI Provider Settings read as one concise connection-and-credential form while keeping model choice in the Agent surface and saved secrets outside React.
**Scope:** Remove the `Model` field from AI Provider Settings and update the section description so this page owns only the Provider connection, credential, test result, and retry policy. Preserve the Provider Test response as the source of `availableModels` and retain the current valid model or select the first returned model when the saved selection is unavailable, so the Agent model selector and runtime continue to work unchanged. When a credential is already configured and no replacement is being typed, render the Token password input with a fixed non-secret masked value. Focusing the masked field enters replacement mode without exposing the saved token; typing displays only the transient replacement under native password masking; leaving replacement mode empty restores the configured mask; and a successful Test stores a non-empty replacement before returning the field to the configured mask. Testing with the existing credential, failed Test, or closing Settings does not replace it.
**Non-Goals:** This feature does not remove `ai.model` or `ai.availableModels` from persisted settings, move or redesign the Agent model selector, change Provider discovery or retry semantics, reveal/decrypt/read back the configured token, put a token or reversible surrogate in settings/browser storage/logs/accessibility text, add a show-token control, change the Rust credential repository, or alter Agent activation and runtime selection.
**Architecture:** Keep the existing status-only credential boundary: Rust continues to return only `credentialConfigured`, while `AiProviderSettings` derives a local presentation state from that boolean plus the transient `credentialInput`. A fixed mask constant is visual-only and must never enter `credentialInput`, Provider Test arguments, persistence, settings snapshots, accessibility labels, or logs. A small local replacement-mode flag controls whether the input renders the fixed mask or the real transient draft; focus begins replacement, empty blur returns to the mask, and successful credential storage resets replacement mode. Provider Test still persists its bounded model catalog and resolves a valid default model, but no model control is rendered on this page. The existing Agent model selector remains the sole user-facing model-selection surface. The visual direction stays deliberately quiet: one fewer settings row, a familiar filled password affordance for configured state, and no new badge or explanatory decoration.
**Baseline:** `AiProviderSettings` currently renders Base URL, an empty Token password input whose configured state appears only as the `Configured` placeholder, Connection Test, a test-gated Model select, Automatic retry, and Maximum attempts. Provider Test already accepts the configured credential without reading it back, securely stores only a newly typed token after success, persists the returned model catalog, and keeps or chooses a valid model. `SettingsEditProvider` clears transient credential input on open/close. `AgentModelSelector` already provides the runtime model choice. F034 explicitly prohibits returning saved token plaintext to React, while F048 makes ordinary Settings changes automatic but keeps credential persistence gated by successful Test.
**Exit Criteria:** AI Provider Settings contains no `Model` label or `AI model` select, and its registry description no longer promises model selection. Provider Test still persists a bounded returned catalog and leaves `settings.ai.model` valid for the Agent selector. With no credential configured, Token is an empty password field with `Enter token`. With a configured credential, Token visibly contains a fixed password mask but the DOM value, React draft, Provider request, settings snapshot, accessibility tree, logs, and native responses never contain the saved token. Focusing permits immediate replacement; empty blur restores the mask; typing uses native password concealment; failed Test and close preserve the old configured credential; successful Test stores the replacement once, clears transient plaintext, and restores the mask. Existing-credential Test, retry settings, automatic Settings persistence, Agent activation/model selection, Light/Dark appearance, keyboard focus, full frontend regression, production build, workflow validation, diff hygiene, and a separate `feat(F049)` commit pass.

## Task 1: Lock the Simplified Provider and Credential Contract

**Outcome:** Focused regressions define one Agent-owned model selector and a visibly configured password field without saved-secret readback.
**Files:**
- Modify: `tests/settingsCenter.test.mjs`
- Modify: `tests/settings.test.mjs`

**Change Map:**
- Provider form contract: reject the Settings `Model` row/select while requiring Provider Test to retain catalog/default-model persistence
- masked credential contract: require a fixed non-secret mask, local replacement mode, focus/empty-blur restoration, successful-Test reset, and separation from `credentialInput` and probe/storage arguments
- security contract: retain status-only native commands, no persisted token-shaped field, no show/reveal control, and no configured-secret readback API
- preservation contract: Agent model selection, existing-credential Test, retry settings, auto-persist behavior, activation, and English accessible labels remain intact

**Verification:**
- `node --test tests/settingsCenter.test.mjs tests/settings.test.mjs tests/settingsAutoPersist.test.mjs tests/agentPanel.test.mjs`
- Pre-change evidence: the suite expects the Provider Model select and the configured Token field has only a placeholder, with no safe filled-mask/replacement lifecycle.

- [x] Add focused failing contracts for removal of Provider-side model selection.
- [x] Add configured-mask, replacement, reset, and no-secret-readback regressions.

## Task 2: Simplify AI Provider Settings Safely

**Outcome:** The Provider form removes its duplicate model control and presents configured credential state directly in the password input without exposing the secret.
**Files:**
- Modify: `src/components/settings/AiProviderSettings.tsx`
- Modify: `src/lib/settingsSectionRegistry.ts`
- Modify: focused tests from Task 1

**Change Map:**
- `AiProviderSettings`: remove the Model `SettingsField` and select while retaining Test-driven `availableModels` and valid default-model updates
- credential presentation: add a fixed mask and component-local replacement mode; never write the mask into `credentialInput` or treat it as a credential
- interaction lifecycle: focus enters replacement mode, empty blur restores configured display, successful Test clears transient plaintext and restores the mask, and failed Test keeps the typed replacement available for correction without changing the stored token
- registry copy: describe AI Provider as connection, credentials, and retry policy rather than model selection

**Verification:**
- Run the focused Task 1 suite.
- Browser/Tauri cases: unconfigured input; configured masked input; focus/blur without typing; replace typing; failed Test; successful Test; existing-credential Test; close/reopen; keyboard Tab/Shift+Tab; Agent model selector/catalog; Light and Dark; console diagnostics.

- [x] Remove the duplicate Model row without removing model catalog/default selection behavior.
- [x] Implement the non-secret configured mask and replacement lifecycle at the component boundary.
- [x] Update registry wording while preserving layout, accessibility, retry, and Agent behavior.

## Task 3: Verify and Deliver F049

**Outcome:** The Settings simplification closes with credential-safety, UI, regression, workflow, and source-control evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F049-simplify-ai-provider-model-and-token-fields.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- regression: focused Settings/security/Agent checks and one full stabilized frontend run
- runtime: genuine configured/unconfigured password states, replacement success/failure, Agent model choice, themes, keyboard, close/reopen, and console inspection
- workflow: mark F049 complete/done, regenerate the index, preserve unrelated F050 work, and stage only F049 paths or exact `features.md` hunk

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `npm run tauri dev`
- Native/browser review in Light and Dark with configured and unconfigured credentials, replacement success/failure, existing-token Test, close/reopen, Agent model selection, keyboard focus, and no console errors or secret disclosure.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks during implementation and one full stabilized frontend regression afterward.
- [x] Inspect the real password-mask and sole Agent model-selection experience without exposing credentials.
- [x] Mark F049 complete/done and create a separate `feat(F049)` commit without F050 changes.

## Delivery Evidence

- The focused Settings/security/Agent suite passed: `node --test tests/settingsCenter.test.mjs tests/settings.test.mjs tests/settingsAutoPersist.test.mjs tests/agentPanel.test.mjs` (13/13). Before implementation, the new contract failed because Provider Settings still rendered Model and had no configured-mask lifecycle.
- The complete stabilized frontend regression passed: `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`.
- Production TypeScript and Vite build passed: `npm run build`; the existing Excalidraw mixed-import and large-chunk advisories were unchanged.
- Native startup smoke passed with the existing Vite server reused: `npm run tauri dev -- --no-watch --config '{"build":{"beforeDevCommand":""}}'` reached `Running target/debug/idea-slide`; existing Rust unused-code warnings were unchanged.
- Browser review passed in Light and Dark: AI Provider showed Base URL, Token, Connection, Automatic retry, and Maximum attempts with no Model row/select; the registry header read `Connection, credentials, and retry policy`; the 760x560 dialog had no horizontal overflow; and the console reported no warnings or errors.
- The unconfigured Token field remained an empty `type=password` input with `autocomplete=new-password` and `Enter token`. The configured-mask/replacement lifecycle is isolated behind status-only `credentialConfigured` and is locked by focused source/security regressions without introducing any saved-token readback API.
- Opening a document confirmed the Agent panel still exposed exactly one `Model and reasoning` selector, while Provider Test retained `availableModels` persistence and valid default-model resolution in source and regression contracts.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-01-settings-and-ai-gating.md`
- `docs/superplan/plans/features/F034-encrypted-ai-token-configuration.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-02-settings-themes-and-markdown.md`
- `docs/superplan/plans/features/F048-refine-settings-navigation-and-auto-apply.md`
- `docs/superplan/plans/bugs/B030-fix-transient-menus-settings-and-agent-history.md`
- `src/components/settings/AiProviderSettings.tsx`
- `src/components/agent/AgentModelSelector.tsx`
- `src/hooks/useSettings.tsx`
- `src/lib/settings.ts`
- `src/lib/settingsSectionRegistry.ts`
- `src-tauri/src/settings.rs`
- `tests/settingsCenter.test.mjs`
- `tests/settings.test.mjs`
