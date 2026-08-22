import { describe, expect, it } from "vitest";
import { FFMPEG_CORE_ROUTE, FFMPEG_CORE_VERSION, FFMPEG_WASM_ROUTE } from "./ffmpegAssets";

describe("same-origin FFmpeg asset routes", () => {
  it("uses versioned local ESM and WASM routes without a CDN", () => {
    expect(FFMPEG_CORE_ROUTE).toBe(`/__wasl__/ffmpeg/ffmpeg-core.js?v=${FFMPEG_CORE_VERSION}`);
    expect(FFMPEG_WASM_ROUTE).toBe(`/__wasl__/ffmpeg/ffmpeg-core.wasm?v=${FFMPEG_CORE_VERSION}`);
    expect(FFMPEG_CORE_ROUTE).not.toContain("http");
    expect(FFMPEG_WASM_ROUTE).not.toContain("http");
  });
});
