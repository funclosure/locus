# Locus Grand Plan

> This plan describes the product architecture and phased implementation order. It is not a step-by-step coding checklist yet.

## Architecture

Locus has four main layers:

```txt
Agent Surface
Codex / Claude / future agent UI
        |
        v
Skill Layer
Agent instructions for research, curation, evidence, learning, and export
        |
        v
Agent Interface Layer
CLI first, then MCP or local HTTP API
        |
        v
Data Layer
Local structured storage for profile, sessions, companies, roles, notes, evidence
        |
        v
Browse UI
Local review console for inspection, editing, approval, filtering, and export
```

## Design Principles

- Locus owns structured memory; agents own conversation.
- The browse UI is for review and navigation, not primary chat.
- Agent writes should be structured and inspectable.
- Session learning is allowed; durable profile changes require approval.
- Evidence is a first-class object, not a footnote.
- Cards stay visually quiet; details live one level deeper.
- Start local and debuggable before adding deeper agent integrations.

## Recommended Technical Direction

### App Shell

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Dark-first UI tuned for dense review workflows.

### Storage

- SQLite for local durability.
- A small schema layer with migrations.
- JSON import/export for portability.

### Agent Interface

- Start with a CLI named `locus`.
- Commands read/write the same local database used by the UI.
- Use JSON input/output modes so agents can call commands reliably.
- Add MCP after command behavior stabilizes.

### Skill Layer

- Create Codex-compatible skills in `skills/`.
- Keep the content mostly model-neutral so Claude project instructions can reuse it.
- Skills should describe behavior, tool usage, evidence discipline, and preference learning rules.

## Data Model

The initial schema should be optimized for agent writes, local debugging, and the browse UI. Keep it in one local SQLite database and expose the same model through the CLI and UI.

### Tables

#### `profiles`

Durable approved user profile.

- `id`: primary key.
- `name`: profile display name.
- `summary`: approved profile summary.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

#### `profile_preferences`

Approved durable preferences linked to a profile.

- `id`: primary key.
- `profile_id`: references `profiles.id`.
- `kind`: `preference_kind`.
- `label`: short preference label.
- `description`: concise explanation.
- `weight`: nullable `REAL` in `[0.0, 1.0]`.
- `source`: `manual`, `approved_candidate`, or `import`.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

#### `sessions`

Bounded research sessions.

- `id`: primary key.
- `profile_id`: references `profiles.id`.
- `title`: short session name.
- `goal`: research goal.
- `status`: `session_status`.
- `started_at`: session start timestamp.
- `ended_at`: nullable session end timestamp.
- `summary`: nullable session summary.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

#### `session_memory`

Session-local observations and learnings.

- `id`: primary key.
- `session_id`: references `sessions.id`.
- `kind`: `memory_kind`.
- `content`: memory content.
- `confidence`: nullable `REAL` in `[0.0, 1.0]`.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

#### `preference_candidates`

Proposed durable profile updates inferred during a session.

- `id`: primary key.
- `session_id`: references `sessions.id`.
- `profile_id`: references `profiles.id`.
- `kind`: `preference_kind`.
- `label`: short candidate label.
- `description`: proposed durable preference text.
- `confidence`: nullable `REAL` in `[0.0, 1.0]`.
- `status`: `candidate_status`.
- `created_at`: creation timestamp.
- `reviewed_at`: nullable review timestamp.

#### `companies`

Company records.

- `id`: primary key.
- `name`: company name.
- `url`: nullable company URL.
- `hq`: nullable headquarters/location note.
- `summary`: short agent-written summary.
- `primary_label`: card label such as `craft-driven` or `AI-first`.
- `status`: `company_status`.
- `fit_score`: nullable `REAL` in `[0.0, 1.0]`.
- `fit_assessment`: nullable text assessment.
- `last_checked_at`: nullable timestamp.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

#### `roles`

Role records linked to companies.

- `id`: primary key.
- `company_id`: references `companies.id`.
- `title`: role title.
- `url`: nullable role URL.
- `location`: nullable location text.
- `remote_policy`: `remote_policy`.
- `seniority`: nullable seniority text.
- `compensation`: nullable compensation text.
- `summary`: short role summary.
- `status`: `role_status`.
- `fit_score`: nullable `REAL` in `[0.0, 1.0]`.
- `fit_assessment`: nullable text assessment.
- `last_checked_at`: nullable timestamp.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

#### `notes`

Standalone or linked notes.

- `id`: primary key.
- `session_id`: nullable reference to `sessions.id`.
- `target_type`: nullable `target_type`.
- `target_id`: nullable target primary key.
- `title`: nullable note title.
- `body`: note body.
- `kind`: `note_kind`.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

#### `evidence`

Source-backed factual support.

- `id`: primary key.
- `target_type`: `target_type`.
- `target_id`: target primary key.
- `url`: source URL.
- `title`: nullable source title.
- `snippet`: source quote or summary.
- `source_type`: `source_type`.
- `confidence`: nullable `REAL` in `[0.0, 1.0]`.
- `checked_at`: timestamp for when the source was checked.
- `created_at`: creation timestamp.

#### `tags`

Reusable labels.

- `id`: primary key.
- `name`: unique tag name.
- `color`: nullable UI color token.

#### `taggings`

Polymorphic tag assignments.

- `id`: primary key.
- `tag_id`: references `tags.id`.
- `target_type`: `target_type`.
- `target_id`: target primary key.

#### `exports`

Generated artifacts.

- `id`: primary key.
- `session_id`: nullable reference to `sessions.id`.
- `format`: `markdown` or `json`.
- `title`: export title.
- `path`: local file path.
- `created_at`: creation timestamp.

### Enums

- `company_status`: `researching`, `shortlisted`, `watching`, `rejected`, `archived`.
- `role_status`: `researching`, `interested`, `applied`, `rejected`, `closed`, `archived`.
- `session_status`: `active`, `paused`, `completed`, `archived`.
- `candidate_status`: `pending`, `approved`, `rejected`, `superseded`.
- `preference_kind`: `requirement`, `positive_signal`, `negative_signal`, `interest`, `constraint`.
- `memory_kind`: `observation`, `inference`, `decision`, `question`, `summary`.
- `note_kind`: `observation`, `decision`, `question`, `summary`.
- `source_type`: `company_site`, `job_post`, `article`, `social`, `docs`, `manual`, `other`.
- `remote_policy`: `remote`, `hybrid`, `onsite`, `unknown`.
- `target_type`: `profile`, `session`, `company`, `role`, `preference`, `preference_candidate`.

### Locked Decisions

- Use a single package for CLI, UI, and data access until there is real pressure to publish the CLI independently.
- Use nullable `REAL` values in `[0.0, 1.0]` for `confidence`, `weight`, and `fit_score`.
- Treat `NULL` scores as "not assessed"; zero means explicit no-fit or no confidence.
- Keep `fit_assessment` as nullable text on `companies` and `roles` for v1.
- Defer a normalized `fit_assessments` table until assessments need version history or multiple scoring sources.
- Use polymorphic `target_type` and `target_id` for `notes`, `evidence`, and `taggings` in v1.
- Constrain `target_type` to the enum values in schema/domain validation.

## Phase 0: Foundation

Goal: make the repo understandable before writing product code.

Deliverables:

- `docs/PRD.md`.
- `docs/PLAN.md`.
- Initial architecture notes.
- Initial data model sketch.
- Initial skill inventory.

Exit criteria:

- The product boundary is clear: data layer, agent interface, skill layer, browse UI.
- The first implementation slice is obvious.

## Phase 1: Data Layer And CLI

Goal: let agents write useful structured data before the UI exists.

Deliverables:

- Local SQLite database.
- Migration setup.
- TypeScript data model.
- CLI entrypoint.
- Commands for profile, session, company, role, note, evidence, and export.
- JSON output mode for agent use.
- Seed profile for the initial user context.

Initial implementation slice:

- Database migration and seed profile.
- TypeScript domain types and validation helpers.
- `locus profile show --json`.
- `locus session start --goal "Research AI-native notes companies" --json`.
- `locus session show --json`.

CLI input contract:

- Prefer flags for simple reads and single-field operations.
- Accept stdin JSON for complex writes in later commands.
- Every write command with `--json` returns the created or updated record.

Expanded CLI surface:

- `locus company add/list/update --json`.
- `locus role add/list/update --json`.
- `locus note add/list --target company:1 --json`.
- `locus evidence add/list --target company:1 --json`.
- `locus preference propose/approve/reject/list --json`.
- `locus export json`.
- `locus export markdown --path shortlist.md --json`.

Agent command conventions:

- Use compact target refs like `company:1`, `role:2`, and `session:1`.
- Use flags for simple values.
- Pipe stdin JSON for complex writes, for example `echo '{"companyId":1,"title":"Senior iOS Engineer"}' | locus role add --json`.

Recommended command surface:

```txt
locus profile show --json
locus session start --goal "Research AI-native notes companies" --json
locus session show --json
locus company add --json
locus company list --json
locus role add --json
locus role list --json
locus note add --json
locus evidence add --json
locus preference propose --json
locus export markdown
locus export json
```

Exit criteria:

- Codex or Claude can use shell commands to populate and inspect Locus.
- The user can export a useful markdown shortlist without a UI.

## Phase 2: Skill Layer

Goal: teach agents how to use Locus consistently.

Deliverables:

```txt
skills/
  convo/SKILL.md
  locus-research/SKILL.md
  locus-curation/SKILL.md
  locus-preference-learning/SKILL.md
  locus-export/SKILL.md
```

Skill responsibilities:

- `convo`: how Codex, Claude, and other agents exchange ideas through `convo.md`.
- `locus-research`: how to start a session, read profile context, research companies and roles, and save evidence.
- `locus-curation`: how to decide what deserves a company, role, note, or rejection status.
- `locus-preference-learning`: how to infer session preferences and propose durable profile changes.
- `locus-export`: how to create useful shortlist and session exports.

Exit criteria:

- An agent can read the skills and use the CLI without extra explanation.
- The same instruction content can be adapted for Claude project context.
- Current status: `convo`, `locus-research`, `locus-curation`, `locus-preference-learning`, and `locus-export` exist under `skills/`.

## Phase 3: Browse UI

Goal: give the user a clean way to inspect and edit what agents wrote.

Primary views:

- Dashboard: active session, recent findings, pending preference candidates.
- Companies: card grid with filters.
- Roles: role table or dense card list.
- Notes: standalone and linked notes.
- Evidence: source list with linked objects and last checked dates.
- Preferences: approved profile and pending candidates.
- Exports: generate markdown/json outputs.

Company card direction:

```txt
[primary fit label]

Company Name
Short agent-written assessment.

tags: remote, iOS, AI-first
evidence: 3
roles: 2
status: shortlisted
last checked: Jun 27
```

Visual requirements:

- Dark, quiet review surface.
- Dense grid, not oversized marketing cards.
- Rounded cards with restrained borders.
- One primary fit label per card.
- Tags are small and secondary.
- Details open in a side panel.

Exit criteria:

- The user can browse companies and roles faster than reading the chat transcript.
- The user can approve or reject preference candidates.
- The user can edit notes and statuses.

## Phase 4: MCP Or Local API

Goal: make Locus easier for agent surfaces to call directly.

Deliverables:

- MCP server or local HTTP API exposing the same operations as the CLI.
- Tool schemas for core operations.
- Agent integration docs.
- Compatibility notes for Codex and Claude.

Exit criteria:

- Agents can call Locus tools without shell command parsing.
- CLI remains available for debugging and portability.

## Phase 5: Research Automation

Goal: add higher-level research workflows after the memory system is stable.

Possible deliverables:

- Web search provider integration.
- Evidence freshness checks.
- Company website and jobs page refresh.
- Duplicate detection.
- Fit scoring improvements.
- Export templates.
- Session summaries.

Exit criteria:

- Locus can refresh and maintain research over time.
- Evidence dates and source quality are visible.

## Implementation Order

Recommended first implementation slice:

1. Initialize the app/tooling workspace.
2. Add SQLite schema and migrations.
3. Add TypeScript domain types.
4. Add CLI commands for profile and session.
5. Add CLI commands for company, role, note, and evidence.
6. Add markdown/json export.
7. Add first Codex skill for Locus research.
8. Build the browse UI over existing data.

This order proves the agent-facing workflow before spending time on UI polish.

## Risks

- Overbuilding the agent runtime too early.
- Letting UI design drive the data model instead of agent workflows.
- Allowing preference inference to become opaque or too automatic.
- Saving too many low-value notes.
- Mixing facts, opinions, and inferred preferences in one field.

## Guardrails

- Every factual company or role claim should have evidence when practical.
- Every durable profile update must be reviewable.
- Every command should support machine-readable output.
- Every object should have creation and update timestamps.
- Exports should preserve evidence URLs.
- UI cards should show summaries; side panels should show detail.
