import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

let tempDir: string | null = null;

function runCli(args: string[], dbPath: string): string {
  return execFileSync("pnpm", ["tsx", "src/cli/index.ts", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, LOCUS_DB_PATH: dbPath },
    encoding: "utf8",
  });
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

describe("note evidence and preference CLI", () => {
  it("adds and lists notes and evidence for a company target", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-note-cli-"));
    const dbPath = join(tempDir, "test.sqlite");
    runCli(["company", "add", "--name", "Bear", "--json"], dbPath);

    const note = JSON.parse(
      runCli(
        ["note", "add", "--target", "company:1", "--body", "Beautiful Apple-native markdown notes.", "--json"],
        dbPath,
      ),
    );
    const evidence = JSON.parse(
      runCli(
        [
          "evidence",
          "add",
          "--target",
          "company:1",
          "--url",
          "https://bear.app",
          "--snippet",
          "Markdown notes app for Apple devices.",
          "--source-type",
          "company_site",
          "--json",
        ],
        dbPath,
      ),
    );
    const notes = JSON.parse(runCli(["note", "list", "--target", "company:1", "--json"], dbPath));
    const evidenceItems = JSON.parse(runCli(["evidence", "list", "--target", "company:1", "--json"], dbPath));

    expect(note.note.targetType).toBe("company");
    expect(evidence.evidence.sourceType).toBe("company_site");
    expect(notes.notes).toHaveLength(1);
    expect(evidenceItems.evidence).toHaveLength(1);
  });

  it("proposes, approves, and rejects preference candidates", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-preference-cli-"));
    const dbPath = join(tempDir, "test.sqlite");
    runCli(["session", "start", "--goal", "Research Apple-native knowledge tools", "--json"], dbPath);

    const proposed = JSON.parse(
      runCli(
        [
          "preference",
          "propose",
          "--session-id",
          "1",
          "--kind",
          "interest",
          "--label",
          "Apple-native knowledge tools",
          "--description",
          "User appears interested in Apple-native knowledge tools.",
          "--confidence",
          "0.8",
          "--json",
        ],
        dbPath,
      ),
    );
    const approved = JSON.parse(runCli(["preference", "approve", "--id", "1", "--json"], dbPath));
    const rejected = JSON.parse(runCli(["preference", "reject", "--id", "1", "--json"], dbPath));

    expect(proposed.preference.status).toBe("pending");
    expect(approved.preference.status).toBe("approved");
    expect(rejected.preference.status).toBe("rejected");
  });
});
