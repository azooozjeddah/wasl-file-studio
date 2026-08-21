import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const dbMock = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }));
const sdkMock = vi.hoisted(() => ({ createSessionToken: vi.fn(async () => "development-session") }));
vi.mock("../db", () => ({ getDb: vi.fn(async () => dbMock) }));
vi.mock("../_core/sdk", () => ({ sdk: sdkMock }));
import { appRouter } from "../routers";

const selection = (rows: unknown[]) => ({ from: () => ({ where: () => ({ limit: async () => rows }) }) });
const cookie = vi.fn();
const context = { user: null, req: { protocol: "https", headers: {} }, res: { cookie } } as unknown as TrpcContext;

describe("development first-admin routes", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  beforeEach(() => { vi.clearAllMocks(); process.env.NODE_ENV = "development"; dbMock.insert.mockReturnValue({ values: vi.fn(async () => [{ insertId: 1 }]) }); });
  afterEach(() => { process.env.NODE_ENV = originalNodeEnv; });

  it("creates the dedicated development admin once even if an OAuth admin exists and issues a session cookie", async () => {
    dbMock.select.mockImplementationOnce(() => selection([])).mockImplementationOnce(() => selection([{ id: 77 }]));
    const result = await appRouter.createCaller(context).devSetup.createFirstAdmin({ name: "مدير التطوير" });
    expect(result).toEqual({ success: true, userName: "مدير التطوير" });
    expect(dbMock.insert).toHaveBeenCalledOnce(); expect(sdkMock.createSessionToken).toHaveBeenCalledWith("dev_first_admin", expect.any(Object)); expect(cookie).toHaveBeenCalledWith(expect.any(String), "development-session", expect.objectContaining({ httpOnly: true }));
  });

  it("rejects another bootstrap when the dedicated development account already exists", async () => {
    dbMock.select.mockImplementationOnce(() => selection([{ id: 1, openId: "dev_first_admin", name: "مدير" }])).mockImplementationOnce(() => selection([{ id: 1 }]));
    await expect(appRouter.createCaller(context).devSetup.createFirstAdmin({ name: "مدير جديد" })).rejects.toThrow("إعداد مدير التطوير");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects bootstrap in production and only logs into an existing development account", async () => {
    process.env.NODE_ENV = "production"; dbMock.select.mockImplementationOnce(() => selection([])).mockImplementationOnce(() => selection([]));
    await expect(appRouter.createCaller(context).devSetup.createFirstAdmin({ name: "محظور" })).rejects.toThrow("إعداد مدير التطوير");
    process.env.NODE_ENV = "development"; dbMock.select.mockImplementationOnce(() => selection([{ id: 1, openId: "dev_first_admin", name: "مدير" }])).mockImplementationOnce(() => selection([{ id: 1 }]));
    await expect(appRouter.createCaller(context).devSetup.developmentLogin()).resolves.toEqual({ success: true });
    expect(cookie).toHaveBeenCalled();
  });
});
