import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDir = resolve(projectRoot, "dist", "public");

function gitRevision() {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  resolve(outputDir, "wasl-release.json"),
  `${JSON.stringify({ revision: gitRevision(), builtAt: new Date().toISOString(), output: "dist/public" }, null, 2)}\n`,
  "utf8"
);
