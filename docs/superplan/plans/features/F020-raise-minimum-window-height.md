---
id: "F020"
title: "Raise the Minimum Window Height"
type: "feature"
status: "complete"
summary: "Keep the main IdeaNote window 1200 pixels wide by default and prevent it from being resized below 850 pixels tall."
source: "docs/superplan/human/features.md"
created: "2026-08-05"
order: 20
depends_on: []
parent: ""
---

# Raise the Minimum Window Height Plan

**Goal:** Keep the IdeaNote desktop layout usable with a 1200-pixel default width and an 850-pixel minimum height.
**Scope:** Preserve the main Tauri window's 1200-pixel default width and change its minimum height so the application cannot be resized below 850 pixels tall.
**Non-Goals:** This plan does not change the minimum width, responsive UI breakpoints, secondary windows, or unrelated window chrome and startup behavior.
**Architecture:** Keep the constraint in the shared Tauri v2 window configuration, which is the native source of truth for the main window's resize limits; no frontend-only size enforcement is added.
**Baseline:** The main window is declared in `src-tauri/tauri.conf.json` with a default width of 1200 pixels, `minHeight` set to 600 pixels, and an initial height of 800 pixels.
**Exit Criteria:** The main window configuration declares a 1200-pixel default width and an 850-pixel minimum height, Tauri accepts the configuration, and the application cannot be resized below that native height limit.

## Task 1: Enforce the 850-pixel native window limit

**Outcome:** The main IdeaNote window opens with its specified 1200-pixel default width, and the desktop window manager prevents it from becoming shorter than 850 pixels.
**Files:**
- Modify: `src-tauri/tauri.conf.json`

**Change Map:**
- `src-tauri/tauri.conf.json`: main window default `width` and `minHeight` constraints

**Verification:**
- Parse `src-tauri/tauri.conf.json` and assert that `app.windows[0].width` equals `1200` and `app.windows[0].minHeight` equals `850`.
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `git diff --check`

- [x] Preserve the main Tauri window default width at 1200 pixels and set its minimum height to 850 pixels.
- [x] Verify the configuration and native build metadata accept the new constraint.

## Delivery Evidence

- Window configuration assertion passed with `width=1200` and `minHeight=850`.
- `cargo check --manifest-path src-tauri/Cargo.toml` completed successfully.
- `git diff --check` passed.

## References
- `docs/superplan/human/features.md#f020-raise-minimum-window-height`
- `docs/superplan/plans/03-multifile-workspace-shell.md`
- `src-tauri/tauri.conf.json`
