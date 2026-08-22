import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { adSlots, contentEntries, faqEntries, siteSettings, toolCatalog } from "../../drizzle/schema";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";

export const catalogRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(toolCatalog).where(eq(toolCatalog.isActive, true)).orderBy(asc(toolCatalog.sortOrder));
  }),
  availability: publicProcedure.input(z.object({ slug: z.string().min(2).max(80) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const [tool] = await db.select({ slug: toolCatalog.slug, isActive: toolCatalog.isActive, nameAr: toolCatalog.nameAr, nameEn: toolCatalog.nameEn }).from(toolCatalog).where(eq(toolCatalog.slug, input.slug)).limit(1);
    return tool || null;
  }),
  settings: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { analyticsEnabled: true, localMaxFileMb: 100, serverProcessingEnabled: false, serverMaxFileMb: 250, defaultProcessingMode: "local" as const, siteName: "وصل للملفات", logoText: "وصل", logoUrl: null, accentColor: "#7157F8", metaTitle: null, metaDescription: null, supportEmail: null, adsEnabled: false };
    const settings = await db.select({ analyticsEnabled: siteSettings.analyticsEnabled, localMaxFileMb: siteSettings.localMaxFileMb, serverProcessingEnabled: siteSettings.serverProcessingEnabled, serverMaxFileMb: siteSettings.serverMaxFileMb, defaultProcessingMode: siteSettings.defaultProcessingMode, siteName: siteSettings.siteName, logoText: siteSettings.logoText, logoUrl: siteSettings.logoUrl, accentColor: siteSettings.accentColor, metaTitle: siteSettings.metaTitle, metaDescription: siteSettings.metaDescription, supportEmail: siteSettings.supportEmail, adsEnabled: siteSettings.adsEnabled }).from(siteSettings).limit(1);
    return settings[0] || { analyticsEnabled: true, localMaxFileMb: 100, serverProcessingEnabled: false, serverMaxFileMb: 250, defaultProcessingMode: "local" as const, siteName: "وصل للملفات", logoText: "وصل", logoUrl: null, accentColor: "#7157F8", metaTitle: null, metaDescription: null, supportEmail: null, adsEnabled: false };
  }),
  publicFaq: publicProcedure.input(z.object({ locale: z.enum(["ar", "en"]) })).query(async ({ input }) => { const db = await getDb(); if (!db) return []; return db.select().from(faqEntries).where(and(eq(faqEntries.locale, input.locale), eq(faqEntries.isActive, true))).orderBy(asc(faqEntries.sortOrder)); }),
  publicContent: publicProcedure.input(z.object({ contentKey: z.string().min(2).max(100), locale: z.enum(["ar", "en"]) })).query(async ({ input }) => { const db = await getDb(); if (!db) return []; return db.select().from(contentEntries).where(and(eq(contentEntries.contentKey, input.contentKey), eq(contentEntries.locale, input.locale))).orderBy(asc(contentEntries.updatedAt)); }),
  publicAdSlots: publicProcedure.input(z.object({ placement: z.enum(["home_top", "home_between_tools", "tool_top", "tool_bottom", "mobile_sticky"]) })).query(async ({ input }) => { const db = await getDb(); if (!db) return []; const settings = await db.select({ adsEnabled: siteSettings.adsEnabled }).from(siteSettings).limit(1); if (!settings[0]?.adsEnabled) return []; return db.select().from(adSlots).where(and(eq(adSlots.placement, input.placement), eq(adSlots.isEnabled, true))); }),
});
