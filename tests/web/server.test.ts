import { mkdtempSync, rmSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "../../src/db/migrate.js";
import { seedDefaultProfile } from "../../src/db/seed.js";
import { openDatabase } from "../../src/db/client.js";
import { addCompany } from "../../src/repositories/companyRepository.js";
import { addEvidence } from "../../src/repositories/evidenceRepository.js";
import { addNote } from "../../src/repositories/noteRepository.js";
import { addRole } from "../../src/repositories/roleRepository.js";
import { handleLocusWebRequest } from "../../src/web/server.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

describe("locus web server", () => {
  it("serves the research snapshot API from SQLite", async () => {
    const dbPath = seedDatabase();
    expect(dbPath).toContain("test.sqlite");

    const response = await requestPath(dbPath, "/api/snapshot");
    const snapshot = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(snapshot.profile.name).toBe("Victor");
    expect(snapshot.companies).toHaveLength(1);
    expect(snapshot.companies[0].name).toBe("Bear");
    expect(snapshot.roles[0].title).toBe("Senior iOS Engineer");
    expect(snapshot.notes[0].body).toContain("Apple-native");
    expect(snapshot.evidence[0].url).toBe("https://bear.app");
  });

  it("serves the browse UI shell", async () => {
    const dbPath = seedDatabase();
    const response = await requestPath(dbPath, "/");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Locus");
    expect(response.body).toContain("/app.js");
  });
});

function seedDatabase() {
  tempDir = mkdtempSync(join(tmpdir(), "locus-web-"));
  const dbPath = join(tempDir, "test.sqlite");
  migrateDatabase(dbPath);
  seedDefaultProfile(dbPath);

  const db = openDatabase(dbPath);
  const company = addCompany(db, {
    name: "Bear",
    url: "https://bear.app",
    hq: "Italy",
    summary: "Apple-native markdown notes.",
    primaryLabel: "craft-driven",
    status: "watching",
    fitScore: 0.8,
    fitAssessment: "Small remote team with strong Apple-platform taste.",
  });
  addRole(db, {
    companyId: company.id,
    title: "Senior iOS Engineer",
    url: "https://bear.app/jobs",
    location: "Remote",
    remotePolicy: "remote",
    seniority: "senior",
    compensation: null,
    summary: "Build native iOS notes features.",
    status: "researching",
    fitScore: 0.82,
    fitAssessment: "Strong iOS craft fit.",
  });
  addNote(db, {
    sessionId: null,
    targetType: "company",
    targetId: company.id,
    title: null,
    body: "Beautiful Apple-native markdown notes.",
    kind: "observation",
  });
  addEvidence(db, {
    targetType: "company",
    targetId: company.id,
    url: "https://bear.app",
    title: "Bear",
    snippet: "Markdown notes app for Apple devices.",
    sourceType: "company_site",
    confidence: 0.9,
  });
  db.close();

  return dbPath;
}

async function requestPath(dbPath: string, path: string): Promise<FakeResponse> {
  const response = new FakeResponse();
  await handleLocusWebRequest({ method: "GET", url: path } as IncomingMessage, response as unknown as ServerResponse, {
    dbPath,
    staticRoot: join(process.cwd(), "src", "web", "static"),
  });
  await response.done();
  return response;
}

class FakeResponse extends Writable {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = "";

  writeHead(statusCode: number, headers: Record<string, string>) {
    this.statusCode = statusCode;
    this.headers = headers;
    return this;
  }

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.body += chunk.toString();
    callback();
  }

  done(): Promise<void> {
    if (this.writableEnded) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.once("finish", resolve));
  }
}
