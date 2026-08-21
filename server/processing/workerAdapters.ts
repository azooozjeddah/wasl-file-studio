import type { ServerProcessingMode } from "./contracts";

export type WorkerAdapter = {
  key: string;
  capabilities: string[];
  enabled: boolean;
  run: (job: { publicId: string; toolSlug: string; mode: ServerProcessingMode }) => Promise<void>;
};

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
