import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMock = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }));
const authMock = vi.hoisted(() => ({ createWaslAccount: vi.fn(), createPasswordResetToken: vi.fn(), sendWaslAccountInviteEmail: vi.fn() }));

vi.mock("./db", () => ({ getDb: vi.fn(async () => dbMock) }));
vi.mock("./auth/waslAuth", () => authMock);

import { adminRouter } from "./routers/admin";

const now = new Date();
const adminContext = { user: { id: 1, openId: "admin", email: "admin@example.com", name: "Admin", loginMethod: "wasl_password", role: "admin" as const, waslAccount: true, accountStatus: "active" as const, createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: "https", get: () => "wasl.example" } as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
const memberContext = { ...adminContext, user: { ...adminContext.user, id: 2, openId: "member", role: "user" as const } } as TrpcContext;

function selectRows(rows: unknown[]) {
  const terminal = Object.assign(Promise.resolve(rows), { limit: async () => rows });
  return { from: () => ({ where: () => terminal, orderBy: () => ({ limit: async () => rows }) }) };
}

describe("admin user management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.insert.mockImplementation(() => ({ values: vi.fn(async () => [{ insertId: 77 }]) }));
    dbMock.update.mockImplementation(() => ({ set: () => ({ where: async () => undefined }) }));
    dbMock.delete.mockImplementation(() => ({ where: async () => undefined }));
  });

  it("rejects a normal user before any management operation", async () => {
    await expect(adminRouter.createCaller(memberContext).createUser({ name: "عضو جديد", email: "member@example.com", role: "user" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(authMock.createWaslAccount).not.toHaveBeenCalled();
  });

  it("creates a requested role with an opaque password and sends a one-time invitation", async () => {
    authMock.createWaslAccount.mockResolvedValue({ id: 77, name: "مدير جديد", email: "new-admin@example.com", role: "admin" });
    authMock.createPasswordResetToken.mockResolvedValue({ rawToken: "opaque-test-token", expiresAt: now });
    authMock.sendWaslAccountInviteEmail.mockResolvedValue(undefined);
    const result = await adminRouter.createCaller(adminContext).createUser({ name: "مدير جديد", email: "new-admin@example.com", role: "admin" });
    expect(result).toEqual({ id: 77, name: "مدير جديد", email: "new-admin@example.com", role: "admin" });
    expect(authMock.createWaslAccount).toHaveBeenCalledWith(expect.objectContaining({ name: "مدير جديد", email: "new-admin@example.com", role: "admin", password: expect.any(String) }));
    expect(authMock.createWaslAccount.mock.calls[0][0].password).not.toBe("opaque-test-token");
    expect(authMock.sendWaslAccountInviteEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "new-admin@example.com", role: "admin", setPasswordUrl: "https://wasl.example/login?token=opaque-test-token" }));
  });

  it("blocks demotion of the last active administrator", async () => {
    dbMock.select.mockImplementationOnce(() => selectRows([{ id: 1, role: "admin", accountStatus: "active" }])).mockImplementationOnce(() => selectRows([{ total: 1 }]));
    await expect(adminRouter.createCaller(adminContext).setPlatformRole({ userId: 9, role: "user" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("blocks suspension and deletion of the last active administrator", async () => {
    dbMock.select.mockImplementationOnce(() => selectRows([{ id: 9, role: "admin", accountStatus: "active" }])).mockImplementationOnce(() => selectRows([{ total: 1 }]));
    await expect(adminRouter.createCaller(adminContext).setUserAccountStatus({ userId: 9, accountStatus: "suspended" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    dbMock.select.mockImplementationOnce(() => selectRows([{ id: 9, role: "admin", accountStatus: "active" }])).mockImplementationOnce(() => selectRows([{ total: 1 }]));
    await expect(adminRouter.createCaller(adminContext).deleteUserAccount({ userId: 9 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it("cleans account-linked permissions and processing records before deleting a user", async () => {
    dbMock.select.mockImplementationOnce(() => selectRows([{ id: 42, role: "user", accountStatus: "active" }])).mockImplementationOnce(() => selectRows([{ id: 3 }, { id: 4 }]));
    await expect(adminRouter.createCaller(adminContext).deleteUserAccount({ userId: 42 })).resolves.toEqual({ success: true });
    expect(dbMock.delete).toHaveBeenCalledTimes(9);
  });
});
