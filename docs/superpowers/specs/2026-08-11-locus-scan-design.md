# locus-scan — Discovery Scan Skill

Date: 2026-08-11
Status: approved

## Problem

`locus-research` documents the write path: how to save companies, roles, notes, and
evidence through the CLI. It does not say how to *find* candidates, how deep to dig
before discarding one, or how to score what you find.

Three companies researched by hand on 2026-08-09 and 2026-08-11 (Speechify, Superwall,
and the earlier Apple/TEKsystems thread) produced several judgments that were reinvented
each time and recorded nowhere reusable:

- Employer-review sites block automated fetching, so culture findings arrive as
  search snippets and carry lower confidence than the claim's importance suggests.
- Compensation only becomes legible when compared against the all-in figure in
  `.locus/compensation.md`. Superwall read as a pay cut until that comparison was made.
- Company fit and role fit diverge. Superwall scored 0.68 as a company and 0.45 as a
  role; a single number would have hidden the whole finding.
- A hard-requirement failure or a high-weight negative signal should cap a score, not
  average into it. Speechify's 0.72 became 0.40 for exactly this reason.

This skill encodes those rules so each round is comparable to the last.

## Scope

Discovery only: find companies that are not yet in Locus and are plausibly worth
pursuing. Triaging a link the user drops in stays with `locus-research`.

## Sourcing Strategy

Company-first, not job-board-first. Start from craft-driven Apple-platform and AI-native
companies that match the profile, then check whether they are hiring. Job boards bias
toward companies that advertise, which skews larger and less craft-driven — the
Bear/Raycast/Craft tier that best matches the profile rarely posts there.

## Sourcing Order (revised after rounds 2-4)

Order the funnel by the scarcest hard requirement, not the most interesting signal. For a
UTC+8 candidate that is geography. Craft-first screening spent rounds 1 and 2 to find
nothing; geography-first found the strongest candidate to date on its first pass in
round 3. Role-first sourcing from job boards was tested in round 4 and failed outright.

## Round Structure

1. **Dedup gate.** `pnpm locus company list --json`. Skip anything already present.
2. **Shallow screen, 10–15 candidates, 1–2 searches each.** Hard filters in order:
   remote, Apple-platform native, team shape, currently hiring. The search budget is
   part of the design — without it the screen phase expands to fill the round.
3. **Deep dive the top 3.** Full research: culture verification, compensation
   comparison, evidence capture, dual fit scores.

## Scoring Rubric

Two scores, always: one for the company, one for each role.

Anchored to the profile's own weights rather than invented per round:

- A failed hard requirement (weight 1.0, e.g. remote) caps the score at 0.3.
- A confirmed negative signal at weight >= 0.9 caps the score at 0.45.
- Unverified negative signals reduce but do not cap; note the uncertainty explicitly.
- Positive signals accumulate above the cap only when no cap applies.

## Verification Rules

- **Culture verification is mandatory before any deep dive is considered complete.**
  Sweep employer-review sources by search. `glassdoor.com` and `teamblind.com` return
  HTTP 403 to automated fetching, so content arrives as search-engine summaries.
  Record that limitation in the evidence snippet, set confidence at or below 0.6, and
  flag the claim for manual reading. Never present snippet-sourced culture claims as
  primary-source verified.
- **Bimodal review distributions are a finding, not noise.** A high aggregate beside a
  cluster of specific one-star accounts usually means either two employee tracks or
  review curation. Record which explanations were considered and which could not be
  ruled out.
- **Compensation** is compared against `.locus/compensation.md`, quoting deltas against
  the all-in annual figure per that file's own instruction, never against base alone.
- **Source-of-truth check on hiring.** Confirm open roles on the company's own jobs
  page. Aggregators and `about` pages go stale in both directions. In the first live
  round (2026-08-11) all three deep-dive candidates failed this check: Raycast and
  Flexibits had no open positions despite board listings, and Copilot Money's
  "live anywhere" iOS role did not exist on its own careers page, which described a
  hybrid New York / Santiago arrangement instead.
- **Listing-locale check.** The same requisition posted against several cities means a
  locale-tagged remote hire, not a local office. Verify before treating a city as a team.

## Status Assignment

Set automatically during a round:

- `rejected` — a hard requirement fails. Keep the evidence.
- `watching` — screened out but sound; worth revisiting.
- `researching` — deep-dived this round.

Durable judgments beyond this stay with the user, per the project convention that
profile-level changes require approval.

## Stop Condition

- One new session per round: `pnpm locus session start --goal "Discovery scan: <focus>"`.
- Verify with `pnpm locus export json` that the round's writes are present.
- Report counts: screened, deep-dived, skipped as duplicates, rejected. No silent
  truncation — if the round was capped, say what was dropped.

## Deliverable

A single `skills/locus-scan/SKILL.md`, symlinked into `.claude/skills/`, and listed in
the skills block in `CLAUDE.md`.
