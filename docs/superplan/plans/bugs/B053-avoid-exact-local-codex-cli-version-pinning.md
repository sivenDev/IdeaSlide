---
id: "B053"
title: "Avoid exact local Codex CLI version pinning"
type: "bugfix"
status: "complete"
summary: "Select installed Codex app-servers by protocol and capability compatibility instead of one hard-coded CLI version."
source: "docs/superplan/human/bugs.md"
created: "2026-09-01"
order: 53
depends_on: []
parent: ""
---

# Avoid exact local Codex CLI version pinning Plan

**Goal:** Let compatible installed Codex CLI releases serve as the rich Agent runtime without requiring the exact release used during development.
**Scope:** Remove the exact `0.147.0` gate from Codex process startup and discovery, probe the app-server initialize/handshake contract before advertising the runtime as compatible, and keep runtime failures truthful when required lifecycle, Tool, approval, cancellation, or dynamic-tool behavior is unavailable. Update tests and diagnostics to describe protocol compatibility rather than a pinned version.
**Non-Goals:** Do not upgrade or install Codex, change the user's PATH, redesign the Codex adapter protocol, support incompatible app-server schemas through speculative shims, change Compatibility behavior, alter model/provider settings, or modify the separate B052 editor Tool continuation fix.
**Architecture:** `LocalRuntimeProcess` remains responsible for launching an absolute executable and enforcing process/frame limits, but no longer performs an exact version comparison when `RuntimeCommandSpec.expected_version` is absent. Codex discovery performs a bounded initialize/initialized app-server probe and reports compatibility from that handshake. `CodexTurnDriver::start` remains the authoritative runtime check for thread start, dynamic editor Tools, and subsequent event contracts; any failure falls back with the existing diagnostic path.
**Baseline:** The installed runtime reports `codex-cli 0.152.0`, while `CodexAppServerAdapter::verify_version` delegates to `verify_version(output, PINNED_CODEX_VERSION)` and `command()` sets `expected_version: Some("0.147.0")`. `discover_runtime_catalog` therefore marks the installed Codex incompatible before app-server initialization, and the existing handshake test fails before it can exercise the protocol.
**Reproduction:** With the installed `codex-cli 0.152.0` on PATH, run `cd src-tauri && cargo test agent::adapters::tests::installed_codex_app_server_completes_a_compatible_handshake`. Before this fix the process is rejected with `Local Agent runtime version is incompatible; expected 0.147.0.` even though the app-server satisfies the required handshake.
**Root Cause:** Runtime compatibility is incorrectly encoded as string equality against a development-time CLI version. The gate runs before protocol negotiation, so any newer or patched compatible release is rejected without testing the capabilities the application actually needs.
**Exit Criteria:** Installed Codex versions other than `0.147.0` are accepted when the bounded app-server handshake and required capability contract succeed; incompatible or malformed handshakes remain unavailable with an actionable, version-agnostic diagnostic. Discovery and startup agree, no exact version constant is required by the Codex command spec, and focused plus complete checks document any unrelated environmental failures.

## Task 1: Replace Exact Version Gating with Handshake Compatibility

**Outcome:** Codex runtime discovery and startup accept compatible local releases and reject only unsupported protocol behavior.
**Files:**
- Modify: `src-tauri/src/agent/adapters/codex_app_server.rs`
- Modify: `src-tauri/src/agent/adapters/mod.rs`
- Modify: `src-tauri/src/agent/adapters/process.rs`
- Test: relevant Rust adapter/process tests
- Test: `tests/agentRuntimeSelection.test.mjs`

**Change Map:**
- command contract: remove the Codex-specific expected-version requirement while retaining executable, timeout, frame, and app-server arguments.
- discovery probe: launch the resolved Codex executable, perform initialize/initialized, validate the response shape, and shut down within bounded time; expose a truthful diagnostic on failure.
- runtime authority: preserve `CodexTurnDriver` checks for thread id, dynamic Tool registration, event mapping, approvals, cancellation, and shutdown.
- regression coverage: accept `0.152.0`-style output without exact matching, retain generic process version helper coverage for adapters that still opt into it, and reject malformed/incompatible handshakes.

**Verification:**
- `cd src-tauri && cargo test --lib agent::adapters`
- `cd src-tauri && cargo test --lib agent::provider`
- `node --test tests/agentRuntimeSelection.test.mjs tests/agentProtocol.test.mjs`
- `npm run build`
- `cd src-tauri && cargo build`
- When local Codex is available: installed app-server handshake and dynamic editor Tool smoke on the current CLI version.
- Full `cargo test` and full frontend test suite, recording unrelated failures separately.

- [x] Add a failing regression showing a compatible non-pinned Codex version is rejected.
- [x] Replace exact version gating with bounded app-server handshake compatibility.
- [x] Verify compatible, incompatible, timeout, shutdown, and existing fallback paths.

## Completion Evidence

- Codex app-server startup no longer performs an exact CLI version comparison; `RuntimeCommandSpec.expected_version` is unset for Codex while generic process version checks remain available to adapters that opt in.
- Runtime discovery launches the resolved executable, performs the bounded `initialize`/`initialized` handshake, validates errors, and shuts the process down before advertising Codex as compatible.
- Runtime diagnostics now report protocol compatibility rather than a pinned release number.
- Current local `codex-cli 0.152.0` passed the real discovery probe, handshake test, and opt-in dynamic editor Tool smoke.
- Adapter/Process tests (23), full Rust tests (177), full frontend tests, `npm run build`, and `cargo build` passed.

## References
- `docs/superplan/human/bugs.md#B053`
- `src-tauri/src/agent/adapters/codex_app_server.rs`
- `src-tauri/src/agent/adapters/mod.rs`
- `src-tauri/src/agent/adapters/process.rs`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-03-rich-runtime-comparison.md`
