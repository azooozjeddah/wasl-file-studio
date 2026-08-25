import { LocalFileResult, validateLocalFile } from "./file-utils";

export type PdfPreviewStatus = "ready" | "password-protected" | "malformed" | "unsupported" | "unknown";

export type PdfPreviewInspection = {
  status: "ready";
  pageCount: number;
  readOnly: true;
};

export function classifyPdfPreviewError(error: unknown): PdfPreviewStatus {
  const name = String((error as { name?: string } | undefined)?.name || "").toLowerCase();
  const message = String(error instanceof Error ? error.message : error || "").toLowerCase();
  if (/passwordexception|password|encrypt|security/.test(`${name} ${message}`)) return "password-protected";
  if (/invalidpdfexception|invalid pdf|malformed|xref|trailer|catalog|page tree|stream|unexpected end/.test(`${name} ${message}`)) return "malformed";
  if (/header|not a pdf|unsupported/.test(`${name} ${message}`)) return "unsupported";
  return "unknown";
}

export function pdfPreviewErrorMessage(status: Exclude<PdfPreviewStatus, "ready">) {
  if (status === "password-protected") return "الملف محمي بكلمة مرور؛ لا يمكن عرضه محليًا قبل فتحه. لا تحاول الأداة تجاوز الحماية.";
  if (status === "malformed") return "تعذر فتح بنية PDF للمعاينة. لم يتم إنشاء نسخة أو تغيير الملف الأصلي.";
  if (status === "unsupported") return "هذا الملف ليس PDF صالحًا للمعاينة.";
  return "تعذر التحقق من PDF للمعاينة محليًا. لم يتم تغيير الملف الأصلي.";
}

/**
 * Read-only PDF validation for preview-pdf. It never renders pages, creates a canvas,
 * or saves a document; the original File remains the preview/download source.
 */
export async function inspectPdfPreview(file: File, limitMb = 100): Promise<LocalFileResult> {
  await validateLocalFile(file, "pdf", limitMb);
  let document: { numPages: number; destroy?: () => void } | undefined;
  try {
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
    const loaded = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    document = loaded;
    if (!Number.isInteger(loaded.numPages) || loaded.numPages < 1) throw new Error("Invalid PDF page tree");
    const inspection: PdfPreviewInspection = { status: "ready", pageCount: loaded.numPages, readOnly: true };
    return {
      name: file.name,
      blob: file,
      mime: "application/pdf",
      label: `معاينة جاهزة محليًا — ${inspection.pageCount} ${inspection.pageCount === 1 ? "صفحة" : "صفحات"}`,
      details: { previewStatus: inspection.status, pageCount: inspection.pageCount, readOnly: inspection.readOnly, originalSize: file.size },
    };
  } catch (error) {
    const status = classifyPdfPreviewError(error);
    throw new Error(pdfPreviewErrorMessage(status === "ready" ? "unknown" : status));
  } finally {
    document?.destroy?.();
  }
}
