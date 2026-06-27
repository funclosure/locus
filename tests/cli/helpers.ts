import { execFileSync, spawnSync } from "node:child_process";

let built = false;

function ensureCliBuilt(): void {
  if (built) {
    return;
  }

  execFileSync("pnpm", ["build"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  });
  built = true;
}

export function runCli(args: string[], dbPath: string, input?: string): string {
  ensureCliBuilt();

  const command = ["dist/cli/index.js", ...args];
  const env = { ...process.env, LOCUS_DB_PATH: dbPath };

  if (input !== undefined) {
    const result = spawnSync("node", command, {
      cwd: process.cwd(),
      encoding: "utf8",
      env,
      input,
    });
    if (result.status !== 0) {
      throw new Error(result.stderr);
    }
    return result.stdout;
  }

  return execFileSync("node", command, {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
  });
}
