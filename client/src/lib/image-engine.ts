import { LocalFileResult, outputName } from "./file-utils";

export type ImageOptions = { outputType?: "image/jpeg" | "image/png" | "image/webp"; quality?: number; width?: number; height?: number; keepAspect?: boolean; crop?: { x: number; y: number; width: number; height: number }; rotation?: number; flipX?: boolean; flipY?: boolean };
const typeToExtension = (type: string) => type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";

function outputTypeFor(file: File, slug: string, selected?: ImageOptions["outputType"]) {
  if (selected) return selected; if (slug === "compress-image" || slug === "convert-image") return "image/webp";
  return file.type === "image/png" ? "image/png" : "image/jpeg";
}

async function renderImage(file: File, options: ImageOptions, slug: string) {
  const bitmap = await createImageBitmap(file); const crop = options.crop || { x: 0, y: 0, width: bitmap.width, height: bitmap.height }; const angle = ((options.rotation || 0) % 360 + 360) % 360;
  let width = options.width || crop.width; let height = options.height || crop.height;
  if (options.keepAspect && options.width && !options.height) height = Math.round(crop.height * (options.width / crop.width)); if (options.keepAspect && options.height && !options.width) width = Math.round(crop.width * (options.height / crop.height));
  const swap = angle === 90 || angle === 270; const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(swap ? height : width)); canvas.height = Math.max(1, Math.round(swap ? width : height)); const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate((angle * Math.PI) / 180); ctx.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1); ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, -width / 2, -height / 2, width, height);
  const type = outputTypeFor(file, slug, options.outputType); const quality = options.quality ?? .82; const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value: Blob | null) => value ? resolve(value) : reject(new Error("تعذر إنشاء الصورة الناتجة.")), type, quality)); return { blob, type, width: canvas.width, height: canvas.height };
}

export async function transformImages(files: File[], slug: string, options: ImageOptions, report?: (fraction: number) => void): Promise<LocalFileResult[]> {
  const results: LocalFileResult[] = []; for (let index = 0; index < files.length; index += 1) { const file = files[index]; const transformed = await renderImage(file, options, slug);
    if (slug === "compress-image" && transformed.blob.size >= file.size) results.push({ name: outputName(file.name, "original-retained", file.name.split(".").pop() || "image"), blob: file, mime: file.type, label: "original-retained", details: { originalSize: file.size, width: transformed.width, height: transformed.height, compression: "original-retained" } });
    else results.push({ name: outputName(file.name, slug.replace(/-/g, "-"), typeToExtension(transformed.type)), blob: transformed.blob, mime: transformed.type, details: { originalSize: file.size, width: transformed.width, height: transformed.height, metadata: "stripped-by-reencode", compression: slug === "compress-image" ? "re-encoded" : undefined } });
    report?.((index + 1) / files.length); }
  return results;
}
