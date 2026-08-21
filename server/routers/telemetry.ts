import { z } from "zod";
import { analyticsEvents, errorLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";

const clean = (value: string | undefined, max: number) => value?.replace(/[\r\n<>]/g, " ").trim().slice(0, max) || undefined;

export const telemetryRouter = router({
  event: publicProcedure.input(z.object({ eventType: z.enum(["visit", "tool_open", "process_start", "process_success", "process_error"]), toolSlug: z.string().max(80).optional(), locale: z.enum(["ar", "en"]).optional(), platform: z.string().max(40).optional(), browser: z.string().max(40).optional(), processingMs: z.number().int().min(0).max(3_600_000).optional(), sizeBucket: z.string().max(20).optional() })).mutation(async ({ input }) => {
    const db = await getDb(); if (!db) return { recorded: false };
    await db.insert(analyticsEvents).values({ ...input, toolSlug: clean(input.toolSlug, 80), platform: clean(input.platform, 40), browser: clean(input.browser, 40), sizeBucket: clean(input.sizeBucket, 20) });
    return { recorded: true };
  }),
  error: publicProcedure.input(z.object({ toolSlug: z.string().max(80).optional(), errorCode: z.string().min(1).max(80), message: z.string().min(1).max(500) })).mutation(async ({ input }) => {
    const db = await getDb(); if (!db) return { recorded: false };
    await db.insert(errorLogs).values({ toolSlug: clean(input.toolSlug, 80), errorCode: clean(input.errorCode, 80)!, message: clean(input.message, 500)! });
    return { recorded: true };
  }),
});
