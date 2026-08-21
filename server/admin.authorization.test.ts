import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("admin authorization", () => {
  it("rejects an authenticated non-admin before querying dashboard data", async () => {
    const ctx = { user: { id: 2, openId: "member", email: "member@example.com", name: "Member", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    await expect(appRouter.createCaller(ctx).admin.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
