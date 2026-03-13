# Excalidraw Image Media Persistence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable image insertion (built-in + paste file) in Excalidraw and persist image binaries inside `.is` zip `media/` with reliable reopen/edit/save behavior.

**Architecture:** Keep Excalidraw scene JSON in `slides/*.json` and store binary image payloads separately under `media/`. Extend frontend slide state to retain `files`, add a conversion layer (`files <-> media[]`) in `tauriCommands`, and extend Rust `file_format` read/write to handle media + safety validation + compatibility fallback. Preserve atomic writes and current auto-save flow.

**Tech Stack:** React 19 + TypeScript, Excalidraw 0.18, Tauri v2 invoke bridge, Rust (`zip`, `serde_json`)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Modify | Add `files` on `Slide` for Excalidraw binary file map |
| `src/hooks/useSlideStore.tsx` | Modify | Persist `files` in reducer; dirty tracking includes file changes |
| `src/components/EditorLayout.tsx` | Modify | Accept `files` from canvas and include in slide update fingerprinting |
| `src/components/SlideCanvas.tsx` | Modify | Pass `initialData.files`; propagate `files` in `onChange` |
| `src/components/PresentationMode.tsx` | Modify | Ensure presentation rendering path also receives slide `files` |
| `src/lib/tauriCommands.ts` | Modify | Convert frontend slide/files to IPC `media[]` and back; filter by used image fileIds |
| `src-tauri/src/file_format.rs` | Modify | Extend `IsFileData`, write/read `media/index.json` + `media/*`, validate id/ext, add tests |
| `src-tauri/src/commands.rs` | Modify | Keep command signatures aligned with extended `IsFileData` |
| `docs/superpowers/specs/2026-03-13-excalidraw-image-media-design.md` | Reference | Approved spec to follow |

---

## Chunk 1: Frontend State and Canvas Data Flow

### Task 1: Extend `Slide` model to carry Excalidraw files

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src/hooks/useSlideStore.tsx`

- [ ] **Step 1: Write failing TypeScript usage first**

Add temporary compile-checked usage in reducer and conversion code that references `slide.files` before type update.

Expected compile error: `Property 'files' does not exist on type 'Slide'`.

- [ ] **Step 2: Run build to verify failure**

Run: `npm run build`
Expected: TypeScript failure mentioning missing `files` on `Slide`.

- [ ] **Step 3: Add minimal type changes**

Update `Slide`:
```ts
export interface Slide {
  id: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
}
```

Initialize `files: {}` in exact creation points:
- `src/hooks/useSlideStore.tsx` initial state
- `src/hooks/useSlideStore.tsx` `ADD_SLIDE`
- `src/lib/tauriCommands.ts` `createNewPresentation`
- `src/lib/tauriCommands.ts` `convertFromIsFileData` fallback path

- [ ] **Step 4: Re-run build to verify pass**

Run: `npm run build`
Expected: Build passes or fails only on not-yet-implemented downstream steps (no `Slide.files` type errors).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/lib/tauriCommands.ts src/hooks/useSlideStore.tsx
git commit -m "feat: add files field to slide state model"
```

---

### Task 2: Wire files through editor and presentation rendering paths

**Files:**
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/PresentationMode.tsx`
- Modify: `src/hooks/useSlideStore.tsx`

- [ ] **Step 1: Create deterministic failing type mismatch**

First change `SlideCanvasProps.onChange` to accept third `files` argument while keeping `EditorLayout.handleSlideChange` unchanged.

Expected compile error: callback signature mismatch at `SlideCanvas` call site.

- [ ] **Step 2: Run build to verify failure**

Run: `npm run build`
Expected: Type mismatch involving `onChange` arity.

- [ ] **Step 3: Implement minimal data flow changes**

1. Update `SlideCanvasProps.onChange`:
```ts
onChange: (elements: readonly any[], appState: Partial<any>, files: Record<string, any>) => void;
```
2. In `<Excalidraw initialData>`, pass `files`.
3. In `stableOnChange`, forward `files`.
4. Update `EditorLayout.handleSlideChange` and reducer payload to include `files`.
5. Reducer stores `files` into updated slide.
6. In `PresentationMode`, pass `currentSlide.files ?? {}` into `SlideCanvas` so images render in presentation mode too.

- [ ] **Step 4: Re-run build and verify**

Run: `npm run build`
Expected: No callback signature/type errors; app builds.

- [ ] **Step 5: Commit**

```bash
git add src/components/SlideCanvas.tsx src/components/EditorLayout.tsx src/components/PresentationMode.tsx src/hooks/useSlideStore.tsx
git commit -m "feat: propagate excalidraw files through editor and presentation flow"
```

---

### Task 3: Add dirty detection that includes file changes

**Files:**
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/hooks/useSlideStore.tsx`

- [ ] **Step 1: Add executable failing check**

Create a pure helper in `EditorLayout.tsx` for fingerprints and add a temporary assertion block (dev-only) proving that changing only `files` currently does not alter dirty status.

Expected result before fix: assertion fails for image-only change case.

- [ ] **Step 2: Implement minimal fingerprint extension**

Add:
- `buildFilesFingerprint(files)` using sorted `(id,mimeType,size)` tuples
- combined dirty predicate = element fingerprint OR files fingerprint changed
- `lastFilesFingerprintRef` reset when `currentSlideIndex` changes (same as element fingerprint reset)

- [ ] **Step 3: Verify with manual run**

Run: `npm run dev`
Expected: inserting/pasting image marks document dirty and triggers auto-save.

- [ ] **Step 4: Build verification**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/components/EditorLayout.tsx src/hooks/useSlideStore.tsx
git commit -m "fix: include file metadata in dirty detection"
```

---

## Chunk 2: Frontend Conversion Layer (`files <-> media[]`)

### Task 4: Implement `usedFileIds` extraction, ext mapping, and save conversion

**Files:**
- Modify: `src/lib/tauriCommands.ts`

- [ ] **Step 1: Write deterministic failing checks in conversion helpers**

Add temporary table-driven checks (dev-only assertions) for:
- unreferenced file IDs should be excluded
- unknown mimeType should not emit invalid ext

Expected result before fix: assertions fail.

- [ ] **Step 2: Implement minimal extraction logic**

Add helpers in `src/lib/tauriCommands.ts`:
```ts
function collectUsedFileIds(slides: Slide[]): Set<string>
function extFromMimeType(mimeType: string): string | null
```
Rules:
- `usedFileIds` = union of all `elements` where `el.type === "image"` and valid `el.fileId`.
- Build `media[]` only from `usedFileIds`.
- Trim each slide `content.files` to `usedFileIds`.
- `extFromMimeType` only maps whitelist: `png`, `jpg/jpeg`, `gif`, `webp`, `svg`.
- Unsupported mimeType on a referenced image: fail conversion and surface save error (do not silently skip referenced media).

- [ ] **Step 3: Implement media-unchanged short-circuit (spec-required)**

In conversion layer, compute stable media key from sorted `usedFileIds + (id,mimeType,size)`.
If unchanged from previous conversion run, skip repeated media re-encoding work (do not change backend full-write behavior).

- [ ] **Step 4: Add soft-limit warnings**

In conversion path, compute:
- single media > 10MB -> warn
- total media > 100MB -> warn

Use non-blocking warning path (no throw).

- [ ] **Step 5: Build verification**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tauriCommands.ts
git commit -m "feat: serialize referenced image media with whitelist mapping and short-circuit"
```

---

### Task 5: Implement open conversion to restore Excalidraw files

**Files:**
- Modify: `src/lib/tauriCommands.ts`

- [ ] **Step 1: Create failing restore checks**

Add temporary checks for these cases:
1. `media[]` present but `files` not reconstructed -> images missing.
2. `content.files` absent -> must become `{}`.
3. image element references missing media -> skip that file entry and continue loading slide.

Expected result before fix: at least one check fails.

- [ ] **Step 2: Implement minimal restore path**

During `convertFromIsFileData`:
- build media lookup by `id`
- reconstruct per-slide `files` entries with Excalidraw-required fields (`id`, `mimeType`, payload field for Excalidraw 0.18)
- ensure every returned `Slide` includes `files: {}` fallback
- when media missing/corrupt for a referenced ID: skip that file entry, do not fail full load

- [ ] **Step 3: Build verification**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`
Expected: previously saved images render after reopen and remain editable.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauriCommands.ts
git commit -m "feat: restore excalidraw files from persisted media on open"
```

---

## Chunk 3: Rust Zip Media IO, Safety, and Compatibility

### Task 6: Extend Rust data structures and add failing tests first

**Files:**
- Modify: `src-tauri/src/file_format.rs`

- [ ] **Step 1: Add failing tests before implementation**

Add tests:
- `test_roundtrip_with_media`
- `test_compat_without_media_dir`
- `test_reject_illegal_media_id_or_ext`

For illegal path test, use IDs/ext containing `/`, `..`, or unsupported ext and expect `Err(...)`.

- [ ] **Step 2: Run Rust tests to verify failure**

Run: `cd src-tauri && cargo test file_format -- --nocapture`
Expected: new tests fail because `media` handling/validation is not implemented.

- [ ] **Step 3: Commit failing tests**

```bash
git add src-tauri/src/file_format.rs
git commit -m "test: add failing media persistence and validation tests"
```

---

### Task 7: Implement `media/index.json` write/read + validation

**Files:**
- Modify: `src-tauri/src/file_format.rs`
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Implement minimal structures and validators**

Add structs with camelCase serde alignment:
```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaEntry {
    pub id: String,
    pub mime_type: String,
    pub ext: String,
    pub bytes_base64: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaIndexItem {
    id: String,
    mime_type: String,
    ext: String,
    path: String,
}
```

Add validators:
- `id`: `[A-Za-z0-9_-]+`
- `ext`: whitelist (`png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`)

- [ ] **Step 2: Implement write path**

In `write_is_file`:
1. validate all entries
2. write `media/index.json`
3. decode `bytesBase64` and write `media/{id}.{ext}`

- [ ] **Step 3: Implement read path + compatibility fallback**

In `read_is_file`:
1. try `media/index.json`
2. if missing, scan `media/` entries and infer id/ext conservatively
3. apply same id/ext validators in both index and fallback paths
4. validate `path` integrity for index items (`path == media/{id}.{ext}`), reject traversal/absolute/mismatch values
5. return `media[]` in `IsFileData`

- [ ] **Step 4: Run tests and fix until green**

Run: `cd src-tauri && cargo test file_format -- --nocapture`
Expected: media tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/file_format.rs src-tauri/src/commands.rs
git commit -m "feat: persist media files and index in is zip format"
```

---

### Task 8: Add corruption-resilience test and finalize backend behavior

**Files:**
- Modify: `src-tauri/src/file_format.rs`

- [ ] **Step 1: Add failing corruption-resilience tests**

Add tests for concrete cases:
- `test_skip_missing_media_file_from_index` (index points to missing `media/{id}.{ext}`)
- `test_skip_unreadable_media_entry` (zip entry read failure/corrupt payload simulation)
- `test_handle_invalid_media_index_item` (bad item in index)
- `test_fallback_when_media_index_json_malformed` (invalid `media/index.json` JSON)

Expected behavior: keep slides readable and skip only broken media entries where safe; malformed index should fall back to `media/` scan (or empty media with warning if scan unavailable).

- [ ] **Step 2: Run tests to verify fail**

Run: `cd src-tauri && cargo test file_format -- --nocapture`
Expected: new resilience tests fail before handling is implemented.

- [ ] **Step 3: Implement minimal resilience logic**

In read path:
- if one media item fails validation/read/decode, log and continue
- do not fail entire file unless manifest/slides are unreadable

- [ ] **Step 4: Re-run tests**

Run: `cd src-tauri && cargo test file_format -- --nocapture`
Expected: all `file_format` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/file_format.rs
git commit -m "fix: tolerate per-media corruption during archive load"
```

---

## Chunk 4: End-to-End Integration and Verification

### Task 9: End-to-end save/open validation in app

**Files:**
- Modify: `src/lib/tauriCommands.ts` (only if final wiring tweaks are required)
- Modify: `src/components/SlideCanvas.tsx` (only if Excalidraw field alignment tweaks are required)

- [ ] **Step 1: Run frontend + backend build checks**

Run:
- `npm run build`
- `cd src-tauri && cargo test`

Expected: both pass.

- [ ] **Step 2: Manual E2E checklist**

Run: `npm run tauri dev`

Validate:
1. Insert image from Excalidraw UI -> save -> reopen -> image renders.
2. Paste image file -> auto-save -> reopen -> image persists.
3. Same image on 2 slides -> zip has one media file for that id.
4. Delete image elements -> save -> unreferenced media removed.
5. Old `.is` without `media/` opens and resaves successfully.
6. Prepare one archive with broken media entry -> app opens slides and only broken image is degraded.
7. Trigger size thresholds (>10MB single, >100MB total) -> non-blocking warnings appear and warning text explicitly states autosave/performance may slow down.

- [ ] **Step 3: Capture deterministic zip-level verification**

For one saved `.is`, verify:
- `media/index.json` exists.
- Every `media/index.json` item has a matching `media/{id}.{ext}` file.
- Union of `image.fileId` in all `slides/*.json` equals IDs in `media/index.json` (no extras, no missing).

- [ ] **Step 4: Commit only if Chunk 4 introduced new fixes**

If Step 2/3 required additional code changes, commit those files only.

```bash
git add src/lib/tauriCommands.ts src/components/SlideCanvas.tsx src-tauri/src/file_format.rs
git commit -m "fix: finalize image media persistence e2e wiring"
```

If no code changes were needed in Chunk 4, skip commit.

---

## Notes for Implementers

- Keep changes scoped to requested feature; avoid unrelated refactors.
- Preserve existing patterns (simple reducer updates, direct conversion helpers).
- If Excalidraw `files` contract differs at runtime, align to Excalidraw 0.18 behavior before completion.
- Preserve atomic save semantics in Rust (`.is.tmp` + rename).
