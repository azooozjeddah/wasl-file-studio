import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public canonical metadata", () => {
  it("uses an origin-relative default canonical instead of a historical deployment domain", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");

    expect(indexHtml).toContain('<link rel="canonical" href="/"/>');
    expect(indexHtml).not.toContain("wasl-file-studio.manus.space");
  });
});
