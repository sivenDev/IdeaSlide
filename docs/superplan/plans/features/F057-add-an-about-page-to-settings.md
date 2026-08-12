---
id: "F057"
title: "Add an About Page to Settings"
type: "feature"
status: "in_progress"
summary: "Add a compact read-only Settings page for IdeaNote identity, runtime version, and official project links."
source: "docs/superplan/human/features.md"
created: "2026-08-12"
order: 72
depends_on: ["F048", "F056"]
parent: ""
---

# Add an About Page to Settings Plan

**Goal:** Give users one trustworthy place inside Settings to identify the running IdeaNote build and reach its official project and release pages.
**Scope:** Add an `About` item at the end of the Settings `Application` group. The page presents the IdeaNote name and concise product description, reads the actual native application version at runtime, provides an accessible browser-safe fallback, and exposes official GitHub repository and Releases links through the maintained Tauri opener boundary. The layout follows the compact Codex-like Settings hierarchy with neutral cards, quiet metadata, and clear link actions in Light, Dark, and System themes.
**Non-Goals:** This feature does not add editable settings, update checking or installation controls, release notes, diagnostics, log export, telemetry, license/EULA acceptance, contributor lists, build-channel selection, commit hashes, platform identifiers, or a second standalone About dialog. It does not hardcode the release version or duplicate the sidebar updater state.
**Architecture:** Keep Settings registry-driven. Extend the section id/icon/group metadata only enough to register `about`; render a dedicated presentation component from `SectionContent`. Add the maintained Tauri opener plugin only if no existing safe external-link boundary is available, initialize it for the desktop app, and grant only URL-opening permission to the main window. Isolate native version/link calls behind a small injectable application-info adapter so browser and source-level tests remain deterministic and no Settings persistence state is involved.
**Baseline:** `SettingsCenter` renders six registry sections across Application, AI, and Editors, and `SectionContent` maps registry ids to dedicated components. The Application group currently contains only General. No About section, runtime-version reader, or maintained external-link action exists. Package and Tauri manifests remain `0.1.0` in source while release builds synchronize the runtime version from the Git tag, so source constants cannot represent the installed version. F048 owns Settings navigation/auto-persistence and F056 owns update discovery/install; About must remain read-only and must not create a parallel updater surface.
**Exit Criteria:** Settings shows an icon-led About item after General in the Application group. Opening it displays IdeaNote identity, a concise English description, and the real installed version without briefly showing a false version; browser/test contexts degrade to an honest unavailable or development label. Repository and Releases actions have accessible names, open only the two approved HTTPS GitHub URLs through the native safe-link boundary, and report a non-disruptive inline error when opening fails. The page introduces no Save status or persisted setting, fits the existing Settings dialog without horizontal overflow, supports keyboard/focus behavior, and looks intentional in Light/Dark/System at desktop and effective 850x850 layouts. Focused registry/component/theme/security tests, the relevant full frontend regression, production build, Tauri capability validation, native smoke, diff hygiene, plan completion, and a separate `feat(F057)` commit pass.

## Task 1: Specify the About and Native-Link Contracts

**Outcome:** Focused tests define section placement, runtime-version behavior, approved-link restrictions, and the read-only visual/accessibility contract before production implementation changes.
**Files:**
- Modify: `tests/settingsCenter.test.mjs`
- Create: `tests/aboutSettings.test.mjs`
- Modify: `tests/themeVisualContract.test.mjs`

**Change Map:**
- registry contract: About is the final Application section with a semantic info icon and no Settings persistence fields
- information contract: native runtime version is resolved asynchronously; loading and unavailable states never claim a false installed version
- link contract: only the official repository and Releases HTTPS URLs are exposed and opener failures remain inline/retryable without navigation side effects
- presentation contract: product mark, metadata rows, and link actions use existing semantic tokens, visible focus, and compact responsive geometry

**Verification:**
- `node --test tests/aboutSettings.test.mjs tests/settingsCenter.test.mjs tests/themeVisualContract.test.mjs`
- Cases: section order/group/icon; native version success/failure; browser fallback; approved repository/releases URLs; opener failure; accessible actions; no editable fields or duplicated updater controls.

- [x] Add failing Settings registry and About component contracts.
- [x] Add native-version and external-link adapter regressions.
- [x] Add Light/Dark/System and compact-layout styling assertions.

## Task 2: Add the Read-Only About Page and Safe Native Links

**Outcome:** Users can identify their actual IdeaNote version and open the official project destinations from a polished Settings page.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src/lib/settingsSectionRegistry.ts`
- Create: `src/lib/appInfo.ts`
- Create: `src/components/settings/AboutSettings.tsx`
- Modify: `src/components/SettingsCenter.tsx`
- Modify: `src/index.css`
- Modify: focused tests from Task 1

**Change Map:**
- maintained native APIs: use Tauri v2 application-version and opener APIs, initialize only required desktop functionality, and grant the main window only the official URL-opening capability
- adapter boundary: expose runtime version and approved external destinations through a small injectable interface with honest browser/test fallback and normalized errors
- Settings registry: add the About definition after General without changing the existing AI/Editors order or auto-persistence provider
- About presentation: build one restrained identity block, version metadata row, and two quiet external-link actions with semantic status/error treatment
- theme/responsive: reuse existing Settings typography, surface, border, interaction, and focus tokens; preserve content scrolling and effective 850x850 fit

**Verification:**
- `node --test tests/aboutSettings.test.mjs tests/settingsCenter.test.mjs tests/themeVisualContract.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- Native smoke: open About in a tagged or tag-version test build, confirm the displayed version matches the application API, and verify both links open the expected GitHub destinations without console/runtime errors.

- [x] Add the maintained Tauri version/opener boundary and least-privilege capability.
- [x] Register and render the read-only About section without entering Settings persistence state.
- [x] Apply the compact Codex-like identity, metadata, link, error, theme, focus, and responsive styling.

## Task 3: Verify and Deliver F057

**Outcome:** The About page closes with current frontend, native, visual, accessibility, and workflow evidence in one isolated feature commit.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F057-add-an-about-page-to-settings.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- focused/full regression: registry, About adapter/component, Settings shell, themes, native capability, and existing update navigation remain intact
- visual/native acceptance: Light/Dark/System, desktop/850x850, keyboard/focus, version loading/success/failure, both links, and link-open failure
- workflow completion: record evidence, mark F057 complete/done, refresh the index, inspect the exact diff, and stage only F057 paths

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo build`
- `npm run tauri dev`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks while iterating and one stabilized full regression/build/native matrix.
- [x] Inspect About in Light/Dark/System and compact geometry with keyboard and failure states.
- [ ] Mark F057 complete/done after its approved F056 dependency completes, refresh the plan index, and create the final metadata follow-up.

## Current Delivery Evidence

- Focused About, Settings, and theme contracts passed, including honest browser fallback, native runtime-version resolution, approved GitHub destinations, inline opener failure, semantic styling, registry placement, and accessible action labels.
- The complete frontend suite passed with `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`; `npm run build` passed with the existing Vite chunk warnings.
- `cargo test` passed all 166 tests and `cargo build` passed with the existing Agent dead-code warnings.
- Playwright inspection passed in Light and Dark at 1200x850 and at effective 850x850 geometry. About had no horizontal or vertical overflow, the repository action received keyboard focus, and browser context displayed the honest `Development preview` label.
- `npm run tauri dev -- --no-watch` compiled and launched the current desktop source with the existing Tauri app/opener plugins. Automated native-window inspection was unavailable because the Computer Use native pipe failed to start, so visual/version acceptance relies on the adapter contract plus browser layout inspection rather than a claimed native screenshot.
- F057 remains `in_progress` because its approved plan depends on F056, which cannot complete until the separately recorded B044 macOS relaunch defect is diagnosed and fixed. The About implementation itself is delivered in its isolated feature commit.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F048-refine-settings-navigation-and-auto-apply.md`
- `docs/superplan/plans/features/F056-automatic-desktop-updates-from-github-releases.md`
- `src/components/SettingsCenter.tsx`
- `src/lib/settingsSectionRegistry.ts`
- `src/index.css`
- `src-tauri/capabilities/default.json`
- `src-tauri/src/lib.rs`
- `https://v2.tauri.app/reference/javascript/api/namespaceapp/`
- `https://v2.tauri.app/plugin/opener/`
