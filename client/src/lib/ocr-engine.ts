import { textToDocx, textToPdf } from "./document-engine";
import { LocalFileResult, outputName } from "./file-utils";
import { pdfToImages } from "./pdf-engine";

export async function extractOcr(files: File[], language: "ara" | "eng" | "ara+eng", report?: (fraction: number) => void, signal?: AbortSignal): Promise<LocalFileResult[]> {
  const { createWorker, PSM } = await import("tesseract.js"); const worker = await createWorker(language, 1, { logger: (entry: { progress?: number; status?: string }) => { if (entry.status === "recognizing text") report?.(Math.max(.02, Math.min(.95, entry.progress || 0))); } });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
  const abort = () => { void worker.terminate(); };
  if (signal?.aborted) { abort(); throw new DOMException("OCR cancelled", "AbortError"); }
  signal?.addEventListener("abort", abort, { once: true });
  try { const allText: string[] = []; for (let index = 0; index < files.length; index += 1) { if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError"); const file = files[index]; if (file.type === "application/pdf") { const images = await pdfToImages(file, "png", .9, amount => report?.((index + amount) / files.length * .55)); for (const image of images) { if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError"); const recognized = await worker.recognize(image.blob); allText.push(recognized.data.text); } } else { const recognized = await worker.recognize(file); if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError"); allText.push(recognized.data.text); } report?.((index + 1) / files.length); }
    const text = allText.join("\n\n").trim(); const source = files[0]; const txt: LocalFileResult = { name: outputName(source.name, "ocr", "txt"), blob: new Blob([text], { type: "text/plain;charset=utf-8" }), mime: "text/plain", details: { language } }; const docx = await textToDocx(text, source, "ocr"); const pdf = await textToPdf(text, source, "ocr"); report?.(1); return [txt, docx, pdf];
  } finally { signal?.removeEventListener("abort", abort); await worker.terminate(); }
}
