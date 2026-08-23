import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildZip, extensionOf, formatBytes, outputName, resultPreviewKind, validateLocalFile } from "./file-utils";

describe("file utility naming", () => {
  it("creates a safe output name and preserves Arabic letters", () => expect(outputName("تقرير 2026.pdf", "merged", "pdf")).toBe("تقرير 2026-merged.pdf"));
  it("extracts extensions and formats file sizes", () => { expect(extensionOf("archive.tar.gz")).toBe("gz"); expect(formatBytes(1536)).toBe("1.5 KB"); });
  it("uses file signatures rather than a misleading filename", async () => { const spoofed = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01])], "not-a-pdf.pdf", { type: "application/pdf" }); await expect(validateLocalFile(spoofed, "pdf", 1)).rejects.toThrow("نوع الملف الفعلي"); });
  it("accepts a real DOCX package as a local document but not a generic ZIP", async () => { const archive = new JSZip(); archive.file("[Content_Types].xml", "<Types />"); const bytes = await archive.generateAsync({ type: "uint8array" }); const docx = new File([bytes], "sample.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }); const zip = new File([bytes], "sample.zip", { type: "application/zip" }); await expect(validateLocalFile(docx, "document", 1)).resolves.toBe("zip"); await expect(validateLocalFile(zip, "document", 1)).rejects.toThrow("DOCX"); });
  it("packages all generated outputs into a readable ZIP", async () => { const archive = await buildZip([{ name: "one.txt", blob: new Blob(["one"]), mime: "text/plain" }, { name: "two.txt", blob: new Blob(["two"]), mime: "text/plain" }]); const zip = await JSZip.loadAsync(new Uint8Array(await archive.arrayBuffer())); expect(Object.keys(zip.files).sort()).toEqual(["one.txt", "two.txt"]); });
  it("classifies batch-result media for safe previews", () => { expect(resultPreviewKind("image/webp")).toBe("image"); expect(resultPreviewKind("audio/mpeg")).toBe("audio"); expect(resultPreviewKind("video/mp4")).toBe("video"); expect(resultPreviewKind("application/pdf")).toBe("file"); });
});
