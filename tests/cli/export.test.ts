import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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

function seedResearch(dbPath: string): void {
  runCli(["session", "start", "--goal", "Research Apple-native notes companies", "--json"], dbPath);
  runCli(["company", "add", "--name", "Bear", "--summary", "Apple-native markdown notes.", "--primary-label", "craft-driven", "--json"], dbPath);
  runCli(["role", "add", "--company-id", "1", "--title", "Senior iOS Engineer", "--remote-policy", "remote", "--json"], dbPath);
  runCli(["note", "add", "--target", "company:1", "--body", "Small remote team signal.", "--json"], dbPath);
  runCli([
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
  ], dbPath);
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

describe("export CLI", () => {
  it("exports JSON to stdout", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-export-json-"));
    const dbPath = join(tempDir, "test.sqlite");
    seedResearch(dbPath);

    const exported = JSON.parse(runCli(["export", "json"], dbPath));

    expect(exported.profile.name).toBe("Victor");
    expect(exported.companies[0].name).toBe("Bear");
    expect(exported.roles[0].title).toBe("Senior iOS Engineer");
    expect(exported.notes[0].body).toContain("remote");
    expect(exported.evidence[0].url).toBe("https://bear.app");
  });

  it("exports Markdown to a path", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-export-md-"));
    const dbPath = join(tempDir, "test.sqlite");
    const exportPath = join(tempDir, "shortlist.md");
    seedResearch(dbPath);

    const result = JSON.parse(runCli(["export", "markdown", "--path", exportPath, "--json"], dbPath));
    const markdown = readFileSync(exportPath, "utf8");

    expect(result.export.path).toBe(exportPath);
    expect(markdown).toContain("# Locus Export");
    expect(markdown).toContain("## Companies");
    expect(markdown).toContain("Bear");
    expect(markdown).toContain("https://bear.app");
  });
});
