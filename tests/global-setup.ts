import { execFileSync } from "node:child_process";

// Build the project once before the suite so CLI e2e tests reuse a single
// compiled dist/ instead of each worker spawning its own (slow, contended) build.
export default function setup(): void {
  execFileSync("pnpm", ["build"], { cwd: process.cwd(), encoding: "utf8", stdio: "pipe" });
}
