import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const fakeAdmin = { id: 7, name: "Admin", email: "admin@wasl.test", role: "admin" as const, createdAt: new Date(), lastSignedIn: new Date() };
const fakeUser = { id: 8, name: "User", email: "user@wasl.test", role: "user" as const, createdAt: new Date(), lastSignedIn: new Date() };
const account = { id: 7, openId: "wasl_test", name: "Admin", email: "admin@wasl.test", loginMethod: "wasl_password", passwordHash: "hash", waslAccount: true, accountStatus: "active" as const, role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

vi.mock("../auth/waslAuth", () => ({
  hasWaslAdmin: vi.fn(), createWaslAccount: vi.fn(), createWaslSession: vi.fn(), getWaslUserByEmail: vi.fn(), toWaslPublicUser: vi.fn(), touchWaslUser: vi.fn(), validateWaslPassword: vi.fn(), verifyWaslPassword: vi.fn(), writeWaslSession: vi.fn(), clearWaslSession: vi.fn(),
}));

import * as auth from "../auth/waslAuth";
import { waslAuthRouter } from "./waslAuth";

const ctx = { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("waslAuth router", () => {
  beforeEach(() => vi.clearAllMocks());
  it("bootstraps only the first admin and starts a Wasl session", async () => {
    vi.mocked(auth.hasWaslAdmin).mockResolvedValue(false);
    vi.mocked(auth.validateWaslPassword).mockReturnValue(true);
    vi.mocked(auth.createWaslAccount).mockResolvedValue(account);
    vi.mocked(auth.createWaslSession).mockResolvedValue("wasl-token");
    vi.mocked(auth.toWaslPublicUser).mockReturnValue(fakeAdmin as never);
    const result = await waslAuthRouter.createCaller(ctx).bootstrapAdmin({ name: "Admin", email: "admin@wasl.test", password: "valid-password" });
    expect(result).toEqual(fakeAdmin);
    expect(auth.createWaslAccount).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }));
    expect(auth.writeWaslSession).toHaveBeenCalledWith(ctx.req, ctx.res, "wasl-token");
  });
  it("logs in a Wasl account and never returns account internals", async () => {
    vi.mocked(auth.getWaslUserByEmail).mockResolvedValue(account);
    vi.mocked(auth.verifyWaslPassword).mockResolvedValue(true);
    vi.mocked(auth.createWaslSession).mockResolvedValue("wasl-token");
    vi.mocked(auth.toWaslPublicUser).mockReturnValue(fakeUser as never);
    const result = await waslAuthRouter.createCaller(ctx).login({ email: "admin@wasl.test", password: "valid-password" });
    expect(result).toEqual(fakeUser);
    expect(auth.touchWaslUser).toHaveBeenCalledWith(7);
    expect(auth.writeWaslSession).toHaveBeenCalledWith(ctx.req, ctx.res, "wasl-token");
    expect(result).not.toHaveProperty("passwordHash");
  });
});
