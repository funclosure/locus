---
name: locus-preference-learning
description: Use when an agent notices user preferences, constraints, dislikes, repeated selection patterns, session-specific learnings, or possible durable profile updates while working with Locus research data.
---

# Locus Preference Learning

Separate session learning from durable profile changes. Agents may propose preferences; the user approves them later.

## Rules

- Do not silently rewrite the approved profile.
- Treat one-off comments as session memory or notes, not durable preference.
- Propose durable preferences only when the pattern is useful for future research.
- Use confidence as `0.0` to `1.0`; omit it when unsure.

## What To Propose

Good candidates:

- repeated positive signals: "Apple-native knowledge tools"
- hard constraints: "remote required"
- negative signals: "avoid vague recruiter-style roles"
- tradeoff patterns: "small craft teams over generic scale"

Weak candidates:

- transient mood
- one company-specific reaction
- facts about a company
- anything the user has not implied

## Command

```bash
pnpm locus preference propose \
  --session-id 1 \
  --kind interest \
  --label "Apple-native knowledge tools" \
  --description "User repeatedly shows interest in Apple-platform notes, writing, and knowledge tools." \
  --confidence 0.8 \
  --json
```

Use:

- `requirement` for hard constraints.
- `positive_signal` for factors that improve fit.
- `negative_signal` for factors that reduce fit.
- `interest` for topic/product areas.
- `constraint` for limitations that are not absolute requirements.

## Review

List pending candidates before summarizing:

```bash
pnpm locus preference list --status pending --json
```

Tell the user these are proposed changes, not approved profile memory.
