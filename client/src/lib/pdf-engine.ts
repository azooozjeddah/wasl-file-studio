import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { LocalFileResult, outputName } from "./file-utils";

export type PdfOptions = { pages?: string; rotation?: number; watermark?: string; position?: "bottom" | "top"; crop?: { x: number; y: number; width: number; height: number }; dimensions?: { width: number; height: number }; metadataMode?: "view" | "clear"; quality?: number; password?: string };

export function parsePageList(value: string | undefined, count: number) {
  const raw = value?.trim() || `1-${count}`; const pages: number[] = [];
  for (const token of raw.split(",").map(item => item.trim()).filter(Boolean)) {
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/); if (!match) throw new Error("صيغة الصفحات غير صحيحة. استخدم مثلًا: 1-3,5,8.");
    const start = Number(match[1]); const end = Number(match[2] || match[1]); if (start < 1 || end < start || end > count) throw new Error(`اختر صفحات بين 1 و${count}.`);
    for (let page = start; page <= end; page += 1) pages.push(page - 1);
  }
  if (!pages.length) throw new Error("اختر صفحة واحدة على الأقل."); return pages;
}

async function openPdf(file: File) { try { return await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false, updateMetadata: false }); } catch (error: any) { if (/encrypt|password|security/i.test(String(error?.message || ""))) throw new Error("الملف محمي بكلمة مرور. استخدم أداة فك حماية PDF فقط إذا كنت تملك كلمة المرور الصحيحة."); throw error; } }
async function result(document: PDFDocument, source: File, suffix: string, extension = "pdf") { const saved = new Uint8Array(await document.save({ useObjectStreams: true })).slice(); return { name: outputName(source.name, suffix, extension), blob: new Blob([saved], { type: "application/pdf" }), mime: "application/pdf" } satisfies LocalFileResult; }

export async function mergePdfs(files: File[], report?: (fraction: number) => void) {
  const merged = await PDFDocument.create(); for (let index = 0; index < files.length; index += 1) { const source = await openPdf(files[index]); const copied = await merged.copyPages(source, source.getPageIndices()); copied.forEach(page => merged.addPage(page)); report?.((index + 1) / files.length); }
  return result(merged, files[0], "merged");
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
  if (slug === "watermark-pdf") { const font = await source.embedFont(StandardFonts.HelveticaBold); pages.forEach((page, index) => { if (!selected.includes(index)) return; const { width, height } = page.getSize(); const text = options.watermark?.trim() || "WASL"; const size = Math.max(18, Math.min(width, height) / 10); page.drawText(text, { x: width / 2 - font.widthOfTextAtSize(text, size) / 2, y: height / 2, size, font, color: rgb(.45, .32, .95), opacity: .24, rotate: degrees(38) }); }); }
  if (slug === "page-numbers-pdf") { const font = await source.embedFont(StandardFonts.Helvetica); pages.forEach((page, index) => { const { width } = page.getSize(); const label = String(index + 1); page.drawText(label, { x: width / 2 - font.widthOfTextAtSize(label, 10) / 2, y: options.position === "top" ? page.getHeight() - 22 : 13, size: 10, font, color: rgb(.28, .27, .35) }); }); }
  if (slug === "crop-pdf") { const crop = options.crop || { x: 0, y: 0, width: 500, height: 700 }; pages.forEach((page, index) => { if (selected.includes(index)) page.setCropBox(crop.x, crop.y, crop.width, crop.height); }); }
  if (slug === "resize-pdf") { const dimensions = options.dimensions || { width: 595, height: 842 }; pages.forEach((page, index) => { if (!selected.includes(index)) return; const current = page.getSize(); const sx = dimensions.width / current.width; const sy = dimensions.height / current.height; page.scaleContent(sx, sy); page.scaleAnnotations(sx, sy); page.setSize(dimensions.width, dimensions.height); }); }
  if (slug === "flatten-pdf") { try { source.getForm().flatten(); } catch { /* PDFs without interactive fields are already effectively flat. */ } }
  if (slug === "compress-pdf") { source.setProducer("Wasl File Studio local optimization"); }
  if (slug === "pdf-metadata") {
    if (options.metadataMode === "clear") { source.setTitle(""); source.setAuthor(""); source.setSubject(""); source.setKeywords([]); source.setCreator(""); source.setProducer(""); return [await result(source, file, "metadata-removed")]; }
    const metadata = { title: source.getTitle() || "—", author: source.getAuthor() || "—", subject: source.getSubject() || "—", creator: source.getCreator() || "—", producer: source.getProducer() || "—", pages: pageCount }; return [{ name: outputName(file.name, "metadata", "txt"), blob: new Blob([Object.entries(metadata).map(([key, value]) => `${key}: ${value}`).join("\n")], { type: "text/plain" }), mime: "text/plain", details: metadata }];
  }
  const suffixMap: Record<string, string> = { "rotate-pdf": "rotated", "watermark-pdf": "watermarked", "page-numbers-pdf": "numbered", "crop-pdf": "cropped", "resize-pdf": "resized", "flatten-pdf": "flattened", "compress-pdf": "optimized" };
  report?.(1); return [await result(source, file, suffixMap[slug] || "processed")];
}

export async function imagesToPdf(files: File[], report?: (fraction: number) => void) {
  const output = await PDFDocument.create(); for (let index = 0; index < files.length; index += 1) { const file = files[index]; const bytes = new Uint8Array(await file.arrayBuffer()); const image = file.type === "image/png" ? await output.embedPng(bytes) : file.type === "image/jpeg" ? await output.embedJpg(bytes) : await output.embedPng(await canvasToPng(file)); const page = output.addPage([image.width, image.height]); page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height }); report?.((index + 1) / files.length); }
  return result(output, files[0], "images");
}

async function canvasToPng(file: File) { const bitmap = await createImageBitmap(file); const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext("2d")!.drawImage(bitmap, 0, 0); const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value: Blob | null) => value ? resolve(value) : reject(new Error("تعذر قراءة الصورة.")), "image/png")); return new Uint8Array(await blob.arrayBuffer()); }

export async function pdfToImages(file: File, type: "png" | "jpeg", quality = .82, report?: (fraction: number) => void) {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const results: LocalFileResult[] = [];
  for (let index = 1; index <= document.numPages; index += 1) { const page = await document.getPage(index); const viewport = page.getViewport({ scale: 1.55 }); const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise; const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value: Blob | null) => value ? resolve(value) : reject(new Error("تعذر إنشاء الصورة.")), `image/${type}`, quality)); results.push({ name: outputName(file.name, `page-${index}`, type === "jpeg" ? "jpg" : "png"), blob, mime: `image/${type}` }); report?.(index / document.numPages); }
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
