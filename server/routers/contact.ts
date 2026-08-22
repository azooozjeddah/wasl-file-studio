import { z } from "zod";
import { contactMessages } from "../../drizzle/schema";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";

const messageInput = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(320), subject: z.string().trim().min(3).max(180), message: z.string().trim().min(10).max(5000) });

export const contactRouter = router({
  submit: publicProcedure.input(messageInput).mutation(async ({ input }) => {
    const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
    await db.insert(contactMessages).values(input);
    return { success: true } as const;
  }),
});
