import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { transformImages } from "./image-engine";

type NativeImage = { width: number; height: number };
type NativeContext = {
  fillStyle: string;
  filter: string;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(...args: unknown[]): void;
  getImageData(x: number, y: number, width: number, height: number): { data: Uint8ClampedArray };
};
type NativeCanvas = {
  width: number;
  height: number;
  getContext(kind: "2d"): NativeContext;
  toBuffer(type: "image/png"): Uint8Array;
};

const testRequire = createRequire(import.meta.url);
const nativeCanvas = testRequire("@napi-rs/canvas") as {
  createCanvas(width: number, height: number): NativeCanvas;
  loadImage(bytes: Uint8Array): Promise<NativeImage>;
};

const sourceSize = { width: 360, height: 240 };
const blurArea = { x: 90, y: 50, width: 160, height: 120, radius: 12 };
const blurCore = { x: 120, y: 80, width: 100, height: 60 };
const protectedMarker = { x: 275, y: 155, width: 55, height: 55 };

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
        .then(bytes => nativeCanvas.loadImage(new Uint8Array(bytes)))
        .then(image => { this.width = image.width; this.height = image.height; this.onload?.(); })
        .catch(error => this.onerror?.(error));
    }
  }
  vi.stubGlobal("document", { createElement: (tag: string) => {
    if (tag !== "canvas") throw new Error(`Unexpected test element: ${tag}`);
    return nativeCanvas.createCanvas(1, 1);
  } });
  vi.stubGlobal("createImageBitmap", async (file: Blob) => nativeCanvas.loadImage(new Uint8Array(await file.arrayBuffer())));
  vi.stubGlobal("Image", RealDecoderBackedImage);
  vi.stubGlobal("URL", {
    createObjectURL(blob: Blob) { const url = `blob:blur-image-test/${++objectUrlId}`; blobs.set(url, blob); return url; },
    revokeObjectURL(url: string) { blobs.delete(url); },
  });
}

function drawChecker(context: NativeContext, x: number, y: number, width: number, height: number, cell: number, first = "#111111", second = "#eeeeee") {
  for (let row = 0; row < height; row += cell) {
    for (let column = 0; column < width; column += cell) {
      context.fillStyle = ((row / cell + column / cell) % 2 === 0) ? first : second;
      context.fillRect(x + column, y + row, Math.min(cell, width - column), Math.min(cell, height - row));
    }
  }
}

async function createDetailFixture(): Promise<File> {
  const canvas = nativeCanvas.createCanvas(sourceSize.width, sourceSize.height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#c7d4e0";
  context.fillRect(0, 0, sourceSize.width, sourceSize.height);
  drawChecker(context, blurArea.x, blurArea.y, blurArea.width, blurArea.height, 4);
  drawChecker(context, protectedMarker.x, protectedMarker.y, protectedMarker.width, protectedMarker.height, 3, "#174ea6", "#f6c344");
  return new File([canvas.toBuffer("image/png")], "blur-detail-fixture.png", { type: "image/png" });
}

async function decode(blob: Blob) {
  return nativeCanvas.loadImage(new Uint8Array(await blob.arrayBuffer()));
}

async function imagePixels(blob: Blob, image: NativeImage) {
  const canvas = nativeCanvas.createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(await decode(blob), 0, 0);
  return context.getImageData(0, 0, image.width, image.height).data;
}

function luma(pixels: Uint8ClampedArray, width: number, x: number, y: number) {
  const offset = (y * width + x) * 4;
  return (pixels[offset] * 0.2126) + (pixels[offset + 1] * 0.7152) + (pixels[offset + 2] * 0.0722);
}

function edgeEnergy(pixels: Uint8ClampedArray, width: number, region: { x: number; y: number; width: number; height: number }) {
  let total = 0;
  let samples = 0;
  for (let y = region.y + 1; y < region.y + region.height; y += 1) {
    for (let x = region.x + 1; x < region.x + region.width; x += 1) {
      total += Math.abs(luma(pixels, width, x, y) - luma(pixels, width, x - 1, y));
      total += Math.abs(luma(pixels, width, x, y) - luma(pixels, width, x, y - 1));
      samples += 2;
    }
  }
  return total / samples;
}

describe("blur-image functional acceptance", () => {
  it("blurs high-frequency detail only inside the requested rectangle through the real production path", async () => {
    installRealImageHarness();
    const input = await createDetailFixture();
    const sourceBefore = new Uint8Array(await input.arrayBuffer());
    const source = await decode(input);
    const sourcePixels = await imagePixels(input, source);
    const progress: number[] = [];

    const [pngOutput] = await transformImages([input], "blur-image", { blur: blurArea, outputType: "image/png", quality: .82, keepAspect: true }, value => progress.push(value));
    expect(pngOutput.mime).toBe("image/png");
    expect(pngOutput.name).toMatch(/blur-image\.png$/);
    expect(pngOutput.blob.size).toBeGreaterThan(100);
    const png = await decode(pngOutput.blob);
    expect(png.width).toBe(sourceSize.width); expect(png.height).toBe(sourceSize.height);
    const outputPixels = await imagePixels(pngOutput.blob, png);

    const sourceBlurEnergy = edgeEnergy(sourcePixels, source.width, blurCore);
    const outputBlurEnergy = edgeEnergy(outputPixels, png.width, blurCore);
    const sourceMarkerEnergy = edgeEnergy(sourcePixels, source.width, protectedMarker);
    const outputMarkerEnergy = edgeEnergy(outputPixels, png.width, protectedMarker);
    expect(sourceBlurEnergy).toBeGreaterThan(50);
    // The production path applies Canvas blur() to the rectangle. Relative energy is robust to fixture scale and decoder details.
    expect(outputBlurEnergy / sourceBlurEnergy).toBeLessThan(.55);
    expect(outputMarkerEnergy / sourceMarkerEnergy).toBeGreaterThan(.9);

    expect(progress.length).toBeGreaterThan(0);
    expect(progress.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
    expect(progress.at(-1)).toBe(1);
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(sourceBefore);
  });

  it("keeps the blur effect under JPEG re-encoding with tolerant visual evidence", async () => {
    installRealImageHarness();
    const input = await createDetailFixture();
    const source = await decode(input);
    const sourcePixels = await imagePixels(input, source);

    const [jpegOutput] = await transformImages([input], "blur-image", { blur: blurArea, outputType: "image/jpeg", quality: .82, keepAspect: true });
    expect(jpegOutput.mime).toBe("image/jpeg");
    expect(jpegOutput.name).toMatch(/blur-image\.jpg$/);
    expect(jpegOutput.blob.size).toBeGreaterThan(100);
    const jpeg = await decode(jpegOutput.blob);
    expect(jpeg.width).toBe(sourceSize.width); expect(jpeg.height).toBe(sourceSize.height);
    const jpegPixels = await imagePixels(jpegOutput.blob, jpeg);

    expect(edgeEnergy(jpegPixels, jpeg.width, blurCore) / edgeEnergy(sourcePixels, source.width, blurCore)).toBeLessThan(.7);
    expect(edgeEnergy(jpegPixels, jpeg.width, protectedMarker) / edgeEnergy(sourcePixels, source.width, protectedMarker)).toBeGreaterThan(.65);
  });

  it("rejects a non-image through the real decoder path without returning successful output", async () => {
    installRealImageHarness();
    const invalid = new File(["not an image"], "not-an-image.png", { type: "image/png" });
    await expect(transformImages([invalid], "blur-image", { blur: blurArea, outputType: "image/png", quality: .82, keepAspect: true })).rejects.toThrow();
  });
});
