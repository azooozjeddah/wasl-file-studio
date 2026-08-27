import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { OFFICE_MAX_BASE64_LENGTH, officeOperations, processOfficeEncryption } from "../officeEncryption";

const officeEncryptionInput = z.object({
  operation: z.enum(officeOperations),
  fileName: z.string().min(5).max(180),
  contentType: z.string().min(3).max(180),
  inputBase64: z.string().min(4).max(OFFICE_MAX_BASE64_LENGTH),
  password: z.string().min(8).max(255),
});

export const officeEncryptionRouter = router({
  process: protectedProcedure.input(officeEncryptionInput).mutation(async ({ input }) => processOfficeEncryption(input)),
});
