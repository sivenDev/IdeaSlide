---
id: "F072"
title: "Prefer gh-proxy for Automatic Update Downloads with Official Fallback"
type: "feature"
status: "in_progress"
summary: "Route automatic update checks and signed package downloads through gh-proxy first, then fall back to official GitHub URLs without weakening signature or install safety."
source: "docs/superplan/human/features.md"
created: "2026-09-02"
order: 72
depends_on: ["F056"]
parent: ""
---

# Prefer gh-proxy for Automatic Update Downloads with Official Fallback Plan

**Goal:** Improve automatic update reachability for users whose network has difficulty accessing GitHub by trying the gh-proxy URL-prefix service first while retaining a verified official GitHub path.
**Scope:** Publish a second updater manifest whose platform package URLs are prefixed with `https://gh-proxy.com/https://github.com/...`, configure the desktop updater to check that manifest before the official manifest, and add a native fallback path that retries the same version's signed package through the official GitHub manifest when a proxy package download fails. Preserve the existing supported Windows x86_64, macOS Apple Silicon, and macOS Intel targets, progress reporting, version comparison, user-initiated install, Save / Discard / Cancel exit protection, native relaunch, and updater signature verification.
**Non-Goals:** Do not infer geography from IP addresses, silently install updates, weaken HTTPS or minisign verification, replace the official manifest, proxy arbitrary application traffic, add a third-party updater key, make gh-proxy a permanent sole dependency, alter manual document/file downloads, or change the existing update UI beyond accurate proxy/fallback progress and error messaging.
**Architecture:** Keep the official `latest.json` and its direct GitHub asset URLs as the canonical signed release metadata. The release publish job derives and uploads `latest-cn.json` only after validating the complete official manifest; it preserves versions and signatures while replacing each supported package URL with the gh-proxy URL-prefix form. `tauri.conf.json` lists the gh-proxy manifest first and the official manifest second so manifest discovery can fall through when the proxy is unavailable. Because `tauri-plugin-updater`'s `proxy` option is an HTTP forward proxy rather than a URL-prefix service, package-download fallback is application-owned: a small native updater bridge creates a second updater builder with the official endpoint, retains its verified `Update` resource, streams progress, and installs only the resource that actually downloaded successfully. The frontend adapter presents one logical `AppUpdateResource`, swaps to the official resource only after a proxy download failure, and never bypasses the existing lifecycle controller or native install gate.
**Baseline:** F056 currently configures one official endpoint, `https://github.com/sivenDev/IdeaSlide/releases/latest/download/latest.json`. Its generated manifest contains absolute direct GitHub package URLs, while `AppUpdateController` retains one Tauri `Update` resource and retries a failed download against the same resource. `tauri-plugin-updater` supports endpoint arrays and signed downloads, but its JavaScript/Rust `proxy` option configures `reqwest::Proxy::all` and cannot consume `gh-proxy.com` URL-prefix paths. The published `v0.3.7` release is complete and direct; older clients must continue updating through the official manifest.
**Exit Criteria:** New releases publish both complete `latest.json` and `latest-cn.json` assets, with identical version/signature data and exact gh-proxy-prefixed package URLs in the latter. A client first checks the proxy manifest and downloads the selected signed package through gh-proxy; a proxy manifest or package failure transparently retries the official endpoint/package for the same version. Official fallback failure remains retryable without losing the known update, and no unsigned, mismatched, stale, or corrupted package can reach install. Existing browser/preview inert behavior, progress, dismissal, Save / Discard / Cancel, deferred restart, macOS relaunch, Windows installation, and supported-target selection remain intact. Focused updater, release-workflow, Rust bridge, frontend regression, production build, Rust tests/build, workflow validation, and diff hygiene pass.

## Task 1: Publish and Validate a Proxy-Aware Release Manifest

**Outcome:** Every future stable release contains a canonical official manifest plus a derived gh-proxy manifest that covers all signed updater targets without changing artifact bytes or signatures.
**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `.github/workflows/release.yml`
- Modify: `tests/releaseWorkflow.test.mjs`

**Change Map:**
- updater endpoints: put the gh-proxy `latest-cn.json` endpoint before the official `latest.json` endpoint while retaining the official endpoint as the durable fallback
- publish gate: derive `latest-cn.json` from the validated official manifest only after all three target bundles and `.sig` assets exist; prefix only supported absolute GitHub Release URLs and preserve `version`, `pub_date`, `notes`, and signatures
- regression contract: assert endpoint ordering, proxy URL construction, complete proxy-manifest upload, direct-manifest preservation, and publish-after-validation ordering

**Verification:**
- `node --test tests/releaseWorkflow.test.mjs`
- Validate a generated fixture or captured manifest has matching version/signatures, six supported updater target aliases, exact `https://gh-proxy.com/https://github.com/` URL prefixes, and no private signing material.
- `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/release.yml`

  - [x] Add the proxy-first endpoint and release-manifest derivation contract.
  - [x] Implement safe proxy-manifest upload after the existing official asset gate.
  - [x] Verify direct and proxy manifest schemas and asset pair completeness.

## Task 2: Add a Native Official-Download Fallback Resource

**Outcome:** A failed gh-proxy package download can switch to a separately checked official Tauri updater resource while preserving signature verification, progress, and install ownership.
**Files:**
- Create: `src-tauri/src/update_fallback.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/updater.json`
- Test: `src-tauri/src/update_fallback.rs`
- Test: `tests/appUpdateNativeFallback.test.mjs`

**Change Map:**
- native state: manage one short-lived official `tauri_plugin_updater::Update` resource per active fallback and close it on success, cancellation, supersession, or disposal
- commands: expose narrowly scoped official check/download/install/close operations with target and version correlation, bounded progress events, and no arbitrary URL input from the webview
- trust boundary: build the official endpoint from a compile-time constant, require the expected current/available version and platform target, let the maintained plugin verify the package signature, and keep the existing native relaunch command unchanged

**Verification:**
- `cd src-tauri && cargo test update_fallback`
- `cd src-tauri && cargo build`
- `node --test tests/appUpdateNativeFallback.test.mjs`
- Assert stale request ids, mismatched versions/targets, duplicate operations, close paths, proxy failure, official success, official failure, and signature/install ordering fail closed.

  - [x] Add the managed official fallback resource and least-privilege commands.
  - [x] Add native unit coverage for lifecycle, correlation, and failure cleanup.
  - [x] Add frontend/native contract coverage for the command payloads and events.

## Task 3: Compose Proxy-First and Official Fallback in the App Lifecycle

**Outcome:** Users see one update lifecycle that tries gh-proxy first, retries the official package after a proxy download failure, and preserves all existing safe install behavior.
**Files:**
- Modify: `src/hooks/useAppUpdate.ts`
- Modify: `src/lib/appUpdates.ts`
- Modify: `tests/appUpdates.test.mjs`
- Modify: `tests/appUpdateUi.test.mjs`

**Change Map:**
- native adapter: wrap the primary proxy `Update` and the official fallback resource behind one injectable client/resource; on proxy download failure, invoke the correlated official fallback and replace the install delegate only after its download succeeds
- lifecycle semantics: retain the available version and progress across the fallback boundary, distinguish proxy and official failure in retryable diagnostics, and prevent stale proxy completions from overwriting official ready/installing state
- UI contract: keep existing update card/footer states and user controls, optionally expose concise “Trying official GitHub download…” status without leaking URLs or creating a second update prompt

**Verification:**
- `node --test tests/appUpdates.test.mjs tests/appUpdateUi.test.mjs tests/appUpdateNativeFallback.test.mjs`
- Cover proxy-first check/download, proxy manifest failure with official check fallback, proxy package failure with official package success, both failures, progress reset/continuation, retry, deferred install, Save / Discard / Cancel, and resource cleanup.

  - [x] Extend the injectable update client and fake resources for source switching.
  - [x] Implement proxy-first download with official fallback and bounded retry semantics.
  - [x] Preserve UI, dismissal, install gating, and relaunch behavior across the source switch.

## Task 4: Verify and Deliver F072

**Outcome:** The proxy-first channel is regression-safe, signed, observable, and ready for the next authorized release.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F072-prefer-gh-proxy-update-downloads-with-official-fallback.md`

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo build`
- `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/release.yml`
- Inspect a signed release fixture: direct and proxy manifests, all package/signature pairs, exact URL prefixes, and rejection of a corrupted package.
- `git diff --check`
- `git status --short`

- [x] Run focused and full verification after implementation stabilizes.
- [x] Record the proxy/direct manifest and signed fallback evidence.
- [ ] Mark the plan and F072 complete/done only after an authorized `v0.3.8` or later release proves the new path.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F056-automatic-desktop-updates-from-github-releases.md`
- `.github/workflows/release.yml`
- `src-tauri/tauri.conf.json`
- `src/lib/appUpdates.ts`
- `src/hooks/useAppUpdate.ts`
- `https://v2.tauri.app/plugin/updater/`
- `https://gh-proxy.com/`
