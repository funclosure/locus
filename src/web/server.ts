import { createReadStream, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, normalize, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildJsonExport } from "../export/json.js";
import { openDatabase } from "../db/client.js";
import { migrateDatabase } from "../db/migrate.js";
import { seedDefaultProfile } from "../db/seed.js";

export type LocusWebServerOptions = {
  dbPath?: string;
  staticRoot?: string;
};

export type StartLocusWebServerOptions = LocusWebServerOptions & {
  host?: string;
  port?: number;
};

const defaultStaticRoot = resolve(process.cwd(), "src", "web", "static");

export function createLocusWebServer(options: LocusWebServerOptions = {}): Server {
  ensureDatabase(options.dbPath);
  const staticRoot = options.staticRoot ?? defaultStaticRoot;

  return createServer((request, response) => {
    void handleLocusWebRequest(request, response, { ...options, staticRoot });
  });
}

export function startLocusWebServer(options: StartLocusWebServerOptions = {}): Server {
  const port = options.port ?? Number(process.env.LOCUS_WEB_PORT ?? 4173);
  const host = options.host ?? process.env.LOCUS_WEB_HOST ?? "127.0.0.1";
  const server = createLocusWebServer(options);
  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`Locus browse UI: http://${host}:${actualPort}`);
  });
  return server;
}

export async function handleLocusWebRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: Required<Pick<LocusWebServerOptions, "staticRoot">> & LocusWebServerOptions,
): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method !== "GET") {
      writeJson(response, 405, { error: "Method not allowed." });
      return;
    }

    if (url.pathname === "/api/snapshot") {
      writeJson(response, 200, buildSnapshot(options.dbPath));
      return;
    }

    serveStatic(url.pathname, response, options.staticRoot);
  } catch (error) {
    writeJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
}

function buildSnapshot(dbPath?: string): Record<string, unknown> {
  const db = openDatabase(dbPath);
  try {
    return buildJsonExport(db);
  } finally {
    db.close();
  }
}

function ensureDatabase(dbPath?: string): void {
  migrateDatabase(dbPath);
  seedDefaultProfile(dbPath);
}

function serveStatic(pathname: string, response: ServerResponse, staticRoot: string): void {
  const requestedPath = pathname === "/" ? "index.html" : pathname.slice(1);
  const rootPath = resolve(staticRoot);
  const filePath = resolve(rootPath, normalize(requestedPath));
  const relativePath = relative(rootPath, filePath);

  if (relativePath.startsWith("..") || relativePath === "" || !existsSync(filePath)) {
    writeText(response, 404, "Not found.", "text/plain; charset=utf-8");
    return;
  }

  response.writeHead(200, { "content-type": contentType(filePath) });
  createReadStream(filePath).pipe(response);
}

function writeJson(response: ServerResponse, statusCode: number, value: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function writeText(response: ServerResponse, statusCode: number, value: string, contentTypeValue: string): void {
  response.writeHead(statusCode, { "content-type": contentTypeValue });
  response.end(value);
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startLocusWebServer({ dbPath: process.env.LOCUS_DB_PATH });
}
