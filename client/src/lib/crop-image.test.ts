import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { transformImages } from "./image-engine";

type DecodedImage = { width: number; height: number };
type CanvasLike = {
  width: number;
  height: number;
  getContext(kind: "2d"): {
    fillStyle: string;
    fillRect(x: number, y: number, width: number, height: number): void;
    getImageData(x: number, y: number, width: number, height: number): { data: Uint8ClampedArray };
  };
  toBuffer(type: "image/png"): Uint8Array;
};

const testRequire = createRequire(import.meta.url);
const canvasModule = testRequire("@napi-rs/canvas") as {
  createCanvas(width: number, height: number): CanvasLike;
  loadImage(bytes: Uint8Array): Promise<DecodedImage>;
};

afterEach(() => vi.unstubAllGlobals());

function installRealImageHarness() {
  const blobs = new Map<string, Blob>();
  let objectUrlId = 0;
  class RealDecoderBackedImage {
    width = 0;
    height = 0;
    decoding = "async";
    onload: (() => void) | null = null;
    onerror: ((error: unknown) => void) | null = null;

    set src(value: string) {
      const blob = blobs.get(value);
      if (!blob) {
        queueMicrotask(() => this.onerror?.(new Error("Unknown test image URL.")));
        return;
      }
      void blob.arrayBuffer()
        .then(bytes => canvasModule.loadImage(new Uint8Array(bytes)))
        .then(image => { this.width = image.width; this.height = image.height; this.onload?.(); })
        .catch(error => this.onerror?.(error));
    }
  }
  vi.stubGlobal("document", { createElement: (tag: string) => {
    if (tag !== "canvas") throw new Error(`Unexpected test element: ${tag}`);
    return canvasModule.createCanvas(1, 1);
  } });
  vi.stubGlobal("createImageBitmap", async (file: Blob) => canvasModule.loadImage(new Uint8Array(await file.arrayBuffer())));
  vi.stubGlobal("Image", RealDecoderBackedImage);
  vi.stubGlobal("URL", {
    createObjectURL(blob: Blob) { const url = `blob:crop-image-test/${++objectUrlId}`; blobs.set(url, blob); return url; },
    revokeObjectURL(url: string) { blobs.delete(url); },
  });
}

async function createQuadrantPng(): Promise<File> {
  const canvas = canvasModule.createCanvas(400, 300);
  const context = canvas.getContext("2d");
  context.fillStyle = "#dc1e1e"; context.fillRect(0, 0, 200, 150);
  context.fillStyle = "#1ea83b"; context.fillRect(200, 0, 200, 150);
  context.fillStyle = "#1e44dc"; context.fillRect(0, 150, 200, 150);
  context.fillStyle = "#e0d11e"; context.fillRect(200, 150, 200, 150);
  return new File([canvas.toBuffer("image/png")], "quadrants.png", { type: "image/png" });
}

async function decodeBlob(blob: Blob) {
  return canvasModule.loadImage(new Uint8Array(await blob.arrayBuffer()));
}

async function pixelsFor(image: DecodedImage, blob: Blob) {
  const canvas = canvasModule.createCanvas(image.width, image.height) as CanvasLike & { getContext(kind: "2d"): CanvasLike["getContext"] extends () => infer Context ? Context & { drawImage(...args: unknown[]): void } : never };
  const context = canvas.getContext("2d");
  const decoded = await canvasModule.loadImage(new Uint8Array(await blob.arrayBuffer()));
  (context as { drawImage(...args: unknown[]): void }).drawImage(decoded, 0, 0);
  return context.getImageData(0, 0, image.width, image.height).data;
}

function pixelAt(pixels: Uint8ClampedArray, width: number, x: number, y: number) {
  const offset = (y * width + x) * 4;
  return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
}

function expectMarkers(pixels: Uint8ClampedArray, width: number, height: number) {
  const [topLeftRed, topLeftGreen, topLeftBlue] = pixelAt(pixels, width, 10, 10);
  const [topRightRed, topRightGreen, topRightBlue] = pixelAt(pixels, width, width - 11, 10);
  const [bottomLeftRed, bottomLeftGreen, bottomLeftBlue] = pixelAt(pixels, width, 10, height - 11);
  const [bottomRightRed, bottomRightGreen, bottomRightBlue] = pixelAt(pixels, width, width - 11, height - 11);
  expect(topLeftRed).toBeGreaterThan(topLeftGreen + 70); expect(topLeftRed).toBeGreaterThan(topLeftBlue + 70);
  expect(topRightGreen).toBeGreaterThan(topRightRed + 45); expect(topRightGreen).toBeGreaterThan(topRightBlue + 45);
  expect(bottomLeftBlue).toBeGreaterThan(bottomLeftRed + 70); expect(bottomLeftBlue).toBeGreaterThan(bottomLeftGreen + 70);
  expect(bottomRightRed).toBeGreaterThan(110); expect(bottomRightGreen).toBeGreaterThan(110); expect(bottomRightBlue).toBeLessThan(100);
}

describe("crop-image functional acceptance", () => {
  it("crops a deterministic PNG through the real production transform path as PNG and JPEG without mutating input bytes", async () => {
    installRealImageHarness();
    const input = await createQuadrantPng();
    const sourceBefore = new Uint8Array(await input.arrayBuffer());
    const crop = { x: 100, y: 75, width: 200, height: 150 };
    const progress: number[] = [];

    const pngOutputs = await transformImages([input], "crop-image", { crop, outputType: "image/png", quality: .82, keepAspect: true }, value => progress.push(value));
    expect(pngOutputs).toHaveLength(1);
    expect(pngOutputs[0].mime).toBe("image/png");
    expect(pngOutputs[0].name).toMatch(/crop-image\.png$/);
    expect(pngOutputs[0].blob.size).toBeGreaterThan(100);
    const png = await decodeBlob(pngOutputs[0].blob);
    expect(png.width).toBe(200); expect(png.height).toBe(150);
    expectMarkers(await pixelsFor(png, pngOutputs[0].blob), png.width, png.height);

    const jpegOutputs = await transformImages([input], "crop-image", { crop, outputType: "image/jpeg", quality: .82, keepAspect: true });
    expect(jpegOutputs).toHaveLength(1);
    expect(jpegOutputs[0].mime).toBe("image/jpeg");
    expect(jpegOutputs[0].name).toMatch(/crop-image\.jpg$/);
    expect(jpegOutputs[0].blob.size).toBeGreaterThan(100);
    const jpeg = await decodeBlob(jpegOutputs[0].blob);
    expect(jpeg.width).toBe(200); expect(jpeg.height).toBe(150);
    expectMarkers(await pixelsFor(jpeg, jpegOutputs[0].blob), jpeg.width, jpeg.height);

    expect(progress.length).toBeGreaterThan(0);
    expect(progress.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
    expect(progress.at(-1)).toBe(1);
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(sourceBefore);
  });

  it("preserves the correct marker when cropping within the top-left image edge", async () => {
    installRealImageHarness();
    const input = await createQuadrantPng();
    const [output] = await transformImages([input], "crop-image", { crop: { x: 0, y: 0, width: 120, height: 90 }, outputType: "image/png", quality: .82, keepAspect: true });
    const decoded = await decodeBlob(output.blob);
    expect(decoded.width).toBe(120); expect(decoded.height).toBe(90);
    const [red, green, blue] = pixelAt(await pixelsFor(decoded, output.blob), decoded.width, 60, 45);
    expect(red).toBeGreaterThan(green + 80); expect(red).toBeGreaterThan(blue + 80);
  });

  it("characterizes ambiguous crop rectangles without treating their observed behavior as acceptance contract", async () => {
    installRealImageHarness();
    const input = await createQuadrantPng();
    const cases = [
      ["partially-out-of-bounds", { x: 350, y: 200, width: 100, height: 100 }],
      ["larger-than-image", { x: 0, y: 0, width: 500, height: 400 }],
      ["zero-width", { x: 100, y: 75, width: 0, height: 150 }],
      ["zero-height", { x: 100, y: 75, width: 200, height: 0 }],
      ["negative-width", { x: 100, y: 75, width: -20, height: 150 }],
      ["negative-height", { x: 100, y: 75, width: 200, height: -20 }],
    ] as const;
    const observations: Array<{ name: string; outcome: "fulfilled" | "rejected"; dimensions?: string; error?: string }> = [];

    for (const [name, crop] of cases) {
      try {
        const [output] = await transformImages([input], "crop-image", { crop, outputType: "image/png", quality: .82, keepAspect: true });
        const decoded = await decodeBlob(output.blob);
        observations.push({ name, outcome: "fulfilled", dimensions: `${decoded.width}x${decoded.height}` });
      } catch (error) {
        observations.push({ name, outcome: "rejected", error: String(error instanceof Error ? error.message : error) });
      }
    }
    console.info("crop-image characterization", JSON.stringify(observations));
    expect(observations).toHaveLength(cases.length);
  });

  it("rejects a non-image through the real decoder path without returning a successful output", async () => {
    installRealImageHarness();
    const invalid = new File(["not an image"], "not-an-image.png", { type: "image/png" });
    await expect(transformImages([invalid], "crop-image", { crop: { x: 0, y: 0, width: 10, height: 10 }, outputType: "image/png", quality: .82, keepAspect: true })).rejects.toThrow();
  });
});
