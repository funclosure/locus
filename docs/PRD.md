# Locus PRD

## Summary

Locus is a local, agent-usable job search knowledge system. It is not primarily a chat app. Codex, Claude, or another agent surface can provide the conversation layer; Locus provides the durable data layer, agent interface, skill instructions, and browsing UI for reviewing what the agent collected.

Locus helps the user research companies and roles, preserve evidence, learn session-specific preferences, propose durable profile updates, and browse/export a curated map of opportunities.

## Problem

Job-search research done through chat agents is useful but easy to lose. Valuable findings are scattered across conversations, links, loose notes, and memory that may not persist. Agents can infer preferences during a session, but without a structured system those inferences are hard to inspect, approve, reuse, or correct.

The user needs a local workspace where agents can write structured research and where the user can browse, edit, approve, and export the resulting knowledge.

## Goals

- Provide a local structured data layer for companies, roles, notes, preferences, sessions, evidence, assessments, and exports.
- Give agents a clear interface for reading and writing Locus data.
- Provide a skill layer that teaches agents how to research, curate, save evidence, infer preferences, and avoid noisy notes.
- Provide a quiet browse UI for reviewing and editing curated findings.
- Keep session learning separate from long-term profile changes.
- Let the user approve durable preference changes before they become part of the main profile.

## Non-Goals

- Build a full chat product in the first version.
- Replace Codex, Claude, or other agent surfaces.
- Automatically apply long-term preference changes without user review.
- Build autonomous web research before the local data and review workflow are solid.
- Build multi-user, hosted, or cloud sync functionality in the first version.

## Target User

The initial user is an iOS developer in Hong Kong researching remote roles at craft-driven, AI-first, Apple-platform, notes, writing, and knowledge-tool companies. The system should support a broader job-search workflow, but early defaults can reflect this context.

## Core Product Model

### Profile

The durable, approved user profile. It includes long-term preferences, constraints, interests, disliked patterns, target role types, location constraints, and notes about what matters.

Examples:

- Remote is required.
- Strong interest in iOS, interaction design, AI-first products, and craft-driven teams.
- Prefers small, high-quality product teams.
- Dislikes recruiter-style outreach and vague role descriptions.

### Session

A bounded research run. Each session starts from the approved profile and accumulates temporary discoveries, notes, candidate preferences, researched companies, researched roles, and decisions.

### Preference Candidate

An inferred preference from a session that may become durable after review.

Examples:

- "The user appears interested in AI-native personal knowledge tools."
- "The user seems to prefer companies with strong Apple-platform taste over generic cross-platform apps."

### Company

A structured record for an organization. It should include basic metadata, fit labels, tags, status, notes, roles, evidence, and fit assessments.

### Role

A structured job opportunity tied to a company. It should include title, URL, remote status, location constraints, seniority, compensation if known, role notes, evidence, and status.

### Note

A concise note that can be standalone or linked to a company, role, session, preference, or evidence item.

### Evidence

A source-backed claim. Evidence should include URL, title, snippet or summary, date checked, source type, confidence, and linked object.

### Fit Assessment

An agent-written assessment explaining why a company or role matches or does not match the profile and session discoveries.

### Export

A generated artifact such as a shortlist, markdown report, JSON bundle, or session summary.

## Key User Flows

### Agent-Led Research

1. User asks Codex or Claude to research companies or roles.
2. Agent reads the Locus profile and active session.
3. Agent researches externally as needed.
4. Agent writes structured companies, roles, notes, evidence, and fit assessments into Locus.
5. Agent proposes preference candidates when it learns something new about the user.
6. User browses the collected results in the Locus UI.

### Preference Learning

1. Session starts with the approved profile.
2. Agent records session observations as session memory.
3. Agent proposes durable preference candidates when patterns emerge.
4. User approves, edits, or rejects candidates in the UI.
5. Approved candidates become part of the durable profile.

### Browse And Review

1. User opens the local Locus UI.
2. User browses company and role cards.
3. User filters by tags, fit, status, evidence count, role availability, or last checked date.
4. User opens a detail panel for sources, notes, roles, and preference impact.
5. User updates statuses or edits notes.

### Export

1. User selects companies, roles, or a session.
2. Locus generates a markdown or JSON export.
3. Export includes fit summaries, notes, evidence links, and current statuses.

## Browse UI Direction

The UI should be a quiet review console, not a marketing page and not primarily a chat interface.

Company cards should follow the provided visual reference:

- Dark, restrained review surface.
- Dense but readable card grid.
- One primary fit label at the top.
- Company name as the visual anchor.
- One short, opinionated summary.
- Small tags at the bottom.
- Details move into a side panel instead of cluttering the card.

Each card may expose data-layer signals without becoming noisy:

- Evidence count.
- Open role count.
- Status.
- Last checked date.
- Pending preference impact.

## Agent Interface Requirements

The first interface should be local, simple, inspectable, and usable by multiple agent surfaces.

Recommended initial commands:

```txt
locus session start
locus session show
locus profile show
locus preference propose
locus preference approve
locus preference reject
locus company add
locus company update
locus company list
locus role add
locus role update
locus role list
locus note add
locus note update
locus note list
locus evidence add
locus assess fit
locus export markdown
locus export json
```

Later versions can expose the same operations through MCP or a local HTTP API.

## Skill Layer Requirements

Locus should include repo-native agent instructions:

```txt
skills/
  locus-research/SKILL.md
  locus-curation/SKILL.md
  locus-preference-learning/SKILL.md
  locus-export/SKILL.md
```

The skills should teach agents to:

- Read the approved profile before researching.
- Start or select a session before writing.
- Save evidence for factual claims.
- Separate facts, interpretation, and preference inference.
- Keep notes concise and decision-useful.
- Update session memory freely.
- Propose durable preferences instead of silently changing the profile.
- Score fit against both approved preferences and session discoveries.
- Prefer structured Locus writes over loose prose.

## Data Rules

- Durable profile updates require user approval.
- Session memory can be updated by the agent without approval.
- Claims about companies and roles should be backed by evidence when possible.
- Evidence should include date checked.
- Notes should be short and useful for later decisions.
- A company or role can be rejected without deleting its evidence.
- Exported artifacts should preserve source links.

## Success Criteria

- An agent can read the current profile and session, then write structured findings without using the browse UI.
- The user can open the UI and understand what was found without rereading the chat.
- The user can approve or reject inferred preferences.
- Company and role cards make it easy to scan the research map.
- Exports are useful outside the app.
- The system works locally with no hosted backend.

## Open Decisions

- Storage engine: SQLite is recommended, but the exact ORM/query layer is still open.
- Initial agent interface: CLI is recommended first; MCP can follow.
- UI stack: Next.js with shadcn/ui remains a good fit.
- Search provider: defer until after the local data and review workflow exists.
