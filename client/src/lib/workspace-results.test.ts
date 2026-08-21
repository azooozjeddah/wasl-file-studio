import { describe, expect, it } from "vitest";
import { workspaceResultState } from "./workspace-results";

describe("workspace batch results", () => {
  it("enables archive download and preserves preview decisions for mixed batch outputs", () => {
    const state = workspaceResultState([{ name: "one.webp", blob: new Blob(["1"]), mime: "image/webp" }, { name: "two.mp3", blob: new Blob(["2"]), mime: "audio/mpeg" }, { name: "text.txt", blob: new Blob(["3"]), mime: "text/plain" }]);
    expect(state).toEqual({ showZipDownload: true, previewKinds: ["image", "audio", "file"], hasTextExport: true });
  });
});
