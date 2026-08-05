---
id: "F021"
title: "Update Documentation to IdeaNote Branding"
type: "feature"
status: "complete"
summary: "Use IdeaNote consistently for current-product references across repository documentation while preserving exact legacy and technical identifiers."
source: "docs/superplan/human/features.md"
created: "2026-08-06"
order: 21
depends_on: []
parent: ""
---

# Update Documentation to IdeaNote Branding Plan

**Goal:** Make repository documentation consistently identify the current product as IdeaNote without rewriting technical compatibility facts or historical evidence.
**Scope:** Review every Markdown occurrence of `IdeaSlide`, `ideaSlide`, `ideaslide`, and `idea-slide`; replace occurrences that name the current product in headings, descriptions, examples, and user-facing prose with `IdeaNote`. Apply the review across top-level documentation, MCP comparison material, Superplan human and plan documents, and legacy Superpowers design/implementation documents.
**Non-Goals:** This plan does not rename repository directories, package/crate names, bundle identifiers, application-support directories, MCP protocol identifiers, Rust/TypeScript symbols, GitHub URLs, executable names, CSS selectors, recorded command output, predecessor/legacy references, or historical delivery evidence. It does not change application code, release workflow behavior, or runtime branding.
**Architecture:** Treat product branding and technical identity as separate documentation concepts. Human-readable references to the current product use `IdeaNote`; exact identifiers and statements about the former IdeaSlide product remain unchanged so commands, compatibility notes, links, and audit evidence stay accurate.
**Baseline:** A case-insensitive Markdown inventory finds 155 matching strings across 31 files. The set mixes stale current-product branding with intentional predecessor references, paths such as `idea-slide`, storage directories such as `ideaslide`, code symbols such as `IdeaSlideServer`, and historical installed-app evidence.
**Exit Criteria:** Current-product prose throughout the Markdown corpus uses `IdeaNote`; every remaining case-insensitive IdeaSlide match is an intentional technical, predecessor, legacy, path, URL, symbol, command, or historical-evidence reference; Superplan registries and plan indexes validate; and the final diff contains documentation-only branding changes.

## Task 1: Normalize current-product names across documentation

**Outcome:** Readers encounter IdeaNote as the current product name in all maintained and historical documentation prose, while exact identifiers and legacy facts remain usable and truthful.
**Files:**
- Modify where current-brand prose exists: `CLAUDE.md`
- Modify where current-brand prose exists: `README.md`
- Modify where current-brand prose exists: `README.zh-CN.md`
- Modify where current-brand prose exists: `docs/mcp-comparison.md`
- Modify where current-brand prose exists: `docs/superplan/human/*.md`
- Modify where current-brand prose exists: `docs/superplan/plans/**/*.md`
- Modify where current-brand prose exists: `docs/superpowers/plans/*.md`
- Modify where current-brand prose exists: `docs/superpowers/specs/*.md`

**Change Map:**
- top-level and MCP documentation: current product headings and explanatory prose
- Superplan human/plan artifacts: current-brand wording without altering ids, statuses, dependencies, acceptance history, or recorded evidence
- Superpowers plans/specs: product prose and example UI labels while retaining exact paths, identifiers, code symbols, and legacy storage names

**Verification:**
- Inventory all case-insensitive Markdown matches for `IdeaSlide`, `ideaSlide`, `ideaslide`, and `idea-slide`, then inspect every residual occurrence against the explicit preservation rules.
- Confirm no non-Markdown implementation or configuration file changed.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root /Users/zhengxiwan/ide-workspace/idea-slide validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root /Users/zhengxiwan/ide-workspace/idea-slide --write --check`
- `git diff --check`

- [x] Replace stale current-product branding with IdeaNote throughout the Markdown corpus.
- [x] Audit and retain only intentional technical, predecessor, legacy, and historical IdeaSlide identifiers.
- [x] Validate Superplan metadata and the documentation-only final diff.

## Delivery Evidence

- Updated 52 stale current-product references across 21 existing Markdown files, including both READMEs, contributor guidance, MCP comparison material, Superplan artifacts, and legacy design/implementation documents.
- Re-ran the case-insensitive corpus inventory: 103 matches remain, all reviewed as explicit predecessor/legacy references, exact paths and storage names, code symbols such as `IdeaSlideServer`, URLs, executable/bundle identifiers, commands, or recorded historical evidence.
- Confirmed every task change is Markdown-only; no application source, configuration, or release workflow file changed.
- Superplan human-request validation and exhaustive plan catalog/index generation passed.
- `git diff --check` passed.

## References
- `docs/superplan/human/features.md#f021-update-documentation-to-ideanote-branding`
- `docs/superplan/human/prd.md`
- `README.md`
- `README.zh-CN.md`
- `CLAUDE.md`
