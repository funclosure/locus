import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { registerLocusTools } from "../../src/mcp/tools.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

async function connect() {
  tempDir = mkdtempSync(join(tmpdir(), "locus-mcp-"));
  const dbPath = join(tempDir, "test.sqlite");
  const server = new McpServer({ name: "locus", version: "0.1.0" });
  registerLocusTools(server, dbPath);
  const client = new Client({ name: "test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function payload(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0].text);
}

const EXPECTED_TOOLS = [
  "profile_show",
  "session_start",
  "session_show",
  "company_add",
  "company_list",
  "company_update",
  "company_get",
  "role_add",
  "role_list",
  "role_update",
  "note_add",
  "note_list",
  "evidence_add",
  "evidence_list",
  "preference_propose",
  "preference_list",
  "preference_approve",
  "preference_reject",
  "application_set",
  "application_list",
  "application_show",
  "export_json",
  "export_markdown",
  "snapshot",
];

describe("Locus MCP server", () => {
  it("exposes the full CLI tool surface", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    for (const expected of EXPECTED_TOOLS) {
      expect(names).toContain(expected);
    }
  });

  it("reads the seeded profile", async () => {
    const client = await connect();
    const result = payload(await client.callTool({ name: "profile_show", arguments: {} }));
    expect(result.profile.name).toBe("Victor");
  });

  it("adds and lists a company round-trip", async () => {
    const client = await connect();
    const added = payload(await client.callTool({ name: "company_add", arguments: { name: "Linear", summary: "Craft-driven." } }));
    expect(added.company.id).toBe(1);
    const listed = payload(await client.callTool({ name: "company_list", arguments: {} }));
    expect(listed.companies).toHaveLength(1);
    expect(listed.companies[0].name).toBe("Linear");
  });

  it("upserts and shows application progress", async () => {
    const client = await connect();
    await client.callTool({ name: "company_add", arguments: { name: "Mem" } });
    const set = payload(await client.callTool({ name: "application_set", arguments: { targetType: "company", targetId: 1, stage: "applied" } }));
    expect(set.application.stage).toBe("applied");
    const shown = payload(await client.callTool({ name: "application_show", arguments: { targetType: "company", targetId: 1 } }));
    expect(shown.application.stage).toBe("applied");
  });

  it("returns a markdown export as text", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "export_markdown", arguments: {} });
    expect(result.content[0].text).toContain("#");
  });
});
