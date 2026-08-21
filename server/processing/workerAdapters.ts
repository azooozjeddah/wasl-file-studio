import type { ServerProcessingMode } from "./contracts";

export type WorkerAdapter = {
  key: string;
  capabilities: string[];
  enabled: boolean;
  run: (job: { publicId: string; toolSlug: string; mode: ServerProcessingMode }) => Promise<void>;
};
export type WorkerPoolMember = { workerKey: string; status: "offline" | "ready" | "busy" | "degraded"; capabilities: string[]; queueDepth: number; lastHeartbeatAt?: Date | null };

/** Adapters describe integration points only. They intentionally reject work until a server runtime is configured. */
const disabled = (key: string, capabilities: string[]): WorkerAdapter => ({
  key, capabilities, enabled: false,
  async run() { throw new Error(`المحرك ${key} غير مفعّل. أضف عامل الخادم المفتوح المصدر ثم فعّل المعالجة الخادمية.`); },
});

export const workerAdapters: WorkerAdapter[] = [
  disabled("libreoffice", ["word-to-pdf", "pdf-to-word"]),
  disabled("tesseract-server", ["ocr-ar", "ocr-en"]),
  disabled("ffmpeg-server", ["audio", "video", "heavy-media"]),
  disabled("pdf-engine-server", ["pdf", "large-pdf"]),
];
export function getWorkerAdapter(key: string) { return workerAdapters.find(adapter => adapter.key === key); }
/** Stable adapter selection keeps queued jobs independent from any individual worker process. */
export function adapterKeyForTool(toolSlug: string, category: string) {
  if (["word-to-pdf", "pdf-to-word"].includes(toolSlug)) return "libreoffice";
  if (toolSlug === "ocr" || category === "ocr") return "tesseract-server";
  if (["audio", "video"].includes(category)) return "ffmpeg-server";
  return "pdf-engine-server";
}
/** Future workers are independent processes. This selection is deterministic, fair, and has no side effects. */
export function selectReadyWorker(workers: WorkerPoolMember[], requiredAdapter: string) {
  return workers
    .filter(worker => worker.status === "ready" && worker.capabilities.includes(requiredAdapter))
    .sort((left, right) => left.queueDepth - right.queueDepth || left.workerKey.localeCompare(right.workerKey))[0];
}
