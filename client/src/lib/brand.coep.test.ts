import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Brand external-logo safety", () => {
  it("uses only same-origin path logos so COEP cannot block the public header", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/Brand.tsx"), "utf8");

    expect(source).toContain('logoUrl?.startsWith("/")');
    expect(source).toContain("localLogo ? <img src={localLogo}");
    expect(source).not.toContain("logoUrl ? <img src={logoUrl}");
  });
});
