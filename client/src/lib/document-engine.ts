import { LocalFileResult, outputName } from "./file-utils";

function normalizeText(value: string) { return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim(); }
function stripRtf(value: string) { return normalizeText(value.replace(/\\par[d]?/g, "\n").replace(/\\'[0-9a-fA-F]{2}/g, "").replace(/\\[a-zA-Z]+-?\d* ?/g, "").replace(/[{}]/g, "")); }
function htmlText(value: string) { const parser = new DOMParser(); return normalizeText((parser.parseFromString(value, "text/html").body.innerText || "").trim()); }

async function pdfDocument(file: File) {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

export async function readDocumentText(file: File, mode: "txt" | "html" | "rtf" | "docx" | "pdf") {
  if (mode === "docx") { const mammoth = await import("mammoth"); const output = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }); return htmlText(output.value); }
  if (mode === "pdf") return normalizeText((await readPdfPages(file)).join("\n\n"));
  const text = await file.text(); return mode === "html" ? htmlText(text) : mode === "rtf" ? stripRtf(text) : normalizeText(text);
}

async function readPdfPages(file: File) {
  const document = await pdfDocument(file); const pages: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) { const content = await (await document.getPage(index)).getTextContent(); pages.push(normalizeText(content.items.map((item: any) => item.str || "").join(" "))); }
  return pages;
}

export async function textToPdf(text: string, original: File, suffix = "converted"): Promise<LocalFileResult> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true }); const margin = 42; const lineWidth = 510; pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); const lines = pdf.splitTextToSize(text || " ", lineWidth); let y = 52;
  lines.forEach((line: string) => { if (y > 790) { pdf.addPage(); y = 52; } pdf.text(line, margin, y); y += 17; }); return { name: outputName(original.name, suffix, "pdf"), blob: pdf.output("blob") as Blob, mime: "application/pdf", details: { source: "text-first-local" } };
}

export async function textToDocx(text: string, original: File, suffix = "converted"): Promise<LocalFileResult> {
  const { Document, Packer, Paragraph } = await import("docx");
  const document = new Document({ sections: [{ children: normalizeText(text).split("\n").map(line => new Paragraph({ text: line || " " })) }] });
  return { name: outputName(original.name, suffix, "docx"), blob: await Packer.toBlob(document), mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
}

async function pdfPagesToDocx(pages: string[], original: File): Promise<LocalFileResult> {
  const { Document, Packer, PageBreak, Paragraph, TextRun } = await import("docx");
  const children = pages.flatMap((page, pageIndex) => {
    const lines = page ? page.split("\n").flatMap(line => line.split(/(?<=[.!؟])\s+/).filter(Boolean)) : [" "];
    const current = lines.map(line => new Paragraph({ children: [new TextRun({ text: line })] }));
    if (pageIndex < pages.length - 1) current.push(new Paragraph({ children: [new PageBreak()] }));
    return current;
  });
  const document = new Document({ sections: [{ children }] });
  return { name: outputName(original.name, "editable", "docx"), blob: await Packer.toBlob(document), mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", details: { source: "page-aware-text-extraction", pages: pages.length } };
}

async function docxToRenderedPdf(file: File, report?: (fraction: number) => void): Promise<LocalFileResult> {
  const [{ renderAsync }, html2canvasModule, jspdfModule] = await Promise.all([import("docx-preview"), import("html2canvas"), import("jspdf")]); const html2canvas = html2canvasModule.default; const { jsPDF } = jspdfModule;
  const container = document.createElement("div"); container.setAttribute("aria-hidden", "true"); Object.assign(container.style, { position: "fixed", top: "0", left: "-20000px", width: "850px", padding: "0", background: "white", zIndex: "-1" }); document.body.appendChild(container);
  try {
    await renderAsync(await file.arrayBuffer(), container, container, { inWrapper: false, breakPages: true, renderHeaders: true, renderFooters: true, renderFootnotes: true, renderEndnotes: true, useBase64URL: true, ignoreLastRenderedPageBreak: false });
    report?.(.35); const pageNodes = Array.from(container.querySelectorAll<HTMLElement>("section.docx")); const nodes = pageNodes.length ? pageNodes : [container]; let pdf: any;
    for (let index = 0; index < nodes.length; index += 1) { const node = nodes[index]; const canvas = await html2canvas(node, { scale: 1.35, backgroundColor: "#ffffff", useCORS: true, logging: false }); const widthPt = 595; const heightPt = Math.max(1, Math.round(widthPt * canvas.height / canvas.width)); if (!pdf) pdf = new jsPDF({ unit: "pt", format: [widthPt, heightPt], compress: true }); else pdf.addPage([widthPt, heightPt]); pdf.addImage(canvas.toDataURL("image/jpeg", .92), "JPEG", 0, 0, widthPt, heightPt, undefined, "FAST"); report?.(.35 + ((index + 1) / nodes.length) * .65); }
    if (!pdf) throw new Error("تعذر عرض محتوى Word محليًا.");
    return { name: outputName(file.name, "rendered", "pdf"), blob: pdf.output("blob") as Blob, mime: "application/pdf", details: { source: "docx-preview-local-render", pages: nodes.length, quality: "visual-layout" } };
  } finally { container.remove(); }
}

export async function convertDocument(file: File, slug: string, report?: (fraction: number) => void): Promise<LocalFileResult[]> {
  const mode = slug === "txt-to-pdf" || slug === "txt-to-docx" ? "txt" : slug === "html-to-pdf" ? "html" : slug === "rtf-to-pdf" ? "rtf" : slug === "word-to-pdf" ? "docx" : "pdf";
  if (slug === "word-to-pdf") return [await docxToRenderedPdf(file, report)];
  if (slug === "pdf-to-word") { const pages = await readPdfPages(file); if (!pages.some(Boolean)) throw new Error("هذا PDF لا يحتوي نصًا قابلًا للاستخراج. استخدم أداة OCR للملفات الممسوحة ضوئيًا أولًا."); report?.(.64); const docx = await pdfPagesToDocx(pages, file); report?.(1); return [docx, { name: outputName(file.name, "extracted", "txt"), blob: new Blob([pages.join("\n\n")], { type: "text/plain" }), mime: "text/plain", details: { pages: pages.length } }]; }
  const text = await readDocumentText(file, mode); report?.(.64);
  if (slug === "txt-to-docx") { const docx = await textToDocx(text, file, "converted"); report?.(1); return [docx, { name: outputName(file.name, "extracted", "txt"), blob: new Blob([text], { type: "text/plain" }), mime: "text/plain" }]; }
  report?.(1); return [await textToPdf(text, file, "converted")];
}
