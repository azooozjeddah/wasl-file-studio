import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import { outputName, type LocalFileResult } from "./file-utils";

export type VisualStamp = { id: string; page: number; type: "image" | "text"; source?: string; text?: string; x: number; y: number; width: number; height: number; rotation: number; opacity: number; color?: string };

export function stampBounds(stamp: VisualStamp, page: { width: number; height: number }) {
  const width = Math.max(16, page.width * stamp.width); const height = Math.max(12, page.height * stamp.height);
  return { x: Math.max(0, Math.min(page.width - width, page.width * stamp.x)), y: Math.max(0, Math.min(page.height - height, page.height * (1 - stamp.y) - height)), width, height };
}

function hexRgb(value = "#171326") { const normalized = value.replace("#", ""); const hex = normalized.length === 3 ? normalized.split("").map(character => character + character).join("") : normalized; return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255); }
async function imageBytes(source: string) { return new Uint8Array(await (await fetch(source)).arrayBuffer()); }

export async function applyVisualStamps(file: File, stamps: VisualStamp[], report?: (fraction: number) => void): Promise<LocalFileResult> {
  const document = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false, updateMetadata: false }); const pages = document.getPages(); const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < stamps.length; index += 1) {
    const stamp = stamps[index]; const page = pages[stamp.page]; if (!page) continue; const bounds = stampBounds(stamp, page.getSize());
    if (stamp.type === "image" && stamp.source) {
      const bytes = await imageBytes(stamp.source); const image = stamp.source.startsWith("data:image/jpeg") ? await document.embedJpg(bytes) : await document.embedPng(bytes);
      page.drawImage(image, { ...bounds, opacity: stamp.opacity, rotate: degrees(stamp.rotation) });
    } else if (stamp.text?.trim()) {
      const size = Math.max(9, Math.min(34, bounds.height * .7)); page.drawText(stamp.text, { x: bounds.x, y: bounds.y + Math.max(0, (bounds.height - size) / 2), size, font, color: hexRgb(stamp.color), opacity: stamp.opacity, rotate: degrees(stamp.rotation), maxWidth: bounds.width });
    }
    report?.((index + 1) / stamps.length);
  }
  document.setProducer("Wasl File Studio visual signature"); const bytes = new Uint8Array(await document.save({ useObjectStreams: true })).slice(); return { name: outputName(file.name, "visually-signed", "pdf"), blob: new Blob([bytes], { type: "application/pdf" }), mime: "application/pdf", label: "Visual PDF signature" };
}
