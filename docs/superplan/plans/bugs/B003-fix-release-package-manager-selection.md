---
id: "B003"
title: "Fix Release Package Manager Selection"
type: "bugfix"
status: "complete"
summary: "Keep GitHub release packaging on the repository's canonical npm toolchain even when Tauri Action performs package-manager detection."
source: "docs/superplan/human/bugs.md"
created: "2026-07-22"
order: 3
depends_on: []
parent: ""
---

# Fix Release Package Manager Selection Plan

**Goal:** Restore successful Windows and macOS release packaging by making the release workflow use npm consistently from dependency installation through the Tauri build.
**Scope:** Remove the redundant pnpm lockfile, explicitly configure both signed and unsigned `tauri-action` steps to invoke the npm Tauri script, and add a source-level regression test for the release package-manager contract.
**Non-Goals:** This plan does not change application dependencies, release asset naming, signing/notarization behavior, supported build targets, version synchronization, or the current Node.js version used to build the app.
**Architecture:** npm remains the single package manager for the repository, as established by `package-lock.json`, project commands, and the workflow's `npm ci` step. The workflow will also pass `tauriScript: npm run tauri` so Tauri Action does not infer a different runner from an incidental lockfile.
**Baseline:** Release run `26559228461` for tag `v0.1.11` created the draft release successfully, then all three platform build jobs failed at their Tauri Action step. The repository contains both `package-lock.json` and a later-added `pnpm-lock.yaml`, while the workflow configures npm caching and installs with `npm ci`.
**Reproduction:** Push a `v*` tag from a revision containing both lockfiles. After `npm ci`, `tauri-apps/tauri-action@v0` detects `pnpm-lock.yaml`, invokes `pnpm tauri build`, and the Windows and macOS packaging jobs fail instead of using the installed npm toolchain.
**Root Cause:** Tauri Action's runner detection prefers pnpm whenever `pnpm-lock.yaml` exists. The redundant lockfile introduced after the last successful release conflicts with the repository's npm-only workflow, and the action steps do not explicitly override auto-detection.
**Exit Criteria:** The repository has one npm lockfile, both Tauri Action paths explicitly run `npm run tauri`, a regression test rejects mixed package-manager configuration, `npm ci` and the production frontend build succeed, and the release workflow passes static syntax validation.

## Task 1: Make Release Packaging Deterministically Use npm

**Outcome:** GitHub release builds no longer switch from npm to pnpm when Tauri Action starts, and future lockfile drift is caught before a tag release.
**Files:**
- Modify: `.github/workflows/release.yml`
- Delete: `pnpm-lock.yaml`
- Create: `tests/releaseWorkflow.test.mjs`

**Change Map:**
- `.github/workflows/release.yml`: signed and unsigned Tauri Action runner configuration
- `pnpm-lock.yaml`: redundant non-canonical package-manager lockfile
- `tests/releaseWorkflow.test.mjs`: npm-only release workflow regression contract

**Verification:**
- `node --test tests/releaseWorkflow.test.mjs`
- `npm ci`
- `npm run build`
- `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/release.yml`

- [x] Add a failing source-level regression test requiring a single npm lockfile and explicit `tauriScript: npm run tauri` on both Tauri Action build paths.
- [x] Run the focused test and confirm it fails against the current mixed npm/pnpm configuration.
- [x] Remove the redundant `pnpm-lock.yaml` and configure both Tauri Action steps to use the npm Tauri script explicitly.
- [x] Re-run the focused test and confirm it passes.
- [x] Run clean npm installation, production build, workflow syntax validation, and the relevant full regression suite.
- [x] Mark B003 and this plan complete after verification.

## References
- `.github/workflows/release.yml`
- `package-lock.json`
- `pnpm-lock.yaml`
- `https://github.com/sivenDev/IdeaSlide/actions/runs/26559228461`
- `https://github.com/tauri-apps/tauri-action/blob/v0/src/runner.ts`
