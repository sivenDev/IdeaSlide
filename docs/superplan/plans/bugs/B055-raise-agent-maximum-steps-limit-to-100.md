---
id: "B055"
title: "Raise Agent maximum steps limit to 100"
type: "bugfix"
status: "complete"
summary: "Allow Agent maximum-step settings and runtime enforcement to use the requested 1–100 range."
source: "docs/superplan/human/bugs.md"
created: "2026-09-01"
order: 55
depends_on: []
parent: ""
---

# Raise Agent maximum steps limit to 100 Plan

**Goal:** Let users configure up to 100 Agent Tool steps while keeping the same bounded policy across settings persistence and both runtimes.
**Scope:** Change the maximum-step range from 1–20 to 1–100 in the Agent settings control, TypeScript normalization, Rust policy normalization, and Rust Tool Broker; update executable regressions and current product documentation to describe the new bound.
**Non-Goals:** Do not change the default of 8, step-count semantics, cached replay behavior, cancellation, Tool prerequisites, provider/runtime selection, or any other Agent policy range.
**Architecture:** The existing settings-to-Turn policy flow remains authoritative: TypeScript validates persisted settings for the UI and request payload, Rust normalizes the captured Turn policy, and `AgentToolBroker` enforces the same bound for Codex and Compatibility Tool activity. All four boundaries use the shared 1–100 contract.
**Baseline:** The input uses `max={20}`; `normalizeSettings` clamps `agent.maxSteps` to 1–20; `AgentPolicySettings::normalized` and `AgentToolBroker::with_max_steps` clamp to 1–20; `AgentToolBroker::new` defaults to 20. The PRD and F037 plan currently document 1–20.
**Reproduction:** Open Settings → Agent and enter `21` in Maximum steps. The input rejects values above 20, persisted settings normalize them to 20, and a Rust broker constructed with a higher value still stores 20.
**Root Cause:** The maximum-step safety bound was duplicated as a literal `20` across UI, TypeScript, and Rust instead of being updated as one policy contract when the requested product limit changed.
**Exit Criteria:** Values from 1 through 100 are accepted and persisted, values above 100 normalize to 100, both Rust policy and Tool Broker retain 100, the default remains 8, and Codex/Compatibility continue enforcing the configured count with unchanged semantics.

## Task 1: Update the shared maximum-step contract

**Outcome:** Every settings and runtime boundary accepts the same 1–100 maximum-step range.
**Files:**
- Modify: `src/components/settings/AgentSettings.tsx`
- Modify: `src/lib/settings.ts`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/agent/tool_broker.rs`

**Change Map:**
- `AgentNumberInput` call: expose `max={100}` for Maximum steps.
- `normalizeSettings`: clamp `agent.maxSteps` to 1–100 while retaining default 8.
- `AgentPolicySettings::normalized`: clamp captured Turn policy to 1–100.
- `AgentToolBroker::new`/`with_max_steps`: use a 100-step default and clamp explicit values to 1–100.

**Verification:**
- `node --test tests/settings.test.mjs`
- `cd src-tauri && cargo test --lib agent::types agent::tool_broker`

- [x] Replace every active maximum-step bound with 100.
- [x] Preserve default and step-count/replay semantics.

## Task 2: Add behavior-level regressions and align documentation

**Outcome:** Tests prove the new upper boundary at the settings and Rust enforcement layers, and current policy documentation no longer advertises the obsolete 20-step cap.
**Files:**
- Modify: `tests/settings.test.mjs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/src/agent/tool_broker.rs`
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/rfcs/001-codex-style-generic-agent.md`

**Verification:**
- `node --test tests/settings.test.mjs`
- `cd src-tauri && cargo test --lib agent::types agent::tool_broker`
- `npm run build`
- `cd src-tauri && cargo build`
- `git diff --check`

- [x] Assert 100 is retained and values above it normalize to 100.
- [x] Assert Rust policy and broker accept the 100-step boundary.
- [x] Update current product and RFC range references.

## Task 3: Complete B055 delivery evidence

**Outcome:** The bug and plan record the final verification evidence and are marked complete in one task-scoped delivery commit.
**Files:**
- Modify: `docs/superplan/plans/bugs/B055-raise-agent-maximum-steps-limit-to-100.md`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`

**Verification:**
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.7.0+codex.20260820095924/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.7.0+codex.20260820095924/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`

- [x] Record focused and final verification evidence.
- [x] Mark B055 and its human entry done.
- [x] Create a separate `fix(B055)` delivery commit.

## Completion Evidence

- Settings regression: `node --test tests/settings.test.mjs` (6 passed), including exact 100 acceptance, above-limit normalization, and the UI's shared `AGENT_MAX_STEPS` bound.
- Comprehensive frontend regression excluding the unrelated flaky WebKit drag-runtime file: `node --test $(find tests -maxdepth 1 -name '*.test.mjs' ! -name 'f012DragRuntime.test.mjs' -print)` (475 passed). The isolated `node --test tests/f012DragRuntime.test.mjs` also passed 2/2; the full concurrent suite twice hit that existing test's 30-second navigation timeout.
- Rust policy and Tool Broker coverage: `cargo test` from `src-tauri` (179 passed), including 1–100 normalization and the 101st unique Tool rejection.
- Builds and hygiene: `npm run build`, `cargo build`, targeted `rustfmt --check --edition 2021 src/agent/types.rs src/agent/tool_broker.rs`, and `git diff --check` passed. Build output contains only existing unused-code and Vite chunk warnings.
- Product documentation now states the 1–100 maximum-step range in `docs/superplan/human/prd.md` and `docs/rfcs/001-codex-style-generic-agent.md`; the default remains 8 and all other policy bounds are unchanged.

## References
- `docs/superplan/human/bugs.md#B055`
- `docs/superplan/human/prd.md`
- `docs/rfcs/001-codex-style-generic-agent.md`
- `src/components/settings/AgentSettings.tsx`
- `src/lib/settings.ts`
- `src-tauri/src/agent/types.rs`
- `src-tauri/src/agent/tool_broker.rs`
