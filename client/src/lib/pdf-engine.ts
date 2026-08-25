import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { LocalFileResult, outputName } from "./file-utils";

export type PdfOptions = { pages?: string; rotation?: number; watermark?: string; watermarkImage?: string; watermarkFont?: "sans" | "serif" | "mono"; watermarkSize?: number; watermarkColor?: string; watermarkOpacity?: number; watermarkPosition?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right"; position?: "bottom" | "top"; crop?: { x: number; y: number; width: number; height: number }; dimensions?: { width: number; height: number }; metadataMode?: "view" | "clear"; quality?: number; password?: string };

export type PdfRepairStatus = "repaired" | "re-saved";
export type PdfRepairFailure = "password-protected" | "unsupported-file" | "unrepairable" | "unknown";
export type PdfRepairIssue = "header" | "encryption" | "xref" | "trailer" | "page-tree" | "stream" | "unknown";
export type PdfRepairInputInspection = { hasPdfHeader: boolean; startXrefOffset?: number; startXrefRecoverableIssue: boolean };

export function parsePageList(value: string | undefined, count: number) {
  const raw = value?.trim() || `1-${count}`; const pages: number[] = [];
  for (const token of raw.split(",").map(item => item.trim()).filter(Boolean)) {
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/); if (!match) throw new Error("صيغة الصفحات غير صحيحة. استخدم مثلًا: 1-3,5,8.");
    const start = Number(match[1]); const end = Number(match[2] || match[1]); if (start < 1 || end < start || end > count) throw new Error(`اختر صفحات بين 1 و${count}.`);
    for (let page = start; page <= end; page += 1) pages.push(page - 1);
  }
  if (!pages.length) throw new Error("اختر صفحة واحدة على الأقل."); return pages;
}

type ExtractedPdfVerification = { pageCount: number; orderVerified: boolean; textVerifiedPages: number };

function extractPagesFailureMessage(error: unknown) {
  const message = String(error instanceof Error ? error.message : error);
  if (/encrypt|password|security/i.test(message)) return "الملف محمي بكلمة مرور ولا يمكن استخراج صفحاته محليًا من دون فتحه.";
  if (/root|catalog|page tree|xref|trailer|stream|parse|invalid/i.test(message)) return "الملف PDF معطوب أو بنيته غير قابلة للقراءة؛ لا يمكن استخراج الصفحات بأمان.";
  return "تعذر فتح PDF لاستخراج الصفحات. تأكد أن الملف PDF صالح وغير محمي.";
}

async function verifyExtractedPdf(sourceBytes: Uint8Array, outputBytes: Uint8Array, selected: number[]): Promise<ExtractedPdfVerification> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  const source = await pdfjs.getDocument({ data: sourceBytes.slice() }).promise;
  const output = await pdfjs.getDocument({ data: outputBytes.slice() }).promise;
  try {
    if (output.numPages !== selected.length) throw new Error("تعذر التحقق من عدد الصفحات المستخرجة.");
    let orderVerified = true; let textVerifiedPages = 0;
    for (let index = 0; index < selected.length; index += 1) {
      const [sourcePage, outputPage] = await Promise.all([source.getPage(selected[index] + 1), output.getPage(index + 1)]);
      const sourceViewport = sourcePage.getViewport({ scale: 1 }); const outputViewport = outputPage.getViewport({ scale: 1 });
      if (Math.abs(sourceViewport.width - outputViewport.width) > .1 || Math.abs(sourceViewport.height - outputViewport.height) > .1) orderVerified = false;
      const [sourceContent, outputContent] = await Promise.all([sourcePage.getTextContent(), outputPage.getTextContent()]);
      const toText = (content: any) => content.items.map((item: any) => item.str || "").join(" ").replace(/\s+/g, " ").trim();
      const sourceText = toText(sourceContent); const outputText = toText(outputContent);
      if (sourceText || outputText) { if (sourceText !== outputText) orderVerified = false; else textVerifiedPages += 1; }
    }
    if (!orderVerified) throw new Error("تعذر التحقق من ترتيب الصفحات أو محتواها المستخرج.");
    return { pageCount: output.numPages, orderVerified, textVerifiedPages };
  } finally { await source.cleanup?.(); await output.cleanup?.(); }
}

/** Extracts selected pages into a new PDF and independently verifies page count and order. */
export async function extractPdfPages(file: File, pages: string, report?: (fraction: number) => void): Promise<LocalFileResult> {
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder("latin1").decode(sourceBytes.slice(0, 5)).startsWith("%PDF-")) throw new Error("هذا الملف ليس PDF صالحًا؛ تحقق من المحتوى وليس الامتداد فقط.");
  let source: PDFDocument;
  try { source = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false, updateMetadata: false }); }
  catch (error) { throw new Error(extractPagesFailureMessage(error)); }
  let pageCount: number;
  try { pageCount = source.getPageCount(); }
  catch (error) { throw new Error(extractPagesFailureMessage(error)); }
  const selected = parsePageList(pages, pageCount);
  const extracted = await PDFDocument.create();
  let copied: Awaited<ReturnType<PDFDocument["copyPages"]>>;
  try { copied = await extracted.copyPages(source, selected); }
  catch (error) { throw new Error(extractPagesFailureMessage(error)); }
  try { copied.forEach(page => extracted.addPage(page)); }
  catch (error) { throw new Error(extractPagesFailureMessage(error)); }
  report?.(.7);
  let outputBytes: Uint8Array;
  try { outputBytes = new Uint8Array(await extracted.save({ useObjectStreams: true })).slice(); }
  catch (error) { throw new Error(extractPagesFailureMessage(error)); }
  let verification: ExtractedPdfVerification;
  try { verification = await verifyExtractedPdf(sourceBytes, outputBytes, selected); }
  catch (error) { throw new Error(error instanceof Error && /تعذر التحقق/.test(error.message) ? error.message : extractPagesFailureMessage(error)); }
  const downloadBytes = new Uint8Array(outputBytes).slice();
  report?.(1);
  return {
    name: outputName(file.name, "extracted", "pdf"), blob: new Blob([downloadBytes], { type: "application/pdf" }), mime: "application/pdf",
    label: `تم استخراج ${verification.pageCount} ${verification.pageCount === 1 ? "صفحة" : "صفحات"} والتحقق من ترتيبها محليًا`,
    details: { selectedPages: selected.map(index => index + 1).join(","), pageCount: verification.pageCount, orderVerified: verification.orderVerified, textVerifiedPages: verification.textVerifiedPages, originalSize: file.size },
  };
}

/** Deletes selected pages into a new PDF and independently verifies every retained page. */
export async function deletePdfPages(file: File, pages: string, report?: (fraction: number) => void): Promise<LocalFileResult> {
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder("latin1").decode(sourceBytes.slice(0, 5)).startsWith("%PDF-")) throw new Error("هذا الملف ليس PDF صالحًا؛ تحقق من المحتوى وليس الامتداد فقط.");
  let source: PDFDocument;
  try { source = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false, updateMetadata: false }); }
  catch (error) { throw new Error(extractPagesFailureMessage(error)); }
  let pageCount: number;
  try { pageCount = source.getPageCount(); }
  catch (error) { throw new Error(extractPagesFailureMessage(error)); }
  const removed = parsePageList(pages, pageCount);
  const remaining = source.getPageIndices().filter(index => !new Set(removed).has(index));
  if (!remaining.length) throw new Error("لا يمكن حذف كل صفحات PDF؛ اترك صفحة واحدة على الأقل في الناتج.");
  const output = await PDFDocument.create();
  let copied: Awaited<ReturnType<PDFDocument["copyPages"]>>;
  try { copied = await output.copyPages(source, remaining); }
  catch (error) { throw new Error(extractPagesFailureMessage(error)); }
  try { copied.forEach(page => output.addPage(page)); }
  catch (error) { throw new Error(extractPagesFailureMessage(error)); }
  report?.(.7);
  let outputBytes: Uint8Array;
  try { outputBytes = new Uint8Array(await output.save({ useObjectStreams: true })).slice(); }
  catch (error) { throw new Error(extractPagesFailureMessage(error)); }
  let verification: ExtractedPdfVerification;
  try { verification = await verifyExtractedPdf(sourceBytes, outputBytes, remaining); }
  catch (error) { throw new Error(error instanceof Error && /تعذر التحقق/.test(error.message) ? error.message : extractPagesFailureMessage(error)); }
  const downloadBytes = new Uint8Array(outputBytes).slice();
  report?.(1);
  return {
    name: outputName(file.name, "pages-removed", "pdf"), blob: new Blob([downloadBytes], { type: "application/pdf" }), mime: "application/pdf",
    label: `تم حذف ${removed.length} ${removed.length === 1 ? "صفحة" : "صفحات"} والتحقق من ${verification.pageCount} صفحات متبقية محليًا`,
    details: { removedPages: removed.map(index => index + 1).join(","), remainingPages: remaining.map(index => index + 1).join(","), pageCount: verification.pageCount, orderVerified: verification.orderVerified, textVerifiedPages: verification.textVerifiedPages, originalSize: file.size },
  };
}

async function openPdf(file: File) { try { return await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false, updateMetadata: false }); } catch (error: any) { if (/encrypt|password|security/i.test(String(error?.message || ""))) throw new Error("الملف محمي بكلمة مرور. استخدم أداة فك حماية PDF فقط إذا كنت تملك كلمة المرور الصحيحة."); throw error; } }
async function result(document: PDFDocument, source: File, suffix: string, extension = "pdf") { const saved = new Uint8Array(await document.save({ useObjectStreams: true })).slice(); return { name: outputName(source.name, suffix, extension), blob: new Blob([saved], { type: "application/pdf" }), mime: "application/pdf" } satisfies LocalFileResult; }
const hexChannels = (value: string) => ({ red: parseInt(value.slice(1, 3), 16) / 255, green: parseInt(value.slice(3, 5), 16) / 255, blue: parseInt(value.slice(5, 7), 16) / 255 });
const isArabicText = (value: string) => /[\u0600-\u06FF]/.test(value);
async function dataUrlBytes(source: string) { return new Uint8Array(await (await fetch(source)).arrayBuffer()); }

export function inspectPdfRepairInput(bytes: Uint8Array): PdfRepairInputInspection {
  const header = new TextDecoder("latin1").decode(bytes.slice(0, 8));
  const text = new TextDecoder("latin1").decode(bytes);
  const marker = text.lastIndexOf("startxref");
  if (marker < 0) return { hasPdfHeader: header.startsWith("%PDF-"), startXrefRecoverableIssue: false };
  const offsetMatch = text.slice(marker + "startxref".length, marker + "startxref".length + 32).match(/\s*(\d+)/);
  const startXrefOffset = offsetMatch ? Number(offsetMatch[1]) : undefined;
  const target = startXrefOffset !== undefined && startXrefOffset >= 0 && startXrefOffset < bytes.length ? text.slice(startXrefOffset, startXrefOffset + 32) : "";
  const validTarget = target.startsWith("xref") || /^\d+\s+\d+\s+obj\b/.test(target);
  return { hasPdfHeader: header.startsWith("%PDF-"), startXrefOffset, startXrefRecoverableIssue: startXrefOffset !== undefined && !validTarget };
}

export function classifyPdfRepairFailure(error: unknown): PdfRepairFailure {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  if (/encrypt|password|security|محمي/.test(message)) return "password-protected";
  if (/no pdf header|not a pdf|invalid pdf|header/.test(message)) return "unsupported-file";
  if (/xref|trailer|page tree|stream|object|parse|catalog|page/.test(message)) return "unrepairable";
  return "unknown";
}

export function classifyPdfRepairIssue(error: unknown): PdfRepairIssue {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  if (/encrypt|password|security|محمي/.test(message)) return "encryption";
  if (/no pdf header|not a pdf|invalid pdf|header/.test(message)) return "header";
  if (/startxref|xref/.test(message)) return "xref";
  if (/trailer/.test(message)) return "trailer";
  if (/page tree|catalog|page/.test(message)) return "page-tree";
  if (/stream|object/.test(message)) return "stream";
  return "unknown";
}

function repairFailureMessage(kind: PdfRepairFailure, issue: PdfRepairIssue = "unknown") {
  if (kind === "password-protected") return "Unsupported / Password protected: الملف محمي بكلمة مرور. لا تحاول هذه الأداة تجاوز الحماية.";
  if (kind === "unsupported-file") return "Unsupported: هذا الملف ليس PDF صالحًا أو لا يحمل بنية PDF معتمدة.";
  if (kind === "unrepairable") return `Unrepairable / ${issue}: تعذر قراءة البنية اللازمة للإصلاح المحلي. لا تدّعي الأداة استعادة كائنات أو صفحات مفقودة.`;
  return "Unrepairable / Unsupported: تعذر تصنيف المشكلة أو فتح الملف بأمان لإعادة بنائه محليًا.";
}

async function verifyPdfRepairOutput(bytes: Uint8Array, expectedPages: number) {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  // PDF.js may transfer the provided ArrayBuffer to its worker; verify a copy so the downloadable bytes remain intact.
  const independent = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  if (independent.numPages !== expectedPages) throw new Error(`Unrepairable: فشل تحقق المخرج؛ عدد الصفحات ${independent.numPages} لا يطابق ${expectedPages}.`);
  const text: string[] = [];
  for (let index = 1; index <= independent.numPages; index += 1) {
    const page = await independent.getPage(index); const content = await page.getTextContent();
    text.push(content.items.map((item: any) => typeof item.str === "string" ? item.str : "").join(" ").replace(/\s+/g, " ").trim());
  }
  return { pageCount: independent.numPages, extractedText: text.join("\n") };
}
async function rasterizedArabicWatermark(text: string, size: number, color: string, font: "sans" | "serif" | "mono") {
  const scale = 3; const canvas = document.createElement("canvas"); const context = canvas.getContext("2d"); if (!context) throw new Error("تعذر تجهيز خط العلامة المائية العربية محليًا.");
  const family = font === "serif" ? "serif" : font === "mono" ? "monospace" : "sans-serif"; context.font = `700 ${size * scale}px ${family}`; context.direction = "rtl"; context.textAlign = "center"; context.textBaseline = "middle";
  const measured = Math.ceil(context.measureText(text).width); canvas.width = Math.max(72, measured + size * scale * 1.4); canvas.height = Math.max(48, Math.ceil(size * scale * 1.9));
  const draw = canvas.getContext("2d"); if (!draw) throw new Error("تعذر رسم العلامة المائية العربية."); draw.font = `700 ${size * scale}px ${family}`; draw.direction = "rtl"; draw.textAlign = "center"; draw.textBaseline = "middle"; draw.fillStyle = color; draw.fillText(text, canvas.width / 2, canvas.height / 2);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("تعذر إنشاء علامة مائية عربية.")), "image/png")); return new Uint8Array(await blob.arrayBuffer());
}

/** Counts interactive AcroForm fields before any flattening is attempted. */
export async function countPdfFormFields(file: File) { const source = await openPdf(file); return source.getForm().getFields().length; }

export async function mergePdfs(files: File[], report?: (fraction: number) => void) {
  const merged = await PDFDocument.create(); for (let index = 0; index < files.length; index += 1) { const source = await openPdf(files[index]); const copied = await merged.copyPages(source, source.getPageIndices()); copied.forEach(page => merged.addPage(page)); report?.((index + 1) / files.length); }
  return result(merged, files[0], "merged");
}

/** Re-saves a PDF accepted by pdf-lib and verifies the output in PDF.js. It only calls a file repaired when a recoverable startxref defect is evidenced before writing. */
export async function repairPdf(file: File, report?: (fraction: number) => void) {
  const inputBytes = new Uint8Array(await file.arrayBuffer()); const inspection = inspectPdfRepairInput(inputBytes);
  if (!inspection.hasPdfHeader) throw new Error(repairFailureMessage("unsupported-file"));
  let source: PDFDocument;
  try { source = await PDFDocument.load(inputBytes, { ignoreEncryption: false, updateMetadata: false }); }
  catch (error) { throw new Error(repairFailureMessage(classifyPdfRepairFailure(error), classifyPdfRepairIssue(error))); }
  let inputPageCount: number;
  try { inputPageCount = source.getPageCount(); }
  catch (error) { throw new Error(repairFailureMessage(classifyPdfRepairFailure(error), classifyPdfRepairIssue(error))); }
  if (!inputPageCount) throw new Error("Unrepairable / page-tree: لا يحتوي الملف على صفحات قابلة لإعادة الحفظ.");
  source.setProducer("Wasl File Studio local re-save");
  let independentInputFailed = false;
  try { await verifyPdfRepairOutput(inputBytes, inputPageCount); } catch { independentInputFailed = true; }
  const saved = new Uint8Array(await source.save({ useObjectStreams: true })).slice();
  let verification: { pageCount: number; extractedText: string };
  try { verification = await verifyPdfRepairOutput(saved, inputPageCount); }
  catch (error) { throw new Error(error instanceof Error ? error.message : repairFailureMessage("unrepairable")); }
  const status: PdfRepairStatus = inspection.startXrefRecoverableIssue && independentInputFailed ? "repaired" : "re-saved";
  const suffix = status === "repaired" ? "repaired" : "re-saved";
  const label = status === "repaired" ? "Repaired: فشل المدخل في تحقق PDF.js مستقل بسبب خلل startxref ثم اجتاز المخرج التحقق مع الحفاظ على الصفحات." : "Re-saved / No repair required: الملف كان قابلًا للقراءة؛ أُعيد حفظه واجتاز المخرج تحققًا مستقلًا.";
  report?.(1);
  return { name: outputName(file.name, suffix, "pdf"), blob: new Blob([saved], { type: "application/pdf" }), mime: "application/pdf", label, details: { repairStatus: status, independentValidation: true, independentInputFailed, inputPages: inputPageCount, outputPages: verification.pageCount, outputTextDetected: Boolean(verification.extractedText.trim()), startXrefRecoverableIssue: inspection.startXrefRecoverableIssue } satisfies LocalFileResult["details"] } satisfies LocalFileResult;
}

async function pdfPageSummaries(file: File, report?: (fraction: number) => void) {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  const source = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const pages: Array<{ text: string; hash: string }> = [];
  for (let index = 1; index <= source.numPages; index += 1) {
    const page = await source.getPage(index); const content = await page.getTextContent(); const text = content.items.map((item: any) => typeof item.str === "string" ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)); const hash = Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
    pages.push({ text, hash }); report?.(index / source.numPages);
  }
  return pages;
}

/** Compares two PDFs locally by page count plus extracted text and a SHA-256 digest per page. It does not claim pixel-level visual diffing. */
export async function comparePdfs(left: File, right: File, report?: (fraction: number) => void): Promise<LocalFileResult> {
  const [leftPages, rightPages] = await Promise.all([pdfPageSummaries(left, fraction => report?.(fraction * .5)), pdfPageSummaries(right, fraction => report?.(.5 + fraction * .5))]);
  const count = Math.max(leftPages.length, rightPages.length); const lines = ["تقرير مقارنة PDF محلي", "", `الملف الأيسر: ${left.name} (${leftPages.length} صفحة)`, `الملف الأيمن: ${right.name} (${rightPages.length} صفحة)`, "", "النتائج حسب الصفحة:"];
  let different = leftPages.length === rightPages.length ? 0 : Math.abs(leftPages.length - rightPages.length);
  for (let index = 0; index < count; index += 1) {
    const a = leftPages[index]; const b = rightPages[index]; const same = Boolean(a && b && a.hash === b.hash);
    if (!same) different += a && b ? 1 : 0;
    lines.push(`صفحة ${index + 1}: ${same ? "متطابقة نصيًا" : !a ? "توجد في الملف الأيمن فقط" : !b ? "توجد في الملف الأيسر فقط" : "مختلفة نصيًا"}`);
    if (!same && a && b) { lines.push(`  الأيسر: ${a.text.slice(0, 500) || "[لا نص مستخرج]"}`); lines.push(`  الأيمن: ${b.text.slice(0, 500) || "[لا نص مستخرج]"}`); }
  }
  lines.push("", `الخلاصة: ${different} فرق/فروقات مكتشفة عبر عدد الصفحات أو النص المستخرج.`); lines.push("ملاحظة: هذه المقارنة لا تدّعي اكتشاف اختلافات البكسل أو الصور أو التنسيق إذا كان النص المستخرج متطابقًا.");
  return { name: outputName(left.name, "comparison", "txt"), blob: new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), mime: "text/plain", label: "Local PDF comparison report", details: { comparison: true, leftPages: leftPages.length, rightPages: rightPages.length, differences: different } };
}

/**
 * Permanently redacts one rectangular region from every page by rasterizing the
 * visible page, applying the mask, and rebuilding a new image-backed PDF.
 * This intentionally removes searchable/selectable source text from the output.
 */
export async function redactPdf(file: File, area: { x: number; y: number; width: number; height: number }, report?: (fraction: number) => void): Promise<LocalFileResult> {
  if (area.width <= 0 || area.height <= 0) throw new Error("أدخل عرضًا وارتفاعًا صالحين لمنطقة التنقيح.");
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  const input = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const output = await PDFDocument.create();
  const scale = 1.5;
  for (let index = 1; index <= input.numPages; index += 1) {
    const page = await input.getPage(index); const viewport = page.getViewport({ scale }); const base = page.getViewport({ scale: 1 });
    const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d"); if (!context) throw new Error("تعذر تجهيز سطح التنقيح المحلي.");
    await page.render({ canvasContext: context, viewport }).promise;
    const x = Math.max(0, Math.min(canvas.width, area.x * scale)); const width = Math.max(0, Math.min(canvas.width - x, area.width * scale));
    const y = Math.max(0, Math.min(canvas.height, canvas.height - (area.y + area.height) * scale)); const height = Math.max(0, Math.min(canvas.height - y, area.height * scale));
    context.fillStyle = "#000000"; context.fillRect(x, y, width, height);
    const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("تعذر إنشاء صفحة التنقيح.")), "image/jpeg", .92));
    const image = await output.embedJpg(new Uint8Array(await jpeg.arrayBuffer())); const outPage = output.addPage([base.width, base.height]);
    outPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height }); report?.(index / input.numPages);
  }
  const bytes = new Uint8Array(await output.save({ useObjectStreams: true })).slice();
  return { name: outputName(file.name, "redacted", "pdf"), blob: new Blob([bytes], { type: "application/pdf" }), mime: "application/pdf", label: "Permanent rasterized redaction", details: { redaction: "rasterized-rebuild", searchableTextRemoved: true } };
}

/**
 * Flattens interactive fields by rebuilding each rendered page as a static image-backed PDF.
 * This deliberately trades selectable source text for predictable removal of AcroForm widgets
 * across browser PDF implementations, while preserving the visible completed form.
 */
async function flattenPdfForm(file: File, report?: (fraction: number) => void): Promise<LocalFileResult> {
  const fieldCount = await countPdfFormFields(file);
  if (!fieldCount) throw new Error("هذا الملف لا يحتوي على حقول PDF قابلة للتعبئة، لذلك لا يحتاج إلى تسطيح.");
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  const input = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const output = await PDFDocument.create(); const scale = 1.55;
  for (let index = 1; index <= input.numPages; index += 1) {
    const page = await input.getPage(index); const viewport = page.getViewport({ scale }); const base = page.getViewport({ scale: 1 });
    const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("تعذر تجهيز صفحة النموذج للتسطيح.")), "image/jpeg", .92));
    const image = await output.embedJpg(new Uint8Array(await jpeg.arrayBuffer())); const outPage = output.addPage([base.width, base.height]);
    outPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height }); report?.(index / input.numPages);
  }
  const bytes = new Uint8Array(await output.save({ useObjectStreams: false })).slice();
  return { name: outputName(file.name, "flattened", "pdf"), blob: new Blob([bytes], { type: "application/pdf" }), mime: "application/pdf", label: `تم تسطيح ${fieldCount} حقلًا داخل نسخة مرئية ثابتة`, details: { flatten: "rasterized-rebuild", fieldCount, searchableTextRemoved: true } };
}

export async function alterPdf(slug: string, file: File, options: PdfOptions, report?: (fraction: number) => void): Promise<LocalFileResult[]> {
  const source = await openPdf(file); const pageCount = source.getPageCount(); const selected = parsePageList(options.pages, pageCount);
  if (["split-pdf", "extract-pdf-pages"].includes(slug)) {
    if (slug === "split-pdf") { const outputs: LocalFileResult[] = []; for (let index = 0; index < selected.length; index += 1) { const single = await PDFDocument.create(); const [page] = await single.copyPages(source, [selected[index]]); single.addPage(page); outputs.push(await result(single, file, `page-${selected[index] + 1}`)); report?.((index + 1) / selected.length); } return outputs; }
    const extracted = await PDFDocument.create(); const copied = await extracted.copyPages(source, selected); copied.forEach(page => extracted.addPage(page)); return [await result(extracted, file, "extracted")];
  }
  if (slug === "delete-pdf-pages") { const output = await PDFDocument.create(); const unwanted = new Set(selected); const copied = await output.copyPages(source, source.getPageIndices().filter(index => !unwanted.has(index))); copied.forEach(page => output.addPage(page)); return [await result(output, file, "pages-removed")]; }
  if (slug === "reorder-pdf-pages") { const output = await PDFDocument.create(); const copied = await output.copyPages(source, selected); copied.forEach(page => output.addPage(page)); return [await result(output, file, "reordered")]; }
  const pages = source.getPages();
  if (slug === "rotate-pdf") pages.forEach((page, index) => { if (selected.includes(index)) page.setRotation(degrees(options.rotation || 90)); });
  if (slug === "watermark-pdf") {
    const family = options.watermarkFont || "sans"; const standard = family === "serif" ? StandardFonts.TimesRomanBold : family === "mono" ? StandardFonts.CourierBold : StandardFonts.HelveticaBold; const font = await source.embedFont(standard);
    const text = options.watermark?.trim() || "WASL"; const color = /^#[0-9a-fA-F]{6}$/.test(options.watermarkColor || "") ? options.watermarkColor! : "#7352f4"; const opacity = Math.max(.05, Math.min(.95, options.watermarkOpacity ?? .24)); const position = options.watermarkPosition || "center"; const imageBytes = options.watermarkImage ? await dataUrlBytes(options.watermarkImage) : isArabicText(text) ? await rasterizedArabicWatermark(text, Math.max(10, options.watermarkSize || 54), color, family) : undefined;
    const embeddedImage = imageBytes ? (options.watermarkImage?.startsWith("data:image/jpeg") ? await source.embedJpg(imageBytes) : await source.embedPng(imageBytes)) : undefined;
    pages.forEach((page, index) => { if (!selected.includes(index)) return; const { width, height } = page.getSize(); const size = Math.max(10, Math.min(120, options.watermarkSize || Math.min(width, height) / 10)); const margin = 28;
      if (embeddedImage) { const imageWidth = Math.max(24, Math.min(width * .72, options.watermarkImage ? size * 3 : embeddedImage.width / 3)); const imageHeight = imageWidth * embeddedImage.height / embeddedImage.width; const x = position.includes("right") ? width - imageWidth - margin : position.includes("left") ? margin : (width - imageWidth) / 2; const y = position.includes("top") ? height - imageHeight - margin : position.includes("bottom") ? margin : (height - imageHeight) / 2; page.drawImage(embeddedImage, { x, y, width: imageWidth, height: imageHeight, opacity, rotate: position === "center" ? degrees(38) : degrees(0) }); return; }
      const textWidth = font.widthOfTextAtSize(text, size); const x = position.includes("right") ? width - textWidth - margin : position.includes("left") ? margin : (width - textWidth) / 2; const y = position.includes("top") ? height - size - margin : position.includes("bottom") ? margin : (height - size) / 2; const channels = hexChannels(color); page.drawText(text, { x, y, size, font, color: rgb(channels.red, channels.green, channels.blue), opacity, rotate: position === "center" ? degrees(38) : degrees(0) });
    });
  }
  if (slug === "page-numbers-pdf") { const font = await source.embedFont(StandardFonts.Helvetica); pages.forEach((page, index) => { const { width } = page.getSize(); const label = String(index + 1); page.drawText(label, { x: width / 2 - font.widthOfTextAtSize(label, 10) / 2, y: options.position === "top" ? page.getHeight() - 22 : 13, size: 10, font, color: rgb(.28, .27, .35) }); }); }
  if (slug === "crop-pdf") { const crop = options.crop || { x: 0, y: 0, width: 500, height: 700 }; pages.forEach((page, index) => { if (selected.includes(index)) page.setCropBox(crop.x, crop.y, crop.width, crop.height); }); }
  if (slug === "resize-pdf") { const dimensions = options.dimensions || { width: 595, height: 842 }; pages.forEach((page, index) => { if (!selected.includes(index)) return; const current = page.getSize(); const sx = dimensions.width / current.width; const sy = dimensions.height / current.height; page.scaleContent(sx, sy); page.scaleAnnotations(sx, sy); page.setSize(dimensions.width, dimensions.height); }); }
  if (slug === "flatten-pdf") return [await flattenPdfForm(file, report)];
  if (slug === "compress-pdf") { source.setProducer("Wasl File Studio local optimization"); }
  if (slug === "pdf-metadata") {
    if (options.metadataMode === "clear") { source.setTitle(""); source.setAuthor(""); source.setSubject(""); source.setKeywords([]); source.setCreator(""); source.setProducer(""); return [await result(source, file, "metadata-removed")]; }
    const metadata = { title: source.getTitle() || "—", author: source.getAuthor() || "—", subject: source.getSubject() || "—", creator: source.getCreator() || "—", producer: source.getProducer() || "—", pages: pageCount }; return [{ name: outputName(file.name, "metadata", "txt"), blob: new Blob([Object.entries(metadata).map(([key, value]) => `${key}: ${value}`).join("\n")], { type: "text/plain" }), mime: "text/plain", details: metadata }];
  }
  const suffixMap: Record<string, string> = { "rotate-pdf": "rotated", "watermark-pdf": "watermarked", "page-numbers-pdf": "numbered", "crop-pdf": "cropped", "resize-pdf": "resized", "flatten-pdf": "flattened", "compress-pdf": "optimized" };
  report?.(1); return [await result(source, file, suffixMap[slug] || "processed")];
}

export async function imagesToPdf(files: File[], report?: (fraction: number) => void) {
  const output = await PDFDocument.create(); for (let index = 0; index < files.length; index += 1) { const file = files[index]; const bytes = new Uint8Array(await file.arrayBuffer()); let image: any;
    if (file.type === "image/jpeg") image = await output.embedJpg(bytes);
    else if (file.type === "image/png") {
      try { image = await output.embedPng(bytes); }
      catch { image = await output.embedPng(await canvasToPng(file)); }
    } else image = await output.embedPng(await canvasToPng(file));
    const page = output.addPage([image.width, image.height]); page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height }); report?.((index + 1) / files.length); }
  return result(output, files[0], "images");
}

async function canvasToPng(file: File) { const bitmap = await createImageBitmap(file); const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext("2d")!.drawImage(bitmap, 0, 0); const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value: Blob | null) => value ? resolve(value) : reject(new Error("تعذر قراءة الصورة.")), "image/png")); return new Uint8Array(await blob.arrayBuffer()); }

export async function pdfToImages(file: File, type: "png" | "jpeg", quality = .82, report?: (fraction: number) => void) {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const results: LocalFileResult[] = [];
  for (let index = 1; index <= pdfDocument.numPages; index += 1) { const page = await pdfDocument.getPage(index); const viewport = page.getViewport({ scale: 1.55 }); const canvas = window.document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise; const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value: Blob | null) => value ? resolve(value) : reject(new Error("تعذر إنشاء الصورة.")), `image/${type}`, quality)); results.push({ name: outputName(file.name, `page-${index}`, type === "jpeg" ? "jpg" : "png"), blob, mime: `image/${type}` }); report?.(index / pdfDocument.numPages); }
  return results;
}

/** Re-renders pages to JPEG and rebuilds a PDF at a chosen quality. This is lossy but is a genuine local compression path. */
export async function compressPdf(file: File, quality = .72, report?: (fraction: number) => void): Promise<LocalFileResult> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  const input = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const output = await PDFDocument.create();
  const scale = quality >= .88 ? 1.45 : quality >= .7 ? 1.2 : 1;
  for (let index = 1; index <= input.numPages; index += 1) {
    const page = await input.getPage(index); const display = page.getViewport({ scale }); const base = page.getViewport({ scale: 1 }); const canvas = document.createElement("canvas"); canvas.width = Math.ceil(display.width); canvas.height = Math.ceil(display.height);
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport: display }).promise;
    const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob: Blob | null) => blob ? resolve(blob) : reject(new Error("تعذر ضغط الصفحة.")), "image/jpeg", quality)); const image = await output.embedJpg(new Uint8Array(await jpeg.arrayBuffer())); const outPage = output.addPage([base.width, base.height]); outPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height }); report?.(index / input.numPages);
  }
  const saved = new Uint8Array(await output.save({ useObjectStreams: true })).slice();
  if (saved.byteLength >= file.size) throw new Error("لم يحقق هذا الملف انخفاضًا في الحجم بالإعدادات الحالية. جرّب جودة أقل أو احتفظ بالملف الأصلي.");
  return { name: outputName(file.name, "compressed", "pdf"), blob: new Blob([saved], { type: "application/pdf" }), mime: "application/pdf", details: { originalSize: file.size, quality: Math.round(quality * 100), compression: "rasterized-jpeg" } };
}

/**
 * Creates a new image-backed PDF for password protection or an authorized unlock.
 * Rasterisation is intentional: browser PDF libraries do not safely alter PDF encryption
 * while preserving every original internal object. The result preserves visible pages.
 */
export async function securePdf(file: File, action: "protect" | "unlock", password: string, report?: (fraction: number) => void): Promise<LocalFileResult> {
  if (!password.trim()) throw new Error(action === "protect" ? "أدخل كلمة مرور لحماية النسخة الجديدة." : "أدخل كلمة المرور الصحيحة للملف الذي تملكه.");
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  let loaded: any; try { loaded = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password: action === "unlock" ? password : undefined }).promise; } catch (error: any) { if (action === "unlock" && /password|PasswordException/i.test(String(error?.message || error?.name || ""))) throw new Error("تعذر فك الحماية: تحقّق من كلمة المرور. لا تحاول هذه الأداة تجاوز كلمات المرور."); throw error; }
  const { jsPDF } = await import("jspdf"); let output: any;
  for (let index = 1; index <= loaded.numPages; index += 1) {
    const page = await loaded.getPage(index); const viewport = page.getViewport({ scale: 1.32 }); const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    const init = { orientation: viewport.width > viewport.height ? "landscape" : "portrait", unit: "pt", format: [viewport.width, viewport.height], compress: true, encryption: action === "protect" ? { userPassword: password, ownerPassword: password, userPermissions: ["print", "copy"] } : undefined } as any;
    if (!output) output = new jsPDF(init); else output.addPage([viewport.width, viewport.height], viewport.width > viewport.height ? "landscape" : "portrait");
    output.addImage(canvas.toDataURL("image/jpeg", .86), "JPEG", 0, 0, viewport.width, viewport.height, undefined, "FAST"); report?.(index / loaded.numPages);
  }
  return { name: outputName(file.name, action === "protect" ? "protected" : "unlocked", "pdf"), blob: output.output("blob") as Blob, mime: "application/pdf", label: action === "protect" ? "Protected PDF" : "Unlocked PDF" };
}
