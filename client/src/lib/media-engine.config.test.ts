import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("FFmpeg local loader configuration", () => {
  it("uses the matching ESM core bundle compatible with the module worker", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/media-engine.ts"), "utf8");

    expect(source).toContain('"@ffmpeg/ffmpeg/worker?worker&url"');
    expect(source).toContain('https://unpkg.com/@ffmpeg/core@0.12.9/dist/esm');
    expect(source).toContain('coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript")');
    expect(source).not.toContain("ffmpeg-core.worker.js");
  });
});
