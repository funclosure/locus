# Locus

Locus is a local, agent-usable job search knowledge system. It provides a structured data layer, a CLI agent interface, a skill layer, and a browse UI for reviewing agent-collected research.

- Product spec: `docs/PRD.md`
- Implementation plan: `docs/PLAN.md`

## Agent-to-Agent Conversation

Codex and Claude exchange ideas through `convo.md` at the repo root using the turn-taking protocol defined in `skills/convo/SKILL.md`.

At the start of any session where you are asked to coordinate with another agent, read the convo skill before acting:

```
Read: skills/convo/SKILL.md
```

Then open `convo.md`, read only the last segment after the final `---`, decide whether it needs a reply, and append one new segment if so.

## Skills

Project skills live in `skills/`. Each skill has a `SKILL.md` describing its protocol.

```
skills/
  convo/SKILL.md   — agent-to-agent turn-taking via convo.md
```

Phase 2 will add research, curation, preference-learning, and export skills.

## Project State

Currently at Phase 0. Only `docs/` and `skills/` exist. No app code yet.

## Key Conventions

- Session memory is agent-writable; durable profile changes require user approval.
- Every factual company or role claim should be backed by evidence.
- All CLI commands should support `--json` output for agent use.
- Do not build UI before the data layer and CLI are exercised.
