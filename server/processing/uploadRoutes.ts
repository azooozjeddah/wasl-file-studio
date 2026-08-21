import type { Express, Request, Response } from "express";
import express from "express";
import { eq } from "drizzle-orm";
import { processingJobEvents, processingJobs, temporaryFileReferences } from "../../drizzle/schema";
import { getDb } from "../db";
import { storageGetSignedUrl, storagePut } from "../storage";
import { sdk } from "../_core/sdk";
import { safeContentType, temporaryObjectPrefix } from "./contracts";
import { releaseExpiredTemporaryFiles } from "./cleanup";

async function ownedJob(req: Request, publicId: string) { const user = await sdk.authenticateRequest(req); const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة"); const [job] = await db.select().from(processingJobs).where(eq(processingJobs.publicId, publicId)).limit(1); if (!job || (job.ownerUserId !== user.id && user.role !== "admin")) throw new Error("الوظيفة غير متاحة"); return { db, user, job }; }
function replyError(res: Response, error: unknown) { const message = error instanceof Error ? error.message : "تعذر تنفيذ طلب المعالجة."; return res.status(message.includes("غير متاحة") ? 403 : 400).json({ error: message }); }

export function registerProcessingUploadRoutes(app: Express) {
  app.post("/api/processing/jobs/:publicId/upload", express.raw({ type: "application/octet-stream", limit: "260mb" }), async (req, res) => {
    try { const { db, job } = await ownedJob(req, req.params.publicId); if (!["queued", "uploading"].includes(job.state)) throw new Error("لا تقبل هذه الوظيفة رفعًا جديدًا."); const data = req.body as Buffer; if (!Buffer.isBuffer(data) || !data.length) throw new Error("لم يصل محتوى ملف صالح."); if (data.byteLength !== job.inputBytes) throw new Error("حجم الملف لا يطابق طلب الوظيفة."); const contentType = safeContentType(String(req.headers["content-type"] || job.inputMimeType)); await db.update(processingJobs).set({ state: "uploading", progress: 5 }).where(eq(processingJobs.id, job.id)); await db.insert(processingJobEvents).values({ jobId: job.id, eventType: "uploading", progress: 5, message: "بدأ رفع ملف مؤقت محمي." }); const stored = await storagePut(`${temporaryObjectPrefix(job.publicId)}/input.bin`, data, contentType); await db.insert(temporaryFileReferences).values({ jobId: job.id, objectKey: stored.key, purpose: "input", contentType, byteSize: data.byteLength, expiresAt: job.expiresAt }); await db.update(processingJobs).set({ state: "queued", progress: 10 }).where(eq(processingJobs.id, job.id)); await db.insert(processingJobEvents).values({ jobId: job.id, eventType: "queued", progress: 10, message: "اكتمل الرفع؛ تنتظر الوظيفة عامل المعالجة." }); res.json({ publicId: job.publicId, state: "queued", progress: 10 });
    } catch (error) { replyError(res, error); }
  });
  app.get("/api/processing/jobs/:publicId/result", async (req, res) => {
    try { const { db, job } = await ownedJob(req, req.params.publicId); if (job.state !== "completed" || job.expiresAt <= new Date()) throw new Error("النتيجة غير متاحة أو انتهت صلاحيتها."); const [result] = (await db.select().from(temporaryFileReferences).where(eq(temporaryFileReferences.jobId, job.id))).filter((ref: any) => ref.purpose === "result" && !ref.releasedAt); if (!result) throw new Error("لا توجد نتيجة مؤقتة متاحة."); res.redirect(302, await storageGetSignedUrl(result.objectKey));
    } catch (error) { replyError(res, error); }
  });
  app.post("/api/scheduled/processing-cleanup", async (req, res) => {
    try { const user = await sdk.authenticateRequest(req); if (!user.isCron) return res.status(403).json({ error: "cron-only" }); const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة"); res.json({ ok: true, ...(await releaseExpiredTemporaryFiles(db)) }); } catch (error) { const message = error instanceof Error ? error.message : "cleanup failed"; res.status(500).json({ error: message, timestamp: new Date().toISOString() }); }
  });
}
