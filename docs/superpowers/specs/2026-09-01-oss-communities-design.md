# OSS Communities — A Second Track in Locus

Date: 2026-09-01
Status: approved

## Problem

Locus models a job search: companies, roles, applications, and a pipeline that moves
targets toward an offer. Six discovery rounds have now established that this pipeline is
mostly dry — 59 companies, and the count of applicable open iOS roles for a UTC+8
candidate has been approximately zero every round. The companies that fit best hire least
often and least publicly.

That pushed the strategy toward building public evidence of craft rather than watching
job boards, and open-source participation is the most concrete form that takes. A
discovery pass on 2026-08-28 produced a genuinely useful result set: which communities
exist, which actually merge outside contributions, and how fast. Those findings currently
live in a single session note (note 52) as prose.

Prose is the wrong home. The whole value of the openness data is that it is comparable
across communities and that it decays — a project that merged outsiders generously last
year may not now, and `modelcontextprotocol/swift-sdk` and `automerge-swift` were both
caught going stale precisely because their last-push dates were checked. A note cannot be
sorted, filtered, or re-checked; a table can.

## Scope

Store and evaluate open-source communities as first-class records, with the same
research affordances companies already have: notes, evidence, fit scoring, and a
re-checkable freshness stamp.

Out of scope, deliberately:

- **A contribution pipeline.** Tracking individual PRs and issues duplicates what GitHub
  already stores better. The community's `status` field captures the one state that
  matters; if "what should I do next" ever needs answering from Locus, that is a later
  decision made with real usage behind it.
- **A link to companies.** `raycast/extensions` does connect to Raycast, and Anytype's
  repo connects to a company that may yet enter the pipeline. But the user framed the OSS
  angle as an independent track rather than a route into targets, so a `company_id`
  column would be speculative. It is a nullable column to add later if a query ever needs
  it, and hard to remove once things depend on it.
- **Browse UI rendering.** The read-only cockpit stays untouched. Communities are worked
  from the CLI and by agents over MCP, which is where research writes already happen.
- **`taggings` support.** Nothing in the data uses tags yet. Rebuilding that table to
  accept a new target type would be speculative work in a migration that already carries
  the project's main risk.

## Design decisions

Four decisions were settled before design, and they constrain everything below.

**Communities are an independent track, not a satellite of companies.** This rules out
the cheapest implementation — a `kind` discriminator on the `companies` table — because
it would conflate two things the user explicitly separated. Every existing query, the
`locus-status` skill, and the browse UI would need a filter, and missing one would report
`GRDB.swift` as a job prospect.

**The evaluated list is the deliverable, not a pipeline.** Smallest thing that works.

**Openness signals are structured columns, not prose.** This is the decision that makes a
community worth modelling separately at all. A community record without sortable,
decaying openness data is just a company row with the wrong columns.

**Full conventional surface: data layer, CLI, and MCP.** Matching what every other entity
in Locus already has. A half-wired entity would break the convention that every CLI
operation has an MCP equivalent.

## Schema

New migration `src/db/migrations/0004_communities.sql`, registered in the ordered
`migrations` array in `src/db/migrate.ts`.

```sql
create table communities (
  id integer primary key autoincrement,
  name text not null,
  url text,
  ecosystem text,
  summary text,
  primary_label text,
  status text not null check (status in
    ('researching', 'watching', 'contributing', 'rejected', 'archived')),
  median_merge_days real check (median_merge_days is null or median_merge_days >= 0),
  outsider_merge_ratio real check (outsider_merge_ratio is null
    or (outsider_merge_ratio >= 0 and outsider_merge_ratio <= 1)),
  last_activity_at text,
  fit_score real check (fit_score is null or (fit_score >= 0 and fit_score <= 1)),
  fit_assessment text,
  last_checked_at text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);
```

The shape deliberately mirrors `companies` — `status`, `fit_score`, `fit_assessment`,
`last_checked_at` all carry identical meaning — so the two entities read the same way in
exports and to agents. What differs is the middle three columns.

`median_merge_days` and `outsider_merge_ratio` are the openness pair. Together they
answer the only question that decides whether a community is worth joining: does it merge
work from people outside the core team, and how long does that take? The 2026-08-28 sweep
showed how sharply these separate: `raycast/extensions` at 0.1 days with 21 distinct
authors across 32 merges, against `anyproto/anytype-ts` where 38 of 40 recent merges came
from a single core developer — open source by licence, closed in practice. Neither star
count nor open-issue count distinguishes those two.

`last_activity_at` holds the repository's last push date and exists to catch stagnation.
It replaces the `open_issues` column from the approved sketch, because open-issue count
proved to be noise: IceCubesApp carries 567 and is healthy, Point-Free carries 25 and is
healthy. Last-push date is what actually flagged `modelcontextprotocol/swift-sdk` (May
2026) and `automerge-swift` (April 2026) as stagnating.

`ecosystem` holds the language or platform — `Swift`, `TypeScript`, `Clojure`. It exists
because stack mismatch is a real screen: Logseq is an excellent PKM fit and a genuine
Clojure/ClojureScript barrier.

All three openness columns are nullable. A community can be recorded before it is
measured, and the CHECK constraints follow the codebase's existing convention of
`x is null or (...)`.

### Extending the polymorphic target types

`notes` and `evidence` both constrain `target_type` with an enumerated CHECK. SQLite
cannot alter a CHECK constraint in place, so each table must be rebuilt with the standard
create-copy-drop-rename sequence, adding `'community'` to the enumeration and recreating
`idx_notes_target` and `idx_evidence_target` afterwards.

`taggings` carries the same constraint and is deliberately left alone.

`src/db/schema.sql` is a canonical reference copy that no code loads — confirmed by
searching `src/` for references and finding none outside the Phase 1 plan document. It
must be updated by hand to match, or it silently becomes wrong.

## Domain layer

`src/domain/enums.ts`:

```ts
export const communityStatuses =
  ["researching", "watching", "contributing", "rejected", "archived"] as const;
export type CommunityStatus = (typeof communityStatuses)[number];
```

and `targetTypes` gains `"community"`.

`src/domain/types.ts` gains `Community`, `CommunityInput`, and `CommunityUpdate`,
following the `Company` / `CompanyInput` / `CompanyUpdate` triple.

`src/domain/validators.ts` gains a community validator mirroring the company validator,
enforcing a non-empty name, a valid status, and the numeric ranges above.

## Repository

`src/repositories/communityRepository.ts`, modelled on `companyRepository.ts` (125 lines,
four exported functions):

```ts
addCommunity(db, input): Community
getCommunity(db, id): Community | null
listCommunities(db, filters: { status?: CommunityStatus }): Community[]
updateCommunity(db, id, input): Community
```

Same signatures, same `updated_at` handling, same partial-update semantics as the company
repository. No new patterns.

## CLI

Added to `src/cli/index.ts` alongside the existing command groups:

```
locus community add    --name --url --ecosystem --summary --primary-label
                       --status --median-merge-days --outsider-merge-ratio
                       --last-activity-at --fit-score --fit-assessment [--stdin] [--json]
locus community list   [--status] [--json]
locus community show   --id [--json]
locus community update --id [...same fields] [--stdin] [--json]
```

`--stdin` accepts a JSON object, matching `company add --stdin`. Every command supports
`--json`, per the project convention that all CLI output is agent-consumable.

## MCP

Four tools in `src/mcp/tools.ts` — `locus_community_add`, `locus_community_list`,
`locus_community_show`, `locus_community_update` — wrapping the same repository functions
with the same validators, taking the tool surface from 24 to 28. `docs/mcp.md` is updated
to document them.

## Testing

Three of the four areas are mechanical and get conventional coverage matching the
existing per-entity pattern:

- `tests/repositories/communityRepository.test.ts` — add, get, list with and without a
  status filter, update including partial update, and rejection of out-of-range
  `fit_score` and `outsider_merge_ratio`.
- `tests/cli/community.test.ts` — each subcommand, `--json` output shape, `--stdin`
  input.
- `tests/domain/validators.test.ts` — extended for the community validator.

### The migration test carries the real risk

Everything else in this design is additive and safe to get wrong. The `notes` and
`evidence` rebuild is not. A create-copy-drop-rename that silently loses rows would
destroy six rounds of research — 52 notes and 91 evidence rows at time of writing, none
of it reproducible.

`tests/db/migrate.test.ts` therefore gains a test that:

1. Migrates a fresh database to `0003`.
2. Seeds notes and evidence rows across several target types, including edge cases: a
   note with a null `target_type` — six such rows exist in the live database, so this is
   a real case rather than a hypothetical — and rows carrying every currently-valid
   target type.
3. Applies `0004`.
4. Asserts row counts are unchanged **and** that every seeded row's content round-trips
   field for field — not just that the count matches.
5. Asserts a `'community'` target row now inserts successfully, and that an invalid
   target type is still rejected, proving the CHECK was rebuilt rather than dropped.

Operationally, the real database file is copied before the migration runs against it.

## Migration and rollout

The migration is additive from the caller's perspective: no existing table loses a
column, no existing value becomes invalid, and every current `target_type` remains legal.
Existing rows are untouched apart from being copied through the rebuild.

Once it lands, the 2026-08-28 findings in note 52 are entered as the first community
records — `raycast/extensions`, the Point-Free libraries, `GRDB.swift`,
`Dimillian/IceCubesApp`, `logseq/logseq`, with `anyproto/anytype-ts` and
`pointfreeco/swift-structured-queries` recorded as `rejected` for being closed to
outsiders in practice. The note stays as the narrative record; the table becomes the
queryable one.

## Success criteria

- `pnpm run check` and `pnpm test` pass.
- The migration test proves notes and evidence survive the rebuild intact.
- The 2026-08-28 community findings are queryable and sortable by openness.
- A future scan round can re-check a community's openness and see the previous values
  change, rather than reading a stale sentence in a note.
