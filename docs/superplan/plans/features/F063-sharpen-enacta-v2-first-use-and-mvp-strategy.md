---
id: "F063"
title: "Sharpen Enacta V2 First-Use and MVP Product Strategy"
type: "feature"
status: "complete"
summary: "Refine the Enacta V2 guide around one trustworthy first outcome, a ten-minute activation path, stable Agent Home structure, and evidence-led expansion."
source: "docs/superplan/human/features.md"
created: "2026-08-14"
order: 63
depends_on: ["F062"]
parent: ""
---

# Sharpen Enacta V2 First-Use and MVP Product Strategy Plan

**Goal:** Turn the complete Enacta V2 vision into a sharper first-product strategy that lets a new user experience one trustworthy, editable outcome quickly and gives the team an evidence-led path to expand from tool to colleague.
**Scope:** Revise `docs/product/enacta-product-guide-v2.md` in professional Simplified Chinese without replacing the document or expanding its capability set. Establish one primary launch promise and make Phase 1 deliver the complete fuzzy-idea-to-IdeaSketch-to-reviewable-HTML-or-document loop instead of only infrastructure. Distinguish that acquisition loop from the Workspace-to-weekly-report retention loop and the voice-to-decision high-frequency entry. Define a ten-minute first-use journey, a stable Agent Home organized around Today, Waiting for Me, In Progress, and Recent Outcomes, progressive permission earning with action receipts, a simplified early-memory contract and periodic memory review, Work and Private governed contexts before personality-heavy personas, an explicit Outcome completion contract, and revised roadmap gates and success metrics. Keep the existing long-term Agent-first colleague, governed shared memory, Persona, background work, generated View, plugin, multi-Agent, and ambient-presence vision in later evidence-gated phases.
**Non-Goals:** This feature does not rewrite V2 into a different product category, remove the long-term multi-Persona or memory vision, add new product capabilities, overwrite V1, revise the approved PRD, modify RFC 003, implement Agent Home, build an Outcome or memory service, add voice capture, change application code, authorize any V2 implementation, or commit the roadmap to dates. It does not make IdeaSketch mandatory for every task, treat generated HTML as authoritative data, expose a personality system before context isolation works, weaken capability grants or editor transactions, ask users for broad initial access, or claim that a first successful task is sufficient to earn durable trust.
**Architecture:** The guide will separate three product horizons. Immediate activation is one narrow Outcome loop that reuses existing Workspace, IdeaSketch, Markdown, real-file, and Agent foundations. Repeat usage comes from Workspace-derived reporting and low-friction voice capture only after the first outcome is understandable and recoverable. Compounding value comes later from governed memory, Work/Private contexts, mature Personas, background Jobs, plugins, and ambient presence. Agent Home keeps a stable information architecture while editors and generated Views remain task-scoped projections. Trust expands through a visible ladder from one-task access to bounded reusable grants, with every consequential run producing a compact action receipt. Early memory favors explicit candidates, provenance, correction, non-use, deletion, and a periodic review digest; automatic ranking, decay, and compaction remain later policies informed by real usage. Each Outcome receives a completion contract covering deliverable, acceptance criteria, scope, deadline, pending human decisions, evidence, and honest terminal state.
**Baseline:** F062 delivered a comprehensive 1,396-line V2 guide with the correct Agent-first relationship, real-file and Kernel authority, governed memory, multiple Personas, view orchestration, user-expectation scoring, and five evidence-gated phases. Its current Phase 1 establishes Agent Home, Outcome visibility, permissions, Workspace access, basic memory, and editor orchestration, while the first complete user outcome loops wait until Phase 2. From an outside-user perspective, this delays the first undeniable value, leaves three initial loops insufficiently ranked, and gives the user more concepts than needed before trust has been earned. The user accepted the recommendation to preserve the long-term vision while sharpening first use, stable navigation, trust earning, early memory, context separation, and the definition of done.
**Exit Criteria:** The revised guide gives one unmistakable first-product promise and identifies fuzzy idea to IdeaSketch to a reviewable and exportable HTML or document Artifact as the primary acquisition loop without making it the only future workflow. It maps Workspace reporting to retention and voice capture to frequency. A new user can follow a bounded ten-minute journey from selecting one Workspace or task scope to reviewing a real-file outcome without configuring advanced Personas or memory policy. Agent Home has four stable user-facing regions and dynamic Views do not replace that frame. Permission progression starts with narrow task grants and records purpose, data used, actions, changes, evidence, reversibility, and memory candidates in an action receipt. Early memory controls are minimal and understandable, with periodic review before automatic decay and compaction; Work and Private contexts prove isolation before personality-heavy Persona expansion. Every meaningful Outcome has an explicit completion contract and cannot be marked complete when acceptance evidence or required human decisions are missing. Phase 1 delivers the complete primary loop, Phase 2 proves repeatability and expands to the other two loops, later phases preserve memory, Persona, proactive, ecosystem, and ambient goals. Metrics separately test activation, repeated outcomes, earned trust, memory value, and long-term retention. All current PRD, RFC, real-file, editor, permission, sandbox, deletion, and implementation-authorization boundaries remain intact.

## Task 1: Refine the V2 Guide Around First Value and Earned Trust

**Outcome:** Product, design, and engineering receive a V2 guide whose first release is small enough to build and test while still connecting coherently to the complete personal-colleague vision.
**Files:**
- Modify: `docs/product/enacta-product-guide-v2.md`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F063-sharpen-enacta-v2-first-use-and-mvp-strategy.md`
- Modify: `docs/superplan/plans/README.md`
- Preserve: `docs/product/enacta-product-guide.md`
- Preserve: `docs/superplan/human/prd.md`
- Preserve: `docs/rfcs/003-enacta-agent-kernel-and-plugin-architecture.md`
- Preserve: `docs/superplan/plans/features/F062-define-enacta-v2-agent-first-product-guide.md`

**Change Map:**
- launch promise and scenario hierarchy: one first-product promise; primary acquisition, retention, and high-frequency loops; explicit reasons for their sequencing
- first-use journey: a ten-minute path with one bounded scope, minimal setup, first clarification, optional IdeaSketch collaboration, reviewable output, real-file save, and a clear next step
- Agent Home: stable Today, Waiting for Me, In Progress, and Recent Outcomes regions; conversation and generated Views remain inside a predictable product frame
- earned trust: progressive grant ladder, narrow initial permissions, task-purpose explanations, action receipts, recovery and revocation, and no permission expansion through context or Persona switching
- early memory: visible candidates, source, use reason, correction, temporary exclusion, deletion, and periodic review digest before advanced ranking, decay, or compaction
- context before personality: Work and Private as governed data and capability contexts in early phases; richer Work, Life, and custom Persona expression only after isolation evidence
- Outcome completion contract: expected Artifact, acceptance checks, data and capability scope, deadline, pending decisions, evidence, review state, and honest complete, partial, failed, cancelled, or needs-review status
- roadmap and measurement: Phase 1 includes one complete Outcome loop; Phase 2 tests repeatability and adds Workspace and voice loops; activation, first-outcome time, second-task return, action-receipt comprehension, permission expansion, and definition-of-done metrics precede ecosystem metrics
- continuity and boundaries: preserve Agent-first positioning, real files, multi-authority data, Kernel security, editor transactions, governed memory, sandboxed generated Views, later Personas, and future-implementation approval gates

**Verification:**
- Compare the revised guide against F063 and confirm every accepted optimization appears as a product decision rather than an implementation promise.
- Compare Phase 1 and Phase 2 before and after the revision: Phase 1 must now deliver the primary complete Outcome loop; Phase 2 must prove repeatability and expand to Workspace reporting and voice capture.
- Confirm the first-use path can be understood without first configuring advanced Personas, automatic memory lifecycle, plugins, background Jobs, or broad permissions.
- Confirm Agent Home retains the four named stable regions while Markdown, IdeaSketch, domain editors, and Web Views remain task-scoped surfaces.
- Confirm permission progression cannot silently widen Scope and every action receipt states purpose, data, capability, effects, evidence, reversibility, and proposed memory.
- Confirm early memory controls are simpler than the mature memory system without deleting the mature model from the long-term vision; automatic permanent deletion remains prohibited without user action or explicit retention policy.
- Confirm Work and Private contexts do not become separate identities, memory silos, or capability shortcuts and that mature Work, Life, and custom Personas remain a later governed capability.
- Confirm the Outcome completion contract prevents false completion and preserves partial, failed, cancelled, and needs-review states.
- Recheck `docs/superplan/human/prd.md`, V1, and RFC 003 for current-scope authority, real-file authority, editor transactions, external-change protection, capability grants, cancellation, recovery, and sandbox boundaries.
- Check all local Markdown links, search for `TODO|TBD|FIXME|PLACEHOLDER`, inspect the heading structure, and run `git diff --check`.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root /Users/zhengxiwan/ide-workspace/idea-slide validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root /Users/zhengxiwan/ide-workspace/idea-slide --write --check`
- `git diff --check`

- [x] Give Enacta V2 one launch promise and assign distinct acquisition, retention, and high-frequency roles to the three initial loops.
- [x] Define the ten-minute first-use journey and stable four-region Agent Home without turning dynamic UI into the product frame.
- [x] Add progressive permission earning, action receipts, simplified early memory, and Work/Private contexts before mature Personas.
- [x] Add the Outcome completion contract and honest terminal-state rules.
- [x] Move one complete primary Outcome loop into Phase 1, make Phase 2 prove repeatability and expand coverage, and align gates and metrics.
- [x] Preserve every V1, PRD, RFC, real-file, editor, memory, permission, sandbox, and implementation-authorization boundary.
- [x] Complete documentation and Superplan validation, mark F063 done, and prepare one isolated `F063` commit.

## Delivery Evidence

- Revised `docs/product/enacta-product-guide-v2.md` from 1,396 to 1,558 lines while preserving its long-term Agent-first colleague vision and implementation-authorization disclaimer.
- Added one explicit first-release promise and ranked the three initial loops as primary acquisition and value proof, Workspace-based retention, and voice-based high-frequency entry.
- Defined a ten-minute first-use journey and a stable Agent Home with Today, Waiting for Me, In Progress, and Recent Outcomes; task-specific editors and generated Views remain inside that predictable frame.
- Added governed Work and Private Contexts before mature Persona expression, keeping one Enacta identity, one governed memory foundation, and unchanged permission boundaries.
- Added a P0–P3 progressive permission ladder and compact action receipt covering purpose, data, capabilities, changes, evidence, reversibility, memory candidates, and remaining review needs.
- Added a simplified early-memory contract with visible content, source, use reason, correction, temporary non-use, deletion, and periodic review before mature decay and compaction.
- Added an Outcome completion contract with expected result, acceptance criteria, Scope, constraints, pending human decisions, evidence, and honest `complete`, `partial`, `failed`, `cancelled`, and `needs_review` states.
- Reworked Phase 1 to deliver the complete fuzzy-idea-to-IdeaSketch-to-HTML-or-document Artifact loop. Phase 2 now proves repeatability and adds Workspace retention and voice frequency loops; later memory, Persona, proactive, plugin, multi-Agent, and ambient phases remain intact.
- Added activation, first-value, second-task return, action-receipt comprehension, and progressive-permission metrics, plus risks for infrastructure-only delivery, heavy onboarding, and false completion.
- Rechecked the current PRD and RFC 003 boundaries for real-file authority, shared editor core, editor-native transactions, external-change protection, bounded Workspace Tools, approval, recovery, and sandboxing.
- Local Markdown links passed, placeholder search returned no matches, the human registry reported `ok 113 requests`, the generated plan index passed `--write --check`, and `git diff --check` passed.

## References

- `docs/product/enacta-product-guide-v2.md`
- `docs/product/enacta-product-guide.md`
- `docs/superplan/human/prd.md`
- `docs/rfcs/003-enacta-agent-kernel-and-plugin-architecture.md`
- `docs/superplan/plans/features/F062-define-enacta-v2-agent-first-product-guide.md`
