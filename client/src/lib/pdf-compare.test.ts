import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testRequire = createRequire(import.meta.url);
const resolvedPdfjsWorkerUrl = pathToFileURL(testRequire.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).toString();
const workerSrcDescriptor = Object.getOwnPropertyDescriptor(pdfjs.GlobalWorkerOptions, "workerSrc");

beforeAll(() => {
  if (!workerSrcDescriptor?.get || !workerSrcDescriptor.set) throw new Error("PDF.js workerSrc descriptor is unavailable in this test environment.");
  Object.defineProperty(pdfjs.GlobalWorkerOptions, "workerSrc", {
    configurable: true,
    get: workerSrcDescriptor.get,
    set(_assignedByProduction: string) { workerSrcDescriptor.set!.call(pdfjs.GlobalWorkerOptions, resolvedPdfjsWorkerUrl); },
  });
});

afterAll(() => {
  if (workerSrcDescriptor) Object.defineProperty(pdfjs.GlobalWorkerOptions, "workerSrc", workerSrcDescriptor);
});

import { comparePdfs } from "./pdf-engine";

async function createTextPdf(name: string, pageTexts: string[], title?: string): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  if (title) pdfDoc.setTitle(title);
  for (const text of pageTexts) {
    const page = pdfDoc.addPage([595, 842]);
    page.drawText(text, { x: 72, y: 760, size: 18 });
  }
  return new File([await pdfDoc.save()], name, { type: "application/pdf" });
}

async function readReport(left: File, right: File) {
  const result = await comparePdfs(left, right);
  expect(result.mime).toBe("text/plain");
  expect(result.blob.type).toBe("text/plain;charset=utf-8");
  return { result, text: await result.blob.text() };
}

describe("compare-pdf functional acceptance", () => {
  it("reports separately generated PDFs with the same text as textually identical, including metadata-only byte differences", async () => {
    const left = await createTextPdf("left.pdf", ["Same page text"], "Left metadata");
    const right = await createTextPdf("right.pdf", ["Same page text"], "Right metadata");
    const leftBefore = new Uint8Array(await left.arrayBuffer());
    const rightBefore = new Uint8Array(await right.arrayBuffer());

    expect(rightBefore).not.toEqual(leftBefore);
    const { result, text } = await readReport(left, right);

    expect(result.details).toMatchObject({ comparison: true, leftPages: 1, rightPages: 1, differences: 0 });
    expect(text).toContain("متطابقة نصيًا");
    expect(new Uint8Array(await left.arrayBuffer())).toEqual(leftBefore);
    expect(new Uint8Array(await right.arrayBuffer())).toEqual(rightBefore);
  });

  it("reports one same-index textual difference and includes the extracted text in the TXT report", async () => {
    const left = await createTextPdf("left.pdf", ["Original text"]);
    const right = await createTextPdf("right.pdf", ["Changed text"]);

    const { result, text } = await readReport(left, right);

    expect(result.details).toMatchObject({ comparison: true, leftPages: 1, rightPages: 1, differences: 1 });
    expect(text).toContain("مختلفة نصيًا");
    expect(text).toContain("Original text");
    expect(text).toContain("Changed text");
  });

  it("reports a page-count difference and a left-only page", async () => {
    const left = await createTextPdf("left.pdf", ["First page", "Second page"]);
    const right = await createTextPdf("right.pdf", ["First page"]);

    const { result, text } = await readReport(left, right);

    expect(result.details).toMatchObject({ comparison: true, leftPages: 2, rightPages: 1, differences: 1 });
    expect(text).toContain("توجد في الملف الأيسر فقط");
  });

  it("rejects a non-PDF input through the real PDF.js loading path", async () => {
    const nonPdf = new File(["not a PDF"], "not-a-pdf.pdf", { type: "application/pdf" });
    const validPdf = await createTextPdf("valid.pdf", ["Valid page"]);

    await expect(comparePdfs(nonPdf, validPdf)).rejects.toThrow();
  });
});
