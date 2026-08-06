---
id: "F025"
title: "Replace Native Unsaved Prompts with a Three-action Dialog"
type: "feature"
status: "complete"
summary: "Replace the two-step native unsaved-change prompt with one accessible three-action dialog and make the dirty save status visibly red."
source: "docs/superplan/human/features.md"
created: "2026-08-06"
order: 25
depends_on: ["06", "F004", "F007", "B011", "B012"]
parent: ""
---

# Replace Native Unsaved Prompts with a Three-action Dialog Plan

**Goal:** Make dirty state immediately noticeable and make closing or leaving a dirty document a clear, single-step decision that feels intentional inside the IdeaNote editor.
**Scope:** Replace the current two sequential Tauri `ask` sheets with one controlled React modal for document close, Home, Open File, Open Workspace, system file-open, and native application close. The modal names the affected document and presents three full-width actions in priority order: `Save`, `Discard Changes`, and `Cancel`. Change the title-bar `Unsaved changes` label from muted gray to a high-visibility red while retaining the current `Saving...` and `Saved` treatments. Preserve direct Save/Save As behavior, save-failure cancellation, active-first sequential resolution of legacy multiple-dirty state, recovery cleanup only after explicit discard, and B011's awaited native-close lifecycle. Deliver keyboard focus containment, visible focus, Escape-to-cancel, screen-reader labelling, reduced-motion behavior, and a compact responsive layout.
**Non-Goals:** This feature does not change autosave timing, Workspace save-before-switch behavior, file serialization, Save As filters, external-change protection, recovery storage, application window configuration, generic error/message dialogs, the decision policy for clean documents, or the wording/colors of `Saving...` and `Saved`. It does not add a reusable application-wide modal design system or convert unrelated recovery and confirmation prompts.
**Architecture:** Add the maintained `@radix-ui/react-alert-dialog` primitive alongside the repository's existing Radix controls. A controlled `UnsavedChangesDialog` owns portal, overlay, focus, accessibility, and the three visible actions. A small `useUnsavedChangesDialog` hook bridges the imperative async exit coordinator to React state with one pending resolver, closes the visual decision before Save As or recovery work begins, treats Escape/unmount as cancellation, and prevents overlapping prompt requests from replacing an unresolved decision. `EditorLayout` continues to own document persistence and passes each requested decision into the existing `requestClose` and `resolveDirtyDocumentsSequentially` flows; only the presentation and one-step result shape change. The existing `SaveIndicator` state class remains the semantic boundary for title-bar status, with a narrowly scoped dirty-label CSS rule providing red text and stronger weight without changing state calculation or announcements.
**Baseline:** `EditorLayout.requestClose` and `confirmSessionExit` currently call Tauri `ask` twice: first `Save` versus `More Options`, then `Discard` versus `Cancel`. Native sheets cannot be styled into the requested large vertical decision card, hide the final three choices across two steps, and use different sizing from the editor shell. The title-bar `SaveIndicator` renders `Unsaved changes` with the shared muted gray text color, so the dirty state is easy to miss even though its dot changes state. B011 and B012 already centralize the safe save, discard, cancellation, active-first ordering, and native-close behavior that this feature must preserve.
**Exit Criteria:** A dirty document immediately shows `Unsaved changes` in clearly legible red text while `Saving...` and `Saved` retain their existing colors and semantics. Closing or leaving shows one centered dialog with its filename, a clear unsaved-change heading, and vertically stacked `Save`, `Discard Changes`, and `Cancel` buttons. Save remains the only saturated blue action; neutral actions remain visually distinct without presenting discard as the default. Save succeeds through the existing writer or Save As flow and then continues; Save cancellation/failure and Cancel keep the document/window open; Discard clears only the corresponding recovery draft and continues. Multiple dirty documents display one decision at a time in active-first order. The modal traps focus, begins on Save, exposes correct dialog/title/description semantics, cancels on Escape, cannot be dismissed accidentally through the backdrop, renders above Excalidraw, fits narrow supported windows, and respects reduced motion. Focused behavior/UI contracts, the complete frontend suite, production build, Tauri close smoke, and diff checks pass.

## Task 1: Lock the One-step Decision and Exit Contracts

**Outcome:** Focused regressions require one three-result prompt while preserving every existing save, discard, recovery, and native-close outcome.
**Files:**
- Create: `tests/unsavedChangesDialog.test.mjs`
- Modify: `tests/unsavedChanges.test.mjs`
- Modify: `tests/recovery.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`

**Change Map:**
- dialog composition contract: filename-aware heading/description, ordered `Save`, `Discard Changes`, and `Cancel` actions, Radix alert-dialog semantics, and no `More Options` wording
- save-status visibility contract: the dirty label uses a dedicated red treatment while saved and saving states remain unchanged
- resolver contract: one pending decision, explicit `save | discard | cancel` result, Escape/unmount cancellation, and safe rejection of overlapping prompt replacement
- exit orchestration contract: document close and session exit consume the same one-step result; save failure/cancel blocks continuation; recovery cleanup remains discard-only; native close retains B011 ordering

**Verification:**
- `node --test tests/unsavedChangesDialog.test.mjs tests/unsavedChanges.test.mjs tests/recovery.test.mjs tests/editorChromeNavigation.test.mjs`
- Cases: dirty/saving/saved title-bar states; saved and untitled documents; Save As success/cancel; real save failure; discard; cancel; active-first multiple dirty documents; repeated native close while a decision is pending; component unmount.

- [x] Add focused failing contracts for the three-action UI and async decision bridge.
- [x] Preserve B011/B012 exit, recovery, and native-close behavior in the focused suite.

## Task 2: Build and Integrate the Accessible Decision Card

**Outcome:** Every unsaved close/exit path uses one polished in-app dialog instead of two native sheets.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/UnsavedChangesDialog.tsx`
- Create: `src/hooks/useUnsavedChangesDialog.ts`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/index.css`

**Change Map:**
- dependency: add the actively maintained Radix Alert Dialog primitive through npm and retain the repository's current package manager/lockfile
- `UnsavedChangesDialog`: controlled portal/overlay/content, filename-aware English copy, three ordered full-width actions, autofocus, Escape cancellation, backdrop protection, and accessible title/description labelling
- `useUnsavedChangesDialog`: Promise-based request/settle boundary with one resolver, cleanup cancellation, and explicit decision type
- `EditorLayout`: replace both two-step Tauri `ask` chains with the shared decision request while retaining direct `saveDocument`, `resolveDirtyDocumentsSequentially`, recovery deletion, and window-close coordination
- save-status emphasis: style only `.idea-slide-save-indicator.is-dirty` label text with accessible red `#D92D20` and semibold weight; leave saving/saved status colors and live-region behavior intact
- visual system: 480px desktop card, 30px internal spacing, 28px radius, restrained shadow/border, system UI typography, `#0A7CFF` Save action, layered neutral actions, translucent blurred overlay, responsive edge gutters, visible focus rings, and reduced-motion fallback

**Verification:**
- Run the focused Task 1 suite.
- Browser/Tauri interaction: make a real edit and confirm the red dirty label remains legible in the title bar; open the prompt above a live Excalidraw Canvas; tab/shift-tab through actions; press Escape; attempt backdrop click; exercise Save, Save As cancel, Discard, Cancel, Home, and native close at standard and minimum window sizes.

- [x] Implement the Radix-backed modal and Promise bridge without duplicating persistence policy.
- [x] Match the approved dialog hierarchy and red dirty-status emphasis; verify keyboard, screen-reader, overlay, and responsive behavior.

## Task 3: Verify and Deliver F025

**Outcome:** The redesigned unsaved-change decision ships with current regression, build, native interaction, visual, and workflow evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F025-three-action-unsaved-changes-dialog.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F025 request/plan: completion status plus focused/full/native/visual evidence
- generated plan index: F025 status and dependencies

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `npm run tauri build`
- `git diff --check`
- Native acceptance: dirty saved and untitled files through document close, Home, Open File/Workspace, system file-open, and macOS window close; verify Save, Save As cancel, Discard Changes, Cancel, repeated close, active-first sequential prompts, and no `More Options` sheet.

**Completion Evidence (2026-08-06):**
- Focused dialog, exit, recovery, and editor-chrome suite passed: 15/15 tests.
- Complete frontend suite passed: 240/240 tests.
- `npm run build` and `npm run tauri build` passed; Tauri produced `IdeaNote.app` and `IdeaNote_0.1.0_aarch64.dmg`.
- Browser and native Tauri checks confirmed the centered three-action dialog, initial Save focus, Tab/Shift+Tab containment, Escape cancellation, backdrop protection, red dirty-status text, and continued close flow after discard.
- `@radix-ui/react-alert-dialog` resolved to 1.1.23 and `git diff --check` passed.

- [x] Run the complete regression/build/native matrix after implementation stabilizes.
- [x] Complete F025, refresh progress, and create a separate `feat(F025)` commit containing only this delivery.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- `docs/superplan/plans/features/F007-framework-title-bar-icons.md`
- `docs/superplan/plans/bugs/B011-fix-untitled-save-and-window-close.md`
- `docs/superplan/plans/bugs/B012-save-active-document-before-switching.md`
- `src/components/EditorLayout.tsx`
- `src/lib/unsavedChanges.ts`
- `src/components/RecoveryPrompt.tsx`
- `src/index.css`
- `tests/unsavedChanges.test.mjs`
- `tests/recovery.test.mjs`
