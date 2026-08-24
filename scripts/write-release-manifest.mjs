import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, join, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const hash = createHash("sha256");

function add(relativePath) {
  const absolutePath = resolve(root, relativePath);
  if (statSync(absolutePath).isDirectory()) {
    for (const entry of readdirSync(absolutePath).sort()) add(join(relativePath, entry));
    return;
  }
  hash.update(relativePath.replaceAll(sep, "/"));
  hash.update(readFileSync(absolutePath));
}

for (const input of ["client/src", "server", "shared", "vite.config.ts", "package.json", "pnpm-lock.yaml"]) add(input);

let revision = "unknown";
try {
  revision = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch {}

const outputDir = resolve(root, "client", "public");
mkdirSync(outputDir, { recursive: true });
writeFileSync(
  resolve(outputDir, "wasl-release.json"),
  `${JSON.stringify({ revision, sourceDigest: hash.digest("hex").slice(0, 16), builtAt: new Date().toISOString(), output: "dist/public" })}\n`,
  "utf8"
);
