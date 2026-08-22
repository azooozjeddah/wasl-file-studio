import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { changeWaslPassword, clearWaslSession, createPasswordResetToken, createWaslAccount, createWaslSession, getWaslUserByEmail, hasWaslAdmin, resetWaslPassword, sendPasswordResetEmail, toWaslPublicUser, touchWaslUser, validateWaslPassword, verifyWaslPassword, writeWaslSession } from "../auth/waslAuth";

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
  changePassword: publicProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), nextPassword: z.string().min(10).max(128) })).mutation(async ({ input, ctx }) => {
    if (!ctx.user) throw authError("سجل الدخول أولًا لتغيير كلمة المرور.");
    try { await changeWaslPassword(ctx.user, input.currentPassword, input.nextPassword); return { success: true } as const; } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر تغيير كلمة المرور." }); }
  }),
  requestPasswordReset: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).mutation(async ({ input, ctx }) => {
    const accepted = { accepted: true } as const;
    const user = await getWaslUserByEmail(input.email);
    if (!user || !user.waslAccount || user.accountStatus !== "active") return accepted;
    try {
      const { rawToken } = await createPasswordResetToken(user);
      const baseUrl = `${ctx.req.protocol}://${ctx.req.get("host")}`;
      await sendPasswordResetEmail({ to: user.email!, resetUrl: `${baseUrl}/login?token=${encodeURIComponent(rawToken)}` });
    } catch { /* Always preserve the same external response to avoid account enumeration. */ }
    return accepted;
  }),
  resetPassword: publicProcedure.input(z.object({ token: z.string().min(20).max(200), nextPassword: z.string().min(10).max(128) })).mutation(async ({ input }) => {
    try { await resetWaslPassword(input.token, input.nextPassword); return { success: true } as const; } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر إعادة تعيين كلمة المرور." }); }
  }),
  logout: publicProcedure.mutation(({ ctx }) => { clearWaslSession(ctx.req, ctx.res); return { success: true } as const; }),
});
