import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerLocusTools } from "./tools.js";

export function createLocusMcpServer(dbPath = process.env.LOCUS_DB_PATH): McpServer {
  const server = new McpServer({ name: "locus", version: "0.1.0" });
  registerLocusTools(server, dbPath);
  return server;
}

export async function startLocusMcpServer(dbPath = process.env.LOCUS_DB_PATH): Promise<McpServer> {
  const server = createLocusMcpServer(dbPath);
  await server.connect(new StdioServerTransport());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startLocusMcpServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
