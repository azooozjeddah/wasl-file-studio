import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("FFmpeg local loader configuration", () => {
  it("bundles the ESM core, WASM, and module worker through Vite without a CDN dependency", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/media-engine.ts"), "utf8");

    expect(source).toContain('@ffmpeg/ffmpeg/worker?worker&url');
    expect(source).toContain('"/__wasl__/ffmpeg/ffmpeg-core.js?v=0.12.10"');
    expect(source).toContain('"/__wasl__/ffmpeg/ffmpeg-core.wasm?v=0.12.10"');
    expect(source).not.toContain("https://unpkg.com/@ffmpeg");
    expect(source).toContain("coreURL: ffmpegCoreURL");
    expect(source).toContain("FFMPEG_LOAD_TIMEOUT_MS = 15_000");
    expect(source).toContain("Promise.race");
  });
});
