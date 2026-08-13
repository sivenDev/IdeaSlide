---
id: "F058"
title: "Configure Markdown Outline Default"
type: "feature"
status: "complete"
summary: "Add a persistent default-off Markdown preference for the editor's left Outline navigation."
source: "docs/superplan/human/features.md"
created: "2026-08-13"
order: 58
depends_on: ["B033", "F046-02", "F048", "F054"]
parent: ""
---

# Configure Markdown Outline Default Plan

**Goal:** Let users choose whether Markdown's left Outline navigation starts open while making the compact closed state the product default.
**Scope:** Add a persistent boolean preference to the existing Markdown Settings section for whether the left Outline navigation opens by default. Default the preference to off for clean, older, and malformed settings snapshots. When a Markdown editor mounts, use saved per-document `showOutline` state when present; otherwise initialize from the global preference. Keep the existing editor toolbar toggle available and continue persisting its in-session state through the document-session boundary.
**Non-Goals:** This feature does not remove or redesign the Outline, persist every toolbar toggle back into global Settings, overwrite an explicit saved per-document Outline state, change heading extraction or navigation, alter Markdown view-mode/split/scroll-sync defaults, change line-number behavior, or modify Markdown file contents and metadata.
**Architecture:** Extend the versioned `AppSettings.markdown` contract and backward-compatible normalizer with `openOutlineByDefault: false`, incrementing the settings schema version. Expose the preference through the registry-owned Markdown Settings page and its existing automatic-persistence session. At the Markdown editor lifecycle boundary, initialize `showOutline` from `document.editorState.markdown.showOutline` when it is a boolean, otherwise from the global preference; later toolbar changes remain editor-session state and are not mirrored into Settings.
**Baseline:** Markdown Settings currently contains only the default-off line-number switch. `MarkdownEditor` currently initializes `showOutline` with `document.editorState?.markdown?.showOutline ?? true`, so documents without saved editor state start with the left Outline open. The toolbar can already show or hide the Outline and stores the choice through `onEditorStateChange`.
**Exit Criteria:** Settings → Markdown exposes a clear English switch for opening the Outline by default and persists it automatically. A clean or migrated settings snapshot contains `markdown.openOutlineByDefault: false`. A Markdown document without saved Outline state mounts closed when the preference is off and open when it is on. An explicit saved document-session `showOutline` value takes precedence over the global default. The existing toolbar toggle continues to work, line-number behavior is unchanged, focused settings/editor regressions pass, the full frontend regression and production build pass, workflow validation succeeds, and the task is delivered in a separate `feat(F058)` commit.

## Task 1: Persist and Expose the Markdown Outline Default

**Outcome:** The versioned Settings contract safely stores a default-off Outline startup preference and exposes it in the Markdown section.
**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/components/settings/MarkdownSettings.tsx`
- Modify: `tests/settings.test.mjs`
- Modify: `tests/settingsCenter.test.mjs`

**Change Map:**
- `AppSettings`, `DEFAULT_SETTINGS`, and `normalizeSettings`: add `markdown.openOutlineByDefault`, increment the schema version, and normalize missing or invalid values to false
- `MarkdownSettings`: add an automatically persisted switch with concise English labeling alongside the existing line-number control
- focused Settings regressions: prove clean defaults, migration fallback, explicit true preservation, and registry/UI wiring

**Verification:**
- `node --test tests/settings.test.mjs tests/settingsCenter.test.mjs`

- [x] Add focused assertions for the default, normalization, and Markdown Settings control.
- [x] Implement the typed Settings contract and automatically persisted switch.
- [x] Run the focused Settings checks and inspect failures.

## Task 2: Apply the Preference Without Overwriting Document State

**Outcome:** Markdown uses the global preference only when the active document has no explicit saved Outline state.
**Files:**
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `tests/markdownEditorRefinement.test.mjs`

**Change Map:**
- `MarkdownEditor` initialization: resolve `showOutline` from explicit per-document state first and `settings.markdown.openOutlineByDefault` second
- editor behavior regression: cover default-off, default-on, saved true/false precedence, and continued toolbar state updates without coupling them to global Settings

**Verification:**
- `node --test tests/markdownEditorRefinement.test.mjs tests/markdownEditorContract.test.mjs`

- [x] Add focused lifecycle assertions for the preference and saved-state precedence.
- [x] Apply the preference at initialization while preserving the current Outline toggle contract.
- [x] Run focused Markdown regressions and inspect navigation/state failures.

## Task 3: Verify and Deliver F058

**Outcome:** The preference ships with current regression, build, workflow, and source-control evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F058-configure-markdown-outline-default.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- regression and build: Settings migration/persistence, Markdown default initialization, saved-state precedence, and unchanged editor controls
- workflow: record completion evidence, mark F058 complete/done, regenerate the plan index, and stage only F058 changes

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run one stabilized full frontend regression and production build after implementation stops changing.
- [x] Compare the final diff with every Exit Criterion and confirm no file-content, metadata, or unrelated editor-setting changes.
- [x] Mark F058 complete/done and create a separate `feat(F058)` commit containing only this feature.

## Completion Evidence

- Settings schema version 7 normalizes clean, older, and malformed snapshots to `markdown.openOutlineByDefault: false`; explicit boolean `true` values persist through the existing automatic Settings boundary, while Markdown line-number behavior remains unchanged.
- Markdown initializes Outline visibility from an explicit saved document-session `showOutline` value when present. Otherwise it applies the global preference after Settings hydration, so a persisted default-on choice is not lost to the initial built-in default-off snapshot.
- Focused settings and editor verification passed: `node --test tests/settings.test.mjs tests/settingsCenter.test.mjs tests/markdownEditorRefinement.test.mjs tests/markdownEditorContract.test.mjs` (18/18).
- The stabilized frontend regression passed: `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs` (427 tests).
- Production TypeScript and Vite build passed: `npm run build`; only the existing mixed static/dynamic import and large-chunk advisories were reported.
- Final diff inspection confirmed the change does not write Markdown content or metadata, mirror toolbar toggles into global Settings, overwrite explicit document-session state, or alter view-mode, split, scroll-sync, line-number, and other editor defaults. `git diff --check` passed.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/bugs/B033-refine-markdown-editor-navigation-view-switching-and-controls.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-02-settings-themes-and-markdown.md`
- `docs/superplan/plans/features/F048-refine-settings-navigation-and-auto-apply.md`
- `docs/superplan/plans/features/F054-configure-default-sidebar-and-page-view-states.md`
- `src/lib/settings.ts`
- `src/components/settings/MarkdownSettings.tsx`
- `src/components/MarkdownEditor.tsx`
