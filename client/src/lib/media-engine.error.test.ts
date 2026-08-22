import { describe, expect, it } from "vitest";
import { assertMediaOutput, mediaErrorMessage } from "./media-engine";

describe("media error messaging", () => {
  it("explains a missing video audio track without exposing the generic filesystem error", () => {
    expect(mediaErrorMessage(new Error("FS error"), "video-to-mp3")).toContain("مسار صوت صالح");
  });

  it("preserves unrelated media errors", () => {
    expect(mediaErrorMessage(new Error("unsupported codec"), "video-to-mp3")).toBe("unsupported codec");
  });

  it("rejects empty media output instead of offering a broken download", () => {
    expect(() => assertMediaOutput(new Uint8Array())).toThrow("ملف وسائط صالح");
  });
});
