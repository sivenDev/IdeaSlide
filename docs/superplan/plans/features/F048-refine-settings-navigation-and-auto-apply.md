---
id: "F048"
title: "Refine Settings Navigation and Apply Changes Automatically"
type: "feature"
status: "complete"
summary: "Give Settings a clearer icon-led hierarchy and replace explicit draft saving with safe automatic persistence."
source: "docs/superplan/human/features.md"
created: "2026-08-12"
order: 68
depends_on: ["B037"]
parent: ""
---

# Refine Settings Navigation and Apply Changes Automatically Plan

**Goal:** Make Settings faster to scan and effortless to operate by pairing a clearer IdeaNote-specific navigation hierarchy with reliable automatic persistence.
**Scope:** Redesign the Settings sidebar using the supplied reference for information-hierarchy inspiration: a calm dedicated navigation surface, meaningful section icons, restrained uppercase groups, a violet current-location rail plus soft selection surface, and a content header driven by each registry entry's label and description. Keep the current Application, AI, and Editors groups and six registry-owned sections; omit search because this information set is still small. Remove the `Save changes` button and dialog-scoped discard behavior. Theme cards, switches, checkboxes, selects, and discrete actions apply and persist immediately. Free-form text and numeric settings update the interface immediately and persist after a short debounce, with the latest pending change flushed on blur and before dialog close. Provider credentials remain a deliberate exception: plaintext input is transient and is securely stored only after the existing Provider Test succeeds, so partially typed or invalid tokens are never committed. Show compact non-blocking Saving/Saved status and an actionable error with Retry when persistence fails. Preserve Light/Dark/System, registry-driven editor contributions, secure credential commands, Provider catalog validity, Agent activation, keyboard focus, responsive geometry, and all production Settings functionality.
**Non-Goals:** This feature does not add Settings search, Account/Email/About sections from the reference, copy Kition's green brand or exact layout, change the persisted settings schema, expose stored credentials, remove Provider Test, invent a manual global Apply/Cancel action, add cloud sync, or redesign the individual setting-field content beyond adjustments needed for the new navigation/header/status composition.
**Architecture:** Replace `SettingsDraftProvider`'s explicit draft transaction with an auto-persisting edit session over the existing `SettingsProvider` persistence boundary. The session owns an optimistic local projection so controls respond synchronously, a monotonically ordered/coalesced save queue so rapid edits cannot persist stale state over newer changes, a 350ms debounce for text/number fields, flush hooks for blur/close, and status/error/retry metadata. Successful persistence reconciles the projection with normalized saved settings; a failure keeps the user's latest projection visible, reports the error, and retains that exact pending snapshot for Retry rather than silently reverting. Discrete updates bypass the debounce but still serialize through the same latest-state queue. Theme continues to paint immediately from the optimistic projection and remains on the chosen theme during save; failed persistence is visible and retryable. Credential input stays outside ordinary preference snapshots. `Test` uses the proposed URL/token, and on success stores a non-empty replacement token before publishing the returned model catalog and selection through the auto-persist boundary; failed Test stores neither token nor catalog. The section registry gains an icon identifier usable by the shell without embedding React components in shared metadata. Visual direction is **Violet Index**: keep the 760x560 compact dialog, use a 190px inset navigation column, 36px rows, 15px line icons, a 2px violet active rail, and the existing low-chroma selection token. Icon meanings are stable and functional: `Settings2` for General, `Bot` for AI Provider, `Sparkles` for Agent, `Blocks` for Skills, `Shapes` for IdeaSketch, and `FileText` for Markdown. The active content header uses the registry label plus its concise description; individual pages no longer repeat the same title.
**Baseline:** Settings currently uses a 170px icon-free Frost sidebar with small group headings and text-only rows. The content area repeats only a page title; existing registry descriptions are not surfaced. `SettingsDraftProvider` clones all settings when the dialog opens, previews theme locally, accumulates edits, and commits settings plus any credential only when `Save changes` is pressed; closing discards ordinary changes and reverts theme. The global `SettingsProvider` and `saveSettings` boundary already normalize and persist complete snapshots, but its callback captures the current React state and is not sufficient by itself for concurrent rapid updates. Provider Test currently updates a draft model catalog while credential storage waits for the global Save action.
**Exit Criteria:** The Settings sidebar is visibly easier to scan in Light and Dark: each section has one consistent semantic icon, current location has a slim violet rail and quiet violet surface, group labels remain subordinate, hover/focus are distinct, and the registry label/description appears as a clear content header. The six sections fit desktop and effective 850x850 layouts without clipping or horizontal overflow; keyboard navigation, accessible names, and focus-visible states remain intact. There is no `Save changes` button, dirty/discard flow, or unsaved-close rollback. A theme, switch, checkbox, or select survives close/reopen immediately after interaction. Text and numeric changes persist after the debounce and are guaranteed to flush on blur/close; rapid edits and overlapping saves cannot regress to an older value. Saving/Saved feedback is quiet and transient; failures retain the attempted value, expose the error plus Retry, and a successful retry reconciles state. Provider token is never stored while merely typing, is stored only following a successful Test, and failed tests or close do not commit it. Provider catalog/model validity, credential secrecy, runtime activation, Settings normalization, Light/Dark/System, full frontend regression, production build, Rust tests, native startup, visual inspection, workflow validation, diff hygiene, and a separate `feat(F048)` commit pass.

## Task 1: Specify the Navigation and Auto-Persist Contracts

**Outcome:** Executable tests describe the new shell hierarchy, absence of manual Save/discard, persistence timing, ordering, flush, failure, retry, and credential safety before implementation changes.
**Files:**
- Modify: `tests/settingsCenter.test.mjs`
- Modify: `tests/settings.test.mjs`
- Modify: `tests/reviewedDemoParity.test.mjs`
- Modify: `src/lib/settingsSectionRegistry.ts`

**Change Map:**
- navigation contract: registry metadata supplies stable icon ids, section descriptions drive the content header, selected rows expose one active rail/surface, and no search is introduced for six sections
- interaction contract: remove Save button and discard-on-close expectations; require optimistic controls plus queued automatic persistence
- concurrency contract: latest snapshot wins across rapid discrete changes, debounced text, in-flight saves, and normalized backend results
- lifecycle contract: debounce, blur flush, close flush, Saving/Saved/Error/Retry, and no unhandled promise rejection
- credential contract: typing never stores a token; successful Test stores it once; failed Test/close stores nothing

**Verification:**
- `node --test tests/settingsCenter.test.mjs tests/settings.test.mjs tests/reviewedDemoParity.test.mjs`
- Cases: current manual Save/draft source fails before repair; navigation metadata and shell assertions; immediate theme/switch/select; debounced text/number; blur/close flush; overlapping saves; failure/retry; Test success/failure with new and configured credential; no plaintext readback.

- [x] Add focused source and behavior regressions for the new navigation hierarchy.
- [x] Add auto-persist timing, ordering, close-flush, and retry regressions.
- [x] Add Provider credential regressions proving Test-gated secure storage.

## Task 2: Build the Auto-Persisting Settings Session

**Outcome:** Every ordinary Settings control updates immediately and reaches durable storage safely without a global Save button.
**Files:**
- Modify: `src/hooks/useSettings.tsx`
- Modify: `src/components/SettingsCenter.tsx`
- Modify: `src/components/settings/AiProviderSettings.tsx`
- Modify: all Settings consumers only where the update API needs field persistence intent
- Modify: focused tests from Task 1

**Change Map:**
- provider boundary: replace draft-only `dirty`, `saveDraft`, and `discardDraft` state with optimistic settings, ordered/coalesced persistence, debounce/flush, status, error, and retry
- update API: distinguish discrete immediate changes from debounced text/number edits without duplicating settings state inside each page
- close path: await/trigger a bounded latest-state flush before dismissal without reintroducing an Apply/Cancel decision
- reconciliation: accept normalized persisted values, prevent stale completions from overwriting later optimistic edits, and retain failed snapshots for retry
- Provider flow: keep token transient while typing; on successful Test, store replacement credential securely and persist the matching catalog/model; report either storage or persistence failure without claiming success

**Verification:**
- `node --test tests/settingsCenter.test.mjs tests/settings.test.mjs tests/reviewedDemoParity.test.mjs`
- Runtime cases: rapid theme and toggle sequences; text typing while another save is in flight; blur/close during debounce; persistence rejection then Retry; reopen after success; Provider Test success/failure and configured-token reuse.

- [x] Implement one race-safe optimistic auto-persistence session over the existing settings service.
- [x] Convert every setting field to the correct immediate or debounced update intent.
- [x] Preserve Provider Test/catalog and secure credential boundaries under auto-apply.

## Task 3: Recompose the Settings Navigation and Header

**Outcome:** Settings gains a clearer visual hierarchy inspired by the reference while remaining recognizably IdeaNote in both themes.
**Files:**
- Modify: `src/lib/settingsSectionRegistry.ts`
- Modify: `src/components/SettingsCenter.tsx`
- Modify: `src/index.css`
- Modify: `tests/settingsCenter.test.mjs`
- Modify: `tests/themeVisualContract.test.mjs`
- Modify: `tests/reviewedDemoParity.test.mjs`

**Change Map:**
- sidebar: use the 190px Violet Index column with 36px rows and 15px Lucide icons selected by registry icon ids, align icon/label baselines, and preserve compact group separation
- location signature: add a 2px violet rail inside the selected row plus a low-chroma violet selection surface; icons remain neutral until active rather than becoming decoration everywhere
- content header: render the active registry label and concise description once above section content, then remove duplicate page-title headings from individual settings sections
- status: place compact Saving/Saved/Error/Retry feedback in the dialog header beside Close, with no primary action button
- responsive: retain the compact dialog and effective minimum viewport, reducing sidebar width/padding at constrained sizes without hiding section names or creating horizontal scroll
- theme: consume B036 semantic roles only; reference green and brand-specific geometry do not enter IdeaNote

**Verification:**
- `node --test tests/settingsCenter.test.mjs tests/themeVisualContract.test.mjs tests/reviewedDemoParity.test.mjs`
- Browser/native review in Light/Dark/System at desktop and effective 850x850: all six sections, selected/hover/focus, long descriptions, saving/saved/error/retry, content scroll, no overflow, and no console warnings/errors.

- [x] Add registry-driven icons and active-section header semantics.
- [x] Apply the violet rail, restrained selection, spacing, typography, and responsive navigation treatment.
- [x] Remove duplicated section headings and all obsolete Save-button styling.

## Task 4: Verify and Deliver the New Settings Experience

**Outcome:** F048 closes with persistence, credential, accessibility, visual, native, workflow, and source-control evidence in one isolated commit.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F048-refine-settings-navigation-and-auto-apply.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- focused/full regression: Settings shell, persistence queue, credential flow, theme contract, editor settings, Agent activation, and reviewed parity expectations
- visual/native: all sections and status states in Light/Dark/System, desktop/compact, pointer/keyboard, close during pending write, and no runtime errors
- workflow: record evidence, complete F048/done, refresh the index, and stage only F048 paths

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `npm run tauri dev`
- Browser/native review at desktop and 850x850 in Light/Dark/System, including keyboard focus, rapid edits, blur/close flush, save error/retry, Provider Test, scroll, overflow, and console diagnostics.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks during implementation and one full stabilized regression after changes stop moving.
- [x] Inspect genuine Light/Dark/System navigation and every automatic persistence state.
- [x] Mark F048 complete/done and create a separate `feat(F048)` commit containing only this feature.

## Delivery Evidence

- Focused Settings, persistence, parity, and theme regressions passed: `node --test tests/settingsAutoPersist.test.mjs tests/settingsCenter.test.mjs tests/settings.test.mjs tests/reviewedDemoParity.test.mjs tests/themeVisualContract.test.mjs` (22/22).
- The stabilized frontend regression passed: `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`.
- Production TypeScript and Vite build passed: `npm run build`; existing Excalidraw mixed-import and large-chunk warnings remain unchanged.
- Native regression passed: `cd src-tauri && cargo test` (156/156); existing unused-code warnings remain unchanged.
- Native startup passed with the existing Vite server reused: `npm run tauri dev -- --no-watch --config '{"build":{"beforeDevCommand":""}}'` reached `Running target/debug/idea-slide`.
- Browser visual QA passed in Light and Dark at 850x850: the 760x560 dialog retained a 190px navigation column, group labels were increased to 10px and section labels to 12px after visual review, all six icon-led sections exposed `aria-current="page"`, no page had horizontal overflow, Agent content scrolled vertically as intended, and the console had no warnings or errors.
- Theme changes showed Saved state, survived close/reopen without a Save button, and the Provider credential fingerprint remained current after a successful Test stored a new token.
- `git diff --check` passed.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-01-settings-and-ai-gating.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-02-settings-themes-and-markdown.md`
- `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`
- `docs/superplan/plans/bugs/B037-restore-danger-disabled-and-theme-choice-semantics.md`
- Human-supplied current Settings screenshot and navigation reference from `2026-08-12`
- `src/components/SettingsCenter.tsx`
- `src/hooks/useSettings.tsx`
- `src/lib/settings.ts`
- `src/lib/settingsSectionRegistry.ts`
- `src/components/settings/AiProviderSettings.tsx`
- `src/index.css`
