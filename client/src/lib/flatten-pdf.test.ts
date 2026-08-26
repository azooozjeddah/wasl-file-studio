import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { alterPdf, countPdfFormFields } from "./pdf-engine";

type CanvasLike = {
  width: number;
  height: number;
  getContext(kind: "2d"): {
    getImageData(x: number, y: number, width: number, height: number): { data: Uint8ClampedArray };
  };
};

type RenderedPage = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

const testRequire = createRequire(import.meta.url);
const resolvedPdfjsWorkerUrl = pathToFileURL(testRequire.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).toString();
const canvasModule = testRequire("@napi-rs/canvas") as {
  createCanvas(width: number, height: number): CanvasLike;
};
const workerSrcDescriptor = Object.getOwnPropertyDescriptor(pdfjs.GlobalWorkerOptions, "workerSrc");

beforeAll(() => {
  if (!workerSrcDescriptor?.get || !workerSrcDescriptor.set) {
    throw new Error("PDF.js workerSrc descriptor is unavailable in this test environment.");
  }
  Object.defineProperty(pdfjs.GlobalWorkerOptions, "workerSrc", {
    configurable: true,
    get: workerSrcDescriptor.get,
    set(_assignedByProduction: string) {
      workerSrcDescriptor.set!.call(pdfjs.GlobalWorkerOptions, resolvedPdfjsWorkerUrl);
    },
  });
});

afterAll(() => {
  if (workerSrcDescriptor) Object.defineProperty(pdfjs.GlobalWorkerOptions, "workerSrc", workerSrcDescriptor);
});

afterEach(() => vi.unstubAllGlobals());

function installRealCanvasDocument() {
  const documentAdapter = {
    createElement(tag: string) {
      if (tag !== "canvas") throw new Error(`Unexpected test element: ${tag}`);
      return canvasModule.createCanvas(1, 1);
    },
  };
  const requestAnimationFrame = (callback: (timestamp: number) => void) => setTimeout(() => callback(Date.now()), 0);
  vi.stubGlobal("document", documentAdapter);
  vi.stubGlobal("window", { document: documentAdapter, requestAnimationFrame });
}

async function createFillablePdf(): Promise<File> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([420, 280]);
  first.drawRectangle({ x: 0, y: 0, width: 420, height: 280, color: rgb(.94, .94, .76) });
  first.drawRectangle({ x: 20, y: 220, width: 72, height: 40, color: rgb(.88, .10, .10) });
  first.drawText("FORM PAGE — RED MARKER", { x: 112, y: 232, size: 18, font, color: rgb(.12, .12, .12) });
  first.drawText("The field value below must remain visible after flattening.", { x: 48, y: 172, size: 12, font, color: rgb(.12, .12, .12) });

  const field = document.getForm().createTextField("visible_customer_value");
  field.addToPage(first, {
    x: 80,
    y: 105,
    width: 280,
    height: 44,
    textColor: rgb(0, 0, 0),
    backgroundColor: rgb(1, 1, 1),
    borderColor: rgb(.10, .10, .10),
    borderWidth: 1,
    font,
  });
  field.setText("VISIBLE-FIELD-VALUE-2026");
  field.setFontSize(18);
  field.defaultUpdateAppearances(font);

  const second = document.addPage([420, 280]);
  second.drawRectangle({ x: 0, y: 0, width: 420, height: 280, color: rgb(.86, .92, .98) });
  second.drawRectangle({ x: 20, y: 220, width: 72, height: 40, color: rgb(.10, .20, .88) });
  second.drawText("SECOND PAGE — BLUE MARKER", { x: 112, y: 232, size: 18, font, color: rgb(.12, .12, .12) });

  return new File([await document.save()], "fillable-two-page.pdf", { type: "application/pdf" });
}

async function createPlainPdf(): Promise<File> {
  const document = await PDFDocument.create();
  const page = document.addPage([300, 200]);
  page.drawRectangle({ x: 0, y: 0, width: 300, height: 200, color: rgb(.9, .9, .9) });
  return new File([await document.save()], "plain.pdf", { type: "application/pdf" });
}

async function renderPage(bytes: Uint8Array, pageNumber: number): Promise<RenderedPage> {
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const document = await task.promise;
  try {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context as never, viewport }).promise;
    return {
      width: viewport.width,
      height: viewport.height,
      pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
    };
  } finally {
    await task.destroy();
  }
}

function pixelAt(page: RenderedPage, x: number, y: number) {
  const offset = (y * Math.round(page.width) + x) * 4;
  return [page.pixels[offset], page.pixels[offset + 1], page.pixels[offset + 2]];
}

function fieldRegionMetrics(page: RenderedPage) {
  let darkPixels = 0;
  let brightPixels = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = 126; y < 180; y += 1) {
    for (let x = 80; x < 360; x += 1) {
      const [red, green, blue] = pixelAt(page, x, y);
      const luma = (red + green + blue) / 3;
      if (luma < 90) {
        darkPixels += 1;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      if (luma > 225) brightPixels += 1;
    }
  }
  return { darkPixels, brightPixels, darkBounds: darkPixels ? { minX, minY, maxX, maxY } : undefined };
}

function expectOrderedColorMarkers(first: RenderedPage, second: RenderedPage) {
  const [firstRed, , firstBlue] = pixelAt(first, 40, 40);
  const [secondRed, , secondBlue] = pixelAt(second, 40, 40);
  expect(firstRed).toBeGreaterThan(firstBlue + 70);
  expect(secondBlue).toBeGreaterThan(secondRed + 70);
}

describe("flatten-pdf functional acceptance", () => {
  it("flattens a real AcroForm through alterPdf while preserving visible page content, dimensions, order, and input bytes", async () => {
    installRealCanvasDocument();
    const input = await createFillablePdf();
    const sourceBefore = new Uint8Array(await input.arrayBuffer());
    const progress: number[] = [];

    expect(await countPdfFormFields(input)).toBe(1);
    const sourceFirst = await renderPage(sourceBefore, 1);
    const sourceSecond = await renderPage(sourceBefore, 2);
    const sourceFieldMetrics = fieldRegionMetrics(sourceFirst);
    expectOrderedColorMarkers(sourceFirst, sourceSecond);
    expect(sourceFieldMetrics).toMatchObject({ darkPixels: expect.any(Number), brightPixels: expect.any(Number) });
    expect(sourceFieldMetrics.darkPixels).toBeGreaterThan(0);
    expect(sourceFieldMetrics.darkBounds).toBeDefined();
    expect(sourceFieldMetrics.brightPixels).toBeGreaterThan(3_000);

    const outputs = await alterPdf("flatten-pdf", input, { pages: "" }, value => progress.push(value));

    expect(outputs).toHaveLength(1);
    expect(outputs[0].mime).toBe("application/pdf");
    expect(outputs[0].blob.type).toBe("application/pdf");
    const outputBytes = new Uint8Array(await outputs[0].blob.arrayBuffer());
    expect(new TextDecoder("latin1").decode(outputBytes.slice(0, 5))).toBe("%PDF-");
    expect(outputBytes.byteLength).toBeGreaterThan(1_000);
    expect(outputs[0].details).toMatchObject({ flatten: "rasterized-rebuild", fieldCount: 1, searchableTextRemoved: true });

    const reopened = await PDFDocument.load(outputBytes, { ignoreEncryption: false, updateMetadata: false });
    expect(reopened.getPageCount()).toBe(2);
    expect(reopened.getForm().getFields()).toHaveLength(0);

    const outputFirst = await renderPage(outputBytes, 1);
    const outputSecond = await renderPage(outputBytes, 2);
    const outputFieldMetrics = fieldRegionMetrics(outputFirst);
    expect(outputFirst.width).toBeCloseTo(sourceFirst.width, 1);
    expect(outputFirst.height).toBeCloseTo(sourceFirst.height, 1);
    expect(outputSecond.width).toBeCloseTo(sourceSecond.width, 1);
    expect(outputSecond.height).toBeCloseTo(sourceSecond.height, 1);
    expectOrderedColorMarkers(outputFirst, outputSecond);
    expect(outputFirst.pixels.some((value, index) => index % 4 < 3 && value < 245)).toBe(true);
    expect(outputFieldMetrics.darkPixels).toBeGreaterThan(0);
    expect(outputFieldMetrics.darkBounds).toBeDefined();
    // Rendering at 1.55x, JPEG quality .92, then re-rasterizing at 1x changes absolute luma counts; retain at least 75% of the source region's dark content instead.
    expect(outputFieldMetrics.darkPixels / sourceFieldMetrics.darkPixels).toBeGreaterThan(.75);
    expect(outputFieldMetrics.brightPixels).toBeGreaterThan(3_000);

    expect(progress.length).toBeGreaterThan(0);
    expect(progress.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
    expect(progress.at(-1)).toBe(1);
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(sourceBefore);
  }, 20_000);

  it("rejects a valid PDF without AcroForm fields instead of producing a pretend flattened file", async () => {
    installRealCanvasDocument();
    const input = await createPlainPdf();
    const progress: number[] = [];

    expect(await countPdfFormFields(input)).toBe(0);
    await expect(alterPdf("flatten-pdf", input, { pages: "" }, value => progress.push(value))).rejects.toThrow("لا يحتوي على حقول PDF");
    expect(progress).toEqual([]);
  });

  it("rejects a non-PDF input through the same alterPdf production dispatcher without silent output", async () => {
    installRealCanvasDocument();
    const input = new File(["not a PDF"], "not-a-pdf.pdf", { type: "application/pdf" });
    const progress: number[] = [];

    await expect(alterPdf("flatten-pdf", input, { pages: "" }, value => progress.push(value))).rejects.toThrow();
    expect(progress).toEqual([]);
  });
});
