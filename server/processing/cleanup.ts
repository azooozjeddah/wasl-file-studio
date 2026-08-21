import { eq } from "drizzle-orm";
import { processingJobs, temporaryFileReferences } from "../../drizzle/schema";

/** Drops expired private object references. The managed storage layer treats unreferenced keys as effectively gone. */
export async function releaseExpiredTemporaryFiles(db: any, now = new Date()) {
  const refs = await db.select().from(temporaryFileReferences); const expiredRefs = refs.filter((ref: any) => !ref.releasedAt && ref.expiresAt <= now);
  for (const ref of expiredRefs) await db.delete(temporaryFileReferences).where(eq(temporaryFileReferences.id, ref.id));
  const jobs = await db.select().from(processingJobs); const expiredJobs = jobs.filter((job: any) => job.expiresAt <= now && !["expired", "cancelled"].includes(job.state));
  for (const job of expiredJobs) await db.update(processingJobs).set({ state: "expired", errorCode: job.state === "completed" ? null : "RETENTION_EXPIRED", errorMessage: job.state === "completed" ? null : "انتهت صلاحية الوظيفة قبل اكتمالها." }).where(eq(processingJobs.id, job.id));
  return { releasedReferences: expiredRefs.length, expiredJobs: expiredJobs.length };
}
