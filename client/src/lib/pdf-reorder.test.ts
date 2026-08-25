import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { alterPdf } from "./pdf-engine";

const testRequire = createRequire(import.meta.url);
const resolvedPdfjsWorkerUrl = pathToFileURL(testRequire.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).toString();

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", async importOriginal => {
  const actual = await importOriginal<typeof import("pdfjs-dist/legacy/build/pdf.mjs")>();
  const realWorkerOptions = actual.GlobalWorkerOptions;
  return {
    ...actual,
    GlobalWorkerOptions: {
      get workerSrc() { return realWorkerOptions.workerSrc; },
      set workerSrc(_assignedByProduction: string) { realWorkerOptions.workerSrc = resolvedPdfjsWorkerUrl; },
    },
  };
});

async function orderedFixture(labels = ["PAGE-ONE", "PAGE-TWO", "PAGE-THREE"]) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.HelveticaBold);
  for (const label of labels) {
    const page = document.addPage([360, 240]);
    page.drawText(label, { x: 48, y: 120, size: 28, font });
  }
  return new File([await document.save()], "ordered-pages.pdf", { type: "application/pdf" });
}

async function outputPageLabels(blob: Blob) {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const document = await task.promise;
  try {
    const labels: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const content = await (await document.getPage(pageNumber)).getTextContent();
      labels.push(content.items.map((item: any) => item.str).join(" ").trim());
    }
    return { count: document.numPages, labels };
  } finally {
    await task.destroy();
  }
}

async function reorder(pages: string, labels?: string[]) {
  const input = await orderedFixture(labels);
  const before = new Uint8Array(await input.arrayBuffer());
  const [output] = await alterPdf("reorder-pdf-pages", input, { pages });
  expect(new Uint8Array(await input.arrayBuffer())).toEqual(before);
  return output;
}

describe("reorder-pdf-pages functional acceptance", () => {
  it("reorders actual generated PDF pages for 3,1,2", async () => {
    const output = await reorder("3,1,2");
    await expect(outputPageLabels(output.blob)).resolves.toEqual({ count: 3, labels: ["PAGE-THREE", "PAGE-ONE", "PAGE-TWO"] });
  });

  it("preserves requested range order for 2-3,1", async () => {
    const output = await reorder("2-3,1");
    await expect(outputPageLabels(output.blob)).resolves.toEqual({ count: 3, labels: ["PAGE-TWO", "PAGE-THREE", "PAGE-ONE"] });
  });

  it("preserves duplicate page requests as the current product behavior", async () => {
    const output = await reorder("3,1,1");
    await expect(outputPageLabels(output.blob)).resolves.toEqual({ count: 3, labels: ["PAGE-THREE", "PAGE-ONE", "PAGE-ONE"] });
  });

  it("rejects an out-of-range page without producing an output and keeps input bytes unchanged", async () => {
    const input = await orderedFixture();
    const before = new Uint8Array(await input.arrayBuffer());
    await expect(alterPdf("reorder-pdf-pages", input, { pages: "4" })).rejects.toThrow("اختر صفحات بين 1 و3");
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(before);
  });

  it("rejects invalid page syntax without producing an output", async () => {
    await expect(alterPdf("reorder-pdf-pages", await orderedFixture(), { pages: "one,2" })).rejects.toThrow("صيغة الصفحات غير صحيحة");
  });

  it("uses original order when the order input is blank", async () => {
    const output = await reorder(" ");
    await expect(outputPageLabels(output.blob)).resolves.toEqual({ count: 3, labels: ["PAGE-ONE", "PAGE-TWO", "PAGE-THREE"] });
  });

  it("creates a valid one-page output for page 1 and rejects page 2", async () => {
    const output = await reorder("1", ["PAGE-ONE"]);
    await expect(outputPageLabels(output.blob)).resolves.toEqual({ count: 1, labels: ["PAGE-ONE"] });
    await expect(alterPdf("reorder-pdf-pages", await orderedFixture(["PAGE-ONE"]), { pages: "2" })).rejects.toThrow("اختر صفحات بين 1 و1");
  });
});
