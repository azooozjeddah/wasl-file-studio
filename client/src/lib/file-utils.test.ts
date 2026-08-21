import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildZip, extensionOf, formatBytes, outputName, validateLocalFile } from "./file-utils";

describe("file utility naming", () => {
  it("creates a safe output name and preserves Arabic letters", () => expect(outputName("تقرير 2026.pdf", "merged", "pdf")).toBe("تقرير 2026-merged.pdf"));
  it("extracts extensions and formats file sizes", () => { expect(extensionOf("archive.tar.gz")).toBe("gz"); expect(formatBytes(1536)).toBe("1.5 KB"); });
  it("uses file signatures rather than a misleading filename", async () => { const spoofed = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01])], "not-a-pdf.pdf", { type: "application/pdf" }); await expect(validateLocalFile(spoofed, "pdf", 1)).rejects.toThrow("نوع الملف الفعلي"); });
  it("packages all generated outputs into a readable ZIP", async () => { const archive = await buildZip([{ name: "one.txt", blob: new Blob(["one"]), mime: "text/plain" }, { name: "two.txt", blob: new Blob(["two"]), mime: "text/plain" }]); const zip = await JSZip.loadAsync(new Uint8Array(await archive.arrayBuffer())); expect(Object.keys(zip.files).sort()).toEqual(["one.txt", "two.txt"]); });
});
