#!/usr/bin/env node
import { Command } from "commander";
import { openDatabase } from "../db/client.js";
import { migrateDatabase } from "../db/migrate.js";
import { seedDefaultProfile } from "../db/seed.js";
import { companyInputSchema, roleInputSchema, sessionStartInputSchema } from "../domain/validators.js";
import { addCompany, listCompanies, updateCompany } from "../repositories/companyRepository.js";
import { getDefaultProfile, listProfilePreferences } from "../repositories/profileRepository.js";
import { addRole, listRoles, updateRole } from "../repositories/roleRepository.js";
import { createSession, getActiveSession, getSession } from "../repositories/sessionRepository.js";
import { mergeOptionsWithJson, readStdinJson } from "./input.js";
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
  .option("--name <name>", "Company name")
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
  .option("--name <name>", "Company name")
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

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
