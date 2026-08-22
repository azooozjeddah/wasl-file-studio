import { LocalFileResult, outputName } from "./file-utils";

const ffmpegWorkerURL = "/__wasl__/ffmpeg/worker.js?v=0.12.10";
type Progress = (fraction: number) => void;
type MediaOptions = { bitrate: string; start: number; end: number; resolution: string; fps: string };
let ffmpegInstance: any;
export const FFMPEG_CORE_BASE = "vite-local-esm-worker";
export const FFMPEG_LOAD_TIMEOUT_MS = 15_000;

export function cancelMediaProcessing() {
  if (!ffmpegInstance?.ffmpeg) return;
  ffmpegInstance.ffmpeg.terminate();
  ffmpegInstance = undefined;
}

async function getFfmpeg(report?: Progress) {
  if (ffmpegInstance) return ffmpegInstance;
  const worker = new Worker(ffmpegWorkerURL, { type: "module" });
  let requestId = 0;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (reason?: unknown) => void }>();
  const ffmpeg = {
    call(type: "load" | "writeFile" | "exec" | "readFile" | "deleteFile", data?: unknown, transfer: Transferable[] = []) {
      const id = ++requestId;
      return new Promise<any>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, type, data }, transfer);
      });
    },
    writeFile(path: string, bytes: Uint8Array) {
      return this.call("writeFile", { path, bytes }, [bytes.buffer]);
    },
    exec(args: string[]) {
      return this.call("exec", { args });
    },
    readFile(path: string) {
      return this.call("readFile", { path });
    },
    deleteFile(path: string) {
      return this.call("deleteFile", { path });
    },
    terminate() {
      worker.terminate();
      pending.forEach(({ reject }) => reject(new Error("تم إلغاء معالجة الوسائط.")));
      pending.clear();
    },
  };
  worker.onmessage = ({ data }) => {
    if (data.type === "progress") {
      report?.(Math.max(.02, Math.min(.98, data.data?.progress ?? 0)));
      return;
    }
    if (data.type === "log") return;
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    data.ok ? request.resolve(data.data) : request.reject(new Error(data.error || "تعذر تشغيل محرك الوسائط المحلي."));
  };
  worker.onerror = () => {
    pending.forEach(({ reject }) => reject(new Error("تعذر تشغيل عامل الوسائط المحلي.")));
    pending.clear();
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ffmpeg.call("load"),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("انتهت مهلة تحميل محرك الوسائط المحلي. جرّب متصفحًا حديثًا أو أعد المحاولة.")), FFMPEG_LOAD_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    ffmpeg.terminate();
    console.error("[Wasl] FFmpeg local engine failed to load", error);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
  ffmpegInstance = { ffmpeg, fetchFile: async (file: File) => new Uint8Array(await file.arrayBuffer()) }; return ffmpegInstance;
}

const outputMime = (extension: string) => ({ mp3: "audio/mpeg", wav: "audio/wav", webm: "video/webm", mp4: "video/mp4", png: "image/png" } as Record<string, string>)[extension] || "application/octet-stream";
async function run(file: File, args: string[], suffix: string, extension: string, report?: Progress) {
  const { ffmpeg, fetchFile } = await getFfmpeg(report); const input = `input-${Date.now()}.${file.name.split(".").pop() || "bin"}`; const output = `output-${Date.now()}.${extension}`;
  await ffmpeg.writeFile(input, await fetchFile(file)); await ffmpeg.exec(args.map(arg => arg === "$INPUT" ? input : arg === "$OUTPUT" ? output : arg)); const data = await ffmpeg.readFile(output); await ffmpeg.deleteFile(input); await ffmpeg.deleteFile(output);
  return { name: outputName(file.name, suffix, extension), blob: new Blob([data], { type: outputMime(extension) }), mime: outputMime(extension), details: { originalSize: file.size } } satisfies LocalFileResult;
}

export async function processMedia(files: File[], slug: string, options: MediaOptions, report?: Progress): Promise<LocalFileResult[]> {
  if (slug === "merge-audio") {
    const { ffmpeg, fetchFile } = await getFfmpeg(report); const names: string[] = []; for (let index = 0; index < files.length; index += 1) { const name = `part-${index}.${files[index].name.split(".").pop() || "audio"}`; names.push(name); await ffmpeg.writeFile(name, await fetchFile(files[index])); }
    const output = `merged-${Date.now()}.mp3`; const inputs = names.flatMap(name => ["-i", name]); await ffmpeg.exec([...inputs, "-filter_complex", `concat=n=${names.length}:v=0:a=1`, "-b:a", options.bitrate || "128k", "$OUTPUT".replace("$OUTPUT", output)]); const data = await ffmpeg.readFile(output); await Promise.all([...names, output].map(name => ffmpeg.deleteFile(name))); return [{ name: outputName(files[0].name, "merged", "mp3"), blob: new Blob([data], { type: "audio/mpeg" }), mime: "audio/mpeg", details: { originalSize: files.reduce((sum, file) => sum + file.size, 0) } }];
  }
  if (slug === "extract-frame") return [await extractFrame(files[0], options.start || 0)];
  if (slug === "video-to-mp3") return [await run(files[0], ["-i", "$INPUT", "-vn", "-b:a", options.bitrate || "128k", "$OUTPUT"], "audio", "mp3", report)];
  if (slug === "mp4-to-webm") return [await run(files[0], ["-i", "$INPUT", "-c:v", "libvpx-vp9", "-b:v", "1M", "-c:a", "libopus", "$OUTPUT"], "webm", "webm", report)];
  if (slug === "webm-to-mp4") return [await run(files[0], ["-i", "$INPUT", "-c:v", "libx264", "-c:a", "aac", "$OUTPUT"], "mp4", "mp4", report)];
  if (slug === "compress-video") return [await run(files[0], ["-i", "$INPUT", "-vf", `scale=${options.resolution || "1280:-2"}`, "-r", options.fps || "30", "-c:v", "libx264", "-crf", "29", "-c:a", "aac", "-b:a", options.bitrate || "128k", "$OUTPUT"], "compressed", "mp4", report)];
  if (slug === "trim-video") return [await run(files[0], ["-ss", String(options.start || 0), "-to", String(options.end || 15), "-i", "$INPUT", "-c", "copy", "$OUTPUT"], "trimmed", "mp4", report)];
  if (slug === "convert-audio") return [await run(files[0], ["-i", "$INPUT", "-b:a", options.bitrate || "128k", "$OUTPUT"], "converted", "mp3", report)];
  if (slug === "trim-audio") return [await run(files[0], ["-ss", String(options.start || 0), "-to", String(options.end || 15), "-i", "$INPUT", "-b:a", options.bitrate || "128k", "$OUTPUT"], "trimmed", "mp3", report)];
  throw new Error("هذه العملية غير مدعومة بعد في محرك الوسائط المحلي.");
}

export async function mediaInfo(file: File): Promise<LocalFileResult> {
  const url = URL.createObjectURL(file); const isVideo = file.type.startsWith("video/"); const element = document.createElement(isVideo ? "video" : "audio") as HTMLVideoElement; element.preload = "metadata";
  const details = await new Promise<Record<string, string | number>>((resolve, reject) => { element.onloadedmetadata = () => resolve({ name: file.name, type: file.type || "unknown", size: file.size, durationSeconds: Number(element.duration.toFixed(2)), ...(isVideo ? { width: element.videoWidth, height: element.videoHeight } : {}) }); element.onerror = () => reject(new Error("تعذر قراءة معلومات الوسائط.")); element.src = url; }); URL.revokeObjectURL(url);
  return { name: outputName(file.name, "info", "txt"), blob: new Blob([Object.entries(details).map(([key, value]) => `${key}: ${value}`).join("\n")], { type: "text/plain" }), mime: "text/plain", details };
}

async function extractFrame(file: File, seconds: number): Promise<LocalFileResult> {
  const url = URL.createObjectURL(file); const video = document.createElement("video"); video.preload = "metadata"; video.muted = true;
  await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => { video.currentTime = Math.min(Math.max(seconds, 0), Math.max(0, video.duration - .05)); }; video.onseeked = () => resolve(); video.onerror = () => reject(new Error("تعذر استخراج الإطار من الفيديو.")); video.src = url; });
  const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext("2d")!.drawImage(video, 0, 0); URL.revokeObjectURL(url); const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value: Blob | null) => value ? resolve(value) : reject(new Error("تعذر إنشاء الصورة.")), "image/png")); return { name: outputName(file.name, "frame", "png"), blob, mime: "image/png", details: { originalSize: file.size, frameAt: seconds } };
}
