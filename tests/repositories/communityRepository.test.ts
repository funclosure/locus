import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import {
  addCommunity,
  getCommunity,
  listCommunities,
  updateCommunity,
} from "../../src/repositories/communityRepository.js";

let tempDir: string;
let dbPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "locus-community-"));
  dbPath = join(tempDir, "test.sqlite");
  migrateDatabase(dbPath);
});

afterEach(() => {
  rmSync(tempDir, { force: true, recursive: true });
});

function withDb<T>(fn: (db: ReturnType<typeof openDatabase>) => T): T {
  const db = openDatabase(dbPath);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

const raycast = {
  name: "raycast/extensions",
  url: "https://github.com/raycast/extensions",
  ecosystem: "TypeScript",
  summary: "Extension store, reviewed by Raycast staff.",
  primaryLabel: "high-openness",
  status: "watching" as const,
  medianMergeDays: 0.1,
  outsiderMergeRatio: 0.66,
  lastActivityAt: "2026-08-27",
  fitScore: 0.9,
  fitAssessment: "Fastest merge latency measured; ties to Raycast as a target.",
};

describe("communityRepository", () => {
  it("adds and reads back every field", () => {
    const created = withDb((db) => addCommunity(db, raycast));
    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe("raycast/extensions");
    expect(created.url).toBe("https://github.com/raycast/extensions");
    expect(created.ecosystem).toBe("TypeScript");
    expect(created.summary).toBe("Extension store, reviewed by Raycast staff.");
    expect(created.primaryLabel).toBe("high-openness");
    expect(created.status).toBe("watching");
    expect(created.medianMergeDays).toBe(0.1);
    expect(created.outsiderMergeRatio).toBe(0.66);
    expect(created.lastActivityAt).toBe("2026-08-27");
    expect(created.fitScore).toBe(0.9);
    expect(created.fitAssessment).toBe("Fastest merge latency measured; ties to Raycast as a target.");
    expect(created.lastCheckedAt).toBeNull();

    const fetched = withDb((db) => getCommunity(db, created.id));
    expect(fetched).toEqual(created);
  });

  it("returns null for a missing id", () => {
    expect(withDb((db) => getCommunity(db, 999))).toBeNull();
  });

  it("lists all communities and filters by status", () => {
    withDb((db) => {
      addCommunity(db, raycast);
      addCommunity(db, { ...raycast, name: "groue/GRDB.swift", status: "contributing" });
      addCommunity(db, { ...raycast, name: "anyproto/anytype-ts", status: "rejected" });
    });

    expect(withDb((db) => listCommunities(db)).length).toBe(3);
    const contributing = withDb((db) => listCommunities(db, { status: "contributing" }));
    expect(contributing.length).toBe(1);
    expect(contributing[0].name).toBe("groue/GRDB.swift");
  });

  it("updates only the supplied fields and bumps updated_at", () => {
    const created = withDb((db) => addCommunity(db, raycast));
    const updated = withDb((db) =>
      updateCommunity(db, created.id, { status: "contributing", medianMergeDays: 0.3 }),
    );

    expect(updated.status).toBe("contributing");
    expect(updated.medianMergeDays).toBe(0.3);
    expect(updated.name).toBe("raycast/extensions");
    expect(updated.outsiderMergeRatio).toBe(0.66);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it("throws when updating a missing community", () => {
    expect(() => withDb((db) => updateCommunity(db, 999, { status: "watching" }))).toThrow(/not found/);
  });

  it("rejects an out-of-range outsider ratio at the database boundary", () => {
    expect(() => withDb((db) => addCommunity(db, { ...raycast, outsiderMergeRatio: 2 }))).toThrow();
  });
});
