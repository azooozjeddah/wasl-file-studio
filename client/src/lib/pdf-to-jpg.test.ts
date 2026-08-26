import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { pdfToImages } from "./pdf-engine";

type CanvasLike = {
  width: number;
  height: number;
  getContext(kind: "2d"): {
    drawImage(image: unknown, x: number, y: number): void;
    getImageData(x: number, y: number, width: number, height: number): { data: Uint8ClampedArray };
  };
};

const testRequire = createRequire(import.meta.url);
const resolvedPdfjsWorkerUrl = pathToFileURL(testRequire.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).toString();
const canvasModule = testRequire("@napi-rs/canvas") as {
  createCanvas(width: number, height: number): CanvasLike;
  loadImage(data: Uint8Array): Promise<{ width: number; height: number }>;
};
const fixtureRoot = resolve(process.cwd(), "../repair-pdf-lab/fixtures");
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

function fixture(name: string, type = "application/pdf") {
  return new File([readFileSync(resolve(fixtureRoot, name))], basename(name), { type });
}

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

async function inspectJpeg(result: Awaited<ReturnType<typeof pdfToImages>>[number]) {
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  expect(result.mime).toBe("image/jpeg");
  expect(result.blob.type).toBe("image/jpeg");
  expect(bytes.byteLength).toBeGreaterThan(100);
  expect([...bytes.slice(0, 2)]).toEqual([0xff, 0xd8]);

  const decoded = await canvasModule.loadImage(bytes);
  expect(decoded.width).toBeGreaterThan(0);
  expect(decoded.height).toBeGreaterThan(0);
  const canvas = canvasModule.createCanvas(decoded.width, decoded.height);
  const context = canvas.getContext("2d");
  context.drawImage(decoded, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const hasVisiblePixel = pixels.some((value, index) => index % 4 < 3 && value < 245);
  expect(hasVisiblePixel).toBe(true);
  return {
    bytes,
    width: decoded.width,
    height: decoded.height,
    averageRgb: [0, 1, 2].map(channel => {
      let total = 0;
      for (let index = channel; index < pixels.length; index += 4) total += pixels[index];
      return total / (pixels.length / 4);
    }),
  };
}

async function createMarkerPdf(): Promise<File> {
  const pdf = await PDFDocument.create();
  const markerPages = [
    { text: "PAGE-ONE-RED", color: rgb(.88, .10, .10) },
    { text: "PAGE-TWO-GREEN", color: rgb(.10, .72, .16) },
    { text: "PAGE-THREE-BLUE", color: rgb(.12, .20, .88) },
  ];
  for (const marker of markerPages) {
    const page = pdf.addPage([240, 160]);
    page.drawRectangle({ x: 0, y: 0, width: 240, height: 160, color: marker.color });
    page.drawText(marker.text, { x: 20, y: 72, size: 18, color: rgb(1, 1, 1) });
  }
  return new File([await pdf.save()], "page-markers.pdf", { type: "application/pdf" });
}

describe("pdf-to-jpg functional acceptance", () => {
  it("converts a real one-page PDF to one valid JPG without changing source bytes", async () => {
    installRealCanvasDocument();
    const input = fixture("valid-single-en.pdf");
    const sourceBefore = new Uint8Array(await input.arrayBuffer());

    const outputs = await pdfToImages(input, "jpeg", .82);

    expect(outputs).toHaveLength(1);
    expect(outputs[0].name).toMatch(/page-1\.jpg$/);
    const inspected = await inspectJpeg(outputs[0]);
    expect(inspected.width).toBeGreaterThan(0);
    expect(inspected.height).toBeGreaterThan(0);
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(sourceBefore);
  });

  it("renders a deterministic three-page PDF as ordered, non-empty JPGs at the production scale", async () => {
    installRealCanvasDocument();
    const input = await createMarkerPdf();
    const sourceBefore = new Uint8Array(await input.arrayBuffer());

    const outputs = await pdfToImages(input, "jpeg", .82);

    expect(outputs).toHaveLength(3);
    expect(outputs.map(output => output.name)).toEqual([
      "page-markers-page-1.jpg",
      "page-markers-page-2.jpg",
      "page-markers-page-3.jpg",
    ]);
    const inspected = await Promise.all(outputs.map(inspectJpeg));
    for (const image of inspected) {
      expect(image.width).toBe(372);
      expect(image.height).toBe(248);
    }
    expect(inspected[0].averageRgb[0]).toBeGreaterThan(inspected[0].averageRgb[1] + 40);
    expect(inspected[0].averageRgb[0]).toBeGreaterThan(inspected[0].averageRgb[2] + 40);
    expect(inspected[1].averageRgb[1]).toBeGreaterThan(inspected[1].averageRgb[0] + 40);
    expect(inspected[1].averageRgb[1]).toBeGreaterThan(inspected[1].averageRgb[2] + 40);
    expect(inspected[2].averageRgb[2]).toBeGreaterThan(inspected[2].averageRgb[0] + 40);
    expect(inspected[2].averageRgb[2]).toBeGreaterThan(inspected[2].averageRgb[1] + 40);
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(sourceBefore);
  });

  it("converts every page of a real image-only PDF to valid JPG output without changing source bytes", async () => {
    installRealCanvasDocument();
    const input = fixture("multipage-images.pdf");
    const sourceBefore = new Uint8Array(await input.arrayBuffer());

    const outputs = await pdfToImages(input, "jpeg", .82);

    expect(outputs).toHaveLength(6);
    expect(outputs.map(output => output.name)).toEqual([
      "multipage-images-page-1.jpg",
      "multipage-images-page-2.jpg",
      "multipage-images-page-3.jpg",
      "multipage-images-page-4.jpg",
      "multipage-images-page-5.jpg",
      "multipage-images-page-6.jpg",
    ]);
    await Promise.all(outputs.map(inspectJpeg));
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(sourceBefore);
  }, 20_000);

  it("converts a real Arabic/Unicode text PDF to valid non-empty JPGs without OCR or source mutation", async () => {
    installRealCanvasDocument();
    const input = fixture("bilingual-arabic-unicode-multipage.pdf");
    const sourceBefore = new Uint8Array(await input.arrayBuffer());

    const outputs = await pdfToImages(input, "jpeg", .82);

    expect(outputs).toHaveLength(2);
    await Promise.all(outputs.map(inspectJpeg));
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(sourceBefore);
  });

  it("rejects an invalid non-PDF input without reporting output progress or silent success", async () => {
    installRealCanvasDocument();
    const progress: number[] = [];

    await expect(pdfToImages(fixture("not-a-pdf.pdf"), "jpeg", .82, value => progress.push(value))).rejects.toThrow();
    expect(progress).toEqual([]);
  });
});
