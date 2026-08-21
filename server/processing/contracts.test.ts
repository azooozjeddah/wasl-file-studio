import { describe, expect, it } from "vitest";
import { boundedExpiry, canUseServerMode, effectiveServerLimit, privateSubjectHash, safeContentType, temporaryObjectPrefix } from "./contracts";

describe("hybrid processing contracts", () => {
  it("bounds retention, derives private prefixes, and normalizes content types", () => {
    const now = new Date("2026-08-21T00:00:00.000Z");
    expect(boundedExpiry(500, now).getTime() - now.getTime()).toBe(168 * 60 * 60 * 1000);
    expect(temporaryObjectPrefix("job_safe")).toBe("private-processing/job_safe");
    expect(safeContentType("IMAGE/PNG")).toBe("image/png"); expect(safeContentType("invalid content type")).toBe("application/octet-stream");
  });
  it("keeps server limits at the strictest tool, site, and plan value without exposing identifiers", () => {
    expect(effectiveServerLimit(500, 250, 50)).toBe(50 * 1024 * 1024); expect(canUseServerMode("hybrid")).toBe(true); expect(canUseServerMode("local")).toBe(false); expect(privateSubjectHash("open-id", "bucket")).not.toContain("open-id");
  });
});
