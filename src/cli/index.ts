#!/usr/bin/env node
import { Command } from "commander";
import { openDatabase } from "../db/client.js";
import { migrateDatabase } from "../db/migrate.js";
import { seedDefaultProfile } from "../db/seed.js";
import { sessionStartInputSchema } from "../domain/validators.js";
import { getDefaultProfile, listProfilePreferences } from "../repositories/profileRepository.js";
import { createSession, getActiveSession, getSession } from "../repositories/sessionRepository.js";
import { printJson, printText } from "./output.js";

function ensureDatabase(): void {
  migrateDatabase(process.env.LOCUS_DB_PATH);
  seedDefaultProfile(process.env.LOCUS_DB_PATH);
}

const program = new Command();

program.name("locus").description("Local agent-usable job search knowledge system").version("0.1.0");

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
