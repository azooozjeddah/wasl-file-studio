import { describe, expect, it } from "vitest";
import { ensureExtractedPdfTextIsReadable, readDocumentText, textToDocx, textToPdf } from "./document-engine";

describe("document engine exports", () => {
  it("creates a named DOCX blob from local editable text", async () => {
    const source = { name: "ملاحظات.txt" } as File;
    const result = await textToDocx("عنوان\nمحتوى عربي وإنجليزي", source, "converted");
    expect(result.name).toBe("ملاحظات-converted.docx");
    expect(result.mime).toContain("openxmlformats-officedocument");
    expect(result.blob.size).toBeGreaterThan(0);
  });
  it("normalizes text-document input before conversion", async () => { const source = new File(["عنوان\r\n\n\nمحتوى"], "notes.txt", { type: "text/plain" }); await expect(readDocumentText(source, "txt")).resolves.toBe("عنوان\n\nمحتوى"); });
  it("creates a named local PDF output for text-first conversions", async () => { const result = await textToPdf("A local PDF contract", { name: "contract.txt" } as File); const bytes = new Uint8Array(await result.blob.arrayBuffer()); expect(result.name).toBe("contract-converted.pdf"); expect(result.mime).toBe("application/pdf"); expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-"); });
  it("accepts Arabic and English Unicode but rejects visibly corrupted PDF text", () => {
    expect(() => ensureExtractedPdfTextIsReadable("عنوان عربي واضح مع English text")).not.toThrow();
    expect(() => ensureExtractedPdfTextIsReadable("W¹cOHM²\u0001« W×zö\u0001« w½ËAF²\u0001«")).toThrow("تعذر قراءة ترميز النص");
  });
});
