import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";

const DEV_ADMIN_OPEN_ID = "dev_first_admin";
/** This guard deliberately ignores OAuth administrators: it only controls the one local development account. */
export function canBootstrapFirstAdmin(nodeEnv: string | undefined, developmentAdminExists: boolean) {
  return nodeEnv === "development" && !developmentAdminExists;
}

async function bootstrapState() {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة لإعداد المدير.");
  const [developmentAdmin] = await db.select({ id: users.id, openId: users.openId, name: users.name }).from(users).where(eq(users.openId, DEV_ADMIN_OPEN_ID)).limit(1);
  const [anyAdmin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  return { db, developmentAdmin, hasAdmin: Boolean(anyAdmin) };
}

export const devSetupRouter = router({
  status: publicProcedure.query(async () => {
    const { developmentAdmin, hasAdmin } = await bootstrapState(); const developmentMode = process.env.NODE_ENV === "development";
    return { developmentMode, canSetup: canBootstrapFirstAdmin(process.env.NODE_ENV, Boolean(developmentAdmin)), canLogin: developmentMode && Boolean(developmentAdmin), hasAdmin, hasDevelopmentAdmin: Boolean(developmentAdmin) };
  }),
  createFirstAdmin: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(80).default("مطور وَصل") })).mutation(async ({ ctx, input }) => {
    const { db, developmentAdmin } = await bootstrapState();
    if (!canBootstrapFirstAdmin(process.env.NODE_ENV, Boolean(developmentAdmin))) throw new Error("إعداد مدير التطوير متاح مرة واحدة في وضع التطوير فقط.");
    await db.insert(users).values({ openId: DEV_ADMIN_OPEN_ID, name: input.name, email: "dev-admin@local.invalid", loginMethod: "development-bootstrap", role: "admin", lastSignedIn: new Date() });
    const token = await sdk.createSessionToken(DEV_ADMIN_OPEN_ID, { name: input.name, expiresInMs: ONE_YEAR_MS });
    ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
    return { success: true, userName: input.name };
  }),
  developmentLogin: publicProcedure.mutation(async ({ ctx }) => {
    const { developmentAdmin } = await bootstrapState();
    if (process.env.NODE_ENV !== "development" || !developmentAdmin) throw new Error("دخول التطوير غير متاح خارج وضع التطوير أو قبل إعداد الحساب المحلي.");
    const token = await sdk.createSessionToken(DEV_ADMIN_OPEN_ID, { name: developmentAdmin.name || "مطور وَصل", expiresInMs: ONE_YEAR_MS });
    ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
    return { success: true };
  }),
});
