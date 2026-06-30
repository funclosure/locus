import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Database from "better-sqlite3";
import { z } from "zod";
import { openDatabase } from "../db/client.js";
import { migrateDatabase } from "../db/migrate.js";
import { seedDefaultProfile } from "../db/seed.js";
import { candidateStatuses, companyStatuses, roleStatuses, targetTypes } from "../domain/enums.js";
import {
  applicationInputSchema,
  companyInputSchema,
  evidenceInputSchema,
  noteInputSchema,
  preferenceCandidateInputSchema,
  roleInputSchema,
  sessionStartInputSchema,
} from "../domain/validators.js";
import { buildJsonExport } from "../export/json.js";
import { buildMarkdownExport } from "../export/markdown.js";
import { getApplication, listApplications, upsertApplication } from "../repositories/applicationRepository.js";
import { addCompany, getCompany, listCompanies, updateCompany } from "../repositories/companyRepository.js";
import { addEvidence, listEvidence } from "../repositories/evidenceRepository.js";
import { addNote, listNotes } from "../repositories/noteRepository.js";
import {
  approvePreferenceCandidate,
  listPreferenceCandidates,
  proposePreferenceCandidate,
  rejectPreferenceCandidate,
} from "../repositories/preferenceCandidateRepository.js";
import { getDefaultProfile, listProfilePreferences } from "../repositories/profileRepository.js";
import { addRole, listRoles, updateRole } from "../repositories/roleRepository.js";
import { createSession, getActiveSession, getSession } from "../repositories/sessionRepository.js";

const idField = z.coerce.number().int().positive();
const targetFilter = {
  targetType: z.enum(targetTypes).optional(),
  targetId: idField.optional(),
};

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

/**
 * Registers every Locus operation as an MCP tool. Each tool is a thin wrapper
 * that opens the shared SQLite database, calls the same repository function the
 * CLI uses, and returns JSON. Input schemas reuse the domain validators so the
 * MCP surface stays in lockstep with the CLI and data model.
 */
export function registerLocusTools(server: McpServer, dbPath?: string): void {
  migrateDatabase(dbPath);
  seedDefaultProfile(dbPath);

  const withDb = <T>(fn: (db: Database.Database) => T): T => {
    const db = openDatabase(dbPath);
    try {
      return fn(db);
    } finally {
      db.close();
    }
  };

  // ── profile ──────────────────────────────────────────────
  server.registerTool("profile_show", { description: "Show the durable profile and its approved preferences." }, async () =>
    withDb((db) => json({ profile: getDefaultProfile(db), preferences: listProfilePreferences(db, 1) })),
  );

  // ── sessions ─────────────────────────────────────────────
  server.registerTool("session_start", { description: "Start a research session.", inputSchema: sessionStartInputSchema.shape }, async (args) =>
    withDb((db) => json({ session: createSession(db, sessionStartInputSchema.parse(args)) })),
  );
  server.registerTool("session_show", { description: "Show a session by id, or the active session.", inputSchema: { id: idField.optional() } }, async (args) =>
    withDb((db) => {
      const session = args.id ? getSession(db, args.id) : getActiveSession(db);
      if (!session) {
        throw new Error("No session found.");
      }
      return json({ session });
    }),
  );

  // ── companies ────────────────────────────────────────────
  server.registerTool("company_add", { description: "Add a company.", inputSchema: companyInputSchema.shape }, async (args) =>
    withDb((db) => json({ company: addCompany(db, companyInputSchema.parse(args)) })),
  );
  server.registerTool("company_list", { description: "List companies, optionally filtered by status.", inputSchema: { status: z.enum(companyStatuses).optional() } }, async (args) =>
    withDb((db) => json({ companies: listCompanies(db, args.status ? { status: args.status } : {}) })),
  );
  server.registerTool("company_get", { description: "Get a single company by id.", inputSchema: { id: idField } }, async (args) =>
    withDb((db) => {
      const company = getCompany(db, args.id);
      if (!company) {
        throw new Error(`Company ${args.id} not found.`);
      }
      return json({ company });
    }),
  );
  server.registerTool("company_update", { description: "Update fields on a company.", inputSchema: { id: idField, ...companyInputSchema.partial().shape } }, async (args) => {
    const { id, ...rest } = args;
    return withDb((db) => json({ company: updateCompany(db, id, companyInputSchema.partial().parse(rest)) }));
  });

  // ── roles ────────────────────────────────────────────────
  server.registerTool("role_add", { description: "Add a role under a company.", inputSchema: roleInputSchema.shape }, async (args) =>
    withDb((db) => json({ role: addRole(db, roleInputSchema.parse(args)) })),
  );
  server.registerTool(
    "role_list",
    { description: "List roles, optionally filtered by company id and/or status.", inputSchema: { companyId: idField.optional(), status: z.enum(roleStatuses).optional() } },
    async (args) => withDb((db) => json({ roles: listRoles(db, { companyId: args.companyId, status: args.status }) })),
  );
  server.registerTool("role_update", { description: "Update fields on a role.", inputSchema: { id: idField, ...roleInputSchema.partial().shape } }, async (args) => {
    const { id, ...rest } = args;
    return withDb((db) => json({ role: updateRole(db, id, roleInputSchema.partial().parse(rest)) }));
  });

  // ── notes ────────────────────────────────────────────────
  server.registerTool("note_add", { description: "Add a note, optionally linked to a target.", inputSchema: noteInputSchema.shape }, async (args) =>
    withDb((db) => json({ note: addNote(db, noteInputSchema.parse(args)) })),
  );
  server.registerTool("note_list", { description: "List notes, optionally filtered by target.", inputSchema: targetFilter }, async (args) =>
    withDb((db) => json({ notes: listNotes(db, { targetType: args.targetType, targetId: args.targetId }) })),
  );

  // ── evidence ─────────────────────────────────────────────
  server.registerTool("evidence_add", { description: "Add source-backed evidence for a target.", inputSchema: evidenceInputSchema.shape }, async (args) =>
    withDb((db) => json({ evidence: addEvidence(db, evidenceInputSchema.parse(args)) })),
  );
  server.registerTool("evidence_list", { description: "List evidence, optionally filtered by target.", inputSchema: targetFilter }, async (args) =>
    withDb((db) => json({ evidence: listEvidence(db, { targetType: args.targetType, targetId: args.targetId }) })),
  );

  // ── preference candidates ────────────────────────────────
  server.registerTool("preference_propose", { description: "Propose a durable preference candidate for review.", inputSchema: preferenceCandidateInputSchema.shape }, async (args) =>
    withDb((db) => json({ preference: proposePreferenceCandidate(db, preferenceCandidateInputSchema.parse(args)) })),
  );
  server.registerTool("preference_list", { description: "List preference candidates, optionally filtered by status.", inputSchema: { status: z.enum(candidateStatuses).optional() } }, async (args) =>
    withDb((db) => json({ preferences: listPreferenceCandidates(db, args.status ? { status: args.status } : {}) })),
  );
  server.registerTool("preference_approve", { description: "Approve a preference candidate.", inputSchema: { id: idField } }, async (args) =>
    withDb((db) => json({ preference: approvePreferenceCandidate(db, args.id) })),
  );
  server.registerTool("preference_reject", { description: "Reject a preference candidate.", inputSchema: { id: idField } }, async (args) =>
    withDb((db) => json({ preference: rejectPreferenceCandidate(db, args.id) })),
  );

  // ── application pipeline ─────────────────────────────────
  server.registerTool("application_set", { description: "Create or update pipeline progress for a target (upsert by target).", inputSchema: applicationInputSchema.shape }, async (args) =>
    withDb((db) => json({ application: upsertApplication(db, applicationInputSchema.parse(args)) })),
  );
  server.registerTool("application_list", { description: "List all application pipeline rows." }, async () =>
    withDb((db) => json({ applications: listApplications(db) })),
  );
  server.registerTool("application_show", { description: "Show pipeline progress for a target.", inputSchema: { targetType: z.enum(["company", "role"]), targetId: idField } }, async (args) => {
    const application = withDb((db) => getApplication(db, args.targetType, args.targetId));
    if (!application) {
      throw new Error(`No application progress for ${args.targetType}:${args.targetId}.`);
    }
    return json({ application });
  });

  // ── exports ──────────────────────────────────────────────
  server.registerTool("export_json", { description: "Return the full Locus dataset as JSON." }, async () => withDb((db) => json(buildJsonExport(db))));
  server.registerTool("export_markdown", { description: "Return a Markdown shortlist export." }, async () => withDb((db) => text(buildMarkdownExport(db))));
  server.registerTool("snapshot", { description: "Return the full Locus dataset as JSON (alias of export_json, for quick reads)." }, async () => withDb((db) => json(buildJsonExport(db))));
}
