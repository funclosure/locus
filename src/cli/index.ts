#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { Command } from "commander";
import { openDatabase } from "../db/client.js";
import { migrateDatabase } from "../db/migrate.js";
import { seedDefaultProfile } from "../db/seed.js";
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
import { addCompany, listCompanies, updateCompany } from "../repositories/companyRepository.js";
import { addEvidence, listEvidence } from "../repositories/evidenceRepository.js";
import { recordExport } from "../repositories/exportRepository.js";
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
import { mergeOptionsWithJson, parseTargetRef, readStdinJson } from "./input.js";
import { printJson, printText } from "./output.js";

function ensureDatabase(): void {
  migrateDatabase(process.env.LOCUS_DB_PATH);
  seedDefaultProfile(process.env.LOCUS_DB_PATH);
}

const program = new Command();

program.name("locus").description("Local agent-usable job search knowledge system").version("0.1.0");

function jsonPayload(options: Record<string, unknown>): Record<string, unknown> {
  return options.stdin || !process.stdin.isTTY ? mergeOptionsWithJson(options, readStdinJson()) : mergeOptionsWithJson(options, {});
}

const profile = program.command("profile").description("Profile commands");

profile
  .command("show")
  .option("--json", "Print machine-readable JSON")
  .action((options: { json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const payload = {
        profile: getDefaultProfile(db),
        preferences: listProfilePreferences(db, 1),
      };
      if (options.json) {
        printJson(payload);
      } else {
        printText(`${payload.profile.name}: ${payload.profile.summary}`);
      }
    } finally {
      db.close();
    }
  });

const company = program.command("company").description("Company commands");

company
  .command("add")
  .option("--name <name>", "Brand or product name — the prominent label (e.g. Bear)")
  .option("--maker <maker>", "Company behind it, when different from the brand (e.g. Shiny Frog); omit when they are the same")
  .option("--url <url>", "Company URL")
  .option("--hq <hq>", "Headquarters or location note")
  .option("--summary <summary>", "Short summary")
  .option("--primary-label <primaryLabel>", "Primary fit label")
  .option("--status <status>", "Company status")
  .option("--fit-score <fitScore>", "Fit score from 0.0 to 1.0")
  .option("--fit-assessment <fitAssessment>", "Fit assessment")
  .option("--stdin", "Read JSON object from stdin")
  .option("--json", "Print machine-readable JSON")
  .action((options: Record<string, unknown> & { json?: boolean }) => {
    ensureDatabase();
    const input = companyInputSchema.parse(jsonPayload(options));
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const created = addCompany(db, input);
      if (options.json) {
        printJson({ company: created });
      } else {
        printText(`Added company ${created.id}: ${created.name}`);
      }
    } finally {
      db.close();
    }
  });

company
  .command("list")
  .option("--status <status>", "Filter by company status")
  .option("--json", "Print machine-readable JSON")
  .action((options: { status?: string; json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const companies = listCompanies(db, options.status ? { status: companyInputSchema.shape.status.parse(options.status) } : {});
      if (options.json) {
        printJson({ companies });
      } else {
        for (const item of companies) {
          printText(`${item.id}: ${item.name} [${item.status}]`);
        }
      }
    } finally {
      db.close();
    }
  });

company
  .command("update")
  .requiredOption("--id <id>", "Company id")
  .option("--name <name>", "Brand or product name — the prominent label (e.g. Bear)")
  .option("--maker <maker>", "Company behind it, when different from the brand (e.g. Shiny Frog); omit when they are the same")
  .option("--url <url>", "Company URL")
  .option("--hq <hq>", "Headquarters or location note")
  .option("--summary <summary>", "Short summary")
  .option("--primary-label <primaryLabel>", "Primary fit label")
  .option("--status <status>", "Company status")
  .option("--fit-score <fitScore>", "Fit score from 0.0 to 1.0")
  .option("--fit-assessment <fitAssessment>", "Fit assessment")
  .option("--stdin", "Read JSON object from stdin")
  .option("--json", "Print machine-readable JSON")
  .action((options: Record<string, unknown> & { id: string; json?: boolean }) => {
    ensureDatabase();
    const { id, ...rest } = options;
    const input = companyInputSchema.partial().parse(jsonPayload(rest));
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const updated = updateCompany(db, Number(id), input);
      if (options.json) {
        printJson({ company: updated });
      } else {
        printText(`Updated company ${updated.id}: ${updated.name}`);
      }
    } finally {
      db.close();
    }
  });

const role = program.command("role").description("Role commands");

role
  .command("add")
  .option("--company-id <companyId>", "Company id")
  .option("--title <title>", "Role title")
  .option("--url <url>", "Role URL")
  .option("--location <location>", "Location text")
  .option("--remote-policy <remotePolicy>", "Remote policy")
  .option("--seniority <seniority>", "Seniority")
  .option("--compensation <compensation>", "Compensation")
  .option("--summary <summary>", "Role summary")
  .option("--status <status>", "Role status")
  .option("--fit-score <fitScore>", "Fit score from 0.0 to 1.0")
  .option("--fit-assessment <fitAssessment>", "Fit assessment")
  .option("--stdin", "Read JSON object from stdin")
  .option("--json", "Print machine-readable JSON")
  .action((options: Record<string, unknown> & { json?: boolean }) => {
    ensureDatabase();
    const input = roleInputSchema.parse(jsonPayload(options));
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const created = addRole(db, input);
      if (options.json) {
        printJson({ role: created });
      } else {
        printText(`Added role ${created.id}: ${created.title}`);
      }
    } finally {
      db.close();
    }
  });

const note = program.command("note").description("Note commands");

note
  .command("add")
  .option("--session-id <sessionId>", "Linked session id")
  .option("--target <target>", "Target ref like company:1")
  .option("--title <title>", "Note title")
  .requiredOption("--body <body>", "Note body")
  .option("--kind <kind>", "Note kind")
  .option("--json", "Print machine-readable JSON")
  .action((options: { sessionId?: string; target?: string; title?: string; body: string; kind?: string; json?: boolean }) => {
    ensureDatabase();
    const target = options.target ? parseTargetRef(options.target) : {};
    const input = noteInputSchema.parse({ ...options, ...target });
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const created = addNote(db, input);
      if (options.json) printJson({ note: created });
      else printText(`Added note ${created.id}`);
    } finally {
      db.close();
    }
  });

note
  .command("list")
  .option("--target <target>", "Target ref like company:1")
  .option("--json", "Print machine-readable JSON")
  .action((options: { target?: string; json?: boolean }) => {
    ensureDatabase();
    const target = options.target ? parseTargetRef(options.target) : {};
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const notes = listNotes(db, target);
      if (options.json) printJson({ notes });
      else notes.forEach((item) => printText(`${item.id}: ${item.body}`));
    } finally {
      db.close();
    }
  });

const evidence = program.command("evidence").description("Evidence commands");

evidence
  .command("add")
  .requiredOption("--target <target>", "Target ref like company:1")
  .requiredOption("--url <url>", "Source URL")
  .option("--title <title>", "Source title")
  .requiredOption("--snippet <snippet>", "Source snippet")
  .option("--source-type <sourceType>", "Source type")
  .option("--confidence <confidence>", "Confidence from 0.0 to 1.0")
  .option("--json", "Print machine-readable JSON")
  .action((options: { target: string; url: string; title?: string; snippet: string; sourceType?: string; confidence?: string; json?: boolean }) => {
    ensureDatabase();
    const input = evidenceInputSchema.parse({ ...options, ...parseTargetRef(options.target) });
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const created = addEvidence(db, input);
      if (options.json) printJson({ evidence: created });
      else printText(`Added evidence ${created.id}`);
    } finally {
      db.close();
    }
  });

evidence
  .command("list")
  .option("--target <target>", "Target ref like company:1")
  .option("--json", "Print machine-readable JSON")
  .action((options: { target?: string; json?: boolean }) => {
    ensureDatabase();
    const target = options.target ? parseTargetRef(options.target) : {};
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const items = listEvidence(db, target);
      if (options.json) printJson({ evidence: items });
      else items.forEach((item) => printText(`${item.id}: ${item.url}`));
    } finally {
      db.close();
    }
  });

const preference = program.command("preference").description("Preference candidate commands");

preference
  .command("propose")
  .requiredOption("--session-id <sessionId>", "Session id")
  .option("--profile-id <profileId>", "Profile id", "1")
  .requiredOption("--kind <kind>", "Preference kind")
  .requiredOption("--label <label>", "Preference label")
  .requiredOption("--description <description>", "Preference description")
  .option("--confidence <confidence>", "Confidence from 0.0 to 1.0")
  .option("--json", "Print machine-readable JSON")
  .action((options: Record<string, unknown> & { json?: boolean }) => {
    ensureDatabase();
    const input = preferenceCandidateInputSchema.parse(options);
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const created = proposePreferenceCandidate(db, input);
      if (options.json) printJson({ preference: created });
      else printText(`Proposed preference ${created.id}: ${created.label}`);
    } finally {
      db.close();
    }
  });

const exportCommand = program.command("export").description("Export commands");

exportCommand
  .command("json")
  .option("--path <path>", "Write export to path")
  .action((options: { path?: string }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const data = buildJsonExport(db);
      const output = `${JSON.stringify(data, null, 2)}\n`;
      if (options.path) {
        writeFileSync(options.path, output);
        const exportRecord = recordExport(db, { format: "json", title: "Locus JSON Export", path: options.path });
        printJson({ export: exportRecord });
      } else {
        process.stdout.write(output);
      }
    } finally {
      db.close();
    }
  });

exportCommand
  .command("markdown")
  .option("--path <path>", "Write export to path")
  .option("--json", "Print machine-readable JSON when writing to path")
  .action((options: { path?: string; json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const output = buildMarkdownExport(db);
      if (options.path) {
        writeFileSync(options.path, output);
        const exportRecord = recordExport(db, { format: "markdown", title: "Locus Markdown Export", path: options.path });
        if (options.json) printJson({ export: exportRecord });
        else printText(`Wrote markdown export to ${options.path}`);
      } else {
        process.stdout.write(output);
      }
    } finally {
      db.close();
    }
  });

preference
  .command("list")
  .option("--status <status>", "Candidate status")
  .option("--json", "Print machine-readable JSON")
  .action((options: { status?: string; json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const preferences = listPreferenceCandidates(db, options.status ? { status: preferenceCandidateInputSchema.shape.status.parse(options.status) } : {});
      if (options.json) printJson({ preferences });
      else preferences.forEach((item) => printText(`${item.id}: ${item.label} [${item.status}]`));
    } finally {
      db.close();
    }
  });

preference
  .command("approve")
  .requiredOption("--id <id>", "Preference candidate id")
  .option("--json", "Print machine-readable JSON")
  .action((options: { id: string; json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const updated = approvePreferenceCandidate(db, Number(options.id));
      if (options.json) printJson({ preference: updated });
      else printText(`Approved preference ${updated.id}`);
    } finally {
      db.close();
    }
  });

preference
  .command("reject")
  .requiredOption("--id <id>", "Preference candidate id")
  .option("--json", "Print machine-readable JSON")
  .action((options: { id: string; json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const updated = rejectPreferenceCandidate(db, Number(options.id));
      if (options.json) printJson({ preference: updated });
      else printText(`Rejected preference ${updated.id}`);
    } finally {
      db.close();
    }
  });

role
  .command("list")
  .option("--company-id <companyId>", "Filter by company id")
  .option("--status <status>", "Filter by role status")
  .option("--json", "Print machine-readable JSON")
  .action((options: { companyId?: string; status?: string; json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const roles = listRoles(db, {
        companyId: options.companyId ? Number(options.companyId) : undefined,
        status: options.status ? roleInputSchema.shape.status.parse(options.status) : undefined,
      });
      if (options.json) {
        printJson({ roles });
      } else {
        for (const item of roles) {
          printText(`${item.id}: ${item.title} [${item.status}]`);
        }
      }
    } finally {
      db.close();
    }
  });

role
  .command("update")
  .requiredOption("--id <id>", "Role id")
  .option("--company-id <companyId>", "Company id")
  .option("--title <title>", "Role title")
  .option("--url <url>", "Role URL")
  .option("--location <location>", "Location text")
  .option("--remote-policy <remotePolicy>", "Remote policy")
  .option("--seniority <seniority>", "Seniority")
  .option("--compensation <compensation>", "Compensation")
  .option("--summary <summary>", "Role summary")
  .option("--status <status>", "Role status")
  .option("--fit-score <fitScore>", "Fit score from 0.0 to 1.0")
  .option("--fit-assessment <fitAssessment>", "Fit assessment")
  .option("--stdin", "Read JSON object from stdin")
  .option("--json", "Print machine-readable JSON")
  .action((options: Record<string, unknown> & { id: string; json?: boolean }) => {
    ensureDatabase();
    const { id, ...rest } = options;
    const input = roleInputSchema.partial().parse(jsonPayload(rest));
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const updated = updateRole(db, Number(id), input);
      if (options.json) {
        printJson({ role: updated });
      } else {
        printText(`Updated role ${updated.id}: ${updated.title}`);
      }
    } finally {
      db.close();
    }
  });

const session = program.command("session").description("Session commands");

session
  .command("start")
  .requiredOption("--goal <goal>", "Research goal")
  .option("--title <title>", "Short session title")
  .option("--profile-id <profileId>", "Profile id", "1")
  .option("--json", "Print machine-readable JSON")
  .action((options: { goal: string; title?: string; profileId: string; json?: boolean }) => {
    ensureDatabase();
    const input = sessionStartInputSchema.parse({
      goal: options.goal,
      title: options.title ?? null,
      profileId: options.profileId,
    });
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const created = createSession(db, input);
      if (options.json) {
        printJson({ session: created });
      } else {
        printText(`Started session ${created.id}: ${created.title}`);
      }
    } finally {
      db.close();
    }
  });

session
  .command("show")
  .option("--id <id>", "Session id")
  .option("--json", "Print machine-readable JSON")
  .action((options: { id?: string; json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const found = options.id ? getSession(db, Number(options.id)) : getActiveSession(db);
      if (!found) {
        throw new Error("No session found.");
      }
      if (options.json) {
        printJson({ session: found });
      } else {
        printText(`${found.id}: ${found.title} [${found.status}]`);
      }
    } finally {
      db.close();
    }
  });

const application = program.command("application").description("Application pipeline commands");

application
  .command("set")
  .description("Create or update pipeline progress for a target (upsert by target)")
  .option("--target <target>", "Target ref like company:1 or role:2")
  .option("--stage <stage>", "Pipeline stage")
  .option("--next-action <nextAction>", "Next action description")
  .option("--next-action-at <nextActionAt>", "Next action timestamp")
  .option("--last-contacted-at <lastContactedAt>", "Last contacted timestamp")
  .option("--notes <notes>", "Freeform notes")
  .option("--stdin", "Read JSON object from stdin")
  .option("--json", "Print machine-readable JSON")
  .action((options: Record<string, unknown> & { target?: string; json?: boolean }) => {
    ensureDatabase();
    const { target, ...rest } = options;
    const ref = target ? parseTargetRef(String(target)) : {};
    const input = applicationInputSchema.parse({ ...jsonPayload(rest), ...ref });
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const saved = upsertApplication(db, input);
      if (options.json) printJson({ application: saved });
      else printText(`Set ${saved.targetType}:${saved.targetId} application to ${saved.stage}`);
    } finally {
      db.close();
    }
  });

application
  .command("list")
  .option("--json", "Print machine-readable JSON")
  .action((options: { json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const applications = listApplications(db);
      if (options.json) printJson({ applications });
      else applications.forEach((item) => printText(`${item.targetType}:${item.targetId} [${item.stage}]`));
    } finally {
      db.close();
    }
  });

application
  .command("show")
  .requiredOption("--target <target>", "Target ref like company:1 or role:2")
  .option("--json", "Print machine-readable JSON")
  .action((options: { target: string; json?: boolean }) => {
    ensureDatabase();
    const ref = parseTargetRef(options.target);
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const found = getApplication(db, ref.targetType as "company" | "role", ref.targetId);
      if (!found) {
        throw new Error(`No application progress for ${options.target}.`);
      }
      if (options.json) printJson({ application: found });
      else printText(`${found.targetType}:${found.targetId} [${found.stage}]`);
    } finally {
      db.close();
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
