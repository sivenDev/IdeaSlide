---
id: "F073-05"
title: "Migrate Pages, UI, IO, Presentation, and Complete the SDK Rollout"
type: "feature"
status: "complete"
summary: "Migrate all non-Agent IdeaSketch commands onto the completed scene and Page services, then complete single-path rollout and final verification."
source: "docs/superplan/human/features.md"
created: "2026-09-02"
order: 73
depends_on: ["F073-04", "F066", "F065"]
parent: "F073"
---

# Migrate Pages, UI, IO, Presentation, and Complete the SDK Rollout Plan

**Goal:** Make every reusable non-Agent IdeaSketch command consume the unified SDK while preserving current UI behavior, persistence, presentation, and safe file boundaries.
**Scope:** Consume the canonical F073-03 Page service from current Page controls, then implement selection, view, Camera query/select/begin-create, transforms, public high-level events, Presentation sessions, serialize/export/import composites, and image-export dialog methods; consume the asset metadata service delivered by F073-02. Replace Page/Camera/Canvas React closures and `SlideCanvasCommandApi` implementations with thin trusted-UI adapters over the SDK, preserving existing controls, English feedback, read-only behavior, current-Page flushes, user-mediated dialogs, and capture-phase presentation keyboard handling. Complete final single-path rollout and whole-feature verification.
**Non-Goals:** This plan does not migrate Agent Tool schemas, expose arbitrary filesystem paths or asset writes, add document-level Undo, change UI layouts, change `.is v1`, make Presentation cross-Page, or delete legacy Agent compatibility.
**Architecture:** Page mutations use the document transaction coordinator inside the shared per-document mutation scheduler and never modify an existing Page scene; optional new-Page seed operations run on a detached clone before atomic reducer commit. Selection/view/presentation/IO are explicit non-scene-history services with snapshot/session ownership. The existing editor and drawer components retain rendering and feedback responsibilities but no longer implement validation or mutation rules. Serialize and export share one post-flush private projection; only trusted UI composites may invoke dialogs. Final rollout selects exactly one implementation per caller/namespace and may fall back only before a mutation attempt enters the scheduler.
**Baseline:** F073-03 is the required canonical Page/document service and F073-04 is the required Agent adapter. Current Page UI still calls `IdeaSketchEditor` closures, Camera drawing and canvas commands live in `SlideCanvas`, import/export helpers and formal conversion are separate modules, and Presentation is component-owned. These UI paths are individually tested but still use different error/result/lifecycle contracts and do not provide reusable SDK methods or events.
**Exit Criteria:** Every RFC v1 Page, Camera wrapper, selection, view, transform, event, Presentation, serialize/export/import, and image-dialog method is capability-gated and tested, and UI consumers use the F073-02 asset metadata service without widening its read-only scope. Page mutations flush the right active draft, honor complete document snapshots, preserve files/AppState/Camera order, retain at least one Page, select deterministically, mark dirty once, serialize against scene mutations, truthfully report no document Undo, and broadcast a bounded cross-caller document-commit event even when active Page does not change. UI behavior remains unchanged while all programmatic writes delegate to `scene.applyPlan()` or `pages.applyPlan()`. Presentation binds a post-flush active Page, stops before context change/dispose, cleans keyboard/fullscreen/timers, and never changes history. IO distinguishes content serialization, user cancellation, stale picker windows, desktop unavailability, and forbidden arbitrary paths. Real Presentation, picker, Camera preview, subscriptions, and unresolved commit state obey the session-disposal contract; picker and Camera composites own exactly one outer ledger request through their final canonical commit. Each earlier plan is completed and committed at its own boundary; after final single-path rollout, Workspace/Standalone save, recovery, external-conflict, full regression, packaging, and archive checks pass before F073 is marked done.

## Task 1: Migrate Page Controls to the Canonical Page Service

**Outcome:** Existing Page controls preserve their behavior while calling the already completed F073-03 Page service instead of owning document mutation rules.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/IdeaSketchNavigator.tsx`
- Modify: `src/components/PageOrganizer.tsx`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/ideaSketchNavigator.test.mjs`
- Modify: `tests/pageOrganizer.test.mjs`

**Change Map:**
- editor/navigator/organizer adapters: translate select/add/import/duplicate/rename/reorder/delete and selection-to-new-page intents into F073-03 calls, map `SdkResult` to current English feedback, and remove duplicate Page validation/mutation logic
- compatibility behavior: preserve F064 import, F065 adjacent full-clone duplicate, title/order/delete protection, active draft flush, deterministic selection, read-only availability, dirty/autosave, and no document-Undo claim
- lifecycle adapter: wire current Page selection to the F073-03 injected Presentation-stop/context-record hooks; Task 2 connects those records to the exclusive public dispatcher while preserving stop record → old token invalidation → context record ordering

**Verification:**
- `node --test tests/ideaSketchEditor.test.mjs tests/ideaSketchNavigator.test.mjs tests/pageOrganizer.test.mjs tests/ideaSketchSdkPages.test.mjs tests/ideaSketchSdkPageTransactions.test.mjs`
- Cases: every existing Page control calls one SDK method; no duplicated reducer/parse/seed validation remains in components; F064/F065 behavior, read-only state, pending draft, dirty/autosave, injected Page selection lifecycle ordering, and existing control placement remain unchanged.

- [x] Replace every Page UI closure with a thin F073-03 service adapter and result mapping.
- [x] Preserve import/duplicate/title/order/delete/selection/dirty/read-only behavior with no second document write path.
- [x] Connect Page selection to the canonical lifecycle hooks without defining a second public event dispatcher.

## Task 2: Add Selection, View, Camera Interaction, Transform, and Event Services

**Outcome:** Non-persistent editor state and trusted Camera interaction use typed snapshot-bound SDK services without exposing AppState or raw events, while asset metadata remains the read-only F073-02 service.
**Files:**
- Create: `src/lib/ideasketch-sdk/selectionViewService.ts`
- Create: `src/lib/ideasketch-sdk/transformsService.ts`
- Create: `src/lib/ideasketch-sdk/events.ts`
- Modify: `src/lib/ideasketch-sdk/capabilities.ts`
- Modify: `src/lib/ideasketch-sdk/cameraService.ts`
- Modify: `src/lib/cameraDrawing.ts`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/components/CameraBadgeOverlay.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Test: `tests/ideaSketchSdkSelectionView.test.mjs`
- Test: `tests/ideaSketchSdkEvents.test.mjs`
- Modify: `tests/cameraBadgeWiring.test.mjs`
- Modify: `tests/canvasSelectionActions.test.mjs`

**Change Map:**
- selection/view: identity-covered get/set/clear/focus/viewport summaries, live ref validation, and no snapshot-staleness or persistence from pan/zoom/selection changes
- Camera wrappers: list/select plus trusted pointer preview lifecycle compiling final creation to canonical scene operations under one outer request-ledger reservation
- transforms/events: explicit selection refs, current/new Page formal conversion, and the exclusive public subscription dispatcher for monotonic facade-wide context/document/scene/selection/availability/presentation sequences; it consumes internal lifecycle, document-commit, canonical scene-commit, and stable native-authoring records, broadcasts authorized document/scene records across caller facades on the active document, distinguishes SDK/native scene origins, terminalizes ledger results before dispatch, isolates subscriber failures, defers callback reentry until the frozen event batch completes, and owns required document-before-context switch ordering; UI reads asset metadata only through the existing bounded service

**Verification:**
- `node --test tests/ideaSketchSdkSelectionView.test.mjs tests/ideaSketchSdkEvents.test.mjs tests/cameraBadgeWiring.test.mjs tests/canvasSelectionActions.test.mjs tests/excalidrawViewportObservers.test.mjs`
- Cases: identity-only selection refs, mutation-readiness not widened, focus/read viewport without dirtying, explicit transform targets, Camera preview cancel/commit, monotonic event sequence, cross-caller non-active Page rename/reorder/add/delete document events, document-before-context ordering when a commit changes the active Page, canonical SDK and stable native-authoring scene events with distinct origins, no transient pointer/scroll event, throwing and multiple subscribers remain isolated, subscription changes affect the next batch, reentrant read/select/mutation runs after the full batch, the original terminal result remains queryable and unchanged, context switch invalidation, and no raw DOM/AppState/model/digest payload.

- [x] Implement typed selection, view, transform, Camera wrapper, and high-level event services.
- [x] Move trusted Camera preview completion onto the canonical scene transaction without persisting preview state.
- [x] Preserve viewport/selection responsiveness and non-dirty behavior while enforcing snapshot identity.

## Task 3: Implement Presentation and IO Session Boundaries

**Outcome:** Presentation and import/export operate from private post-flush snapshots with explicit sessions, cancellation, and cleanup semantics.
**Files:**
- Create: `src/lib/ideasketch-sdk/presentationService.ts`
- Create: `src/lib/ideasketch-sdk/ioService.ts`
- Modify: `src/lib/ideasketch-sdk/capabilities.ts`
- Modify: `src/components/PresentationMode.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/ideaSketchPageExport.ts`
- Modify: `src/lib/drawioExport.ts`
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src/lib/ideasketch-sdk/session.ts`
- Test: `tests/ideaSketchSdkPresentation.test.mjs`
- Test: `tests/ideaSketchSdkIo.test.mjs`
- Modify: `tests/ideaSketchSdkSession.test.mjs`
- Modify: `tests/presentationMode.test.mjs`
- Modify: `tests/ideaSketchPageExport.test.mjs`

**Change Map:**
- Presentation service: post-flush active-Page snapshot, owned session ids, Camera navigation, idempotent stop, boundary no-op behavior, stopped-before-context-change events, and disposal/fullscreen/keyboard/timer cleanup; busy native pointer/text/IME/history interaction refuses to create the private snapshot or start a session
- IO service: shared post-flush private serialization projections, trusted user-mediated exports/pick-import, image-export dialog, in-flight deduplication, cancellation/stale/desktop-unavailable classification, and no arbitrary path input; busy native interaction refuses private/document snapshots before picker or serialization starts; pick-import reserves the outer request before opening the picker and passes only a host-issued reserved-request handle into the final Page coordinator
- integrated disposal: stop owned Presentation and emit `stopped` before unsubscribe, cancel or safely join Camera preview and picker work, preserve an active facade when cleanup cannot finish, retain indeterminate ledger state without replay, and ensure rebuilt sessions inherit no old tokens, ledger entries, subscriptions, or scopes
- component adapters: render existing Preview/Fullscreen behavior and dialogs from SDK state while keeping presentation keyboard events in capture phase

**Verification:**
- `node --test tests/ideaSketchSdkPresentation.test.mjs tests/ideaSketchSdkIo.test.mjs tests/ideaSketchSdkSession.test.mjs tests/presentationMode.test.mjs tests/ideaSketchPageExport.test.mjs tests/ideaSketchPageExportWiring.test.mjs`
- Cases: current-Page-only start, Camera session snapshot, next/previous bounds, foreign/expired ids, stop/dispose/context-switch ordering, zero-Camera viewport, cancellation/no write, picker stale during wait, exact bytes, dialog availability, distinct `desktop_unavailable` versus `editor_unavailable`, and no history/dirty changes; pointer transform/native text/IME/history busy state issues no Presentation/export/document/private snapshot; duplicate Camera/picker request joins one interaction and one ledger record, payload collision rejects, nested canonical commit creates no second record, commit-after-cancel returns the committed outer result, outer reconciliation handles indeterminate commit; uncooperative picker cleanup, active preview, cleanup failure, stopped-before-unsubscribe, and clean session rebuild lifecycle.

- [x] Implement Presentation sessions and cleanup/event ordering over post-flush active-Page snapshots.
- [x] Implement serialize/export/import/image-dialog methods with shared projections and user-mediated boundaries.
- [x] Preserve current Presentation and export behavior while removing raw command ownership from components.

## Task 4: Convert Remaining Canvas and UI Commands into Thin SDK Adapters

**Outcome:** Camera, Canvas, transform, presentation, and IO controls keep their current UI but delegate reusable behavior to one facade after Page controls have already migrated.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/components/IdeaSketchClearCanvasDialog.tsx`
- Modify: `src/components/IdeaSketchDrawerCommands.tsx`
- Modify: `src/components/IdeaSketchNavigator.tsx`
- Modify: `src/components/CameraList.tsx`
- Modify: `src/lib/slideCanvasProps.ts`
- Test: `tests/ideaSketchEditor.test.mjs`
- Test: `tests/ideaSketchDrawer.test.mjs`
- Test: `tests/ideaSketchNavigator.test.mjs`
- Test: `tests/slideCanvasProps.test.mjs`

**Change Map:**
- `SlideCanvasCommandApi`: retain temporary compatibility shape only as a facade-backed adapter; remove independent validation/mutation implementations
- editor/navigator/drawer: call SDK scene/Camera/transform/presentation/IO services, map `SdkResult` to existing English feedback, and preserve read-only/availability/control placement; Page controls remain owned by Task 1
- ownership audit: every current React closure and raw Excalidraw method from the RFC classification matrix has exactly one public, adapter-only, or host-internal destination

**Verification:**
- `node --test tests/ideaSketchEditor.test.mjs tests/ideaSketchDrawer.test.mjs tests/ideaSketchNavigator.test.mjs tests/slideCanvasProps.test.mjs tests/excalidrawWorkspaceImport.test.mjs tests/ideaSketchPageExportWiring.test.mjs`
- `npm run build`
- Tauri smoke: Page lifecycle, Camera lifecycle, selection conversion, clear confirmation, background, Preview/Fullscreen, import, every active-Page export, cancel paths, save/reopen, recovery, and external-change conflict behavior.

- [x] Replace duplicated UI command logic with thin trusted-UI SDK calls and result mapping.
- [x] Complete the RFC current-interface ownership matrix with no component-owned public write rule.
- [x] Verify UI placement and behavior stay stable across editable, read-only, busy, unavailable, and cancelled states.

## Task 5: Complete Single-path Rollout and Final F073 Verification

**Outcome:** The unified SDK becomes the sole programmatic IdeaSketch implementation, with safe pre-commit fallback and complete delivery evidence.
**Files:**
- Create: `src/lib/ideasketch-sdk/rollout.ts`
- Modify: `src/lib/ideasketch-sdk/index.ts`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/lib/slideCanvasProps.ts`
- Create: `tests/ideaSketchSdkRollout.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`
- Modify: `tests/ideaSketchAgentProtocol.test.mjs`
- Modify: `tests/agentDirectEditorContract.test.mjs`
- Modify: `tests/editorSession.test.mjs`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F073-unified-ideasketch-jssdk/F073-05-pages-ui-io-presentation-and-rollout.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- rollout: select one implementation per caller/namespace, record bounded diagnostics, prohibit mixed old/new commits, and allow compatibility fallback only before mutation scheduling with no `.is` data migration
- ownership audit: eliminate independent validation/normalize/build/commit logic from `SlideCanvasCommandApi`, React closures, Agent builders, and legacy adapters; raw Excalidraw APIs remain host-internal
- final evidence: verify the complete protocol/operation matrix, native Undo and Page-history truthfulness, Workspace/Standalone persistence, save/reopen, recovery/external conflicts, session disposal/Presentation cleanup, IO cancellation, and rollback/fallback behavior
- progress: F073-01 through F073-04 must already be complete with separate implementation commits; complete F073-05, then mark F073 done and create the separate final F073-05 delivery commit without `.codebase-memory` artifacts

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native disposable Workspace and Standalone `.is` matrix: UI and Agent v1/v2 reads/mutations, text/binding/Camera/delete/Page/Presentation/IO flows, native Undo/Redo, Page no-false-Undo, autosave/recovery/external conflict, cancellation/dispose, save/reopen archive inspection, and pre-commit fallback selection.

- [x] Prove each caller/namespace selects exactly one write implementation and fallback never follows scheduling or a partial/indeterminate commit.
- [x] Run the complete automated/build/native matrix and repair every F073 regression.
- [x] Inspect saved archives and final ownership, complete F073-05 and F073 progress/index, and create the separate final implementation commit.

## Delivery Evidence

- `node --test --test-concurrency=1 tests/*.test.mjs` passed 687/687, including the F073 SDK, UI, IO, Presentation, session, Agent, persistence, recovery, and drag regressions.
- `npm run build` passed; Vite emitted only the existing mixed-import and large-chunk advisories.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed 180/180; `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` completed with existing dead-code/argument-count warnings.
- `npm run tauri build -- --debug --bundles app --no-sign` passed and produced `IdeaNote.app` plus `IdeaNote.app.tar.gz`. The full signed debug bundle also compiled and produced `.app`, `.dmg`, and updater `.tar.gz` before stopping because this environment has no `TAURI_SIGNING_PRIVATE_KEY`; no source or packaging configuration was changed.
- `git diff --check` passed. `cargo fmt --check` remains blocked by pre-existing formatting differences in unrelated Rust files (`commands.rs`, `lib.rs`, `recent_files.rs`, and `update_fallback.rs`); no unrelated formatting was applied.
- Final ownership inspection confirms UI/Agent writes route through the canonical SDK scene/Page services, with no `.codebase-memory` artifacts included in the delivery commit.

## References
- `docs/superplan/human/features.md#F073`
- `docs/superplan/rfcs/F073.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/features/F003-canvas-presentation-controls.md`
- `docs/superplan/plans/features/F017-convert-excalidraw-selection-to-clean-diagram-style.md`
- `docs/superplan/plans/features/F064-import-excalidraw-files-into-ideasketch.md`
- `docs/superplan/plans/features/F065-duplicate-pages-from-pages-list.md`
- `docs/superplan/plans/features/F066-add-ideasketch-excalidraw-and-is-page-export-actions.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/PresentationMode.tsx`
- `src/lib/ideaSketchReducer.ts`
