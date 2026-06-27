import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

let tempDir: string | null = null;

function runCli(args: string[], dbPath: string, input?: string): string {
  if (input !== undefined) {
    const result = spawnSync("pnpm", ["tsx", "src/cli/index.ts", ...args], {
      cwd: process.cwd(),
      env: { ...process.env, LOCUS_DB_PATH: dbPath },
      encoding: "utf8",
      input,
    });
    if (result.status !== 0) {
      throw new Error(result.stderr);
    }
    return result.stdout;
  }
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

describe("company and role CLI", () => {
  it("adds, lists, and updates companies", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-company-cli-"));
    const dbPath = join(tempDir, "test.sqlite");

    const added = JSON.parse(
      runCli(
        [
          "company",
          "add",
          "--name",
          "Linear",
          "--summary",
          "Craft-driven issue tracking.",
          "--primary-label",
          "craft-driven",
          "--fit-score",
          "0.8",
          "--json",
        ],
        dbPath,
      ),
    );
    const updated = JSON.parse(runCli(["company", "update", "--id", "1", "--status", "shortlisted", "--json"], dbPath));
    const listed = JSON.parse(runCli(["company", "list", "--json"], dbPath));

    expect(added.company.id).toBe(1);
    expect(updated.company.status).toBe("shortlisted");
    expect(listed.companies).toHaveLength(1);
  });

  it("adds roles from stdin JSON and lists by company", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-role-cli-"));
    const dbPath = join(tempDir, "test.sqlite");
    runCli(["company", "add", "--name", "Craft", "--json"], dbPath);

    const added = JSON.parse(
      runCli(
        ["role", "add", "--json"],
        dbPath,
        JSON.stringify({
          companyId: 1,
          title: "Senior iOS Engineer",
          remotePolicy: "remote",
          summary: "Build native iOS features.",
          fitScore: 0.85,
        }),
      ),
    );
    const updated = JSON.parse(runCli(["role", "update", "--id", "1", "--status", "interested", "--json"], dbPath));
    const listed = JSON.parse(runCli(["role", "list", "--company-id", "1", "--json"], dbPath));

    expect(added.role.title).toBe("Senior iOS Engineer");
    expect(updated.role.status).toBe("interested");
    expect(listed.roles).toHaveLength(1);
  });
});
