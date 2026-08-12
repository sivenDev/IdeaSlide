---
id: "B044"
title: "Relaunch IdeaNote After a Successful macOS Update"
type: "bugfix"
status: "complete"
summary: "Hand macOS updater restarts to LaunchServices so the updated application reliably opens after installation."
source: "docs/superplan/human/bugs.md"
created: "2026-08-13"
order: 44
depends_on: ["B024"]
parent: ""
---

# Relaunch IdeaNote After a Successful macOS Update Plan

**Goal:** Make a successful signed macOS update close the old IdeaNote process and reliably open the newly installed application without weakening document-exit safeguards.
**Scope:** Replace the updater's generic process-plugin restart boundary with one application-owned native command. After the existing Save / Discard / Cancel gate and successful updater installation, macOS resolves the running `.app` bundle and asks LaunchServices to open a new instance through `/usr/bin/open -n`; only after LaunchServices accepts the request does the old process exit. Non-bundle macOS development launches and non-macOS platforms keep Tauri's normal restart behavior. The command accepts no user-controlled executable, path, URL, or arguments. Remove the now-unused process plugin and permission if no other caller remains. Preserve the current update state machine, retry behavior, signed artifact verification, Windows installer behavior, and browser/preview inertness.
**Non-Goals:** This bugfix does not redesign updater UI, change update discovery/download/signature policy, replay stale launch arguments, add background installation, change release workflows or signing keys, publish a tag without separate authorization, patch vendored Tauri source, enable the dangerous macOS symlink relaunch feature, or add a general-purpose application launcher. It does not treat a mocked JavaScript relaunch call as native acceptance.
**Architecture:** Keep `AppUpdateController` platform-neutral and preserve its single `AppUpdateClient.relaunch` seam. The native client routes that seam to a narrow `relaunch_after_update` Tauri command. A dedicated Rust module owns exact `.app/Contents/MacOS/<binary>` bundle-root validation, builds the fixed `/usr/bin/open -n <bundle>` LaunchServices request on macOS, checks the command result, and exits only after successful handoff; failure returns to the current process so the existing retryable install error is visible. When the current executable is not inside an application bundle, or on Windows/Linux, the command delegates to `AppHandle::request_restart`. This local boundary intentionally avoids Tauri 2.11's affected direct-child macOS restart implementation while retaining Tauri for lifecycle coordination everywhere else.
**Baseline:** IdeaNote 0.2.7 is installed at `/Applications/IdeaNote.app`, and the application bundle reports version `0.2.7`. `AppUpdateController.install` awaits `update.install()` and then calls `client.relaunch()`. `useAppUpdate` implements that client with `@tauri-apps/plugin-process`, whose Rust 2.3.1 command calls `AppHandle::request_restart()`. The pinned Tauri 2.11.5 implementation ultimately launches the updated macOS binary directly from the dying process. The current test only increments a fake relaunch counter, so it cannot detect a failed native process handoff.
**Reproduction:** From installed IdeaNote 0.2.6 on macOS, discover and install the signed 0.2.7 GitHub release through the in-app updater. The application bundle is replaced successfully, but IdeaNote does not return automatically; the user must open it manually. The same symptom is independently tracked upstream as `tauri-apps/tauri#13923` for `restart`/`request_restart` on macOS.
**Root Cause:** The first incorrect source is the generic Tauri macOS restart implementation reached through `tauri-plugin-process`, not IdeaNote's update-state sequencing or restart permission. Tauri 2.11.5 resolves the application bundle but starts its executable as a direct child of the process that is exiting. Upstream `tauri-apps/tauri#13923` reports the exact shutdown-without-relaunch symptom, and `tauri-apps/tauri#15742` demonstrates that this spawn inherits the dying process's stdio, session, and process group, allowing the replacement to terminate before its UI appears. IdeaNote currently delegates completely to this affected path and has no LaunchServices handoff or native regression for it.
**Exit Criteria:** A successful macOS install uses exactly `/usr/bin/open -n` with the validated current `.app` bundle, exits the old process only after the LaunchServices request succeeds, and starts a new process whose runtime version matches the installed update. A failed handoff leaves the current process alive with a retryable visible error. Save completes before installation when selected, Discard proceeds, Cancel never installs or exits, and duplicate restart requests remain bounded. Non-bundle development and non-macOS behavior retain the existing restart contract. No general launcher or user-controlled path is exposed; the unused process-plugin dependency and restart permission are removed when safe. Focused frontend/Rust regressions, full frontend and Rust suites/builds, capability validation, a signed isolated installed-client 0.2.7-to-0.2.8-style round trip, process/version evidence, diff hygiene, F056/F057 dependency closure, and a separate `fix(B044)` commit pass.

## Task 1: Capture the Native Relaunch Contract Before the Fix

**Outcome:** Focused regressions distinguish a LaunchServices macOS handoff from the currently mocked generic restart and lock the safe bundle/path boundary.
**Files:**
- Modify: `tests/appUpdates.test.mjs`
- Create: `tests/appUpdateNativeRelaunch.test.mjs`
- Create: `src-tauri/src/update_relaunch.rs`
- Modify: `src-tauri/src/lib.rs`

**Change Map:**
- frontend adapter contract: the native updater client invokes only the dedicated update-relaunch command after install, while browser and preview contexts remain inert
- Rust path contract: accept only the current executable's exact `.app/Contents/MacOS/<binary>` ancestry, derive the `.app` root, and reject misleading or user-supplied paths
- LaunchServices contract: macOS command specification is exactly `/usr/bin/open -n <validated bundle>` with no inherited application arguments; fallback behavior is explicit for development and other platforms
- failure contract: failed LaunchServices handoff returns an error before process exit and remains retryable through the existing controller state

**Verification:**
- `node --test tests/appUpdates.test.mjs tests/appUpdateNativeRelaunch.test.mjs`
- `cd src-tauri && cargo test update_relaunch -- --nocapture`
- Cases: post-install ordering; no direct process-plugin import; exact command/arguments; valid and invalid bundle paths; successful handoff before exit; handoff failure without exit; non-bundle fallback; no user-controlled target.

- [x] Add a focused failing frontend source/behavior regression for the dedicated native relaunch boundary.
- [x] Add Rust regressions for bundle resolution, exact LaunchServices command construction, fallback, and failure ordering.

## Task 2: Hand macOS Update Restarts to LaunchServices

**Outcome:** The updater reliably opens the replaced macOS bundle while preserving the current cross-platform and unsaved-change lifecycle.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/hooks/useAppUpdate.ts`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/update_relaunch.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/updater.json`
- Modify: focused tests from Task 1

**Change Map:**
- native command: register `relaunch_after_update` and keep all executable/bundle resolution inside Rust
- macOS handoff: synchronously verify LaunchServices accepted `/usr/bin/open -n <current bundle>`, then request application exit; keep the current process alive on failure
- fallback: delegate non-bundle development and non-macOS launches to Tauri restart semantics without adding UI branches
- dependency/capability cleanup: remove `@tauri-apps/plugin-process`, `tauri-plugin-process`, plugin initialization, and `process:allow-restart` only after repository search proves the updater was their sole consumer
- controller safety: retain confirmation-before-install, one operation promise, downloaded resource ownership, retryable errors, and no updater calls from browser/preview windows

**Verification:**
- `node --test tests/appUpdates.test.mjs tests/appUpdateNativeRelaunch.test.mjs tests/unsavedChanges.test.mjs tests/recovery.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test update_relaunch -- --nocapture`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo build`

- [x] Implement the narrow native command and macOS LaunchServices handoff.
- [x] Route the updater client through the command and remove the obsolete process-plugin authority.
- [x] Preserve retry, duplicate-operation, browser/preview, and Save / Discard / Cancel behavior.

## Task 3: Prove the Installed macOS Update Round Trip and Close the Updater Dependency Chain

**Outcome:** A real signed isolated installation proves install, old-process exit, new-process launch, and updated runtime version before B044, F056, and F057 claim completion.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/bugs/B044-relaunch-ideanote-after-successful-macos-update.md`
- Modify: `docs/superplan/plans/features/F056-automatic-desktop-updates-from-github-releases.md`
- Modify: `docs/superplan/plans/features/F057-add-an-about-page-to-settings.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- isolated signed acceptance: build a disposable macOS test application identity and local signed update endpoint from two fixed versions, install the older build outside the production IdeaNote bundle, and exercise the real updater without changing `/Applications/IdeaNote.app`
- process evidence: record old PID/version, successful bundle replacement, old PID exit, distinct new PID, new runtime version, and absence of crash/abort evidence
- safety/error acceptance: prove Cancel avoids installation, and a controlled failed LaunchServices handoff leaves the old process alive with retry available
- workflow closure: record current evidence, complete B044, then complete F056 and its already-delivered F057 dependent only when the installed-client restart proof passes; a public GitHub tag remains a separate explicit authorization

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo build`
- Signed isolated installed-client matrix: fixed older version discovers/downloads/installs a fixed newer version, old PID exits, new PID starts through LaunchServices, About/runtime API reports the newer version, and no production bundle or user document is modified.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run one signed isolated installed-client macOS update and capture PID/version/handoff evidence.
- [x] Run the stabilized full regression/build/native matrix and inspect the final diff.
- [x] Complete B044, F056, and F057 in dependency-safe order and create the isolated `fix(B044)` delivery commit plus metadata closure as required.

## Current Delivery Evidence

- The regression-first run failed because `useAppUpdate` still imported `@tauri-apps/plugin-process` and `src-tauri/src/update_relaunch.rs` did not exist; the same focused suite passed after the native boundary was added.
- `relaunch_after_update` validates the current executable's exact `.app/Contents/MacOS/<binary>` ancestry, invokes only `/usr/bin/open -n <bundle>`, exits after a successful LaunchServices response, and leaves the process alive on failure. A failed handoff retry repeats only relaunch and never reinstalls the already-applied update.
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`, `npm run build`, `cargo test` (171 passed), and `cargo build` passed. Existing Vite chunk and Rust Agent dead-code warnings remain unchanged.
- A disposable application identity outside `/Applications/IdeaNote.app` completed a locally signed `0.2.7` to `0.2.8` update from an isolated loopback endpoint. Old PID `48681` recorded `0.2.7`, discovered and installed `0.2.8`, then exited. LaunchServices started distinct PID `48743` from the replaced bundle; it recorded runtime `0.2.8`, the installed bundle reported `0.2.8`, PPID was `1`, and no crash/abort evidence was found.
- The implementation is committed as `15090c9 fix(B044): relaunch macOS updates through LaunchServices`; no public GitHub tag was created and the production IdeaNote bundle was not modified.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F056-automatic-desktop-updates-from-github-releases.md`
- `docs/superplan/plans/features/F057-add-an-about-page-to-settings.md`
- `docs/superplan/plans/bugs/B024-align-tauri-versions-and-verify-agent-editing.md`
- `src/lib/appUpdates.ts`
- `src/hooks/useAppUpdate.ts`
- `src/components/EditorLayout.tsx`
- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/updater.json`
- `https://github.com/tauri-apps/tauri/issues/13923`
- `https://github.com/tauri-apps/tauri/issues/15742`
