import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { alterPdf, countPdfFormFields, parsePageList } from "./pdf-engine";

async function toPdfFile(document: PDFDocument, name: string) { return new File([await document.save()], name, { type: "application/pdf" }); }

describe("parsePageList", () => {
  it("keeps the browser document distinct from the PDF document while rendering pages", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/pdf-engine.ts"), "utf8");
    expect(source).toContain("const pdfDocument = await pdfjs.getDocument");
    expect(source).toContain("window.document.createElement(\"canvas\")");
  });
  it("expands ranges while preserving the user order", () => expect(parsePageList("3,1-2,5", 5)).toEqual([2, 0, 1, 4]));
  it("uses the full document when no range is supplied", () => expect(parsePageList("", 3)).toEqual([0, 1, 2]));
  it("rejects unsafe or out-of-range page specifications", () => expect(() => parsePageList("0,2", 3)).toThrow("اختر صفحات"));
});

describe("flatten PDF", () => {
  it("flattens real AcroForm values and removes interactive fields", async () => {
    const document = await PDFDocument.create(); const page = document.addPage([400, 240]); const field = document.getForm().createTextField("customer_name"); field.setText("Abdulaziz"); field.addToPage(page, { x: 40, y: 120, width: 220, height: 28 });
    const input = await toPdfFile(document, "fillable.pdf");
    await expect(countPdfFormFields(input)).resolves.toBe(1);
    const [output] = await alterPdf("flatten-pdf", input, {});
    const flattened = await PDFDocument.load(await output.blob.arrayBuffer());
    expect(flattened.getForm().getFields()).toHaveLength(0);
  });
  it("does not generate a pretend flattened output for a plain PDF", async () => {
    const document = await PDFDocument.create(); document.addPage([300, 200]); const input = await toPdfFile(document, "plain.pdf");
    await expect(countPdfFormFields(input)).resolves.toBe(0);
    await expect(alterPdf("flatten-pdf", input, {})).rejects.toThrow("لا يحتوي على حقول PDF قابلة للتعبئة");
  });
});
