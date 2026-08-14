---
id: "F061"
title: "Open Markdown Files from the Operating System"
type: "feature"
status: "complete"
summary: "Let installed IdeaNote builds open associated Markdown files through the existing registry-backed standalone document flow."
source: "docs/superplan/human/features.md"
created: "2026-08-14"
order: 61
depends_on: ["F038-01", "F046-01"]
parent: ""
---

# Open Markdown Files from the Operating System Plan

**Goal:** Let users open `.md` files directly with IdeaNote instead of first entering the application and using its file picker.
**Scope:** Register `.md` as an installed IdeaNote document association and accept registry-openable Markdown paths from the existing operating-system open event. Preserve the current cold-start pending-file handoff and hot-start `file-open` event so Finder double-click and Open With activate the production Markdown editor through the same save-gated standalone session flow already used by `.is` files.
**Non-Goals:** This feature does not change Markdown parsing, editing, preview, persistence, recent-file semantics, Workspace scanning, unsupported-file behavior, application shell ownership, or add a new cross-platform single-instance/CLI launch system. It does not claim operating-system behaviors beyond the platforms and Tauri event boundary already used for `.is` file opening.
**Architecture:** Keep the application shell and frontend startup path format-agnostic. The Tauri bundle declares a distinct Markdown association with the standard `text/markdown` MIME type. The native open-event adapter delegates path eligibility to `document_formats::is_openable_path` instead of hard-coding the IdeaSketch extension, then reuses the existing `PendingFile` and `file-open` delivery contract. Format knowledge remains owned by the document-format registry, and the mounted frontend continues to validate and open the path through `openStandaloneDocument` and the editor registry.
**Baseline:** Markdown is already registered as openable in the frontend and Rust format registries; the in-app Open File dialog includes `.md`; Workspace and standalone sessions already mount the Markdown editor; and the frontend already consumes cold-start `get_opened_file` and hot-start `file-open` paths generically. The remaining gap is that `src-tauri/tauri.conf.json` associates only `.is`, while the macOS `RunEvent::Opened` adapter accepts only a case-sensitive hard-coded `is` extension even though `document_formats::is_openable_path` already recognizes both `.is` and `.md` case-insensitively.
**Exit Criteria:** Installed bundle metadata advertises both IdeaSketch and Markdown document associations; opening a `.md` or `.MD` path through the existing operating-system event boundary reaches the same pending/event delivery used by `.is`; unsupported extensions are ignored; no Markdown-specific branch is added to the frontend shell; existing `.is`, application-picker, Workspace, and unsupported-file behavior remains unchanged; focused association/routing tests, Rust regressions, the strict frontend build, bundle generation, and Superplan validation pass.

## Task 1: Register and Route Markdown System-open Requests

**Outcome:** Operating-system Markdown open requests are recognized by the installed application and delivered safely to the existing Markdown standalone editor path.
**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/lib.rs`
- Create: `tests/tauriFileAssociations.test.mjs`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F061-open-markdown-files-from-the-operating-system.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- bundle association: add a dedicated Markdown association for `.md` with an English name, description, editor role, and `text/markdown` MIME type while preserving the existing IdeaSketch association
- native routing: replace the hard-coded `.is` eligibility check with the backend document-format registry and make pending-file documentation format-neutral
- regression contract: verify bundle metadata contains the two supported associations and native system-open routing delegates to the registry, accepts `.md`/`.MD` and `.is`, and rejects unsupported paths
- artifact validation: build the desktop bundle and inspect generated platform metadata to confirm the Markdown association is present rather than relying only on source configuration

**Verification:**
- `node --test tests/tauriFileAssociations.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml document_formats -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml opened_file -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `npm run build`
- `npm run tauri build -- --debug`
- Inspect the generated macOS bundle metadata for both `is` and `md` document types and perform a disposable `.md` cold-start/open-with smoke when the platform permits.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root /Users/zhengxiwan/ide-workspace/idea-slide validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root /Users/zhengxiwan/ide-workspace/idea-slide --write --check`
- `git diff --check`

- [x] Add the Markdown bundle association without changing the existing IdeaSketch association.
- [x] Route system-open paths through the shared native document-format registry and preserve cold/hot delivery behavior.
- [x] Add focused regressions and verify the generated desktop bundle advertises Markdown support.
- [x] Complete full verification, mark F061 complete/done, and create one isolated commit containing `F061`.

## Delivery Evidence

- Bundle metadata: `src-tauri/tauri.conf.json` keeps the existing `.is` association and adds a distinct `.md` association with `text/markdown`; the generated `IdeaNote.app/Contents/Info.plist` contains `CFBundleDocumentTypes` entries for both `is` and `md` with the Editor role.
- Native routing: `opened_file_path` delegates to `document_formats::is_openable_path`, accepts `.is`, `.md`, and `.MD`, rejects unsupported/no-extension paths, and leaves the existing `PendingFile` plus `file-open` cold/hot delivery contract unchanged.
- Focused verification: `node --test tests/tauriFileAssociations.test.mjs` passed 2 tests; `cargo test --manifest-path src-tauri/Cargo.toml opened_file -- --nocapture` passed 2 tests; and the document-format filter passed 24 tests.
- Full regression: `node --test tests/*.test.mjs` passed 435 tests; `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` passed 173 tests; and `npm run build` completed successfully with only the existing import/chunk warnings.
- Artifact verification: `npm run tauri build -- --debug --config '{"bundle":{"createUpdaterArtifacts":false}}'` completed successfully and produced `IdeaNote.app` plus `IdeaNote_0.3.3_aarch64.dmg`. The normal updater-artifact build also produced the bundles but could not sign the updater archive because this environment does not provide `TAURI_SIGNING_PRIVATE_KEY`.
- Formatting: `rustfmt --edition 2021 --check --config skip_children=true src-tauri/src/lib.rs` passed. Repository-wide `cargo fmt --check` still reports pre-existing formatting differences in `src-tauri/src/commands.rs` and `src-tauri/src/recent_files.rs`; F061 did not modify those files.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-01-generic-document-kernel-and-markdown-editor.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-01-production-shell-workspaces-and-recents.md`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/lib.rs`
- `src-tauri/src/document_formats/mod.rs`
- `src/App.tsx`
- `src/components/EditorLayout.tsx`
