import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("release foundation", () => {
  it("builds from a clean dist and writes a public release manifest", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { scripts: { build: string } };
    expect(packageJson.scripts.build).toContain("rm -rf dist node_modules/.vite");
    expect(packageJson.scripts.build).toContain("NODE_OPTIONS=--max-old-space-size=900");
    expect(packageJson.scripts.build).toContain("vite build && sleep 2 && esbuild");
    expect(packageJson.scripts.build).not.toContain("write-release-manifest");
    expect(readFileSync(resolve(root, "vite.config.ts"), "utf8")).toContain("vitePluginWaslReleaseManifest");
  });

  it("keeps HTML and the release manifest out of intermediary caches", () => {
    const staticServer = readFileSync(resolve(root, "server/_core/vite.ts"), "utf8");
    expect(staticServer).toContain('filePath.endsWith(".html")');
    expect(staticServer).toContain("wasl-release.json");
    expect(staticServer).toContain('"CDN-Cache-Control": "no-store"');
  });
});
