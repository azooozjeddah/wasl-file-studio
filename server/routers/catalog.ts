import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { adminRoles, adSlots, contentEntries, faqEntries, siteSettings, toolCatalog, userRoleAssignments, userToolPermissions } from "../../drizzle/schema";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";

export const catalogRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(toolCatalog).where(and(eq(toolCatalog.isActive, true), ne(toolCatalog.lifecycleStatus, "disabled"))).orderBy(asc(toolCatalog.sortOrder));
  }),
  availability: publicProcedure.input(z.object({ slug: z.string().min(2).max(80) })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [tool] = await db.select({ slug: toolCatalog.slug, isActive: toolCatalog.isActive, lifecycleStatus: toolCatalog.lifecycleStatus, nameAr: toolCatalog.nameAr, nameEn: toolCatalog.nameEn }).from(toolCatalog).where(eq(toolCatalog.slug, input.slug)).limit(1);
    if (!tool) return null;
    const [override] = ctx.user ? await db.select({ isAllowed: userToolPermissions.isAllowed }).from(userToolPermissions).where(and(eq(userToolPermissions.userId, ctx.user.id), eq(userToolPermissions.toolSlug, input.slug))).limit(1) : [];
    if (override?.isAllowed === false) return { ...tool, isAllowed: false };
    if (override?.isAllowed === true || !ctx.user) return { ...tool, isAllowed: true };
    const roles = await db.select({ permissions: adminRoles.permissions }).from(userRoleAssignments).innerJoin(adminRoles, eq(userRoleAssignments.roleId, adminRoles.id)).where(eq(userRoleAssignments.userId, ctx.user.id));
    const rolePermissions = roles.flatMap(role => role.permissions || []);
    const hasToolPolicy = rolePermissions.some(permission => permission === "tool:*" || permission.startsWith("tool:"));
    const isRoleAllowed = rolePermissions.includes("tool:*") || rolePermissions.includes(`tool:${input.slug}`);
    return { ...tool, isAllowed: !hasToolPolicy || isRoleAllowed };
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
