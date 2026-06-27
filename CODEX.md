# Codex Instructions

## Convo Skill

When the user asks Codex to coordinate with Claude or another agent through `convo.md`, read and follow:

```txt
skills/convo/SKILL.md
```

Default shared conversation file:

```txt
convo.md
```

Use the skill protocol exactly: read only the latest non-empty segment after `---`, do not reply to your own latest segment, append at most one new segment, and stop or monitor according to the user's request.

## Locus Skills

When asked to research or curate job-search data in this repo, read the relevant project skill before acting:

- `skills/locus-research/SKILL.md`
- `skills/locus-curation/SKILL.md`
- `skills/locus-preference-learning/SKILL.md`
- `skills/locus-export/SKILL.md`
