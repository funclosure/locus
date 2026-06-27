import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "./helpers.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

describe("locus CLI", () => {
  it("shows the seeded profile as JSON", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-cli-"));
    const dbPath = join(tempDir, "test.sqlite");

    const output = runCli(["profile", "show", "--json"], dbPath);
    const parsed = JSON.parse(output);

    expect(parsed.profile.name).toBe("Victor");
    expect(parsed.preferences.length).toBeGreaterThan(0);
  });

  it("starts and shows an active session as JSON", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-cli-"));
    const dbPath = join(tempDir, "test.sqlite");

    const startOutput = runCli(["session", "start", "--goal", "Research AI notes tools", "--json"], dbPath);
    const started = JSON.parse(startOutput);

    expect(started.session.id).toBe(1);
    expect(started.session.status).toBe("active");

    const showOutput = runCli(["session", "show", "--json"], dbPath);
    const shown = JSON.parse(showOutput);

    expect(shown.session.id).toBe(started.session.id);
    expect(shown.session.goal).toBe("Research AI notes tools");
  });
});
