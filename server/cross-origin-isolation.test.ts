import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("cross-origin isolation", () => {
  it("enables the headers required by multi-threaded local WebAssembly engines", () => {
    const source = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");

    expect(source).toContain('"Cross-Origin-Opener-Policy", "same-origin"');
    expect(source).toContain('"Cross-Origin-Embedder-Policy", "require-corp"');
  });
});
