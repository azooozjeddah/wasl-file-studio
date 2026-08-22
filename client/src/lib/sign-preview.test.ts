import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("visual signature preview", () => {
  it("uses a native PDF object preview and a local PDF page count rather than a raster rendering dependency", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/SignPdfPage.tsx"), "utf8");
    expect(source).toContain("PDFDocument.load");
    expect(source).toContain("type=\"application/pdf\"");
    expect(source).not.toContain("pdfToImages");
  });
});
