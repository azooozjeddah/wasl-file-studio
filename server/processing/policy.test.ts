import { describe, expect, it } from "vitest";
import { activePlanCode, effectiveQuota, hasQuota, mayExposeTemporaryResult, mayReadJob } from "./policy";
describe("server processing policy", () => {
  it("falls back to free when an assignment is not active", () => { expect(activePlanCode({ planCode: "pro", status: "paused" })).toBe("free"); expect(activePlanCode({ planCode: "business", status: "active" })).toBe("business"); });
  it("enforces quotas without treating zero as unlimited", () => { expect(effectiveQuota(0)).toBe(10); expect(hasQuota(9, 10)).toBe(true); expect(hasQuota(10, 10)).toBe(false); });
  it("never exposes a temporary result to another regular user or after expiry", () => { const future = new Date(Date.now() + 1000); const past = new Date(Date.now() - 1000); expect(mayReadJob(3, 4, "user")).toBe(false); expect(mayReadJob(3, 4, "admin")).toBe(true); expect(mayExposeTemporaryResult("completed", future, true)).toBe(true); expect(mayExposeTemporaryResult("completed", past, true)).toBe(false); expect(mayExposeTemporaryResult("processing", future, true)).toBe(false); });
});
