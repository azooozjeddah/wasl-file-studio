import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { applyVisualStamps, stampBounds, type VisualStamp } from "./sign-pdf-engine";

describe("visual PDF stamp placement", () => {
  const stamp: VisualStamp = { id: "sig", page: 0, type: "text", text: "Wasl", x: .1, y: .75, width: .3, height: .1, rotation: 0, opacity: 1 };
  it("maps normalized editor placement to safe PDF bounds", () => expect(stampBounds(stamp, { width: 600, height: 800 })).toEqual({ x: 60, y: 120, width: 180, height: 80 }));
  it("keeps a moved stamp inside a PDF page", () => expect(stampBounds({ ...stamp, x: .95, y: .05 }, { width: 600, height: 800 })).toEqual({ x: 420, y: 680, width: 180, height: 80 }));
  it("writes a valid signed PDF without rasterising its pages", async () => {
    const source = await PDFDocument.create(); source.addPage([400, 500]); source.addPage([400, 500]);
    const input = new File([await source.save()], "contract.pdf", { type: "application/pdf" });
    const signed = await applyVisualStamps(input, [{ ...stamp, page: 1, text: "Wasl signer" }]);
    const verified = await PDFDocument.load(await signed.blob.arrayBuffer());
    expect(signed.name).toBe("contract-visually-signed.pdf"); expect(verified.getPageCount()).toBe(2);
  });
});
