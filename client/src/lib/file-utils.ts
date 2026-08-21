import JSZip from "jszip";

export type LocalFileResult = { name: string; blob: Blob; mime: string; label?: string; details?: Record<string, string | number | boolean | undefined> };
export type ResultPreviewKind = "image" | "audio" | "video" | "file";
export function resultPreviewKind(mime: string): ResultPreviewKind { if (mime.startsWith("image/")) return "image"; if (mime.startsWith("audio/")) return "audio"; if (mime.startsWith("video/")) return "video"; return "file"; }

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function extensionOf(name: string) { return name.split(".").pop()?.toLowerCase() || ""; }
export function outputName(name: string, suffix: string, extension: string) { const base = name.replace(/\.[^.]+$/, "").replace(/[^\w\-.\u0600-\u06FF ]/g, "-").slice(0, 90) || "wasl-file"; return `${base}-${suffix}.${extension.replace(/^\./, "")}`; }
export function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1_000); }
export async function buildZip(results: LocalFileResult[]) { const zip = new JSZip(); for (const result of results) zip.file(result.name, new Uint8Array(await result.blob.arrayBuffer())); return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }); }
export async function downloadZip(results: LocalFileResult[], archiveName = "wasl-results.zip") { downloadBlob(await buildZip(results), archiveName); }
export async function dataUrl(file: Blob) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(reader.error); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); }); }

type MagicType = "pdf" | "jpeg" | "png" | "webp" | "gif" | "mp3" | "wav" | "ogg" | "mp4" | "webm" | "text" | "unknown";
export async function sniffMagic(file: File): Promise<MagicType> {
  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer()); const text = new TextDecoder().decode(header);
  if (text.startsWith("%PDF-")) return "pdf"; if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "jpeg";
  if (header[0] === 0x89 && text.slice(1, 4) === "PNG") return "png"; if (text.slice(0, 4) === "RIFF" && text.slice(8, 12) === "WEBP") return "webp";
  if (text.slice(0, 3) === "ID3" || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)) return "mp3"; if (text.slice(0, 4) === "RIFF" && text.slice(8, 12) === "WAVE") return "wav";
  if (text.slice(0, 4) === "OggS") return "ogg"; if (text.slice(4, 8) === "ftyp") return "mp4"; if (header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3) return "webm";
  if (file.type.startsWith("text/") || ["txt", "html", "htm", "rtf"].includes(extensionOf(file.name))) return "text";
  return "unknown";
}

export async function validateLocalFile(file: File, family: "pdf" | "image" | "document" | "ocr" | "audio" | "video", limitMb = 100) {
  if (file.size === 0) throw new Error("الملف فارغ ولا يمكن معالجته."); if (file.size > limitMb * 1024 * 1024) throw new Error(`الحد الأقصى لهذه الأداة هو ${limitMb} MB.`);
  const magic = await sniffMagic(file);
  const allowed: Record<typeof family, MagicType[]> = { pdf: ["pdf"], image: ["jpeg", "png", "webp"], document: ["text", "unknown"], ocr: ["pdf", "jpeg", "png", "webp"], audio: ["mp3", "wav", "ogg", "unknown"], video: ["mp4", "webm", "unknown"] };
  if (!allowed[family].includes(magic)) throw new Error("نوع الملف الفعلي غير مدعوم لهذه الأداة. تحقق من الملف ثم أعد المحاولة.");
  return magic;
}

export function sizeBucket(size: number) { return size < 1_000_000 ? "<1MB" : size < 10_000_000 ? "1-10MB" : size < 50_000_000 ? "10-50MB" : "50MB+"; }
