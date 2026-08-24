import { describe, expect, it } from "vitest";
import { findTool } from "./tools";

describe("PDF to Word acceptance contract", () => {
  it("keeps the verified text-PDF path available while documenting the OCR boundary", () => {
    const tool = findTool("pdf-to-word");
    expect(tool).toMatchObject({ local: true, processingMode: "local", accepts: ["application/pdf"] });
    expect(tool?.experimental).not.toBe(true);
    expect(tool?.descriptionAr).toContain("OCR");
  });
});
