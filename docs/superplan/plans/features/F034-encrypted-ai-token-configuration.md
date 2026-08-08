---
id: "F034"
title: "Store the AI Token in Encrypted Application Configuration"
type: "feature"
status: "complete"
summary: "Replace Keychain-backed AI credentials with encrypted application configuration plus password visibility and bounded Provider retry settings."
source: "docs/superplan/human/features.md"
created: "2026-08-09"
order: 39
depends_on: ["F033-04"]
parent: ""
---

# Store the AI Token in Encrypted Application Configuration Plan

**Goal:** Remove system Keychain interaction from normal AI configuration while keeping the provider token encrypted at rest, making token entry easier to verify, and letting users bound safe automatic Provider retries.
**Scope:** Replace the native Credential Vault implementation with a versioned encrypted credential envelope under the platform application configuration directory; generate separate application-owned key material with current-user-only file permissions; use authenticated encryption and atomic replacement; keep encryption, decryption, status, replacement, removal, and Agent access inside Rust; add a show/hide control for the token currently typed into AI Provider Settings; add versioned automatic-retry enablement and maximum-attempt settings; pass the effective retry policy through the generic Agent request into the OpenAI-compatible Provider adapter; update Settings wording; and revise the PRD, RFC, and Workspace format contract. Existing Keychain data is not read, migrated, or deleted automatically, so the user saves the token once into the new store without triggering a Keychain prompt.
**Non-Goals:** This plan does not return or reveal an already saved token to React; expose the token or decryption key to browser storage, logs, errors, Agent history, Recovery, Workspace metadata, or documents; synchronize credentials; support multiple provider secrets; add a master-password prompt; claim protection against malware or another process running as the same operating-system user; automatically access or delete the existing Keychain entry; make non-retryable or partially streamed/tool-executed requests retryable; configure custom backoff algorithms; change runtime selection/editor behavior; or weaken the AI enablement gate.
**Architecture:** Rust owns a small `CredentialRepository` rooted in `app_config_dir`. A maintained RustCrypto authenticated-encryption crate encrypts the trimmed token with a random nonce and a random 256-bit application key. The credential file contains only a schema version, algorithm identifier, nonce, and ciphertext; key material lives in a separate current-user-only file and never enters JSON or Tauri command responses. Both files use collision-safe staging, flush, and atomic replacement. Decryption failures, missing files, partial pairs, invalid permissions where enforceable, and tampered ciphertext return redacted configuration errors. The versioned non-secret settings contract adds `ai.retry.enabled` and `ai.retry.maxAttempts`, defaulting to enabled and three total attempts, with normalization bounding attempts to 1–5. Each Turn captures that policy and sends it through the format-agnostic Agent request; the Provider adapter applies it only to already-classified retryable failures before visible output or Tool progress, while retaining cancellable exponential backoff. The password visibility control changes only the current input field type and never requests the stored token. This is intentionally a simpler local-at-rest boundary than the OS vault: it prevents plaintext disclosure and accidental copying of the token alone, but a same-user attacker who can read both application files can decrypt it.
**Baseline:** F031-01 stores the provider token through the Rust `keyring` crate and describes OS-vault-only credentials in the PRD, RFC, Workspace format, tests, and Settings UI. `run_agent` reads the Keychain-backed token before every Provider request. The current Provider adapter automatically retries classified pre-progress failures with hard-coded limits of two or three total attempts and a cancellable exponential delay; Settings cannot disable or bound those attempts. The isolated F033 native test bundle triggered a macOS Keychain authorization dialog because its Bundle ID differed from the normal application while requesting the shared credential service. The current frontend never receives the saved secret and that invariant remains required.
**Exit Criteria:** Saving a token creates no Keychain request and persists only an authenticated-encrypted credential envelope plus separate restricted key material in the application configuration directory; plaintext searches across application configuration, logs, Recovery, Agent history, Workspace metadata, and documents find no token; the API Key field defaults hidden and an accessible control reveals or hides only the currently typed value; restart decrypts the saved token in Rust and a real Agent request succeeds; replace/remove/status behavior works without returning the saved token; automatic retry can be disabled or bounded to 1–5 total attempts, defaults to three, survives restart, is captured per Turn, and never retries after visible output or Tool progress; missing, corrupt, truncated, mismatched, or tampered credential files fail safely without leaking secret material; AI-disabled behavior remains unchanged; Settings accurately describes encrypted local configuration; the `keyring` dependency and Keychain product wording are removed; documentation states the reduced threat model; and focused/full Rust, frontend, build, native, restart, corruption, retry, and privacy verification passes.

## Task 1: Revise the Credential Storage Contract

**Outcome:** Product and architecture documentation authorize encrypted application configuration without overstating its security properties.
**Files:**
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/rfcs/001-codex-style-generic-agent.md`
- Modify: `docs/workspace-format.md`
- Modify: `docs/superplan/plans/features/F034-encrypted-ai-token-configuration.md`

**Change Map:**
- PRD: replace OS-vault-only requirements with Rust-owned authenticated-encrypted local credential storage, no-frontend-secret invariants, token-input visibility behavior, configurable safe retry policy, and the explicit same-user threat-model limit
- RFC: update provider configuration, persistence, security, retry, and acceptance statements without changing editor contracts
- Workspace format: keep credentials outside `.ideanote`, documents, Recovery, caches, and conversation history while locating the encrypted files under platform application configuration

**Verification:**
- Search all active product/RFC/workspace documentation for `vault`, `keychain`, `credential`, `API Key`, and `token`; confirm no active statement contradicts the new boundary.
- `git diff --check`

- [x] Authorize encrypted application configuration and remove active Keychain requirements.
- [x] State exactly what the local encryption protects and does not protect.
- [x] Define typed-input visibility and configurable retry behavior while preserving no-frontend-saved-secret, no-Workspace, no-Recovery, no-history, and AI-gate invariants.

## Task 2: Add the Native Encrypted Credential Repository

**Outcome:** Rust persists and reads the provider token without OS Credential Vault access or plaintext-at-rest storage.
**Files:**
- Modify: `src-tauri/src/settings.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Test: `src-tauri/src/settings.rs`

**Change Map:**
- credential repository: versioned envelope, random key/nonce generation, authenticated encryption/decryption, bounded token length, redacted errors, and zeroized transient secret buffers where supported
- filesystem safety: resolve only under `app_config_dir`, current-user-only key permissions, collision-safe staging, flush, atomic replacement, missing/partial/corrupt/tampered recovery, and independent credential/key removal
- Tauri commands: inject the application handle into status/set/delete and Agent-run reads without returning plaintext to the frontend
- dependencies: replace `keyring` with maintained RustCrypto encryption/randomness/zeroization crates and keep versions pinned by Cargo.lock
- migration boundary: never read or delete the old Keychain entry automatically; absence in the new store is `configuration-required`

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml settings -- --nocapture`
- Cases: first save; restart read; replace; remove; empty/oversized token; unique nonce; ciphertext differs from plaintext; restricted key permissions; missing key/envelope; partial pair; corrupt JSON; invalid Base64; tampered nonce/ciphertext; atomic-write failure; redacted diagnostics; no Keychain access.

- [x] Implement versioned authenticated-encrypted credential persistence with separate key material.
- [x] Route every Agent credential read through the native repository without frontend exposure.
- [x] Remove the Keychain dependency and prove safe failure/recovery behavior.

## Task 3: Simplify AI Provider Settings and Add Retry Configuration

**Outcome:** The Settings UI presents encrypted-local-token controls, safe password visibility, and a bounded retry policy.
**Files:**
- Modify: `src/components/settings/AiProviderSettings.tsx`
- Modify: `src/lib/settings.ts`
- Modify: `src/hooks/useSettings.tsx`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/lib/agent/agentRuntime.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/agent/runtime.rs`
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `tests/settings.test.mjs`
- Modify: `tests/settingsCenter.test.mjs`
- Modify: `tests/agentProtocol.test.mjs`
- Test: `src-tauri/src/agent/runtime.rs`

**Change Map:**
- UI copy: replace system-vault language with encrypted local configuration, retain replacement/removal/configured status, and add an accessible Eye/EyeOff control that reveals only the currently typed token and returns to hidden after save
- settings schema: add normalized `ai.retry.enabled` and `ai.retry.maxAttempts`, default enabled/3, bound attempts to 1–5, and migrate older settings without changing AI enablement/provider values
- request contract: capture retry settings at Turn start and pass them through generic frontend/Rust Agent request types without editor coupling
- Provider behavior: replace hard-coded attempt limits with the captured policy while preserving retry classification, no-retry-after-progress, cancellation during backoff, diagnostics, and manual Retry independence
- frontend security: retain status-only credential responses and ensure the saved token is never added to `AppSettings`, localStorage, React context, serialized Agent requests, or reveal-command APIs
- static security tests: reject Keychain wording/dependency references in active code and reject token-shaped fields in persisted frontend settings

**Verification:**
- `node --test tests/settings.test.mjs tests/settingsCenter.test.mjs tests/agentPanel.test.mjs tests/agentProtocol.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml agent::runtime -- --nocapture`
- Browser/Tauri cases: hidden/revealed current input, save resets hidden/empty, configured token cannot be read back, retry enabled/disabled, 1/3/5 attempts, restart persistence, enabled-unconfigured guidance, disabled AI, keyboard/focus behavior, and no native authorization dialog.

- [x] Replace Keychain-facing UI and add accessible current-input visibility without stored-token readback.
- [x] Persist and normalize bounded automatic retry settings and route them through the generic Agent request.
- [x] Preserve retry safety, frontend secrecy, Settings accessibility, manual Retry, and AI activation behavior.

## Task 4: Verify Native Agent Use and Privacy

**Outcome:** The simplified credential store works end-to-end without regressions or secret leakage.
**Files:**
- Modify: `docs/superplan/plans/features/F034-encrypted-ai-token-configuration.md`

**Change Map:**
- native acceptance: configure token, exercise input visibility, restart, run the Agent under enabled/disabled/bounded retry policies, replace/remove token, and confirm no Keychain dialog or Keychain API access
- privacy audit: inspect credential/configuration files, logs, Recovery, persisted Threads, Workspace metadata, and documents using a disposable marker token
- delivery evidence: corruption/tamper handling, permission inspection, AI-disabled lifecycle, frontend/Rust regressions, production build, and final diff

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native disposable-profile matrix plus password visibility, retry counts, restart/Agent request, file-permission inspection, tamper/corruption recovery, and marker-token privacy search.

- [x] Prove native Agent requests use the decrypted token after restart without Keychain interaction and obey the captured retry policy.
- [x] Prove plaintext never persists outside transient Rust memory.
- [x] Record the full security, regression, build, and native acceptance evidence.

## Completion Evidence

- `cargo test --manifest-path src-tauri/Cargo.toml settings -- --nocapture`: 6 credential repository tests passed, including encrypted round trip, replacement/removal, unique nonces, malformed/partial/tampered/invalid-Base64 failures, size bounds, Unix permissions, and symlink rejection.
- `node --test tests/*.test.mjs`: 307 frontend and contract tests passed, including schema-v2 migration, retry bounds, Settings visibility controls, no persisted token field, and retry-policy request wiring.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`: 112 Rust tests passed, including retry disabled, pre-progress retry recovery, no retry after visible output, cancellation during backoff, and safe-write regressions.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`, `npm run build`, `npm run tauri build -- --debug`, and `git diff --check` passed. The build produced the macOS application and debug DMG.
- Native macOS acceptance used a disposable marker and localhost Provider. The token field hid by default, revealed only typed input, reset after save, and triggered no Keychain prompt. Restart preserved configured status; files were `0700`/`0600`, the encrypted envelope contained no plaintext marker, and the Agent completed `/v1/responses` only when the decrypted token produced the expected Bearer header.
- Native cleanup restored `https://aigateway.claudeoffice.com/v1`, model `gpt-5.6-sol`, automatic retry enabled with three attempts, and an unconfigured credential state. The disposable credential and plaintext marker were absent afterward; the disposable Thread was moved to Trash as `F034-test-thread-512d6871-d8bb-4c23-a7a2-4571adb62430.json`.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-01-settings-and-ai-gating.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `docs/superplan/plans/features/F032-codex-style-generic-agent-rfc.md`
- `docs/rfcs/001-codex-style-generic-agent.md`
- `docs/workspace-format.md`
- `src-tauri/src/settings.rs`
- `src-tauri/src/agent/mod.rs`
- `src-tauri/src/agent/provider.rs`
- `src/components/settings/AiProviderSettings.tsx`
- `src/lib/settings.ts`
- `https://github.com/RustCrypto/AEADs/tree/master/aes-gcm`
