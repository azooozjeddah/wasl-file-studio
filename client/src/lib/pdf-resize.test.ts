import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { alterPdf } from "./pdf-engine";

async function createSamplePdf(): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  const page1 = pdfDoc.addPage([595, 842]);
  page1.drawText("Page 1 Content");
  const page2 = pdfDoc.addPage([595, 842]);
  page2.drawText("Page 2 Content");
  const pdfBytes = await pdfDoc.save();
  return new File([pdfBytes], "sample.pdf", { type: "application/pdf" });
}

async function openSingleOutput(outputs: Awaited<ReturnType<typeof alterPdf>>) {
  expect(outputs).toHaveLength(1);
  expect(outputs[0].mime).toBe("application/pdf");
  expect(outputs[0].blob.type).toBe("application/pdf");
  return PDFDocument.load(await outputs[0].blob.arrayBuffer());
}

describe("Acceptance Test: resize-pdf (alterPdf)", () => {
  it("1. Valid Resize: يغير أبعاد الصفحة الأولى فقط ويحافظ على أبعاد الصفحة الثانية", async () => {
    const inputFile = await createSamplePdf();
    const outputs = await alterPdf("resize-pdf", inputFile, {
      pages: "1",
      dimensions: { width: 200, height: 150 },
    });
    const resultDoc = await openSingleOutput(outputs);
    const pages = resultDoc.getPages();
    expect(pages[0].getSize()).toEqual({ width: 200, height: 150 });
    expect(pages[0].getMediaBox()).toEqual({ x: 0, y: 0, width: 200, height: 150 });
    expect(pages[1].getSize()).toEqual({ width: 595, height: 842 });
    expect(pages[1].getMediaBox()).toEqual({ x: 0, y: 0, width: 595, height: 842 });
  });

  it("2. All Pages Mode: يغير أبعاد كل الصفحات عند ترك خيار الصفحات فارغاً", async () => {
    const inputFile = await createSamplePdf();
    const outputs = await alterPdf("resize-pdf", inputFile, {
      pages: "",
      dimensions: { width: 300, height: 400 },
    });
    const resultDoc = await openSingleOutput(outputs);
    const pages = resultDoc.getPages();
    expect(pages[0].getSize()).toEqual({ width: 300, height: 400 });
    expect(pages[1].getSize()).toEqual({ width: 300, height: 400 });
  });

  it("3. Input Immutability: يضمن عدم تغيير أو مساس الملف الأصلي", async () => {
    const inputFile = await createSamplePdf();
    const originalBytes = new Uint8Array(await inputFile.arrayBuffer());
    await alterPdf("resize-pdf", inputFile, {
      pages: "1",
      dimensions: { width: 200, height: 150 },
    });
    const currentInputBytes = new Uint8Array(await inputFile.arrayBuffer());
    expect(currentInputBytes).toEqual(originalBytes);
  });

  it("4. Invalid Page Syntax: يرفض التعديل في حال إدخال صفحات غير صالحة أو خارج النطاق", async () => {
    const inputFile = await createSamplePdf();
    await expect(
      alterPdf("resize-pdf", inputFile, {
        pages: "3",
        dimensions: { width: 200, height: 150 },
      }),
    ).rejects.toThrow();
    await expect(
      alterPdf("resize-pdf", inputFile, {
        pages: "invalid_page",
        dimensions: { width: 200, height: 150 },
      }),
    ).rejects.toThrow();
  });
});
