---
id: "F062"
title: "Define Enacta V2 as an Agent-First Personal Colleague"
type: "feature"
status: "complete"
summary: "Create a Chinese V2 product guide for an Agent-first personal colleague with role-based personas, governed shared memory, and on-demand views over durable data and outcomes."
source: "docs/superplan/human/features.md"
created: "2026-08-14"
order: 62
depends_on: ["F060"]
parent: ""
---

# Define Enacta V2 as an Agent-First Personal Colleague Plan

**Goal:** Reframe Enacta from an AI-enabled workspace into a trusted, persistent personal AI colleague whose primary interaction is conversation and whose editors are invoked only when a human needs to see, shape, review, or deliver data.
**Scope:** Create `docs/product/enacta-product-guide-v2.md` in professional Simplified Chinese as a versioned upgrade to `docs/product/enacta-product-guide.md`. Define the V2 vision, positioning, user relationship, product ontology, Agent-first home, text and voice interaction, multiple role-based personas, durable shared memory, canonical data boundaries, intent-to-outcome lifecycle, permission and approval experience, dynamic view selection, Markdown and IdeaSketch roles, generated Web-view fallback, Workspace entry, background work, progressive autonomy, trust model, representative scenarios, migration from V1, a user-expectation-weighted capability roadmap, phase gates, success metrics, risks, and explicit product boundaries. Preserve V1 as the historical baseline and clearly state that the V2 guide does not itself authorize implementation.
**Non-Goals:** This feature does not overwrite or rename the V1 guide, revise `docs/superplan/human/prd.md`, implement a new shell or Agent runtime, change file formats, add voice capture, build a memory store, generate application UI, alter RFC 003, grant new runtime capabilities, weaken approvals, make a database authoritative for user file bodies, or promise unrestricted autonomous action. Personas are not separate user accounts, unrelated independent Agents, unrestricted memory partitions, or permission shortcuts. The guide will not claim that Enacta should remember everything, silently delete durable information based only on model judgment, expose sensitive Life context through a Work persona without authorization, prioritize visual novelty over completed work, or treat roadmap phases as irrevocable schedules. It does not copy the linked article's wording or treat its predictions as verified requirements.
**Architecture:** The guide will define five product layers. The Enacta Agent is the primary relationship and interaction layer, with multiple role-based personas representing the same Enacta colleague through different goals, tone, capability policies, and memory lenses. The Enacta Agent Kernel remains the privileged execution authority described by RFC 003. A durable data and memory layer stores application-owned Threads, events, preferences, permissions, plans, provenance, and bounded memory while keeping user-authored artifact bodies authoritative in real files. One governed memory foundation supports global user memory, domain-scoped Work/Life memory, persona working context, and episodic records without copying them into independent persona silos. Retrieval considers scope, relevance, importance, recency, repetition, confidence, provenance, sensitivity, expiry, and user correction. Memory lifecycle distinguishes reduced recall, decay, summarization/compaction, archival retention, policy expiry, and irreversible user-authorized deletion. A capability and outcome layer coordinates Tools, Skills, Workflows, specialist Agents, and approvals. A view layer selects a registered editor when semantic editing is supported and otherwise produces a sandboxed, disposable or exportable Web view derived from canonical data. UI state is never the source of truth, and neither personas nor generated views can bypass capability, revision, external-change, transaction, or approval boundaries. Roadmap ordering will use an explicit user-expectation score: reliable outcome completion and quality (30%), trust, control, privacy, and recoverability (25%), frequency and interaction-friction reduction (15%), memory compounding and personalization (15%), capability reuse and extensibility (10%), and delight, embodiment, or novelty (5%). Dependency and safety constraints may delay a feature, but every exception to descending user value must be explained.
**Baseline:** V1 defines Enacta as an Agent-driven, local-first AI Workspace with a persistent three-column shell, real files as the source of truth, registry-driven editors, and a right-side Agent. The current accepted PRD implements this workspace-first model and remains the authority for shipped behavior. Delivered Agent history already persists bounded local Threads but does not define cross-Thread personal memory, personas, memory scoring, controlled forgetting, or cross-domain disclosure rules. RFC 003 defines an Enacta-owned Agent Kernel, durable execution, capability-secured plugins, Tool Pipeline, editor authority, Job and Workflow orchestration, and specialist Agent adapters. The linked article argues that AI-era products move from tools to colleagues, repetitive software becomes Agent-consumed capability, interfaces become generated and temporary, and humans focus on intent, judgment, and responsibility. The user's new direction applies those ideas by making Enacta Agent the default product surface, retaining Workspace and editors as optional human-facing instruments, and allowing the same colleague to adopt Work, Life, or custom personas over a unified but governed memory foundation.
**Exit Criteria:** A new Chinese V2 product guide exists and is understandable without the article, V1 guide, PRD, or RFC. It gives one unambiguous product definition: Enacta is a persistent personal AI colleague, not primarily a workspace or editor suite. It explains exactly what remains canonical data, what belongs to Agent memory, when Markdown, IdeaSketch, another registered editor, or a generated Web view opens, and how the Workspace remains accessible without being the startup center. It defines Work, Life, and custom personas as role projections of one Enacta identity; specifies which memory is global, domain-scoped, persona-working, or episodic; prevents accidental sensitive cross-persona disclosure; and gives users visible controls to inspect, correct, pin, re-scope, forget, delete, and export memory. It distinguishes context exclusion, decay, compaction, expiry, and deletion; describes how low-value conversation fades and important verified memory persists; includes the report-outline-to-HTML and cross-persona continuity scenarios; distinguishes temporary views from durable artifacts; and preserves every applicable local-first and editor-safety invariant. It includes a weighted capability matrix and a staged roadmap that puts trustworthy task completion ahead of novelty: Phase 1 establishes the Agent Home, text interaction, visible outcomes, permission/activity controls, Workspace access, basic inspectable memory, and existing editor orchestration; Phase 2 proves the three core outcome loops, push-to-talk voice, bounded HTML views, and memory provenance/correction; Phase 3 introduces mature memory ranking/forgetting plus Work, Life, and custom personas; Phase 4 adds recurring/background work and carefully bounded proactive behavior; Phase 5 explores ambient desktop presence, richer generated interfaces, broader plugins, and multi-Agent expansion. Every phase states prerequisites, measurable user-success and trust gates, and re-ranking rules based on observed evidence. The guide records V1-to-V2 continuity and changed assumptions, cites its inputs, passes local-link and Markdown hygiene checks, and is delivered only after this revised draft plan receives human approval.

## Task 1: Author the Enacta V2 Product Guide

**Outcome:** Product, design, and engineering receive one decision-ready V2 guide that can steer future PRD revisions and implementation plans around an Agent-first colleague experience.
**Files:**
- Create: `docs/product/enacta-product-guide-v2.md`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F062-define-enacta-v2-agent-first-product-guide.md`
- Modify: `docs/superplan/plans/README.md`
- Preserve: `docs/product/enacta-product-guide.md`
- Preserve: `docs/superplan/human/prd.md`
- Preserve: `docs/rfcs/003-enacta-agent-kernel-and-plugin-architecture.md`

**Change Map:**
- document identity and upgrade contract: V2 metadata, relationship to V1, current-PRD authority, central thesis, positioning, principles, and explicit changed assumptions
- product ontology: User, Enacta identity, Persona, Intent, Memory, Data Object, Artifact, Outcome, Permission, Activity, Workspace, Capability, Editor, and View
- primary experience: Agent Home on launch, text/voice composer, explicit or context-suggested persona selection, ongoing relationship, activity and status, proactive but bounded follow-up, ambient desktop-pet presence, Workspace entry, and interruption rules
- persona model: built-in Work and Life roles plus user-defined personas; stable role description, tone, goals, tool/capability policy, default data scope, permission boundary, memory lens, switch behavior, provenance, and a clear indication that every persona is the same Enacta colleague rather than a separate identity
- data and memory: global, domain-scoped, persona-working, episodic, semantic, preference, project, and procedural memory; provenance, confidence, importance, recency, repetition, sensitivity, correction, pinning, re-scoping, decay, contextual forgetting, compaction, retention, expiry, deletion, and export; separation between application-owned state and real-file artifact authority
- outcome loop: capture, understand, clarify, request capability, plan, execute, present, review, commit, learn, and resume across foreground Turns and background Jobs
- view orchestration: decision policy for conversational cards, Markdown, IdeaSketch, registered domain editors, and sandboxed generated Web views; lifecycle, persistence, export, accessibility, and prohibition on treating rendered UI as canonical state
- human authority: contextual permission dialogs, scoped and expiring grants, preview, approval, reject, edit, pause, cancel, undo, recovery, visible provenance, and progressive autonomy
- representative scenarios: IdeaSketch report outline to delivered HTML in the Work persona, Life-to-Work continuity with sensitive-memory isolation, voice-to-project outcome, recurring brief, memory correction and forgetting, memory-assisted collaboration, and Workspace/file inspection
- platform continuity: mapping to RFC 003 Kernel, Tool Pipeline, Plugin/Skill model, editor transactions, real files, event persistence, specialist Agents, Workflow, and local-first security
- user-expectation prioritization: weighted scoring model for outcome completion, trust/control, interaction frequency, memory compounding, extensibility, and delight; feature-level scorecards; dependency exceptions; evidence-driven re-ranking; and explicit avoidance of novelty-led sequencing
- strategy and measurement: V1-to-V2 migration, five staged capability phases, phase prerequisites, adoption/trust/outcome gates, capability maturity, product risks, non-goals, and decision gates for future PRD work

**Verification:**
- Review every section against the user's stated V2 direction and the linked article's tool-to-colleague, Agent-facing capability, generated-product, and human-judgment themes without reproducing article prose.
- Compare V2 with `docs/product/enacta-product-guide.md` and include an explicit continuity/change matrix covering product center, startup surface, Workspace, editors, data, memory, interaction, autonomy, and success metrics.
- Check V2 against `docs/superplan/human/prd.md` and state that shipped V1 behavior remains authoritative until separate PRD and implementation plans are approved.
- Check V2 against `docs/rfcs/003-enacta-agent-kernel-and-plugin-architecture.md` for Kernel authority, capability security, memory/persistence boundaries, Tool Pipeline, editor transactions, cancellation, approvals, and recovery.
- Check the persona model against misuse cases: Life memory leaking into Work, persona switching widening capability grants, one persona creating contradictory global facts, stale memory outranking corrected memory, low-value conversation being retained indefinitely, decay being confused with deletion, and model-initiated deletion without an explicit policy or user action.
- Confirm memory ranking and lifecycle remain explainable product policies rather than hidden model intuition: every durable memory has scope, provenance, confidence, importance, sensitivity, timestamps, correction state, and retention behavior, while users can inspect and override material decisions.
- Confirm every material V2 capability appears in a priority matrix with its user-expectation score, user problem, dependency, proposed phase, success signal, trust risk, and reason when dependency order overrides raw score.
- Confirm the roadmap places Agent task completion, visible outcomes, permissions, memory control, and the three core workflows before advanced personas, proactive autonomy, ambient desktop behavior, broad generated UI, plugins, or multi-Agent expansion.
- Confirm each phase has an evidence gate and can be re-ranked from observed adoption, completion, correction, permission, privacy, and retention data rather than being presented as a fixed calendar commitment.
- Check every local Markdown link and the external inspiration link.
- Search for placeholders, accidental English-only reader-facing sections, duplicated source-of-truth claims, and language that implies implementation authorization.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root /Users/zhengxiwan/ide-workspace/idea-slide validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root /Users/zhengxiwan/ide-workspace/idea-slide --write --check`
- `git diff --check`

- [x] Define Enacta V2 around a persistent Agent colleague and Agent Home rather than a workspace-first shell.
- [x] Define Work, Life, and custom personas as governed role projections of one Enacta identity over a unified memory foundation.
- [x] Specify durable data, memory ranking, controlled forgetting, artifact, permission, outcome, and view boundaries without weakening V1 safety invariants.
- [x] Describe on-demand editor and generated Web-view behavior through concrete end-to-end scenarios.
- [x] Prioritize every major capability through the weighted user-expectation model and group delivery into evidence-gated phases.
- [x] Document V1 migration, phased delivery, risks, metrics, re-ranking rules, and future PRD decision gates.
- [x] Complete documentation and Superplan validation, mark F062 ready for one isolated `F062` commit.

## Delivery Evidence

- Created `docs/product/enacta-product-guide-v2.md` as a 1,396-line standalone Chinese product guide covering the Agent-first product definition, governed shared memory, Work/Life/custom personas, intent-to-outcome lifecycle, permissions, view orchestration, representative scenarios, V1 continuity, metrics, risks, and five evidence-gated phases.
- Reviewed the guide against V1, the current approved PRD, and RFC 003. The guide explicitly preserves current-PRD authority, real-file Artifact authority, editor-native transactions and Undo/Redo, external-change protection, Kernel capability boundaries, and the requirement for future approved implementation plans.
- Reviewed critical misuse boundaries: Persona switching cannot expand existing grants; unified memory is scope- and sensitivity-governed rather than universally shared; corrected memories outrank stale facts; model judgment alone cannot permanently delete memory; and generated Web Views run as non-authoritative, permissionless sandbox projections.
- Expanded the weighted capability matrix to record the user problem, dependency, proposed phase, success signal, trust risk, and scheduling rationale for each major capability. Every phase records its leading user-expectation weights, prerequisites, observable evidence gate, and re-ranking basis.
- `wc -l docs/product/enacta-product-guide-v2.md` reported 1,396 lines; heading inspection reported 135 level 1–3 headings.
- Placeholder search for `TODO|TBD|FIXME|PLACEHOLDER` returned no matches.
- The local Markdown-link checker reported `local markdown links: ok`.
- `python3 .../human_requests.py --root /Users/zhengxiwan/ide-workspace/idea-slide validate` reported `ok 112 requests` before completion metadata was applied.
- `python3 .../generate_plans_readme.py --root /Users/zhengxiwan/ide-workspace/idea-slide --write --check` updated and validated the plan index before completion metadata was applied.
- `git diff --check` passed for the stabilized guide and planning artifacts.

## References

- `docs/product/enacta-product-guide.md`
- `docs/superplan/human/prd.md`
- `docs/rfcs/003-enacta-agent-kernel-and-plugin-architecture.md`
- `docs/superplan/plans/features/F060-enacta-agent-kernel-and-plugin-architecture-rfc.md`
- `docs/superplan/plans/bugs/B050-translate-enacta-agent-kernel-rfc-into-chinese.md`
- `https://mp.weixin.qq.com/s/57L1Qokt5dxCgAVyhQrYcA`
