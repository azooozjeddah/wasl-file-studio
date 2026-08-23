import { describe, expect, it } from "vitest";
import { isReadyAssistantTool, isSingleFileReadyAssistantTool, matchesToolInput, prepareFileForTool, takePendingFileForTool } from "./file-handoff";
import { findTool } from "./tools";

describe("smart file assistant matching", () => {
  it("matches ready PDF tools and excludes deferred conversions", () => {
    const pdf = { name: "contract.pdf", type: "application/pdf" } as File;
    expect(matchesToolInput(pdf, findTool("sign-pdf")!)).toBe(true);
    expect(isReadyAssistantTool(findTool("sign-pdf")!)).toBe(true);
    expect(isReadyAssistantTool(findTool("pdf-to-word")!)).toBe(false);
    expect(isSingleFileReadyAssistantTool(findTool("compare-pdf")!)).toBe(false);
    expect(isSingleFileReadyAssistantTool(findTool("merge-pdf")!)).toBe(false);
    expect(isSingleFileReadyAssistantTool(findTool("file-hash")!)).toBe(false);
    expect(isSingleFileReadyAssistantTool(findTool("qr-reader")!)).toBe(false);
  });
  it("matches image and text document tools by local input contract", () => {
    expect(matchesToolInput({ name: "photo.png", type: "image/png" } as File, findTool("compress-image")!)).toBe(true);
    expect(matchesToolInput({ name: "notes.txt", type: "text/plain" } as File, findTool("txt-to-pdf")!)).toBe(true);
  });
  it("hands a selected file to only the chosen tool and consumes it once", () => {
    const file = { name: "contract.pdf", type: "application/pdf" } as File;
    prepareFileForTool(file, "sign-pdf");
    expect(takePendingFileForTool("compress-pdf")).toBeUndefined();
    expect(takePendingFileForTool("sign-pdf")).toBe(file);
    expect(takePendingFileForTool("sign-pdf")).toBeUndefined();
  });
});
