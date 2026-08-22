import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("FFmpeg local loader configuration", () => {
  it("uses a Vite-built ESM worker and core without a CDN dependency", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/media-engine.ts"), "utf8");
    const workerSource = readFileSync(resolve(process.cwd(), "client/src/lib/ffmpeg-local-worker.ts"), "utf8");

    expect(source).toContain('"./ffmpeg-local-worker?worker"');
    expect(workerSource).toContain('import createFFmpegCore from "@ffmpeg/core"');
    expect(workerSource).toContain('import wasmURL from "@ffmpeg/core/wasm?url"');
    expect(workerSource).not.toContain("https://unpkg.com/@ffmpeg");
    expect(workerSource).toContain("mainScriptUrlOrBlob");
    expect(source).toContain("FFMPEG_LOAD_TIMEOUT_MS = 15_000");
    expect(source).toContain("Promise.race");
  });
});
