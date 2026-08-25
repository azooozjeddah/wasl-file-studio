import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyPdfPreviewError, pdfPreviewErrorMessage } from "./pdf-preview-engine";

describe("pdf preview inspection contracts", () => {
  it("classifies password, malformed, unsupported, and unknown PDF.js failures", () => {
    expect(classifyPdfPreviewError({ name: "PasswordException", message: "need password" })).toBe("password-protected");
    expect(classifyPdfPreviewError(new Error("Invalid PDF structure / xref"))).toBe("malformed");
    expect(classifyPdfPreviewError(new Error("No PDF header found"))).toBe("unsupported");
    expect(classifyPdfPreviewError(new Error("worker stopped"))).toBe("unknown");
  });

  it("uses clear Arabic error wording without claiming repair", () => {
    expect(pdfPreviewErrorMessage("password-protected")).toContain("لا تحاول");
    expect(pdfPreviewErrorMessage("malformed")).toContain("لم يتم");
  });

  it("keeps the preview engine isolated from canvas, pdf-lib, and pdfToImages", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/pdf-preview-engine.ts"), "utf8");
    expect(source).not.toContain("pdfToImages");
    expect(source).not.toContain("PDFDocument");
    expect(source).not.toContain("createElement(\"canvas\")");
    expect(source).not.toContain(".save(");
  });
});
