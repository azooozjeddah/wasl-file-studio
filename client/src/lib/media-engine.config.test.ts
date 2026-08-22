import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("FFmpeg local loader configuration", () => {
  it("uses a Vite-built ESM worker and core without a CDN dependency", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/media-engine.ts"), "utf8");

    expect(source).toContain('"/__wasl__/ffmpeg/worker.js?v=0.12.10"');
    expect(source).not.toContain("https://unpkg.com/@ffmpeg");
    expect(source).toContain("new Worker(ffmpegWorkerURL)");
    expect(source).toContain("FFMPEG_LOAD_TIMEOUT_MS = 45_000");
    expect(source).toContain("Promise.race");
  });
});
