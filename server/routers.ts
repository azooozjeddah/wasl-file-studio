import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { clearWaslSession } from "./auth/waslAuth";
import { processingRouter } from "./routers/processing";
import { adminRouter } from "./routers/admin";
import { catalogRouter } from "./routers/catalog";
import { telemetryRouter } from "./routers/telemetry";
import { devSetupRouter } from "./routers/devSetup";
import { waslAuthRouter } from "./routers/waslAuth";

export const appRouter = router({
  system: systemRouter,
  auth: router({ me: publicProcedure.query(opts => opts.ctx.user ? { id: opts.ctx.user.id, name: opts.ctx.user.name, email: opts.ctx.user.email, role: opts.ctx.user.role } : null), logout: publicProcedure.mutation(({ ctx }) => { clearWaslSession(ctx.req, ctx.res); return { success: true } as const; }) }),
  waslAuth: waslAuthRouter,
  processing: processingRouter,
  catalog: catalogRouter,
  telemetry: telemetryRouter,
  admin: adminRouter,
  devSetup: devSetupRouter,
});

export type AppRouter = typeof appRouter;
