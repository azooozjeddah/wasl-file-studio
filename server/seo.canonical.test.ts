import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public canonical metadata", () => {
  it("uses a build-safe production fallback then resolves to the active origin and path", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");

    expect(indexHtml).toContain('<link rel="canonical" href="https://waslfile-b7bks7br.manus.space/"/>');
    expect(indexHtml).toContain("window.location.origin");
    expect(indexHtml).not.toContain("wasl-file-studio.manus.space");
    expect(indexHtml).not.toContain("VITE_ANALYTICS_ENDPOINT");
  });

  it("publishes robots.txt with the active sitemap domain", () => {
    const robots = readFileSync(resolve(process.cwd(), "client/public/robots.txt"), "utf8");

    expect(robots).toContain("Sitemap: https://waslfile-b7bks7br.manus.space/sitemap.xml");
    expect(robots).not.toContain("wasl-file-studio.manus.space");
  });
});
