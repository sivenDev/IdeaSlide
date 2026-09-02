---
id: "B056"
title: "Retain the Update Notice after Download Cancellation"
type: "bugfix"
status: "draft"
summary: "Keep a cancelled or interrupted update actionable instead of persisting it as dismissed."
source: "docs/superplan/human/bugs.md"
created: "2026-09-02"
order: 56
depends_on: ["F072"]
parent: ""
---

# Retain the Update Notice after Download Cancellation Plan

**Goal:** Ensure cancelling or interrupting an update download does not hide the same available version after restart.
**Scope:** Change the update notice dismissal boundary so the close/dismiss action cannot persist while a package is downloading, retain the known update as retryable after an interrupted download, add behavior-level regressions, and publish the repaired client as `v0.9.10` with the existing signed proxy-first updater workflow.
**Non-Goals:** Do not change version comparison, update endpoint ordering, signing keys, package formats, automatic installation, Save / Discard / Cancel exit protection, or the official fallback policy.
**Architecture:** Keep `AppUpdateController` as the owner of update lifecycle and version-scoped dismissal. A download-in-progress is an active operation rather than a dismissible notice: the UI disables its close action, and any interrupted download must leave the known `availableVersion` and `retryAction` intact. Only an explicit close while the notice is not downloading writes the version-scoped local-storage dismissal key.
**Baseline:** `v0.3.6` checks only the official GitHub manifest. `AppUpdateNotice` leaves its close button active during `downloading`, while `AppUpdateController.dismiss()` always stores `availableVersion` in `localStorage`. On restart, the same `0.3.8` manifest is marked `dismissed`, so the full notice is hidden; if GitHub is unreachable, no update state is rendered at all.
**Reproduction:** On an installed older build, wait for `0.3.8` to appear, start `Download update`, click the notice close/cancel affordance, and restart. The same update no longer appears as a full actionable notice because `ideanote.dismissed-update-version` contains `0.3.8`.
**Root Cause:** The only close affordance is wired to persistent dismissal even while a download is active; cancellation and “ignore this version” are not distinct lifecycle states.
**Exit Criteria:** Closing the notice during download cannot persist dismissal; an interrupted download keeps the available version and exposes retry/download again; an explicit dismissal outside an active download still persists and can be restored; a fresh `v0.9.10` release publishes complete signed official and proxy manifests and supported updater packages.

## Task 1: Separate Active Download State from Persistent Dismissal

**Outcome:** The update controller and notice no longer treat an in-progress download as an ignored version, and interrupted downloads remain actionable.
**Files:**
- Modify: `src/lib/appUpdates.ts`
- Modify: `src/components/AppUpdateNotice.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/WorkspaceSidebar.tsx`
- Modify: `src/hooks/useAppUpdate.ts`

**Change Map:**
- `AppUpdateController.dismiss`: reject dismissal while `phase === "downloading"` (and preserve existing persistence for explicit non-active dismissal).
- `AppUpdateNotice`: disable or relabel the close affordance while downloading so it cannot be mistaken for “ignore this version”.
- update prop wiring: keep one lifecycle callback and retain the known update/error state after a cancelled or failed transfer.

**Verification:**
- `node --test tests/appUpdates.test.mjs tests/appUpdateUi.test.mjs tests/workspaceSidebar.test.mjs`
- `npm run build`

- [ ] Prevent dismissal persistence during an active download.
- [ ] Preserve retryable update state after an interrupted download.
- [ ] Keep explicit non-downloading dismissal and restore behavior unchanged.

## Task 2: Add Regression Coverage for Restart-Visible Updates

**Outcome:** Tests prove the reported sequence no longer loses the update and that the compact restore path remains version-scoped.
**Files:**
- Modify: `tests/appUpdates.test.mjs`
- Modify: `tests/appUpdateUi.test.mjs`
- Modify: `tests/workspaceSidebar.test.mjs`

**Verification:**
- `node --test tests/appUpdates.test.mjs tests/appUpdateUi.test.mjs tests/workspaceSidebar.test.mjs`
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`

- [ ] Reproduce download-start plus close/cancel and assert no dismissed version is stored.
- [ ] Assert the same available version is shown again after a fresh controller check.
- [ ] Assert explicit dismissal still renders the compact `Update` restore action.

## Task 3: Publish and Verify `v0.9.10`

**Outcome:** The repaired client is versioned, pushed, and published with complete signed updater assets.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B056-retain-update-notice-after-download-cancel.md`
- Modify: `docs/superplan/plans/README.md`

**Verification:**
- `npm run build`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo build`
- `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/release.yml`
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- Push `v0.9.10`, monitor GitHub Actions, and verify the public release contains Windows x86_64, macOS Apple Silicon, macOS Intel, `latest.json`, and `latest-cn.json` with matching versions/signatures and exact proxy URL prefixes.
- `git diff --check`

- [ ] Set all application/package versions to `0.9.10` without changing updater keys.
- [ ] Publish and verify the signed release assets and both manifests.
- [ ] Record final evidence, mark B056 and this plan complete, and create the task delivery commit.

## References
- `docs/superplan/human/bugs.md#B056`
- `docs/superplan/plans/features/F056-automatic-desktop-updates-from-github-releases.md`
- `docs/superplan/plans/features/F072-prefer-gh-proxy-update-downloads-with-official-fallback.md`
- `src/lib/appUpdates.ts`
- `src/components/AppUpdateNotice.tsx`
- `src/components/WorkspaceSidebar.tsx`
- `src/hooks/useAppUpdate.ts`
