import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("FFmpeg local loader configuration", () => {
  it("uses the UMD core bundle compatible with the classic FFmpeg worker", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/media-engine.ts"), "utf8");

    expect(source).toContain('https://unpkg.com/@ffmpeg/core@0.12.9/dist/umd');
    expect(source).not.toContain('core@0.12.9/dist/esm');
    expect(source).not.toContain("ffmpeg-core.worker.js");
    expect(source).toContain('coreURL: `${base}/ffmpeg-core.js`');
  });
});
