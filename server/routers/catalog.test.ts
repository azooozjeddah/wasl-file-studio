import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const dbMock = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("../db", () => ({ getDb: vi.fn(async () => dbMock) }));
import { appRouter } from "../routers";

const publicContext = { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("public tool availability", () => {
  it("returns a stored inactive state and lifecycle evidence so the public route can block processing honestly", async () => {
    dbMock.select.mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [{ slug: "merge-pdf", isActive: false, lifecycleStatus: "maintenance", lifecycleReasonAr: "اختبار قيد المراجعة", lastTestResult: "لم يكتمل القبول", lastTestedAt: null, nameAr: "دمج PDF", nameEn: "Merge PDF" }] }) }) }));
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.catalog.availability({ slug: "merge-pdf" })).resolves.toMatchObject({ slug: "merge-pdf", isActive: false, lifecycleStatus: "maintenance", lifecycleReasonAr: "اختبار قيد المراجعة", lastTestResult: "لم يكتمل القبول" });
  });
});
