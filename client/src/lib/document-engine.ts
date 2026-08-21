import { Document, Packer, Paragraph } from "docx";
import { jsPDF } from "jspdf";
import { LocalFileResult, outputName } from "./file-utils";

function normalizeText(value: string) { return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim(); }
function stripRtf(value: string) { return normalizeText(value.replace(/\\par[d]?/g, "\n").replace(/\\'[0-9a-fA-F]{2}/g, "").replace(/\\[a-zA-Z]+-?\d* ?/g, "").replace(/[{}]/g, "")); }
function htmlText(value: string) { const parser = new DOMParser(); return normalizeText((parser.parseFromString(value, "text/html").body.innerText || "").trim()); }

export async function readDocumentText(file: File, mode: "txt" | "html" | "rtf" | "docx" | "pdf") {
  if (mode === "docx") { const mammoth = await import("mammoth"); const output = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }); return htmlText(output.value); }
  if (mode === "pdf") { const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString(); const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const pages: string[] = []; for (let index = 1; index <= document.numPages; index += 1) { const content = await (await document.getPage(index)).getTextContent(); pages.push(content.items.map((item: any) => item.str || "").join(" ")); } return normalizeText(pages.join("\n\n")); }
  const text = await file.text(); return mode === "html" ? htmlText(text) : mode === "rtf" ? stripRtf(text) : normalizeText(text);
}

export function textToPdf(text: string, original: File, suffix = "converted"): LocalFileResult {
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true }); const margin = 42; const lineWidth = 510; pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); const lines = pdf.splitTextToSize(text || " ", lineWidth); let y = 52;
  lines.forEach((line: string) => { if (y > 790) { pdf.addPage(); y = 52; } pdf.text(line, margin, y); y += 17; }); return { name: outputName(original.name, suffix, "pdf"), blob: pdf.output("blob") as Blob, mime: "application/pdf", details: { source: "text-first-local" } };
}

export async function textToDocx(text: string, original: File, suffix = "converted"): Promise<LocalFileResult> { const document = new Document({ sections: [{ children: normalizeText(text).split("\n").map(line => new Paragraph({ text: line || " " })) }] }); return { name: outputName(original.name, suffix, "docx"), blob: await Packer.toBlob(document), mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }; }

export async function convertDocument(file: File, slug: string, report?: (fraction: number) => void): Promise<LocalFileResult[]> {
  const mode = slug === "txt-to-pdf" || slug === "txt-to-docx" ? "txt" : slug === "html-to-pdf" ? "html" : slug === "rtf-to-pdf" ? "rtf" : slug === "word-to-pdf" ? "docx" : "pdf";
  const text = await readDocumentText(file, mode); report?.(.64);
  if (slug === "txt-to-docx" || slug === "pdf-to-word") { const docx = await textToDocx(text, file, slug === "pdf-to-word" ? "extracted" : "converted"); report?.(1); return [docx, { name: outputName(file.name, "extracted", "txt"), blob: new Blob([text], { type: "text/plain" }), mime: "text/plain" }]; }
  report?.(1); return [textToPdf(text, file, slug === "word-to-pdf" ? "best-effort" : "converted")];
}
