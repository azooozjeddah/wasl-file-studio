import { describe, expect, it } from "vitest";
import { adapterKeyForTool, getWorkerAdapter, selectReadyWorker, workerAdapters } from "./workerAdapters";

describe("server worker adapter registry", () => {
  it("declares future open-source engines without allowing accidental execution", async () => {
    expect(workerAdapters.map(item => item.key)).toEqual(expect.arrayContaining(["libreoffice", "tesseract-server", "ffmpeg-server"]));
    await expect(getWorkerAdapter("ffmpeg-server")!.run({ publicId: "job_1", toolSlug: "convert-video", mode: "server" })).rejects.toThrow("غير مفعّل");
  });
  it("maps future jobs to stable open-source engine keys", () => {
    expect(adapterKeyForTool("word-to-pdf", "document")).toBe("libreoffice");
    expect(adapterKeyForTool("ocr", "ocr")).toBe("tesseract-server");
    expect(adapterKeyForTool("compress-video", "video")).toBe("ffmpeg-server");
    expect(adapterKeyForTool("merge-pdf", "pdf")).toBe("pdf-engine-server");
  });
  it("selects the least-busy ready worker and excludes unavailable workers", () => {
    const selected = selectReadyWorker([
      { workerKey: "ffmpeg-b", status: "ready", capabilities: ["ffmpeg-server"], queueDepth: 2 },
      { workerKey: "ffmpeg-a", status: "ready", capabilities: ["ffmpeg-server"], queueDepth: 1 },
      { workerKey: "ffmpeg-offline", status: "offline", capabilities: ["ffmpeg-server"], queueDepth: 0 },
      { workerKey: "office", status: "ready", capabilities: ["libreoffice"], queueDepth: 0 },
    ], "ffmpeg-server");
    expect(selected?.workerKey).toBe("ffmpeg-a");
    expect(selectReadyWorker([], "ffmpeg-server")).toBeUndefined();
  });
});
