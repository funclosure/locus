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

describe("locus community CLI", () => {
  it("adds a community and prints JSON", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-cli-community-"));
    const dbPath = join(tempDir, "test.sqlite");

    const out = runCli(
      [
        "community",
        "add",
        "--name",
        "raycast/extensions",
        "--ecosystem",
        "TypeScript",
        "--status",
        "watching",
        "--median-merge-days",
        "0.1",
        "--outsider-merge-ratio",
        "0.66",
        "--last-activity-at",
        "2026-08-27",
        "--fit-score",
        "0.9",
        "--json",
      ],
      dbPath,
    );
    const parsed = JSON.parse(out);
    expect(parsed.community.name).toBe("raycast/extensions");
    expect(parsed.community.medianMergeDays).toBe(0.1);
    expect(parsed.community.outsiderMergeRatio).toBe(0.66);
    expect(parsed.community.status).toBe("watching");
  });

  it("lists communities and filters by status", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-cli-community-"));
    const dbPath = join(tempDir, "test.sqlite");

    runCli(["community", "add", "--name", "a/one", "--status", "watching", "--json"], dbPath);
    runCli(["community", "add", "--name", "b/two", "--status", "contributing", "--json"], dbPath);

    expect(JSON.parse(runCli(["community", "list", "--json"], dbPath)).communities.length).toBe(2);
    const filtered = JSON.parse(runCli(["community", "list", "--status", "contributing", "--json"], dbPath));
    expect(filtered.communities.length).toBe(1);
    expect(filtered.communities[0].name).toBe("b/two");
  });

  it("shows a single community by id", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-cli-community-"));
    const dbPath = join(tempDir, "test.sqlite");

    const id = JSON.parse(runCli(["community", "add", "--name", "a/one", "--json"], dbPath)).community.id;
    const shown = JSON.parse(runCli(["community", "show", "--id", String(id), "--json"], dbPath));
    expect(shown.community.name).toBe("a/one");
  });

  it("updates a community", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-cli-community-"));
    const dbPath = join(tempDir, "test.sqlite");

    const id = JSON.parse(runCli(["community", "add", "--name", "a/one", "--json"], dbPath)).community.id;
    const updated = JSON.parse(
      runCli(["community", "update", "--id", String(id), "--status", "contributing", "--json"], dbPath),
    );
    expect(updated.community.status).toBe("contributing");
    expect(updated.community.name).toBe("a/one");
  });
});
