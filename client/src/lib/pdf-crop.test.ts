import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { alterPdf } from "./pdf-engine";

type PageBox = { x: number; y: number; width: number; height: number };

async function twoPageFixture() {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.HelveticaBold);
  const first = document.addPage([400, 300]);
  const second = document.addPage([400, 300]);
  first.drawText("CROP-PAGE-ONE", { x: 32, y: 140, size: 22, font });
  second.drawText("CROP-PAGE-TWO", { x: 32, y: 140, size: 22, font });
  return new File([await document.save()], "crop-fixture.pdf", { type: "application/pdf" });
}

function expectBox(actual: PageBox, expected: PageBox) {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
  expect(actual.width).toBeCloseTo(expected.width, 6);
  expect(actual.height).toBeCloseTo(expected.height, 6);
}

describe("crop-pdf functional acceptance", () => {
  it("sets CropBox only on selected pages, preserves MediaBox, creates a valid PDF, and keeps input bytes unchanged", async () => {
    const input = await twoPageFixture();
    const before = new Uint8Array(await input.arrayBuffer());

    const outputs = await alterPdf("crop-pdf", input, {
      pages: "1",
      crop: { x: 50, y: 40, width: 200, height: 120 },
    });

    expect(outputs).toHaveLength(1);
    expect(outputs[0].mime).toBe("application/pdf");
    expect(outputs[0].blob.type).toBe("application/pdf");
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(before);

    const output = await PDFDocument.load(new Uint8Array(await outputs[0].blob.arrayBuffer()));
    expect(output.getPageCount()).toBe(2);

    const first = output.getPage(0);
    const second = output.getPage(1);
    expectBox(first.getCropBox(), { x: 50, y: 40, width: 200, height: 120 });
    expectBox(second.getCropBox(), { x: 0, y: 0, width: 400, height: 300 });
    expectBox(first.getMediaBox(), { x: 0, y: 0, width: 400, height: 300 });
    expectBox(second.getMediaBox(), { x: 0, y: 0, width: 400, height: 300 });
  });

  it("rejects out-of-range and invalid page syntax using the current parsePageList contract", async () => {
    const input = await twoPageFixture();
    const before = new Uint8Array(await input.arrayBuffer());
    const crop = { x: 50, y: 40, width: 200, height: 120 };

    await expect(alterPdf("crop-pdf", input, { pages: "3", crop })).rejects.toThrow("اختر صفحات بين 1 و2");
    await expect(alterPdf("crop-pdf", input, { pages: "one", crop })).rejects.toThrow("صيغة الصفحات غير صحيحة");
    expect(new Uint8Array(await input.arrayBuffer())).toEqual(before);
  });
});
