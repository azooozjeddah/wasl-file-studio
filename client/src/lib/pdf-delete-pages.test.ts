import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { deletePdfPages } from "./pdf-engine";

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

const fixtureRoot = resolve(process.cwd(), "../repair-pdf-lab/fixtures");

function fixture(name: string, type = "application/pdf") {
  const bytes = readFileSync(resolve(fixtureRoot, name));
  return new File([bytes], basename(name), { type });
}

async function inspectOutput(result: Awaited<ReturnType<typeof deletePdfPages>>) {
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  expect(new TextDecoder("latin1").decode(bytes.slice(0, 5))).toBe("%PDF-");
  const reopened = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  return { bytes, pageCount: reopened.getPageCount() };
}

describe("deletePdfPages functional acceptance", () => {
  it("deletes one, a range, and non-contiguous pages from a real six-page image PDF without changing the source", async () => {
    const input = fixture("multipage-images.pdf");
    const sourceBefore = new Uint8Array(await input.arrayBuffer());

    const one = await deletePdfPages(input, "2");
    const range = await deletePdfPages(input, "2-4");
    const nonContiguous = await deletePdfPages(input, "2,4");

    expect(one.details).toMatchObject({ pageCount: 5, remainingPages: "1,3,4,5,6", orderVerified: true });
    expect(range.details).toMatchObject({ pageCount: 3, remainingPages: "1,5,6", orderVerified: true });
    expect(nonContiguous.details).toMatchObject({ pageCount: 4, remainingPages: "1,3,5,6", orderVerified: true });
    expect((await inspectOutput(one)).pageCount).toBe(5);
    expect((await inspectOutput(range)).pageCount).toBe(3);
    expect((await inspectOutput(nonContiguous)).pageCount).toBe(4);
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(sourceBefore);
  });

  it("keeps an Arabic Unicode PDF valid after deleting page one", async () => {
    const input = fixture("bilingual-arabic-unicode-multipage.pdf");
    const sourceBefore = new Uint8Array(await input.arrayBuffer());
    const output = await deletePdfPages(input, "1");

    expect(output.details).toMatchObject({ pageCount: 1, remainingPages: "2", orderVerified: true, textVerifiedPages: 1 });
    expect((await inspectOutput(output)).pageCount).toBe(1);
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(sourceBefore);
  });

  it("rejects deleting every page without producing an output", async () => {
    await expect(deletePdfPages(fixture("valid-single-en.pdf"), "1")).rejects.toThrow("لا يمكن حذف كل صفحات PDF");
  });

  it("rejects non-PDF, encrypted, and malformed inputs explicitly", async () => {
    await expect(deletePdfPages(fixture("not-a-pdf.pdf"), "1")).rejects.toThrow("ليس PDF صالحًا");
    await expect(deletePdfPages(fixture("encrypted-password-wasl-test.pdf"), "1")).rejects.toThrow(/محمي بكلمة مرور|استخراج صفحاته/);
    await expect(deletePdfPages(fixture("broken-page-tree.pdf"), "1")).rejects.toThrow(/معطوب|بنيته غير قابلة للقراءة/);
  });
});
