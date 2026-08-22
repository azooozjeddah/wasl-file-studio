import { describe, expect, it } from "vitest";
import { findTool } from "./tools";

describe("media readiness labeling", () => {
  it("keeps FFmpeg-dependent audio and video conversions visibly experimental", () => {
    ["convert-audio", "trim-audio", "merge-audio", "video-to-mp3", "mp4-to-webm", "webm-to-mp4", "compress-video", "trim-video"].forEach(slug => expect(findTool(slug)?.experimental).toBe(true));
  });
  it("keeps browser-native metadata and frame inspection available as non-experimental tools", () => {
    expect(findTool("audio-metadata")?.experimental).not.toBe(true);
    expect(findTool("video-metadata")?.experimental).not.toBe(true);
    expect(findTool("extract-frame")?.experimental).not.toBe(true);
  });
});
