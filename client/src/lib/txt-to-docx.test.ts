import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { convertDocument } from "./document-engine";

const fixtureText = [
  "عنوان عربي رئيسي",
  "",
  "",
  "",
  "فقرة عربية واضحة تحفظ اتجاه القراءة.",
  "English paragraph remains editable in the generated document.",
  "Mixed Arabic English: حالة mixed DOCX text.",
  "",
  "END-TXT-DOCX-ACCEPTANCE-2026",
].join("\r\n");

const normalizedFixtureText = [
  "عنوان عربي رئيسي",
  "",
  "فقرة عربية واضحة تحفظ اتجاه القراءة.",
  "English paragraph remains editable in the generated document.",
  "Mixed Arabic English: حالة mixed DOCX text.",
  "",
  "END-TXT-DOCX-ACCEPTANCE-2026",
].join("\n");

describe("txt-to-docx functional acceptance", () => {
  it("converts deterministic editable text through the real production path into inspectable RTL DOCX and extracted TXT outputs", async () => {
    const input = new File([fixtureText], "deterministic-notes.txt", { type: "text/plain" });
    const sourceBefore = new Uint8Array(await input.arrayBuffer());
    const progress: number[] = [];

    const outputs = await convertDocument(input, "txt-to-docx", value => progress.push(value));

    expect(outputs).toHaveLength(2);
    const [docx, extractedTxt] = outputs;
    expect(docx.mime).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(docx.name).toBe("deterministic-notes-converted.docx");
    expect(docx.blob.size).toBeGreaterThan(500);
    const docxBytes = new Uint8Array(await docx.blob.arrayBuffer());
    expect(new TextDecoder().decode(docxBytes.slice(0, 2))).toBe("PK");

    const archive = await JSZip.loadAsync(docxBytes);
    const documentXml = await archive.file("word/document.xml")?.async("string");
    expect(documentXml).toBeDefined();
    expect(documentXml).toContain("عنوان عربي رئيسي");
    expect(documentXml).toContain("فقرة عربية واضحة تحفظ اتجاه القراءة.");
    expect(documentXml).toContain("English paragraph remains editable in the generated document.");
    expect(documentXml).toContain("Mixed Arabic English: حالة mixed DOCX text.");
    expect(documentXml).toContain("END-TXT-DOCX-ACCEPTANCE-2026");
    expect((documentXml?.match(/<w:p(?:\s|>)/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(documentXml).toContain("w:bidi");
    expect(documentXml).toContain("w:rtl");

    expect(extractedTxt.mime).toBe("text/plain");
    expect(extractedTxt.name).toBe("deterministic-notes-extracted.txt");
    expect(await extractedTxt.blob.text()).toBe(normalizedFixtureText);

    expect(progress.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
    expect(progress).toContain(.64);
    expect(progress.at(-1)).toBe(1);
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(sourceBefore);
  });
});
