import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ recognize: vi.fn(async () => ({ data: { text: "نص مستخرج / extracted text" } })), setParameters: vi.fn(async () => undefined), terminate: vi.fn(async () => undefined) }));

vi.mock("tesseract.js", () => ({ PSM: { AUTO: 3, SINGLE_LINE: 7 }, createWorker: vi.fn(async () => ({ recognize: mocks.recognize, setParameters: mocks.setParameters, terminate: mocks.terminate })) }));
vi.mock("./document-engine", () => ({ textToDocx: vi.fn(async (_text: string, file: File) => ({ name: `${file.name}-ocr.docx`, blob: new Blob(["docx"]), mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })), textToPdf: vi.fn((_text: string, file: File) => ({ name: `${file.name}-ocr.pdf`, blob: new Blob(["pdf"]), mime: "application/pdf" })) }));
vi.mock("./pdf-engine", () => ({ pdfToImages: vi.fn() }));

const { extractOcr } = await import("./ocr-engine");

describe("OCR exports", () => {
  it.each(["ara", "eng"] as const)("produces text, DOCX, and PDF for %s", async language => {
    const source = new File(["sample image"], "capture.png", { type: "image/png" }); const outputs = await extractOcr([source], language);
    expect(outputs.map(output => output.mime)).toEqual(["text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/pdf"]);
    expect(mocks.terminate).toHaveBeenCalled();
  });

  it("retries a blank first pass with single-line recognition before creating exports", async () => {
    const callCount = mocks.recognize.mock.calls.length;
    mocks.recognize.mockResolvedValueOnce({ data: { text: "   " } }).mockResolvedValueOnce({ data: { text: "وصل ملفات عربي ٢٠٢٦" } });
    const outputs = await extractOcr([new File(["sample image"], "arabic.png", { type: "image/png" })], "ara");

    expect(await outputs[0].blob.text()).toContain("وصل ملفات عربي ٢٠٢٦");
    expect(mocks.recognize.mock.calls.length).toBe(callCount + 2);
    expect(mocks.setParameters).toHaveBeenCalledWith({ tessedit_pageseg_mode: 7 });
  });
});
