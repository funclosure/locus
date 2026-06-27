---
name: convo
description: Use when an agent is asked to coordinate with another agent through a shared convo.md file, exchange ideas asynchronously, read the latest appended segment, or append a turn-taking message for Codex, Claude, or another coding agent.
---

# Convo

Use `convo.md` as a lightweight shared inbox between agents. Read only the latest segment after the final `---`, decide whether it needs a reply, append one new segment, then stop.

## Setup

Run once per project to make this skill available in Claude Code and initialize the conversation file:

```bash
# 1. Register the skill with Claude Code
mkdir -p .claude/skills
ln -s ../../skills/convo .claude/skills/convo

# 2. Create convo.md if it doesn't exist
cat > convo.md << 'EOF'
# Agent Conversation

Shared turn-taking file for Codex, Claude, and other agents.

Protocol:

- Append a new segment after `---`.
- Read only the latest non-empty segment unless asked otherwise.
- Do not reply to your own latest segment.
- Durable decisions belong in project docs, plans, issues, or code.
EOF
```

The symlink lets Claude Code load the skill via the `Skill` tool. Codex reads it directly from `skills/convo/SKILL.md`. Both agents share the same file.

## Monitoring After Sending

After appending a turn, watch `convo.md` for the other agent's reply using file-change detection rather than a fixed timer:

```bash
prev=$(md5 -q convo.md)
while true; do
  curr=$(md5 -q convo.md)
  [ "$curr" != "$prev" ] && echo "convo.md changed" && break
  sleep 2
done
```

Stop watching as soon as a change is detected. Read the new segment and decide whether to reply.

## File Location

Default path: `convo.md` at the repository root.

If the user names another file, use that file for the current task. Do not create multiple conversation files unless explicitly asked.

## Segment Format

Append messages in this format:

```md
---
timestamp: 2026-06-27T19:30:00+08:00
from: Codex
to: Claude
topic: Locus planning

Message body in concise prose.
```

Use `from: Codex`, `from: Claude`, or the actual agent name. Use ISO 8601 timestamps with timezone when possible.

## Turn Protocol

1. Open `convo.md`.
2. Split on lines containing exactly `---`.
3. Read only the last non-empty segment.
4. If the last segment is from this agent, do not append a reply unless the user explicitly asks for another same-agent turn.
5. If the last segment is addressed to another agent, do not answer unless the user asked this agent to mediate or continue anyway.
6. Append exactly one new `---` segment.
7. Keep the reply focused on the latest segment. Do not summarize the full file unless asked.
8. End after appending. Do not loop or wait for the other agent inside the same turn.

## Message Style

- Be concise and concrete.
- State agreements, disagreements, open questions, and proposed next steps.
- Preserve uncertainty instead of pretending consensus exists.
- Use bullets only when they improve scanability.
- Put durable decisions in explicit `Decision:` lines.
- Put handoff requests in explicit `Question:` or `Request:` lines.

## Safety Rules

- Do not overwrite or reorder existing segments.
- Do not edit another agent's message except to fix file corruption at the user's request.
- Do not place secrets, API keys, or private credentials in `convo.md`.
- Do not treat `convo.md` as authoritative project state. Durable decisions should be copied into project docs, issues, plans, or code.
- If the latest segment asks for code changes, follow the normal repo workflow and applicable skills before editing code.

## Kickoff Pattern

When the user says to kick off an agent-to-agent exchange:

1. Create `convo.md` if missing.
2. Append a kickoff segment from the current agent to the other agent.
3. Include the shared topic, current context, and one concrete question or request.
4. Stop so the other agent can take the next turn.

Example:

```md
---
timestamp: 2026-06-27T19:30:00+08:00
from: Codex
to: Claude
topic: Locus architecture

Context: Locus is shifting from a chat app to an agent-usable data layer with skills and a browse UI.

Question: Do you see the first implementation slice as CLI-first, MCP-first, or UI-first?
```
