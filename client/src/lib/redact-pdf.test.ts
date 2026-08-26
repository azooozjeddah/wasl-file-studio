import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { redactPdf } from "./pdf-engine";

const secret = "SECRET-REDACT-2026";
const publicText = "PUBLIC-REMAINS-VISIBLE";
const pageWidth = 420;
const pageHeight = 280;
const secretArea = { x: 85, y: 100, width: 260, height: 60 };

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
  text: string;
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

async function createSecurityFixture(): Promise<File> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.HelveticaBold);
  const pages = [
    { marker: rgb(.88, .10, .10), label: "PAGE-ONE-RED" },
    { marker: rgb(.10, .20, .88), label: "PAGE-TWO-BLUE" },
  ];
  for (const { marker, label } of pages) {
    const page = document.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(.96, .95, .82) });
    page.drawRectangle({ x: 20, y: 220, width: 72, height: 40, color: marker });
    page.drawText(label, { x: 112, y: 232, size: 18, font, color: rgb(.12, .12, .12) });
    page.drawText(secret, { x: 100, y: 122, size: 20, font, color: rgb(.08, .08, .08) });
    page.drawText(publicText, { x: 100, y: 48, size: 16, font, color: rgb(.08, .08, .08) });
  }
  return new File([await document.save({ useObjectStreams: false })], "security-redaction.pdf", { type: "application/pdf" });
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
    const content = await page.getTextContent();
    return {
      width: viewport.width,
      height: viewport.height,
      pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
      text: content.items.map((item: any) => typeof item.str === "string" ? item.str : "").join(" "),
    };
  } finally {
    await task.destroy();
  }
}

function pixelAt(page: RenderedPage, x: number, y: number) {
  const offset = (y * Math.round(page.width) + x) * 4;
  return [page.pixels[offset], page.pixels[offset + 1], page.pixels[offset + 2]];
}

function canvasRectangle(area: { x: number; y: number; width: number; height: number }) {
  return { left: area.x, right: area.x + area.width, top: pageHeight - (area.y + area.height), bottom: pageHeight - area.y };
}

function nearBlackRatio(page: RenderedPage, area: { x: number; y: number; width: number; height: number }) {
  const rectangle = canvasRectangle(area);
  let black = 0;
  let total = 0;
  for (let y = rectangle.top; y < rectangle.bottom; y += 1) {
    for (let x = rectangle.left; x < rectangle.right; x += 1) {
      const [red, green, blue] = pixelAt(page, x, y);
      if (red < 35 && green < 35 && blue < 35) black += 1;
      total += 1;
    }
  }
  return black / total;
}

function darkPixelCount(page: RenderedPage, area: { x: number; y: number; width: number; height: number }) {
  const rectangle = canvasRectangle(area);
  let dark = 0;
  for (let y = rectangle.top; y < rectangle.bottom; y += 1) {
    for (let x = rectangle.left; x < rectangle.right; x += 1) {
      const [red, green, blue] = pixelAt(page, x, y);
      if ((red + green + blue) / 3 < 100) dark += 1;
    }
  }
  return dark;
}

function expectOrderedMarkers(first: RenderedPage, second: RenderedPage) {
  const [firstRed, , firstBlue] = pixelAt(first, 40, 40);
  const [secondRed, , secondBlue] = pixelAt(second, 40, 40);
  expect(firstRed).toBeGreaterThan(firstBlue + 70);
  expect(secondBlue).toBeGreaterThan(secondRed + 70);
}

describe("redact-pdf security acceptance", () => {
  it("permanently redacts the secret from every page while preserving visible public content, dimensions, order, and source bytes", async () => {
    installRealCanvasDocument();
    const input = await createSecurityFixture();
    const sourceBefore = new Uint8Array(await input.arrayBuffer());
    const progress: number[] = [];

    const sourceFirst = await renderPage(sourceBefore, 1);
    const sourceSecond = await renderPage(sourceBefore, 2);
    expect(sourceFirst.text).toContain(secret);
    expect(sourceFirst.text).toContain(publicText);
    expect(sourceSecond.text).toContain(secret);
    expect(sourceSecond.text).toContain(publicText);
    expectOrderedMarkers(sourceFirst, sourceSecond);
    expect(darkPixelCount(sourceFirst, secretArea)).toBeGreaterThan(100);

    const output = await redactPdf(input, secretArea, value => progress.push(value));

    expect(output.mime).toBe("application/pdf");
    expect(output.blob.type).toBe("application/pdf");
    const outputBytes = new Uint8Array(await output.blob.arrayBuffer());
    expect(new TextDecoder("latin1").decode(outputBytes.slice(0, 5))).toBe("%PDF-");
    expect(outputBytes.byteLength).toBeGreaterThan(1_000);
    expect(output.details).toMatchObject({ redaction: "rasterized-rebuild", searchableTextRemoved: true });

    const reopened = await PDFDocument.load(outputBytes, { ignoreEncryption: false, updateMetadata: false });
    expect(reopened.getPageCount()).toBe(2);
    const metadata = [reopened.getTitle(), reopened.getAuthor(), reopened.getSubject(), reopened.getKeywords(), reopened.getCreator(), reopened.getProducer()]
      .flatMap(value => Array.isArray(value) ? value : [value])
      .filter((value): value is string => typeof value === "string");
    expect(metadata.join("\n")).not.toContain(secret);

    const outputFirst = await renderPage(outputBytes, 1);
    const outputSecond = await renderPage(outputBytes, 2);
    expect(outputFirst.width).toBeCloseTo(sourceFirst.width, 1);
    expect(outputFirst.height).toBeCloseTo(sourceFirst.height, 1);
    expect(outputSecond.width).toBeCloseTo(sourceSecond.width, 1);
    expect(outputSecond.height).toBeCloseTo(sourceSecond.height, 1);
    expectOrderedMarkers(outputFirst, outputSecond);
    expect(nearBlackRatio(outputFirst, secretArea)).toBeGreaterThan(.97);
    expect(nearBlackRatio(outputSecond, secretArea)).toBeGreaterThan(.97);
    const publicArea = { x: 90, y: 35, width: 260, height: 32 };
    expect(darkPixelCount(outputFirst, publicArea)).toBeGreaterThan(150);
    expect(darkPixelCount(outputSecond, publicArea)).toBeGreaterThan(150);
    expect(outputFirst.text).not.toContain(secret);
    expect(outputSecond.text).not.toContain(secret);
    expect(new TextDecoder("latin1").decode(outputBytes)).not.toContain(secret);

    expect(progress.length).toBeGreaterThan(0);
    expect(progress.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
    expect(progress.at(-1)).toBe(1);
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(sourceBefore);
  }, 20_000);

  it("rejects zero-width, zero-height, and non-PDF inputs without silent output or progress", async () => {
    installRealCanvasDocument();
    const input = await createSecurityFixture();
    const widthProgress: number[] = [];
    const heightProgress: number[] = [];
    const invalidProgress: number[] = [];

    await expect(redactPdf(input, { ...secretArea, width: 0 }, value => widthProgress.push(value))).rejects.toThrow("عرضًا وارتفاعًا صالحين");
    await expect(redactPdf(input, { ...secretArea, height: 0 }, value => heightProgress.push(value))).rejects.toThrow("عرضًا وارتفاعًا صالحين");
    await expect(redactPdf(new File(["not a PDF"], "not-a-pdf.pdf", { type: "application/pdf" }), secretArea, value => invalidProgress.push(value))).rejects.toThrow();
    expect(widthProgress).toEqual([]);
    expect(heightProgress).toEqual([]);
    expect(invalidProgress).toEqual([]);
  });

  it("clips a partially out-of-bounds rectangle and does not auto-detect a secret outside a separate rectangle", async () => {
    installRealCanvasDocument();
    const input = await createSecurityFixture();

    const clipped = await redactPdf(input, { x: 390, y: 100, width: 100, height: 60 });
    const clippedFirst = await renderPage(new Uint8Array(await clipped.blob.arrayBuffer()), 1);
    expect(nearBlackRatio(clippedFirst, { x: 390, y: 100, width: 30, height: 60 })).toBeGreaterThan(.97);

    const outsideSecret = await redactPdf(input, { x: 0, y: 0, width: 30, height: 30 });
    const outsideSecretFirst = await renderPage(new Uint8Array(await outsideSecret.blob.arrayBuffer()), 1);
    expect(darkPixelCount(outsideSecretFirst, secretArea)).toBeGreaterThan(100);
  }, 20_000);
});
