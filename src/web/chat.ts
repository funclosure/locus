import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import type Database from "better-sqlite3";
import { z } from "zod/v4";
import { openDatabase } from "../db/client.js";
import { companyStatuses, preferenceKinds, roleStatuses, sourceTypes } from "../domain/enums.js";
import {
  applicationInputSchema,
  companyInputSchema,
  evidenceInputSchema,
  noteInputSchema,
  preferenceCandidateInputSchema,
  roleInputSchema,
  sessionStartInputSchema,
} from "../domain/validators.js";
import { upsertApplication } from "../repositories/applicationRepository.js";
import { getCompany, listCompanies, updateCompany } from "../repositories/companyRepository.js";
import { addEvidence, deleteEvidence } from "../repositories/evidenceRepository.js";
import { addNote, deleteNote, listNotes, updateNote } from "../repositories/noteRepository.js";
import { proposePreferenceCandidate } from "../repositories/preferenceCandidateRepository.js";
import { getDefaultProfile, listProfilePreferences } from "../repositories/profileRepository.js";
import { listRoles, updateRole } from "../repositories/roleRepository.js";
import { getActiveSession, createSession } from "../repositories/sessionRepository.js";
import { listEvidence } from "../repositories/evidenceRepository.js";

export type ChatResult = {
  reply: string;
  edits: string[];
  proposed: Array<{ id: number; label: string }>;
};

const target = {
  targetType: z.enum(["company", "role"]),
  targetId: z.number().int().positive(),
};

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export async function runChat(message: string, companyId: number | null, dbPath?: string, selection?: string | null): Promise<ChatResult> {
  const edits: string[] = [];
  const proposed: Array<{ id: number; label: string }> = [];

  const withDb = <T>(fn: (db: Database.Database) => T): T => {
    const db = openDatabase(dbPath);
    try {
      return fn(db);
    } finally {
      db.close();
    }
  };

  const systemPrompt = withDb((db) => buildSystemPrompt(db, companyId, selection));

  const locus = createSdkMcpServer({
    name: "locus",
    version: "0.1.0",
    tools: [
      tool(
        "update_company",
        "Update fields on a company (status, label, summary, fit score/assessment, maker, name, url, hq). Use for the user's feedback about a company.",
        {
          id: z.number().int().positive().describe("Company id"),
          status: z.enum(companyStatuses).optional(),
          primaryLabel: z.string().optional().describe("Short fit label, e.g. craft-driven"),
          summary: z.string().optional(),
          fitScore: z.number().min(0).max(1).nullable().optional(),
          fitAssessment: z.string().optional(),
          maker: z.string().optional().describe("Company behind the product, when different from the brand"),
          name: z.string().optional(),
          url: z.string().optional(),
          hq: z.string().optional(),
        },
        async ({ id, ...rest }) =>
          withDb((db) => {
            const updated = updateCompany(db, id, companyInputSchema.partial().parse(rest));
            edits.push(`Updated ${updated.name}`);
            return ok(`Updated company ${updated.id} (${updated.name}).`);
          }),
      ),
      tool(
        "update_role",
        "Update fields on a role (status, title, remote policy, seniority, compensation, summary, fit).",
        {
          id: z.number().int().positive().describe("Role id"),
          title: z.string().optional(),
          status: z.enum(roleStatuses).optional(),
          remotePolicy: z.enum(["remote", "hybrid", "onsite", "unknown"]).optional(),
          seniority: z.string().optional(),
          compensation: z.string().optional(),
          summary: z.string().optional(),
          fitScore: z.number().min(0).max(1).nullable().optional(),
          fitAssessment: z.string().optional(),
        },
        async ({ id, ...rest }) =>
          withDb((db) => {
            const updated = updateRole(db, id, roleInputSchema.partial().parse(rest));
            edits.push(`Updated role: ${updated.title}`);
            return ok(`Updated role ${updated.id} (${updated.title}).`);
          }),
      ),
      tool(
        "add_note",
        "Attach a note to a company or role. Use for decision-useful observations the user shares.",
        { ...target, body: z.string().describe("Note text"), kind: z.enum(["observation", "decision", "question", "summary"]).optional() },
        async (args) =>
          withDb((db) => {
            const note = addNote(db, noteInputSchema.parse(args));
            edits.push(`Added note on ${args.targetType}:${args.targetId}`);
            return ok(`Added note ${note.id}.`);
          }),
      ),
      tool(
        "update_note",
        "Edit an existing note's text or kind by id. Use when the user wants to revise a note rather than add a new one. Note ids are listed in the selected-company context.",
        {
          id: z.number().int().positive().describe("Note id"),
          body: z.string().optional().describe("Replacement note text"),
          kind: z.enum(["observation", "decision", "question", "summary"]).optional(),
        },
        async ({ id, ...rest }) =>
          withDb((db) => {
            const note = updateNote(db, id, noteInputSchema.partial().parse(rest));
            edits.push(`Edited note ${note.id}`);
            return ok(`Updated note ${note.id}.`);
          }),
      ),
      tool(
        "delete_note",
        "Delete a note by id. Use when the user wants to remove a note. Note ids are listed in the selected-company context.",
        { id: z.number().int().positive().describe("Note id") },
        async ({ id }) =>
          withDb((db) => {
            if (!deleteNote(db, id)) {
              throw new Error(`Note ${id} not found.`);
            }
            edits.push(`Deleted note ${id}`);
            return ok(`Deleted note ${id}.`);
          }),
      ),
      tool(
        "add_evidence",
        "Add source-backed evidence for a company or role (a URL plus a snippet). Use when the user cites a fact with a source.",
        {
          ...target,
          url: z.string().describe("Source URL"),
          snippet: z.string().describe("Quote or summary from the source"),
          title: z.string().optional(),
          sourceType: z.enum(sourceTypes).optional(),
          confidence: z.number().min(0).max(1).nullable().optional(),
        },
        async (args) =>
          withDb((db) => {
            const item = addEvidence(db, evidenceInputSchema.parse(args));
            edits.push(`Added evidence on ${args.targetType}:${args.targetId}`);
            return ok(`Added evidence ${item.id}.`);
          }),
      ),
      tool(
        "delete_evidence",
        "Delete an evidence item by id. Evidence ids are listed in the selected-company context.",
        { id: z.number().int().positive().describe("Evidence id") },
        async ({ id }) =>
          withDb((db) => {
            if (!deleteEvidence(db, id)) {
              throw new Error(`Evidence ${id} not found.`);
            }
            edits.push(`Deleted evidence ${id}`);
            return ok(`Deleted evidence ${id}.`);
          }),
      ),
      tool(
        "set_application",
        "Set application pipeline progress for a company or role (stage, next action, dates, notes). Use when the user reports outreach or status changes.",
        {
          ...target,
          stage: z.enum(["researching", "warm_intro", "reached_out", "applied", "interviewing", "offer", "rejected", "paused"]),
          nextAction: z.string().optional(),
          nextActionAt: z.string().optional().describe("ISO date, e.g. 2026-07-08"),
          lastContactedAt: z.string().optional(),
          notes: z.string().optional(),
        },
        async (args) =>
          withDb((db) => {
            const app = upsertApplication(db, applicationInputSchema.parse(args));
            edits.push(`${args.targetType}:${args.targetId} → ${app.stage.replace(/_/g, " ")}`);
            return ok(`Set ${args.targetType}:${args.targetId} application to ${app.stage}.`);
          }),
      ),
      tool(
        "propose_preference",
        "Propose a DURABLE change to the user's profile/preferences (something about themselves — what they want, a constraint, an interest). This does NOT apply; it creates a pending candidate for the user to approve. Use this for any info about the user, never edit their profile directly.",
        {
          kind: z.enum(preferenceKinds).describe("requirement | positive_signal | negative_signal | interest | constraint"),
          label: z.string().describe("Short label"),
          description: z.string().describe("The proposed durable preference, in the user's voice"),
          confidence: z.number().min(0).max(1).nullable().optional(),
        },
        async (args) =>
          withDb((db) => {
            const sessionId = ensureSessionId(db);
            const candidate = proposePreferenceCandidate(db, preferenceCandidateInputSchema.parse({ ...args, sessionId, profileId: "1" }));
            proposed.push({ id: candidate.id, label: candidate.label });
            return ok(`Proposed preference "${candidate.label}" for the user's approval (pending).`);
          }),
      ),
    ],
  });

  const response = query({
    prompt: message,
    options: {
      systemPrompt,
      model: process.env.LOCUS_CHAT_MODEL ?? "claude-opus-4-8",
      mcpServers: { locus },
      tools: [],
      allowedTools: [
        "mcp__locus__update_company",
        "mcp__locus__update_role",
        "mcp__locus__add_note",
        "mcp__locus__update_note",
        "mcp__locus__delete_note",
        "mcp__locus__add_evidence",
        "mcp__locus__delete_evidence",
        "mcp__locus__set_application",
        "mcp__locus__propose_preference",
      ],
      disallowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Agent", "WebFetch", "WebSearch", "NotebookEdit", "TodoWrite"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      settingSources: [],
      maxTurns: 16,
    },
  });

  let reply = "";
  try {
    for await (const msg of response) {
      if (msg.type === "result") {
        if (msg.subtype === "success") {
          reply = msg.result;
        } else {
          throw new Error(msg.errors?.join("; ") || `Agent stopped: ${msg.subtype}`);
        }
        break;
      }
    }
  } finally {
    response.close?.();
  }

  return { reply: reply.trim(), edits, proposed };
}

function ensureSessionId(db: Database.Database): number {
  const active = getActiveSession(db);
  if (active) {
    return active.id;
  }
  const created = createSession(db, sessionStartInputSchema.parse({ goal: "Browse-UI feedback", title: "Browse feedback", profileId: "1" }));
  return created.id;
}

function buildSystemPrompt(db: Database.Database, companyId: number | null, selection?: string | null): string {
  const profile = getDefaultProfile(db);
  const preferences = listProfilePreferences(db, 1);
  const companies = listCompanies(db);
  const lines: string[] = [];

  const highlighted = (selection || "").trim().slice(0, 2000);

  lines.push(
    "You help the user curate their job-search data in Locus by turning their feedback into structured edits through the provided tools.",
    "",
    "Rules:",
    "- Apply edits about companies, roles, notes, and application progress directly with the tools (update_company, update_role, add_note, add_evidence, set_application).",
    "- Anything about the USER themselves — what they want, a new interest, a constraint, a dislike — is a DURABLE profile change. Do NOT apply it; call propose_preference so the user can approve it later.",
    "- Refer to companies/roles by id. When the user says \"this\"/\"it\", they mean the selected company below.",
    "- Don't invent facts. If the user states a fact about a company, record it as a note or, with a source, as evidence.",
    "- After acting, reply in one or two short sentences describing what you changed. If nothing was actionable, say so briefly.",
    "",
    `User profile — ${profile.name}: ${profile.summary}`,
  );

  if (preferences.length) {
    lines.push("Known preferences: " + preferences.map((p) => `${p.kind}:${p.label}`).join("; "));
  }

  if (highlighted) {
    lines.push(
      "",
      'The user has highlighted this text in the UI — treat it as the focus of their request (what they mean by "this"/"that"):',
      '"""',
      highlighted,
      '"""',
    );
  }

  if (companyId) {
    const company = getCompany(db, companyId);
    if (company) {
      const roles = listRoles(db, { companyId });
      const notes = listNotes(db, { targetType: "company", targetId: companyId });
      const evidence = listEvidence(db, { targetType: "company", targetId: companyId });
      lines.push(
        "",
        `Selected company (id ${company.id}): ${company.name}${company.maker ? ` — by ${company.maker}` : ""} [status: ${company.status}, label: ${company.primaryLabel ?? "—"}, fit: ${company.fitScore ?? "—"}]`,
        company.fitAssessment || company.summary ? `  assessment: ${company.fitAssessment || company.summary}` : "",
        roles.length ? `  roles: ${roles.map((r) => `${r.id}:${r.title}`).join(", ")}` : "  roles: none",
        notes.length ? `  notes: ${notes.map((n) => `[id ${n.id}] ${n.body}`).join(" | ")}` : "  notes: none",
        evidence.length ? `  evidence: ${evidence.map((e) => `[id ${e.id}] ${e.url}`).join(" | ")}` : "  evidence: none",
      );
    }
  }

  lines.push("", "All companies (id: name [status, fit]):");
  for (const c of companies) {
    lines.push(`  ${c.id}: ${c.name} [${c.status}, ${c.fitScore ?? "—"}]`);
  }

  return lines.filter((line) => line !== "").join("\n");
}
