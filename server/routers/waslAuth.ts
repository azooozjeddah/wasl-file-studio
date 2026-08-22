import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { clearWaslSession, createWaslAccount, createWaslSession, getWaslUserByEmail, hasWaslAdmin, toWaslPublicUser, touchWaslUser, validateWaslPassword, verifyWaslPassword, writeWaslSession } from "../auth/waslAuth";

const credentials = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(320), password: z.string().min(10).max(128) });

function authError(message: string) { return new TRPCError({ code: "UNAUTHORIZED", message }); }

export const waslAuthRouter = router({
  status: publicProcedure.query(async () => ({ setupRequired: !(await hasWaslAdmin()) })),
  me: publicProcedure.query(({ ctx }) => ctx.user ? toWaslPublicUser(ctx.user) : null),
  register: publicProcedure.input(credentials).mutation(async ({ input, ctx }) => {
    if (!validateWaslPassword(input.password)) throw new TRPCError({ code: "BAD_REQUEST", message: "كلمة المرور يجب أن تكون 10 أحرف على الأقل." });
    try {
      const user = await createWaslAccount(input);
      writeWaslSession(ctx.req, ctx.res, await createWaslSession(user));
      return toWaslPublicUser(user);
    } catch (error) {
      throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "تعذر إنشاء الحساب." });
    }
  }),
  bootstrapAdmin: publicProcedure.input(credentials).mutation(async ({ input, ctx }) => {
    if (await hasWaslAdmin()) throw new TRPCError({ code: "FORBIDDEN", message: "تمت تهيئة مدير وصل بالفعل." });
    try {
      const user = await createWaslAccount({ ...input, role: "admin" });
      writeWaslSession(ctx.req, ctx.res, await createWaslSession(user));
      return toWaslPublicUser(user);
    } catch (error) {
      throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "تعذر تهيئة المدير." });
    }
  }),
  login: publicProcedure.input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
    const user = await getWaslUserByEmail(input.email);
    if (!user || !user.waslAccount || user.accountStatus !== "active" || !(await verifyWaslPassword(input.password, user.passwordHash))) throw authError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    await touchWaslUser(user.id);
    writeWaslSession(ctx.req, ctx.res, await createWaslSession(user));
    return toWaslPublicUser(user);
  }),
  logout: publicProcedure.mutation(({ ctx }) => { clearWaslSession(ctx.req, ctx.res); return { success: true } as const; }),
});
