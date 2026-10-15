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

describe("application CLI", () => {
  it("sets, upserts, and lists application progress for a target", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-application-cli-"));
    const dbPath = join(tempDir, "test.sqlite");
    runCli(["company", "add", "--name", "Linear", "--json"], dbPath);

    const created = JSON.parse(
      runCli(
        ["application", "set", "--target", "company:1", "--stage", "applied", "--next-action", "Follow up with recruiter", "--json"],
        dbPath,
      ),
    );
    const upserted = JSON.parse(
      runCli(["application", "set", "--target", "company:1", "--stage", "interviewing", "--json"], dbPath),
    );
    const listed = JSON.parse(runCli(["application", "list", "--json"], dbPath));

    expect(created.application.targetType).toBe("company");
    expect(created.application.targetId).toBe(1);
    expect(created.application.stage).toBe("applied");
    expect(created.application.nextAction).toBe("Follow up with recruiter");
    expect(upserted.application.id).toBe(created.application.id);
    expect(upserted.application.stage).toBe("interviewing");
    expect(listed.applications).toHaveLength(1);
  });

  it("sets from stdin JSON and shows a single target", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-application-show-cli-"));
    const dbPath = join(tempDir, "test.sqlite");
    runCli(["company", "add", "--name", "Craft", "--json"], dbPath);
    runCli(["role", "add", "--json"], dbPath, JSON.stringify({ companyId: 1, title: "Senior iOS Engineer" }));

    const created = JSON.parse(
      runCli(
        ["application", "set", "--json"],
        dbPath,
        JSON.stringify({ targetType: "role", targetId: 1, stage: "reached_out", notes: "Warm intro via ex-colleague" }),
      ),
    );
    const shown = JSON.parse(runCli(["application", "show", "--target", "role:1", "--json"], dbPath));

    expect(created.application.stage).toBe("reached_out");
    expect(shown.application.targetId).toBe(1);
    expect(shown.application.notes).toBe("Warm intro via ex-colleague");
  });

  it("records feedback in history and reports calibration", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-application-history-cli-"));
    const dbPath = join(tempDir, "test.sqlite");
    runCli(["company", "add", "--name", "Linear", "--fit-score", "0.8", "--json"], dbPath);
    runCli(["application", "set", "--target", "company:1", "--stage", "applied", "--occurred-at", "2026-09-01", "--json"], dbPath);
    runCli(
      [
        "application", "set", "--target", "company:1", "--stage", "rejected",
        "--feedback", "Looking for more backend depth.", "--occurred-at", "2026-09-20", "--json",
      ],
      dbPath,
    );

    const history = JSON.parse(runCli(["application", "history", "--target", "company:1", "--json"], dbPath));
    const calibration = JSON.parse(runCli(["application", "calibrate", "--json"], dbPath)).calibration;
    const text = runCli(["application", "calibrate"], dbPath);

    expect(history.events.map((event: { stage: string; occurredAt: string }) => [event.stage, event.occurredAt])).toEqual([
      ["applied", "2026-09-01"],
      ["rejected", "2026-09-20"],
    ]);
    expect(history.events[1].feedback).toBe("Looking for more backend depth.");
    expect(calibration.verdict).toBe("insufficient");
    expect(calibration.resolved).toHaveLength(1);
    expect(calibration.feedback[0].name).toBe("Linear");
    expect(text).toContain("(n too small)");
    expect(text).toContain('"Looking for more backend depth."');
  });
});

