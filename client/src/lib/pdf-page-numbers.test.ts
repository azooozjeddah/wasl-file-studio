import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { alterPdf } from "./pdf-engine";

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

type TextItem = { str: string; transform: number[] };

async function numberedFixture(pageCount: number, width = 400, height = 300): Promise<File> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([width, height]);
    page.drawText(`SOURCE-PAGE-${index + 1}`, { x: 32, y: height - 70, size: 18 });
  }
  return new File([await document.save()], "page-numbers-fixture.pdf", { type: "application/pdf" });
}

async function outputPageText(blob: Blob): Promise<TextItem[][]> {
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const document = await loadingTask.promise;
  try {
    const pages: TextItem[][] = [];
    for (let index = 1; index <= document.numPages; index += 1) {
      const content = await (await document.getPage(index)).getTextContent();
      pages.push(content.items.filter((item): item is TextItem => "str" in item && "transform" in item).map(item => ({ str: item.str, transform: item.transform })));
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

function exactText(items: TextItem[], value: string): TextItem {
  const item = items.find(candidate => candidate.str === value);
  expect(item).toBeDefined();
  return item!;
}

describe("page-numbers-pdf functional acceptance", () => {
  it("numbers every page sequentially at the bottom, creates a valid PDF, and keeps input bytes unchanged", async () => {
    const input = await numberedFixture(3);
    const before = new Uint8Array(await input.arrayBuffer());

    const outputs = await alterPdf("page-numbers-pdf", input, { pages: "", position: "bottom" });

    expect(outputs).toHaveLength(1);
    expect(outputs[0].mime).toBe("application/pdf");
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(before);

    const reopened = await PDFDocument.load(new Uint8Array(await outputs[0].blob.arrayBuffer()));
    expect(reopened.getPageCount()).toBe(3);

    const pages = await outputPageText(outputs[0].blob);
    expect(pages).toHaveLength(3);
    pages.forEach((items, index) => {
      expect(exactText(items, `SOURCE-PAGE-${index + 1}`)).toBeDefined();
      const number = exactText(items, String(index + 1));
      expect(number.transform[5]).toBeCloseTo(13, 0);
      expect(number.transform[4]).toBeGreaterThan(190);
      expect(number.transform[4]).toBeLessThan(200);
    });
  });

  it("places the single-page number at the production top coordinate", async () => {
    const input = await numberedFixture(1, 500, 350);
    const before = new Uint8Array(await input.arrayBuffer());
    const outputs = await alterPdf("page-numbers-pdf", input, { pages: "", position: "top" });

    const reopened = await PDFDocument.load(new Uint8Array(await outputs[0].blob.arrayBuffer()));
    expect(reopened.getPageCount()).toBe(1);

    const items = (await outputPageText(outputs[0].blob))[0];
    expect(exactText(items, "SOURCE-PAGE-1")).toBeDefined();
    const number = exactText(items, "1");
    expect(number.transform[5]).toBeCloseTo(328, 0);
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(before);
  });

  it("uses the current all-pages behavior even if a low-level pages value is supplied", async () => {
    const input = await numberedFixture(3);
    const outputs = await alterPdf("page-numbers-pdf", input, { pages: "2", position: "bottom" });

    const pages = await outputPageText(outputs[0].blob);
    expect(pages).toHaveLength(3);
    pages.forEach((items, index) => expect(exactText(items, String(index + 1))).toBeDefined());
  });

  it("rejects invalid page selections before creating output and preserves the source", async () => {
    const input = await numberedFixture(2);
    const before = new Uint8Array(await input.arrayBuffer());

    await expect(alterPdf("page-numbers-pdf", input, { pages: "9", position: "bottom" })).rejects.toThrow("اختر صفحات بين 1 و2");
    await expect(alterPdf("page-numbers-pdf", input, { pages: "one", position: "bottom" })).rejects.toThrow("صيغة الصفحات غير صحيحة");
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(before);
  });
});
