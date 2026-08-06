---
id: "B016"
title: "Prevent Large IdeaSketch Page Switch Freezes"
type: "bugfix"
status: "complete"
summary: "Scope the complete Excalidraw Canvas lifecycle to one Page so switching large Pages cannot emit a false edit and rewrite the whole document."
source: "docs/superplan/human/bugs.md"
created: "2026-08-06"
order: 16
depends_on: ["F024", "B006", "B014"]
parent: ""
---

# Prevent Large IdeaSketch Page Switch Freezes Plan

**Goal:** Keep Page switching responsive for large IdeaSketch documents without reverting F024 viewport optimizations or changing save and editor behavior.
**Scope:** Remount the complete `SlideCanvas` ownership boundary from one coherent `draft.slideId`, rather than preserving Page-sensitive refs and subscriptions while only its Excalidraw child changes identity. Ensure the old Page API, Camera overlay subscriptions, initial-emission guard, selection observer, interaction timer, and drawing refs are cleaned before the destination Page mounts. Reject delayed notifications from an unmounted Canvas and normalize persistence-equivalent floating-point geometry tails so destination initialization remains non-editing, Page selection stays `Saved`, and an unchanged `.is` archive is not rewritten. Preserve B006 Page/draft identity, F024 viewport fast paths, Camera badges, style conversion, Page thumbnails, presentation, and file-format behavior.
**Non-Goals:** This fix does not remove normal Excalidraw remounting between Pages, change Page selection persistence, disable autosave for real edits, alter `.is v1` serialization, weaken external-change protection, replace WKWebView, change thumbnail demand or cache policy, or claim that all Excalidraw rendering cost can be eliminated for image-heavy Pages.
**Architecture:** `IdeaSketchEditor` keys the `SlideCanvas` component itself by `draft.slideId`, matching the existing rule that `slideId`, elements, app state, and files come from one complete draft. A Page switch therefore unmounts the old Canvas owner before mounting the new one, making `isInitialLoad`, `excalidrawApiRef`, Camera overlay/API subscriptions, selection observation, and interaction timers Page-scoped by construction. `SlideCanvas` additionally rejects delayed Excalidraw API/change callbacks after unmount. Scene fingerprints serialize finite geometry with 15 significant digits, matching the persistence-equivalence boundary without masking meaningful geometry changes. Internal Excalidraw and overlay keys remain defensive for other callers; no WebView configuration or file-format change is required.
**Baseline:** F024 added Camera-overlay, selection, scroll-interaction, and preview-activity refs/subscriptions to `SlideCanvas`, but `IdeaSketchEditor` renders `SlideCanvas` without a React key. Only the nested `Excalidraw` and Camera overlay are keyed by `slideId`. During a Page transition, the parent component survives with the previous Page's `isInitialLoad` and API refs; the new overlay is initially rendered with the old `excalidrawApiRef.current`, and the passive `isInitialLoad` reset occurs after the destination child begins mounting. This permits destination initialization notifications to cross the old Canvas lifecycle boundary.
**Reproduction:** Open a writable temporary copy of the 6.6 MB, 15-Page `chenlan.is` in the current production bundle and select another Page. The toolbar changes from `Saved` to `Unsaved changes` and the archive is rewritten. Comparing the before/after ZIP entries shows every `slides/*.json` payload is byte-identical and only `manifest.json` changes through its `modified` timestamp. Repeating Page switches therefore invokes full-document serialization/compression despite no Page data changing, producing the reported long freeze on a large file. A read-only copy switches without the save path, and F024-preceding builds exhibit the same false-save boundary, while F024 increases the amount of Page-sensitive state retained by that boundary.
**Root Cause:** The Page identity boundary stops at the nested Excalidraw child instead of the component that owns its refs, API subscriptions, and initial-emission guard. Because `SlideCanvas` is reused across `draft.slideId` changes, the destination Excalidraw can mount while `isInitialLoad` and `excalidrawApiRef` still describe the previous Page. An initialization emission is then accepted as a live edit, producing a persisted-equivalent Page commit and scheduling autosave. The writer updates only manifest metadata, but it still serializes and compresses the entire multi-megabyte document on every Page switch.
**Exit Criteria:** Switching among all 15 Pages of a writable disposable copy of `chenlan.is` remains responsive, keeps the toolbar `Saved`, and leaves archive bytes and modification time unchanged beyond the autosave debounce. The destination Canvas displays the correct Page and old Camera/selection/interaction subscriptions are cleaned exactly once. A real element, background, grid, Camera, conversion, Page lifecycle, or presentation edit still follows the existing dirty/autosave path. Viewport-only emissions remain fingerprint-free, thumbnail pause/resume remains bounded, and all focused, full frontend, build, Rust, production Tauri, and diff checks pass.

## Task 1: Lock the Whole-Canvas Page Lifecycle Regression

**Outcome:** Focused tests fail unless one complete Page draft owns one complete `SlideCanvas` mount and its initial Excalidraw emission cannot enter the save path.
**Files:**
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/excalidrawViewportObservers.test.mjs`
- Modify: `src/lib/sceneFingerprint.ts`
- Modify: `tests/sceneFingerprint.test.mjs`

**Change Map:**
- Page/Canvas identity contract: require `SlideCanvas` React identity, `slideId`, elements, app state, and files to use the same `draft.slideId` boundary
- observer lifecycle contract: require Page-scoped cleanup for Camera/API subscriptions and interaction timers rather than carrying them into another Page
- persistence-equivalence contract: ignore sub-precision floating-point geometry tails while retaining meaningful resize detection
- native regression: preserve the pre-fix writable-copy archive/hash and `Unsaved changes` evidence as the behavior-level failure

**Verification:**
- `node --test tests/ideaSketchEditor.test.mjs tests/excalidrawViewportObservers.test.mjs tests/editorSession.test.mjs tests/sceneFingerprint.test.mjs`
- Cases: Page selection remount identity; initial notification isolation; old API cleanup; correct destination draft; viewport-only/no-op notifications remain non-saving.

- [x] Add the focused Page-scoped `SlideCanvas` identity regression and confirm it fails before the fix.
- [x] Retain the writable large-file before/after archive comparison as the native behavior regression.

## Task 2: Make SlideCanvas Ownership Page-scoped

**Outcome:** Page switching disposes every old Canvas ref/subscription before the destination Excalidraw mounts, preventing false dirty state and whole-document rewrites.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/SlideCanvas.tsx` only if the focused lifecycle test exposes a cleanup gap after keying the owner

**Change Map:**
- `IdeaSketchEditor`: key `SlideCanvas` by `draft.slideId` while retaining the B006 scene/draft prop contract
- `SlideCanvas`: preserve existing internal keys and cleanup; add only the smallest explicit API-owner guard if a destination can still observe a previous Page API
- behavior preservation: keep F024 persisted projections, Camera projection, conversion observation, interaction-idle signaling, thumbnail scheduling, drawing, export, and presentation refresh unchanged

**Verification:**
- Run the focused Task 1 suite.
- Native cases: Page 1 → every other Page → Page 1 on the writable disposable large file; toolbar remains `Saved`; ZIP hash and mtime remain stable; correct Page content renders; repeated switching does not accumulate live callbacks or produce console errors.

- [x] Remount the complete Canvas ownership boundary from `draft.slideId` and close any remaining stale-API gap.
- [x] Verify unchanged real-edit, Camera, conversion, thumbnail, and presentation behavior.

## Task 3: Verify and Deliver B016

**Outcome:** The large-Page switch fix ships with focused, archive-integrity, performance, build, native, and workflow evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B016-prevent-large-page-switch-freeze.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B016 request and plan: completion status, focused failure/pass evidence, native archive hashes/mtime, and measured Page-switch behavior
- generated plan index: B016 state and dependencies

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `npm run tauri build`
- `git diff --check`
- Production Tauri acceptance uses only disposable copies: switch all Pages repeatedly in Name and Thumbnail modes, wait beyond autosave debounce, compare archive entries and mtime, then make one real edit and confirm exactly one normal save reaches `Saved`.

- [x] Run the complete regression/build/native matrix after the focused fix stabilizes.
- [x] Complete B016, refresh progress, and create a separate `fix(B016)` commit containing only this delivery.

## Completion Evidence

- Focused lifecycle and persistence suite: 31/31 tests passed across `ideaSketchEditor`, `excalidrawViewportObservers`, `editorSession`, and `sceneFingerprint`, including Page-owned Canvas identity, unmounted callback rejection, and floating-point-tail equivalence.
- Complete frontend regression: the stabilized rerun passed 237/237 tests with no failures, skips, or cancellations. One earlier full-suite invocation reported a single non-reproducing failure before the clean rerun; the focused suite remained green throughout.
- `npm run build`: strict TypeScript and the production Vite build passed. Existing informational warnings remain for Excalidraw's mixed static/dynamic import and generated chunks over 500 kB.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`: 85 Rust tests passed.
- `npm run tauri build`: produced `IdeaNote.app` and `IdeaNote_0.1.0_aarch64.dmg` successfully.
- `git diff --check`: passed before delivery with no whitespace errors.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/features/F019-add-page-list-view-mode-switch.md`
- `docs/superplan/plans/features/F024-optimize-large-excalidraw-viewport-interactions.md`
- `docs/superplan/plans/bugs/B004-stabilize-editor-session-slide.md`
- `docs/superplan/plans/bugs/B006-synchronize-page-canvas-draft-identity.md`
- `docs/superplan/plans/bugs/B007-prevent-false-conflicts-after-autosave.md`
- `docs/superplan/plans/bugs/B008-suppress-workspace-self-write-event-bursts.md`
- `docs/superplan/plans/bugs/B014-fix-workspace-autosave-completion-loop.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/SlideCanvas.tsx`
- `src/hooks/useEditorSession.ts`
- `tests/ideaSketchEditor.test.mjs`
- `tests/excalidrawViewportObservers.test.mjs`
