import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { adSlots, analyticsEvents, contentEntries, errorLogs, siteSettings, subscriptionPlans, toolCatalog } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, router } from "../_core/trpc";

const toolInput = z.object({
  id: z.number().optional(), slug: z.string().min(2).max(80),
  category: z.enum(["pdf", "image", "document", "ocr", "audio", "video"]),
  nameAr: z.string().min(2).max(140), nameEn: z.string().min(2).max(140),
  descriptionAr: z.string().max(2000).optional(), descriptionEn: z.string().max(2000).optional(),
  icon: z.string().max(40).default("FileCog"), processingMode: z.enum(["local", "server-ready"]),
  supportedFormats: z.array(z.string()).max(20), sizeLimitMb: z.number().int().min(1).max(2048),
  sortOrder: z.number().int().min(0), isActive: z.boolean(), isFeatured: z.boolean(), showOnHome: z.boolean(),
  seoTitleAr: z.string().max(180).optional(), seoTitleEn: z.string().max(180).optional(),
  seoDescriptionAr: z.string().max(500).optional(), seoDescriptionEn: z.string().max(500).optional(),
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة حاليًا" });
  return db;
}

export const adminRouter = router({
  dashboard: adminProcedure.query(async () => {
    const db = await dbOrThrow();
    const [tools, events, errors] = await Promise.all([
      db.select().from(toolCatalog), db.select().from(analyticsEvents), db.select().from(errorLogs).orderBy(desc(errorLogs.updatedAt)).limit(12),
    ]);
    const successful = events.filter(event => event.eventType === "process_success").length;
    const failed = events.filter(event => event.eventType === "process_error").length;
    const usage = tools.map(tool => ({
      slug: tool.slug, nameAr: tool.nameAr,
      count: events.filter(event => event.toolSlug === tool.slug && event.eventType === "process_success").length,
    })).sort((a, b) => b.count - a.count);
    const days = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(); date.setDate(date.getDate() - (6 - offset)); const key = date.toISOString().slice(0, 10);
      const dayEvents = events.filter(event => event.createdAt.toISOString().slice(0, 10) === key);
      return { key, label: key.slice(5), operations: dayEvents.filter(event => event.eventType === "process_success" || event.eventType === "process_error").length, visits: dayEvents.filter(event => event.eventType === "visit").length };
    });
    return { totalEvents: events.length, processedFiles: successful + failed, successful, failed, activeTools: tools.filter(tool => tool.isActive).length, usage, days, recentErrors: errors };
  }),
  tools: adminProcedure.query(async () => (await dbOrThrow()).select().from(toolCatalog).orderBy(toolCatalog.sortOrder)),
  saveTool: adminProcedure.input(toolInput).mutation(async ({ input }) => {
    const db = await dbOrThrow();
    const { id, ...values } = input;
    if (id) { await db.update(toolCatalog).set(values).where(eq(toolCatalog.id, id)); return { id }; }
    const result = await db.insert(toolCatalog).values(values);
    return { id: Number(result[0].insertId) };
  }),
  syncTools: adminProcedure.input(z.array(toolInput.omit({ id: true })).max(80)).mutation(async ({ input }) => {
    const db = await dbOrThrow();
    for (const tool of input) await db.insert(toolCatalog).values(tool).onDuplicateKeyUpdate({ set: tool });
    return { synchronized: input.length };
  }),
  settings: adminProcedure.query(async () => (await dbOrThrow()).select().from(siteSettings).limit(1)),
  saveSettings: adminProcedure.input(z.object({ siteName: z.string().min(2).max(120), taglineAr: z.string().max(500).optional(), taglineEn: z.string().max(500).optional(), logoText: z.string().min(1).max(24), accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), defaultLocale: z.enum(["ar", "en"]), defaultTheme: z.enum(["light", "dark", "system"]), adsEnabled: z.boolean(), analyticsEnabled: z.boolean(), localMaxFileMb: z.number().int().min(5).max(2048) })).mutation(async ({ input }) => {
    const db = await dbOrThrow();
    const exists = await db.select({ id: siteSettings.id }).from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
    if (exists[0]) await db.update(siteSettings).set(input).where(eq(siteSettings.id, 1)); else await db.insert(siteSettings).values({ id: 1, ...input });
    return { success: true };
  }),
  content: adminProcedure.query(async () => (await dbOrThrow()).select().from(contentEntries).orderBy(desc(contentEntries.updatedAt))),
  saveContent: adminProcedure.input(z.object({ id: z.number().optional(), contentKey: z.string().min(2).max(100), locale: z.enum(["ar", "en"]), title: z.string().min(1).max(240), body: z.string().max(20000).optional(), metaTitle: z.string().max(180).optional(), metaDescription: z.string().max(500).optional() })).mutation(async ({ input, ctx }) => {
    const db = await dbOrThrow(); const { id, ...values } = input;
    if (id) await db.update(contentEntries).set({ ...values, updatedBy: ctx.user.id }).where(eq(contentEntries.id, id)); else await db.insert(contentEntries).values({ ...values, updatedBy: ctx.user.id });
    return { success: true };
  }),
  adSlots: adminProcedure.query(async () => (await dbOrThrow()).select().from(adSlots)),
  saveAdSlot: adminProcedure.input(z.object({ id: z.number().optional(), placement: z.enum(["home_top", "home_between_tools", "tool_top", "tool_bottom", "mobile_sticky"]), label: z.string().min(2).max(100), isEnabled: z.boolean(), audience: z.enum(["free", "all", "none"]) })).mutation(async ({ input }) => {
    const db = await dbOrThrow(); const { id, ...values } = input;
    if (id) await db.update(adSlots).set(values).where(eq(adSlots.id, id)); else await db.insert(adSlots).values(values).onDuplicateKeyUpdate({ set: values });
    return { success: true };
  }),
  plans: adminProcedure.query(async () => (await dbOrThrow()).select().from(subscriptionPlans)),
  savePlan: adminProcedure.input(z.object({ id: z.number().optional(), code: z.enum(["free", "basic", "pro", "business"]), nameAr: z.string().min(2).max(80), nameEn: z.string().min(2).max(80), dailyOperations: z.number().int().min(0), maxFileMb: z.number().int().min(0), visibleAds: z.boolean(), enabled: z.boolean(), featureFlags: z.array(z.string()).max(30) })).mutation(async ({ input }) => {
    const db = await dbOrThrow(); const { id, ...values } = input;
    if (id) await db.update(subscriptionPlans).set(values).where(eq(subscriptionPlans.id, id)); else await db.insert(subscriptionPlans).values(values).onDuplicateKeyUpdate({ set: values });
    return { success: true };
  }),
});
