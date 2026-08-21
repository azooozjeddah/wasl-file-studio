import { describe, expect, it } from "vitest";
import { getWorkerAdapter, workerAdapters } from "./workerAdapters";

describe("server worker adapter registry", () => {
  it("declares future open-source engines without allowing accidental execution", async () => {
    expect(workerAdapters.map(item => item.key)).toEqual(expect.arrayContaining(["libreoffice", "tesseract-server", "ffmpeg-server"]));
    await expect(getWorkerAdapter("ffmpeg-server")!.run({ publicId: "job_1", toolSlug: "convert-video", mode: "server" })).rejects.toThrow("غير مفعّل");
  });
});
