import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { securePdf } from "./pdf-engine";

const testRequire = createRequire(import.meta.url);
const resolvedPdfjsWorkerUrl = pathToFileURL(testRequire.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).toString();
const pdfjsRequire = createRequire(testRequire.resolve("pdfjs-dist/legacy/build/pdf.mjs"));
const { createCanvas } = pdfjsRequire("@napi-rs/canvas") as { createCanvas(width: number, height: number): any };
const fixtureRoot = resolve(process.cwd(), "../repair-pdf-lab/fixtures");
const password = "Wasl-acceptance-2026";

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

function fixture(name: string, type = "application/pdf") {
  return new File([readFileSync(resolve(fixtureRoot, name))], basename(name), { type });
}

function installCanvasDocument() {
  vi.stubGlobal("document", {
    createElement(tag: string) {
      if (tag !== "canvas") throw new Error(`Unexpected test element: ${tag}`);
      return createCanvas(1, 1);
    },
  });
}

async function openPdf(bytes: Uint8Array, suppliedPassword?: string) {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(), password: suppliedPassword });
  const document = await task.promise;
  return { document, task };
}

afterEach(() => vi.unstubAllGlobals());

describe("protect-pdf functional acceptance", () => {
  it("creates a password-gated, readable PDF from a real input without changing input bytes", async () => {
    installCanvasDocument();
    const input = fixture("valid-single-en.pdf");
    const inputBefore = new Uint8Array(await input.arrayBuffer());

    const result = await securePdf(input, "protect", password);
    const outputBytes = new Uint8Array(await result.blob.arrayBuffer());
    expect(new TextDecoder("latin1").decode(outputBytes.slice(0, 5))).toBe("%PDF-");
    await expect(openPdf(outputBytes)).rejects.toThrow(/password|PasswordException/i);

    const { document, task } = await openPdf(outputBytes, password);
    try {
      expect(document.numPages).toBe(1);
      const page = await document.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      expect(viewport.width).toBeGreaterThan(0);
      expect(viewport.height).toBeGreaterThan(0);
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      expect(pixels.some((value: number, index: number) => index % 4 < 3 && value < 245)).toBe(true);
    } finally {
      await task.destroy();
    }

    expect(new Uint8Array(await input.arrayBuffer())).toEqual(inputBefore);
  });

  it("rejects an empty password, non-PDF input, and an already protected input without bypassing protection", async () => {
    installCanvasDocument();
    await expect(securePdf(fixture("valid-single-en.pdf"), "protect", "")).rejects.toThrow("أدخل كلمة مرور");
    await expect(securePdf(fixture("not-a-pdf.pdf"), "protect", password)).rejects.toThrow();
    await expect(securePdf(fixture("encrypted-password-wasl-test.pdf"), "protect", password)).rejects.toThrow(/password|PasswordException/i);
  });
});
