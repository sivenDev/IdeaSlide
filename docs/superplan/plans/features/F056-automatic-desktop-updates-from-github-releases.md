---
id: "F056"
title: "Add Automatic Desktop Updates from GitHub Releases"
type: "feature"
status: "in_progress"
summary: "Publish signed GitHub Release updater artifacts and guide users through a safe ChatGPT-style in-app update flow."
source: "docs/superplan/human/features.md"
created: "2026-08-12"
order: 71
depends_on: ["B003", "F046-01", "F048", "F055"]
parent: ""
---

# Add Automatic Desktop Updates from GitHub Releases Plan

**Goal:** Let supported IdeaNote desktop installations discover, download, install, and restart into a newer signed GitHub tag release without requiring users to find and reinstall the application manually.
**Scope:** Add a stable-channel Tauri v2 updater for the existing Windows x86_64, macOS Apple Silicon, and macOS Intel builds. A successful published `v*` GitHub tag release must contain signed updater bundles plus one complete `latest.json` manifest and become visible to installed clients only after all three targets pass. The main native window checks on startup and through a bounded foreground refresh cadence. When a newer version exists, the lower-left Workspace sidebar shows a restrained ChatGPT-style update card immediately above Settings; dismissing that card retains a compact `Update` action to the right of Settings for that version. The interaction exposes available-version notes, download progress, ready-to-restart, deferred restart, retryable failure, and installation states. Browser builds and the hidden preview renderer remain inert. Installing is always user-initiated, and the final install/restart path reuses IdeaNote's existing Save / Discard / Cancel exit safeguard before any platform can terminate the process.
**Non-Goals:** This feature does not add background silent installation, a custom push-notification server, beta/nightly channels, downgrades, delta patches, Linux packages, App Store or Microsoft Store distribution, release creation from branches, automatic tag creation, an updater preference toggle, a second Settings page, or replacement of Apple/Windows code-signing and notarization. It does not make historical releases update-capable, because the currently published assets have no updater signatures or `latest.json`. It does not commit the updater private key, print it in logs, upload it as an artifact, weaken HTTPS/signature checks, or let updater code bypass document recovery and external-change protections.
**Architecture:** Treat update delivery as a high-risk supply-chain and process-lifecycle boundary. Use the maintained `tauri-plugin-updater` and `tauri-plugin-process` plugins rather than custom download/install code. `src-tauri/tauri.conf.json` owns the stable GitHub `releases/latest/download/latest.json` endpoint and one long-lived updater public key; GitHub Actions owns the matching private key only through `TAURI_SIGNING_PRIVATE_KEY` and optional `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets. Tauri's bundle layer emits updater artifacts and minisign signatures. The release stays draft while matrix jobs upload assets; a final publish job downloads and validates `latest.json`, signatures, SemVer, and the `windows-x86_64`, `darwin-aarch64`, and `darwin-x86_64` entries before atomically publishing the release. The application uses a small injectable update client plus a pure lifecycle state machine so native resources and progress events can be tested without network access. `useAppUpdate` owns startup/hourly checks, version-scoped dismissal, the live Tauri `Update` resource, resource cleanup, download progress, and retry. `EditorLayout` remains the lifecycle coordinator: the updater can download independently, but `install()` is called only after the existing `confirmSessionExit` Save / Discard / Cancel flow succeeds; cancellation leaves the downloaded update ready. `WorkspaceSidebar` and a dedicated `AppUpdateNotice` are presentation-only consumers. B034 may later restyle the same shell, so F056 isolates new footer/card classes and does not revise unrelated Workspace or Settings geometry.
**Baseline:** The repository is clean on `master` at `409d7c9`, with no updater dependency, plugin initialization, updater/process permissions, public key, endpoint, or update UI. `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` report `0.1.0`; the tag workflow rewrites them only inside each build to the tag version. `.github/workflows/release.yml` already builds Windows x86_64, macOS aarch64, and macOS x86_64 through the npm Tauri script and uploads ordinary installers to a draft release. Public releases through `v0.2.6` contain `.dmg`, `.msi`/`.exe`, and macOS `.app.tar.gz` assets, but no `.sig` files and no `latest.json`, so no existing client can verify or discover them as updates. The current workflow relies on later manual publication and has no final cross-platform manifest gate. `WorkspaceSidebar` ends with one Settings row and keyboard shortcut, `EditorLayout` owns that sidebar plus the shared `confirmSessionExit` safety path, and `AppContent` already excludes the `preview-renderer` window. GitHub CLI authentication is currently invalid, so provisioning or confirming repository secrets requires re-authentication before release-channel verification. B034 is still `in_progress`, but its production implementation tasks are unchecked and the current Git worktree has no overlapping uncommitted changes.
**Exit Criteria:** A repository administrator has generated and safely retained one updater signing key, committed only its public key, and configured the required GitHub Actions secret names without exposing secret values. Pushing a valid stable `v*` tag builds all three supported targets with the tag version, creates updater bundles and `.sig` assets, merges a complete `latest.json`, rejects incomplete/malformed manifests, and publishes the GitHub Release only after every build and validation succeeds; a failed target leaves the release non-latest and non-published. A supported native main window discovers only strictly newer stable releases over HTTPS. The first discovery of each version shows the lower-left update card above Settings; dismissing it leaves the compact `Update` action in the Settings row across the current installation until that version is installed, superseded, or no longer applicable, while a later version restores the full card. Users can start or retry download, see bounded progress, defer a downloaded update, and install/restart deliberately. Save succeeds before install when chosen, Discard proceeds, Cancel does not install or exit, and failed checks/downloads/installs remain retryable without losing the known version. Browser mode and preview renderer perform no updater calls. Light/Dark/System, compact sidebar widths, keyboard/focus behavior, reduced motion, Windows/macOS lifecycle differences, focused tests, the full frontend regression, production build, Rust tests/build, workflow validation, native smoke, signed-artifact inspection, and diff hygiene pass.

## Task 1: Establish a Signed and Atomically Published GitHub Update Channel

**Outcome:** Every successful stable tag produces one complete, verifiable update release, while missing keys, failed targets, or incomplete manifests can never become the client's latest update.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/capabilities/updater.json`
- Modify: `.github/workflows/release.yml`
- Modify: `tests/releaseWorkflow.test.mjs`

**Change Map:**
- maintained plugins: add compatible Tauri v2 updater/process Rust plugins and JavaScript bindings, initialize them only for the desktop application, and grant only updater default plus process restart capability to the main application boundary
- signing trust: generate or import one stable updater key outside the repository, place only its public-key content in Tauri configuration, configure the HTTPS GitHub `latest.json` endpoint, and enable v2 updater artifacts; document the exact GitHub secret names without materializing their values in source, logs, or artifacts
- tag contract: reject non-SemVer `v*` tags before building, keep tag-derived version synchronization, pass updater signing secrets to both Apple-signed and ad-hoc macOS paths plus Windows, and keep npm as the only package manager
- release transaction: serialize stable releases, keep the release draft during matrix upload, prevent concurrent last-writer-wins updates to `latest.json` by serializing or explicitly aggregating platform metadata, then validate updater bundle/signature assets and all three required platform entries before changing `draft: true` to a published stable release
- regression contract: extend the release workflow test to cover updater configuration, least-privilege permissions, secret wiring by name, complete-platform validation, no private-key literals/files, and publish-after-build ordering

**Verification:**
- `node --test tests/releaseWorkflow.test.mjs`
- `npm ci`
- `npm run build`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo build`
- `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/release.yml`
- Signing preflight: confirm `TAURI_SIGNING_PRIVATE_KEY` and optional `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` exist in GitHub Actions after re-authentication, confirm the private key is absent from Git history/worktree/log output, and locally inspect that a signed build emits the expected updater bundle plus `.sig` for its target.

- [x] Add failing release and configuration contracts for signed artifacts, complete updater metadata, protected key handling, and publish ordering.
- [x] Add the maintained plugins, public trust configuration, endpoint, updater artifacts, and least-privilege capabilities.
- [x] Harden the tag workflow so all targets and updater metadata validate before automatic publication.

## Task 2: Build a Testable Native Update Lifecycle with Safe Install Gating

**Outcome:** The main desktop window has one deterministic, retryable update lifecycle, and no update installation can bypass IdeaNote's unsaved-document decision.
**Files:**
- Create: `src/lib/appUpdates.ts`
- Create: `src/hooks/useAppUpdate.ts`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `tests/unsavedChanges.test.mjs`
- Create: `tests/appUpdates.test.mjs`

**Change Map:**
- update adapter: wrap `check`, `Update.download`, `Update.install`, resource `close`, and process `relaunch` behind an injectable native client; return an inert client in browser/test contexts and never initialize it in preview renderer
- lifecycle model: represent idle/checking/available/downloading/ready/installing/error states with current/available version, release notes/date, byte progress, retry target, and version-scoped dismissal; stale checks or events cannot overwrite a newer lifecycle generation
- bounded discovery: check after native main-window startup and when the application returns to the foreground only after a one-hour minimum interval; no-update and transient initial-check failures stay non-disruptive, while a known-update failure remains visible and retryable
- resource ownership: retain exactly one live Tauri `Update` resource for the known version, close superseded/abandoned resources, prevent duplicate download/install operations, and preserve a completed download while restart is deferred
- safe install: expose install through `EditorLayout` only after `confirmSessionExit()` resolves true; Save must finish successfully, Discard may continue, Cancel or save failure leaves state `ready`, Windows installer-driven exit is accepted, and macOS relaunches only after install completes

**Verification:**
- `node --test tests/appUpdates.test.mjs tests/unsavedChanges.test.mjs tests/recovery.test.mjs`
- Cases: browser/preview inert; startup newer/no-update/error; foreground throttle; superseding version; duplicate clicks; determinate/indeterminate progress; download retry; install retry; resource cleanup; Save/Discard/Cancel/save-failure; Windows install exit; macOS relaunch; no stale completion state.

- [x] Add focused failing lifecycle and exit-safety tests with a deterministic fake updater client.
- [x] Implement the native adapter, reducer/controller, bounded checks, cleanup, and retry semantics.
- [x] Connect install to the existing session-exit safeguard without duplicating save or recovery logic.

## Task 3: Add the ChatGPT-style Sidebar Notice and Persistent Update Action

**Outcome:** Users notice a new release immediately, can dismiss the larger prompt without losing access to it, and understand every download/restart state from the lower-left sidebar.
**Files:**
- Create: `src/components/AppUpdateNotice.tsx`
- Modify: `src/components/WorkspaceSidebar.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/index.css`
- Modify: `tests/workspaceSidebar.test.mjs`
- Create: `tests/appUpdateUi.test.mjs`

**Change Map:**
- update card: render a restrained card immediately above the Settings footer with version, concise release notes/status, primary action, progress, retry, and accessible dismiss control; reopening does not recheck or discard an in-progress/downloaded update
- persistent footer action: when the card is dismissed, replace the Settings shortcut area with a compact `Update`, progress, or `Restart` action for the same version; clicking it restores or advances the update experience, and a newer version clears the old dismissal automatically
- presentation state: persist only the dismissed version identifier locally, never update artifacts or install authority; remove the card/action after successful update or when the version is superseded/no longer newer
- visual/accessibility contract: reuse semantic violet/status/danger tokens and Lucide icons, preserve the Settings action and `⌘,` accessibility, fit populated/empty/compact sidebars in Light/Dark/System, announce meaningful status changes without noisy progress speech, restore focus after dismissal, and honor reduced motion

**Verification:**
- `node --test tests/appUpdateUi.test.mjs tests/workspaceSidebar.test.mjs tests/themeVisualContract.test.mjs`
- Browser component cases with an injected fake lifecycle: first discovery, dismiss, footer reopen, download progress, ready/defer/restart, each failure/retry, newer-version replacement, Settings keyboard activation, screen-reader status, Light/Dark/System, 254px and compact widths, no overflow.

- [x] Add failing UI contracts for the supplied lower-left card and Settings-row Update action.
- [x] Implement the dedicated notice, footer projection, version-scoped dismissal, and accessible progress/error treatment.
- [x] Visually inspect available, progress, error, and compact-width states in Light and Dark against the supplied ChatGPT references without changing unrelated B034 shell geometry.

## Task 4: Verify the Signed End-to-End Path and Deliver F056

**Outcome:** F056 closes with current evidence for client behavior, native lifecycle safety, signed artifacts, and the GitHub publication gate.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F056-automatic-desktop-updates-from-github-releases.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- focused/full regression: updater lifecycle, sidebar projection, unsaved exit, release workflow, existing Workspace/Settings behavior, themes, and native Tauri configuration
- signed artifact evidence: build with a protected test or production signing key, inspect the updater bundle/signature pair and generated/merged manifest schema for each supported target, and verify signature or manifest corruption is rejected
- native acceptance: run an installed older build against a controlled signed newer manifest or the first approved published tag; verify discover, dismiss, compact Update, download, defer, Save/Discard/Cancel, install, restart, and post-restart version behavior on macOS plus the Windows lifecycle contract or runner evidence
- publication readiness: after GitHub authentication is restored, verify the repository secret names and workflow validation; do not push a release tag or rotate signing keys unless the human explicitly chooses the version/operation during delivery
- workflow completion: record current command/native evidence, mark F056 complete/done only when update delivery is genuinely operable, regenerate the index, inspect the exact diff, and create one task-level `feat(F056)` commit

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo build`
- `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/release.yml`
- `npm run tauri dev`
- Native/installed matrix: macOS Apple Silicon and Intel manifest selection, Windows x86_64 manifest/install behavior, first discovery/dismiss/footer action, offline and corrupt metadata, indeterminate/determinate download, deferred restart, Save/Discard/Cancel, Light/Dark/System, compact width, keyboard/focus, reduced motion, and no calls from browser/preview renderer.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run one stabilized full regression/build/native/workflow matrix after implementation stops changing.
- [ ] Prove a signed update round trip or stop with the exact external secret/tag authorization still required; do not claim completion from UI mocks alone.
- [x] Refresh the plan index and create the separate F056 implementation commit without claiming the blocked remote round trip.
- [ ] After the authorized remote round trip succeeds, mark F056 done/complete and refresh the index in a follow-up task commit.

## Current Delivery Evidence

- `npm ci` completed from the committed lockfile; existing Excalidraw/Radix React peer warnings and 14 pre-existing audit findings remain outside F056.
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs` passed the complete frontend test suite.
- `npm run build`, `cargo test` (166 passed), `cargo build`, and `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/release.yml` passed. Existing Vite chunk warnings and Rust dead-code warnings are unchanged.
- A CI-mode signed macOS Tauri build using the protected local key produced `IdeaNote.app.tar.gz` plus `IdeaNote.app.tar.gz.sig`; the private key remains outside the repository with mode `0600`.
- Playwright visual inspection passed at 254px and 214px sidebar widths in Light and Dark with no card overflow; available, determinate progress, compact, and retry/error presentations were inspected.
- An existing user-started `pnpm tauri dev` session has a live `target/debug/idea-slide` process. A second smoke command was deliberately stopped by the occupied Vite port without terminating the user's session.
- External blocker: `gh auth status` reports the active `sivenDev` token is invalid. Repository administrators must run `gh auth login -h github.com`, configure or confirm `TAURI_SIGNING_PRIVATE_KEY` (with `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` empty/unset for this key), and explicitly authorize the first stable `vMAJOR.MINOR.PATCH` tag before the cross-platform GitHub release/update round trip can be proven. F056 therefore remains `in_progress`.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/bugs/B003-fix-release-package-manager-selection.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-01-production-shell-workspaces-and-recents.md`
- `docs/superplan/plans/features/F048-refine-settings-navigation-and-auto-apply.md`
- `docs/superplan/plans/features/F055-add-workspace-from-sidebar-header.md`
- `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`
- `.github/workflows/release.yml`
- `src/App.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/WorkspaceSidebar.tsx`
- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`
- `https://v2.tauri.app/plugin/updater/`
- `https://github.com/tauri-apps/tauri-action`
- Human-supplied lower-left update prompt and Settings-row references from `2026-08-12`
