---
id: "B057"
title: "Restore IdeaSketch Page rename, duplicate, and delete actions"
type: "bugfix"
status: "draft"
summary: "Allow trusted editor Page actions to mutate the in-memory document while preserving read-only and Agent safety gates."
source: "docs/superplan/human/bugs.md"
created: "2026-09-04"
order: 57
depends_on: ["F073-05"]
parent: ""
---

# Restore IdeaSketch Page Actions Plan

**Goal:** Make the Page row's Rename, Copy, and Delete actions work for every editor state in which the existing IdeaSketch editor remains intentionally in-memory editable.
**Scope:** Align trusted-UI SDK writability and Page/scene mutation guards with the editor's in-memory editable status set (`editable`, `external-change`, `conflict`, `missing`, and `root-missing`), while keeping protected/read-only/unsupported/error states non-mutating. Preserve the canonical `pages.applyPlan()` path, deterministic active-Page selection, dirty/recovery behavior, and no silent filesystem overwrite.
**Non-Goals:** Do not add a reducer bypass, change Page button layout or labels, alter filesystem conflict resolution, make Agent callers mutate conflicted documents, or change autosave eligibility.
**Architecture:** Add one shared SDK target-writability predicate that distinguishes trusted editor in-memory mutation from Agent/external callers and persistable `editable` state. Use it for capability projection, context writability, Page transactions, and scene transactions so advertised operations and runtime guards agree.
**Baseline:** `PageOrganizer` emits all three button callbacks correctly, and the canonical Page service succeeds for `documentStatus: "editable"`. When the editor is `external-change` or `conflict`, `IdeaSketchEditor` still renders the controls because `readOnly` is false, but `targetAvailability()` marks the SDK non-writable; `pages.applyPlan()` therefore rejects every Page operation as unavailable before commit. Existing native editor and app-store paths intentionally allow in-memory edits in these statuses.
**Reproduction:** Open an IdeaSketch file that is in `external-change` or `conflict` while the editor remains writable, open the IdeaSketch Pages drawer, and click Rename, Copy, or Delete on a Page row. Expected: the title changes, an adjacent cloned Page is created and selected, or the selected Page is removed. Actual: no visible change; the SDK logs `The Page plan contains an operation unavailable to this caller.`
**Root Cause:** SDK writability is hard-coded to `documentStatus === "editable"` in capability projection and Page/scene transaction guards, while `EditorLayout` and `appStoreReducer` treat several external-file states as in-memory editable. The UI exposes the controls but every canonical SDK mutation is rejected before reaching the reducer commit adapter.
**Exit Criteria:** In-memory editable statuses allow trusted-UI Page rename, duplicate, reorder, add, and delete through `pages.applyPlan()`; protected statuses and non-trusted Agent callers remain unable to mutate; context/capability reports match runtime behavior; Page row actions visibly update the model and active selection; focused SDK/UI regressions and the production build pass.

## Task 1: Align SDK writability with editor in-memory editing

**Outcome:** The SDK exposes and enforces one consistent trusted-editor writability policy without opening Agent or protected document mutation paths.
**Files:**
- Create: `src/lib/ideasketch-sdk/documentWritability.ts`
- Modify: `src/lib/ideasketch-sdk/host.ts`
- Modify: `src/lib/ideasketch-sdk/context.ts`
- Modify: `src/lib/ideasketch-sdk/pagesService.ts`
- Modify: `src/lib/ideasketch-sdk/sceneService.ts`

**Change Map:**
- `documentWritability.ts`: centralize the in-memory editable status set and caller-aware target predicate.
- `host.ts` / `context.ts`: project `available.writable`, operation kinds, and context `writable` from the same predicate used by trusted UI.
- `pagesService.ts` / `sceneService.ts`: replace status equality guards in preflight, final validation, and destructive confirmation with the shared predicate.

**Verification:**
- `node --test tests/ideaSketchSdkPageTransactions.test.mjs tests/ideaSketchSdkSceneTransactions.test.mjs tests/ideaSketchSdkBoundaryReview.test.mjs`
- Assert trusted UI can mutate an `external-change` or `conflict` target in memory, while `agent-v2`, read-only, and protected targets remain rejected and capability projections do not advertise writes for those callers.

- [ ] Add the shared status/caller writability predicate and use it at every SDK mutation boundary.
- [ ] Preserve explicit `services.writable: false`, native-interaction busy checks, snapshot checks, and filesystem save restrictions.

## Task 2: Add behavior-level regressions for the Page controls

**Outcome:** The reported Rename, Copy, and Delete behavior is covered through the canonical host path and the editor wiring remains adapter-only.
**Files:**
- Modify: `tests/ideaSketchSdkPageTransactions.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/pageOrganizer.test.mjs`

**Change Map:**
- Page transaction harness: exercise all three operations against an in-memory external/conflict document and verify model/active-page outcomes.
- Editor/organizer source contracts: keep the three callbacks wired to the SDK-backed handlers and prevent a direct reducer fallback from being introduced.

**Verification:**
- `node --test tests/ideaSketchSdkPageTransactions.test.mjs tests/ideaSketchEditor.test.mjs tests/pageOrganizer.test.mjs`
- `npm run build`
- Verify Rename commits the trimmed title, Copy creates a full adjacent clone and selects it, Delete preserves at least one Page and selects deterministically, and no direct Page reducer path is added to the UI handlers.

- [ ] Add the external-change/conflict lifecycle regression and protected-caller assertions.
- [ ] Run focused tests and the TypeScript/Vite production build.

## References
- `docs/superplan/human/bugs.md#B057`
- `docs/superplan/plans/features/F073-unified-ideasketch-jssdk/F073-05-pages-ui-io-presentation-and-rollout.md`
- `src/lib/appStoreReducer.ts`
- `src/components/EditorLayout.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/PageOrganizer.tsx`
