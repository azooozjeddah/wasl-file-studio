import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePageList } from "./pdf-engine";

describe("extract PDF pages contracts", () => {
  it("keeps sequential and non-sequential page selections in requested order", () => {
    expect(parsePageList("2-4", 6)).toEqual([1, 2, 3]);
    expect(parsePageList("4,1,3", 6)).toEqual([3, 0, 2]);
  });

  it("adds independent output validation without invoking the shared image-rendering path", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/pdf-engine.ts"), "utf8");
    const extractSection = source.slice(source.indexOf("export async function extractPdfPages"), source.indexOf("async function openPdf"));
    expect(extractSection).toContain("verifyExtractedPdf");
    expect(extractSection).toContain("extractPagesFailureMessage");
    expect(extractSection).toContain('startsWith("%PDF-")');
    expect(extractSection).not.toContain("pdfToImages");
    expect(extractSection).toContain("copyPages");
  });
});
