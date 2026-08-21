import { asc, eq } from "drizzle-orm";
import { toolCatalog } from "../../drizzle/schema";
import { siteSettings } from "../../drizzle/schema";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";

export const catalogRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(toolCatalog).where(eq(toolCatalog.isActive, true)).orderBy(asc(toolCatalog.sortOrder));
  }),
  settings: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { analyticsEnabled: true, localMaxFileMb: 100 };
    const settings = await db.select({ analyticsEnabled: siteSettings.analyticsEnabled, localMaxFileMb: siteSettings.localMaxFileMb }).from(siteSettings).limit(1);
    return settings[0] || { analyticsEnabled: true, localMaxFileMb: 100 };
  }),
});
