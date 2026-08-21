import { createHash, randomUUID } from "node:crypto";

export const jobStates = ["queued", "uploading", "processing", "completed", "failed", "cancelled", "expired"] as const;
export type JobState = (typeof jobStates)[number];
export type ServerProcessingMode = "server" | "hybrid";

export function publicJobId() { return `job_${randomUUID().replaceAll("-", "")}`; }
export function processingWindowKey(date = new Date()) { return date.toISOString().slice(0, 10); }
export function privateSubjectHash(openId: string, bucketKey: string) { return createHash("sha256").update(`${openId}:${bucketKey}`).digest("hex"); }
export function boundedExpiry(retentionHours: number, now = new Date()) { const safeHours = Math.min(168, Math.max(1, retentionHours)); return new Date(now.getTime() + safeHours * 60 * 60 * 1000); }
export function temporaryObjectPrefix(jobPublicId: string) { return `private-processing/${jobPublicId}`; }
export function safeContentType(contentType: string) { return /^[a-z]+\/[a-z0-9.+-]+$/i.test(contentType) ? contentType.toLowerCase() : "application/octet-stream"; }
export function effectiveServerLimit(toolLimitMb: number, globalLimitMb: number, planLimitMb: number) { return Math.max(1, Math.min(toolLimitMb, globalLimitMb, planLimitMb || globalLimitMb)) * 1024 * 1024; }
export function canUseServerMode(mode: string) { return mode === "server" || mode === "hybrid"; }
