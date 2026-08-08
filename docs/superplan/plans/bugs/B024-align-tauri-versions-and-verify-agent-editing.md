---
id: "B024"
title: "Align Tauri Versions and Verify Agent Editing"
type: "bugfix"
status: "complete"
summary: "Pin the Tauri core toolchain to one minor line, restore normal desktop builds, and prove reviewed Agent edits can be applied and undone in IdeaSketch."
source: "docs/superplan/human/bugs.md"
created: "2026-08-08"
order: 24
depends_on: ["B003", "F031-02", "B023"]
parent: ""
---

# Align Tauri Versions and Verify Agent Editing Plan

**Goal:** Restore a deterministic Tauri desktop build and obtain end-to-end evidence that the configured generic Agent can safely edit the active IdeaSketch document.
**Scope:** Add a regression contract for Tauri core-version alignment, exact-pin the JavaScript API/CLI and Rust runtime on the current 2.11 minor line, regenerate the npm and Cargo lockfiles, and restore the standard debug Bundle build. Then launch the native app with the already configured provider and use a disposable unsaved `.is` document to verify an Agent-created Page proposal, explicit Change Review, Apply, visible editor mutation, and one-step Undo without saving or touching a real user file.
**Non-Goals:** This bugfix does not upgrade independently versioned Tauri plugins or `tauri-build` merely to make their patch versions match, change provider credentials or Agent configuration, expose secrets, alter Agent runtime/tool schemas, redesign the three-column layout, add a new editor, save the smoke-test document, or change release packaging beyond preserving npm as the canonical JavaScript package manager.
**Architecture:** `package.json` and `src-tauri/Cargo.toml` become the human-readable authority for exact core toolchain versions while `package-lock.json` and `src-tauri/Cargo.lock` capture the resolved dependency graphs. A source-level regression compares the declared and locked `@tauri-apps/api`, `@tauri-apps/cli`, and Rust `tauri` major/minor versions, rejects broad core constraints that can drift independently, and deliberately excludes independently versioned plugins and `tauri-build`. Agent verification uses the existing editor-agnostic runtime and IdeaSketch extension: the model may only propose an extension-owned Change Set, the user explicitly applies it through the mounted editor binding, and Undo restores the pre-apply in-memory document.
**Baseline:** `package.json` declares both `@tauri-apps/api` and `@tauri-apps/cli` with broad `^2` ranges; the npm lock currently resolves API 2.11.1 and CLI 2.10.1. `src-tauri/Cargo.toml` declares `tauri = "2"`, while the Cargo lock resolves Rust `tauri` 2.10.3. The configured provider connection already succeeds, B023 places Agent in the independent right app column, and F031 supplies proposal-only IdeaSketch mutation tools plus reviewed Apply and Undo.
**Reproduction:** Run `npm run tauri build -- --debug`. Tauri's pre-build compatibility check exits before compilation with `tauri (v2.10.3) : @tauri-apps/api (v2.11.1)` because the core runtime packages are on different minor releases.
**Root Cause:** The JavaScript and Rust manifests use independent broad major-only constraints. npm and Cargo update their lockfiles separately, so normal dependency refreshes can advance one Tauri ecosystem to a new minor while the other remains on the previous minor; no repository regression currently enforces the cross-manager core-version contract.
**Exit Criteria:** The core JavaScript API/CLI and Rust runtime have exact 2.11 declarations and compatible lockfile resolutions; the alignment regression fails for simulated minor drift and passes for the checked-in manifests; the normal debug Bundle build, frontend regressions/build, Rust tests/format/lint, and diff checks pass. In the native app, Agent proposes adding a Page titled `Agent Test Page` with simple editable content to a disposable unsaved one-Page `.is`; the document remains unchanged until Change Review is explicitly applied, then shows two Pages and the requested title, and Undo returns it to one Page without any save or real-file mutation.

## Task 1: Guard the Cross-manager Tauri Version Contract

**Outcome:** Future npm or Cargo dependency refreshes fail a focused test before a mismatched Tauri core toolchain reaches desktop packaging.
**Files:**
- Create: `tests/tauriVersionAlignment.test.mjs`
- Test: `package.json`
- Test: `package-lock.json`
- Test: `src-tauri/Cargo.toml`
- Test: `src-tauri/Cargo.lock`

**Change Map:**
- `tests/tauriVersionAlignment.test.mjs`: parse the npm/Cargo manifests and lockfiles, require exact core declarations, compare compatible major/minor lines, and exercise a deliberately mismatched fixture in memory
- manifest/lockfile contract: include `@tauri-apps/api`, `@tauri-apps/cli`, and Rust `tauri`; exclude independently versioned plugins and `tauri-build`

**Verification:**
- `node --test tests/tauriVersionAlignment.test.mjs`
- Confirm the focused test fails against the current broad and minor-mismatched declarations before changing dependencies.

- [x] Add the focused source-level regression for exact declarations and compatible locked core versions.
- [x] Capture the expected failure against the current manifests and lockfiles.

## Task 2: Pin and Resolve One Tauri 2.11 Toolchain

**Outcome:** npm and Cargo resolve a deterministic compatible core toolchain and the standard native Bundle build proceeds normally.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`

**Change Map:**
- `package.json`: exact-pin `@tauri-apps/api` 2.11.1 and `@tauri-apps/cli` 2.11.4
- `src-tauri/Cargo.toml`: exact-pin Rust `tauri` 2.11.5 while preserving the existing feature set
- npm/Cargo lockfiles: regenerate only through their canonical package managers so transitive resolutions match the pinned manifests

**Verification:**
- `npm install`
- `cargo update --manifest-path src-tauri/Cargo.toml -p tauri --precise 2.11.5`
- `node --test tests/tauriVersionAlignment.test.mjs`
- `npm run tauri build -- --debug`

- [x] Replace broad core constraints with exact compatible 2.11 versions and regenerate both lockfiles.
- [x] Re-run the focused regression and the original Bundle-build reproduction successfully.

## Task 3: Verify Reviewed Agent Editing in a Disposable IdeaSketch Document

**Outcome:** The configured generic Agent demonstrates proposal-only mutation, explicit Apply, visible IdeaSketch editing, and reversible Undo through the native application.
**Files:**
- Test: `src/components/AgentPanel.tsx`
- Test: `src/lib/agent/extensions/ideaSketchAgentExtension.ts`
- Test: `src/lib/agent/extensions/ideaSketchAgentTools.ts`
- Test: `src/components/IdeaSketchEditor.tsx`

**Change Map:**
- native acceptance: create an unsaved one-Page `.is`, ask Agent to add `Agent Test Page` with a simple rectangle and text, inspect Change Review before mutation, Apply once, verify the second Page/title/content, Undo once, and verify restoration to one Page
- safety boundary: use the existing configured credential without reading or logging it; do not save, overwrite, or open a real user document for mutation

**Verification:**
- Native Tauri smoke: Pages count is 1 before approval, remains 1 during Change Review, becomes 2 only after Apply with `Agent Test Page` visible, and returns to 1 after Undo.
- Inspect Tool Activity/review for the IdeaSketch Skill and proposal tool, and confirm Agent remains the independent rightmost column while the editor Navigator stays in the center region.

- [x] Run the Agent request against a disposable unsaved document and verify no pre-approval mutation.
- [x] Apply the reviewed Change Set, verify the requested editor mutation, Undo it, and close without saving.

## Task 4: Complete Regression and Delivery Evidence

**Outcome:** B024 ships with current dependency, native-build, Agent-acceptance, and repository-hygiene evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B024-align-tauri-versions-and-verify-agent-editing.md`

**Change Map:**
- B024 request/plan: checked outcomes, exact resolved versions, debug Bundle result, Agent proposal/Apply/Undo evidence, and final status
- generated index: refreshed B024 lifecycle and dependency graph

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `git diff --check`
- Superplan registry, catalog, dependency, artifact, changed-plan, and generated-index validation

- [x] Run focused checks while changing dependencies and one relevant full regression/build matrix after implementation stabilizes.
- [x] Inspect the final diff, record native Agent acceptance, complete B024, and create a separate `fix(B024)` implementation commit.

## Completion Evidence

- Regression-first proof: `node --test tests/tauriVersionAlignment.test.mjs` initially failed because `@tauri-apps/api` used the broad `^2` declaration; the checked-in npm/Cargo state also resolved JS API 2.11.1 against Rust `tauri` 2.10.3. The new guard additionally rejects an in-memory 2.11/2.10 drift fixture.
- Deterministic toolchain: `package.json` now exact-pins `@tauri-apps/api` 2.11.1 and `@tauri-apps/cli` 2.11.4; `src-tauri/Cargo.toml` exact-pins `tauri` 2.11.5. npm and Cargo regenerated their lockfiles, and the focused alignment test passes 2/2.
- Native build: `npm run tauri build -- --debug` passed the Tauri compatibility check, ran the production frontend build, compiled the Rust application, and produced `IdeaNote.app` plus `IdeaNote_0.1.0_aarch64.dmg`. Only the existing Excalidraw import-overlap and large-chunk informational warnings remained.
- Native Agent acceptance: a fresh unsaved `Untitled.is` began with Pages 1 while Agent remained the independent rightmost column. The configured runtime loaded the `ideasketch` Skill and six editor Tools, called the proposal-only mutation Tool, and displayed Change Review for `Agent Test Page` with two elements while Pages remained 1 and reported that no file was written.
- Apply/Undo proof: explicit Apply changed Pages to 2 and exposed `Agent Test Page`; selecting it showed an editable blue rectangle and editable `Agent Test` text on the canvas. `Undo Agent change` restored Pages to 1. Returning Home used `Discard Changes`; the document was never saved and no new recent file appeared.
- Regression matrix: `node --test tests/*.test.mjs` passed 275/275; Rust tests passed 74/74; `cargo fmt --check` and `cargo clippy --all-targets` passed; the production frontend build passed within the debug Bundle build; `git diff --check` passed.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B003-fix-release-package-manager-selection.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `docs/superplan/plans/bugs/B023-separate-agent-right-column.md`
- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
