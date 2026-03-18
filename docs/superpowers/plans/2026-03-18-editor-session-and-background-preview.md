# Editor Session And Background Preview Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple Excalidraw editing, persisted slide state, and preview rendering so Chinese text editing stays smooth and previews update reliably without flashing or blocking the editor.

**Architecture:** Introduce a local editor session for the current slide, keep transient Excalidraw editing state out of the global slide store, and move both camera and slide preview rendering behind a shared hidden Tauri preview renderer. Explicit flush boundaries commit the current draft into the persisted presentation state before save, slide switch, presentation start, or exit.

**Tech Stack:** Tauri v2, React 19, TypeScript, Excalidraw 0.18, Rust, Node test runner

---

## File Structure

**Create:**
- `src/lib/editorSession.ts` - editor-session helpers, draft shape, persisted appState extraction, flush helpers
- `src/hooks/useEditorSession.ts` - current-slide local draft lifecycle and flush orchestration
- `src/lib/previewRenderer.ts` - shared slide/camera preview renderer client and hidden-window bootstrap
- `src/lib/previewKeys.ts` - stable keys for slide preview/camera preview cache entries
- `tests/editorSession.test.mjs` - editor draft + persisted-state extraction tests
- `tests/previewKeys.test.mjs` - preview key stability tests

**Modify:**
- `src/App.tsx` - bootstrap a shared hidden `preview-renderer` window instead of split preview boot paths
- `src/components/EditorLayout.tsx` - consume local editor session instead of reading/writing the current slide directly from global store
- `src/components/SlideCanvas.tsx` - bind to editor draft props only; keep memo boundary strict
- `src/hooks/useSlideStore.tsx` - add explicit commit action(s) and stop treating live editor appState as always-global state
- `src/hooks/useAutoSave.ts` - flush current editor draft before saving
- `src/hooks/useSlideThumbnails.ts` - replace direct `exportToSvg()` work with shared preview renderer client
- `src/hooks/useCameraThumbnails.ts` - migrate to shared preview renderer API and visibility-aware refresh policy
- `src/lib/cameraThumbnail.ts` - keep only pure helper logic needed by renderer/client
- `src/lib/tauriCommands.ts` - if needed, normalize persisted appState serialization
- `src-tauri/src/lib.rs` - replace separate preview windows with shared `preview-renderer` readiness/window management
- `src-tauri/capabilities/default.json` - include `preview-renderer` window

**Existing tests to keep green:**
- `tests/latestOnlyExecutor.test.mjs`
- `tests/cameraThumbnail.test.mjs`
- `tests/cameraUtils.test.mjs`
- `tests/sceneFingerprint.test.mjs`
- `tests/slideCanvasProps.test.mjs`

---

### Task 1: Define editor-session state boundaries with TDD

**Files:**
- Create: `src/lib/editorSession.ts`
- Test: `tests/editorSession.test.mjs`

- [ ] **Step 1: Write failing editor-session tests**

Cover:
- extracting persisted slide content from a draft excludes transient editing-only appState fields
- draft flush returns a commit payload only when content actually changes
- switching slides resets draft identity cleanly
- draft save metadata preserves `elements`, `files`, and only the persisted subset of `appState`

Run: `node --experimental-strip-types --test tests/editorSession.test.mjs`
Expected: FAIL because the editor-session helpers do not exist yet.

- [ ] **Step 2: Implement minimal editor-session helpers**

Implement:
- `buildEditorDraftFromSlide(slide)`
- `extractPersistedAppState(appState)`
- `buildSlideCommitPayload(previousSlide, draft)`

Keep the API pure and testable.

- [ ] **Step 3: Run the editor-session tests**

Run: `node --experimental-strip-types --test tests/editorSession.test.mjs`
Expected: PASS.

### Task 2: Add stable preview cache keys with TDD

**Files:**
- Create: `src/lib/previewKeys.ts`
- Test: `tests/previewKeys.test.mjs`

- [ ] **Step 1: Write failing preview-key tests**

Cover:
- slide preview key changes when the slide scene changes
- camera preview key changes when camera signature changes
- equivalent slide/camera data produce stable identical keys

Run: `node --experimental-strip-types --test tests/previewKeys.test.mjs`
Expected: FAIL because the preview-key helpers do not exist yet.

- [ ] **Step 2: Implement minimal preview-key helpers**

Implement helpers that compose scene fingerprint + optional camera signature into string keys for the shared preview renderer.

- [ ] **Step 3: Run the preview-key tests**

Run: `node --experimental-strip-types --test tests/previewKeys.test.mjs`
Expected: PASS.

### Task 3: Introduce the local current-slide editor session

**Files:**
- Create: `src/hooks/useEditorSession.ts`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/hooks/useSlideStore.tsx`
- Verify: `tests/editorSession.test.mjs`
- Verify: `tests/slideCanvasProps.test.mjs`

- [ ] **Step 1: Add explicit store commit action(s)**

In `src/hooks/useSlideStore.tsx`, add an action for committing a fully prepared slide payload into the persisted presentation state, instead of using `UPDATE_SLIDE` as the live editing pipe.

- [ ] **Step 2: Implement `useEditorSession.ts`**

Responsibilities:
- own local draft for the current slide
- expose `draft`, `updateDraft`, and `flushDraft()`
- detect when the selected slide changes and rebuild the draft from persisted state
- keep track of whether the draft is ahead of persisted state

- [ ] **Step 3: Rewire `EditorLayout.tsx` to use the local draft**

Behavior:
- `SlideCanvas` receives the draft values, not `state.slides[currentSlideIndex]`
- `handleSlideChange` updates only the local draft during active editing
- `save`, `save as`, `go home`, `set current slide`, and presentation start call `flushDraft()` first

- [ ] **Step 4: Keep `SlideCanvas` render isolation strict**

Preserve the memo boundary and ensure parent-local preview updates do not remount or repaint the Excalidraw editor unless draft props actually change.

- [ ] **Step 5: Run the focused editor tests**

Run: `node --experimental-strip-types --test tests/editorSession.test.mjs tests/slideCanvasProps.test.mjs`
Expected: PASS.

### Task 4: Move all preview generation behind one shared background renderer

**Files:**
- Create: `src/lib/previewRenderer.ts`
- Modify: `src/hooks/useSlideThumbnails.ts`
- Modify: `src/hooks/useCameraThumbnails.ts`
- Modify: `src/App.tsx`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Verify: `tests/previewKeys.test.mjs`
- Verify: `tests/latestOnlyExecutor.test.mjs`
- Verify: `tests/cameraThumbnail.test.mjs`

- [ ] **Step 1: Build a shared preview renderer client**

Requirements:
- one hidden `preview-renderer` window
- one readiness handshake
- shared request/response transport for `slide` and `camera` preview jobs
- latest-only queueing per preview lane
- in-memory cache keyed by preview keys

- [ ] **Step 2: Migrate `useSlideThumbnails.ts`**

Behavior:
- no direct `exportToSvg()` in the editor webview
- only refresh when `slides` tab is visible
- current slide preview uses the local draft snapshot; other slides use persisted slide data

- [ ] **Step 3: Migrate `useCameraThumbnails.ts`**

Behavior:
- use the shared preview renderer
- only refresh when `cameras` tab is visible
- current slide camera previews use the local draft snapshot
- late/stale results are ignored cleanly

- [ ] **Step 4: Bootstrap the shared renderer window**

In `src/App.tsx` and `src-tauri/src/lib.rs`, replace split preview bootstraps with a single hidden `preview-renderer` window and matching ready events/commands.

- [ ] **Step 5: Run preview-related tests**

Run: `node --experimental-strip-types --test tests/previewKeys.test.mjs tests/latestOnlyExecutor.test.mjs tests/cameraThumbnail.test.mjs`
Expected: PASS.

### Task 5: Wire flush boundaries into save/navigation/presentation flows

**Files:**
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/hooks/useAutoSave.ts`
- Modify: `src/lib/tauriCommands.ts` (only if serialization changes are needed)
- Verify: `tests/editorSession.test.mjs`

- [ ] **Step 1: Flush before save and autosave**

Ensure manual save and autosave always persist the latest draft snapshot before writing `.is` files.

- [ ] **Step 2: Flush before navigation transitions**

Ensure draft commits occur before:
- switching slides
- starting preview/fullscreen presentation
- leaving the editor/home

- [ ] **Step 3: Keep dirty-state semantics correct**

Behavior:
- local draft edits should still mark the presentation as dirty
- a successful flush + save should clear dirty state
- switching slides should not drop unsaved local edits

- [ ] **Step 4: Run the focused editor-session suite again**

Run: `node --experimental-strip-types --test tests/editorSession.test.mjs tests/slideCanvasProps.test.mjs`
Expected: PASS.

### Task 6: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run the full targeted test suite**

Run: `node --experimental-strip-types --test tests/editorSession.test.mjs tests/previewKeys.test.mjs tests/slideCanvasProps.test.mjs tests/latestOnlyExecutor.test.mjs tests/cameraThumbnail.test.mjs tests/cameraUtils.test.mjs tests/sceneFingerprint.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Run Rust build/tests**

Run: `cd src-tauri && cargo build && cargo test`
Expected: PASS.

- [ ] **Step 4: Manual Tauri verification checklist**

Check:
- continuously type Chinese text in the editor and confirm no flash/stutter tied to preview updates
- stay on `cameras` tab and confirm preview refreshes do not repaint the editor
- stay on `slides` tab and confirm slide previews refresh after pause without blocking typing
- switch slides immediately after editing and confirm the last typed text is preserved
- save immediately after editing and confirm the saved file contains the latest text
