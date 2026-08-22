import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const values = vi.fn(); const insert = vi.fn(() => ({ values }));
vi.mock("../db", () => ({ getDb: vi.fn(async () => ({ insert })) }));

import { contactRouter } from "./contact";

const ctx = { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("contact router", () => {
  beforeEach(() => { vi.clearAllMocks(); values.mockResolvedValue(undefined); });
  it("stores only the structured text message submitted by the public form", async () => {
    await expect(contactRouter.createCaller(ctx).submit({ name: "مستخدم اختبار", email: "user@wasl.test", subject: "سؤال", message: "هذه رسالة نصية آمنة لا تتضمن ملفًا مرفقًا." })).resolves.toEqual({ success: true });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ name: "مستخدم اختبار", email: "user@wasl.test", subject: "سؤال" }));
    expect(values.mock.calls[0][0]).not.toHaveProperty("file");
    expect(values.mock.calls[0][0]).not.toHaveProperty("attachment");
  });
});
