export type ToolVisualTone = "pdf" | "word" | "sheet" | "image" | "media" | "qr" | "scan" | "utility";

export function toolVisualTone(slug: string, category: string): ToolVisualTone {
  if (slug.includes("qr") || slug.includes("barcode")) return "qr";
  if (slug.includes("ocr") || slug.includes("extract-text")) return "scan";
  if (slug.includes("excel") || slug.includes("xlsx") || slug.includes("csv") || category === "spreadsheet") return "sheet";
  if (slug.includes("word") || slug.includes("document") || slug.includes("txt") || slug.includes("html") || slug.includes("rtf") || slug.includes("pptx")) return "word";
  if (slug.includes("image") || slug.includes("photo") || slug.includes("resize") || slug.includes("crop") || slug.includes("blur")) return "image";
  if (slug.includes("audio") || slug.includes("video") || category === "audio" || category === "video") return "media";
  if (slug.includes("pdf") || slug.includes("sign") || slug.includes("merge") || slug.includes("split") || slug.includes("watermark") || category === "pdf") return "pdf";
  return "utility";
}
