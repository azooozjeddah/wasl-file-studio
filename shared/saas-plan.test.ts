import { describe, expect, it } from "vitest";
import { canRunOperation, canUseTool, featureEnabled, isWithinFileLimit, shouldShowAds, type PlanEntitlements } from "./saas-plan";

const freePlan: PlanEntitlements = { code: "free", dailyOperations: 3, maxFileMb: 25, visibleAds: true, enabled: false, toolSlugs: ["merge-pdf", "compress-image"], entitlements: { batch: false }, usageWindow: "daily" };
const proPlan: PlanEntitlements = { code: "pro", dailyOperations: 0, maxFileMb: 500, visibleAds: false, enabled: false, toolSlugs: [], entitlements: { batch: true, priority_processing: true }, usageWindow: "monthly" };

describe("SaaS plan entitlement helpers", () => {
  it("enforces explicit free-tool and file limits", () => { expect(canUseTool(freePlan, "merge-pdf")).toBe(true); expect(canUseTool(freePlan, "video-to-mp3")).toBe(false); expect(isWithinFileLimit(freePlan, 25 * 1024 * 1024)).toBe(true); expect(isWithinFileLimit(freePlan, 25 * 1024 * 1024 + 1)).toBe(false); });
  it("treats zero limits as unrestricted for a future paid plan", () => { expect(canUseTool(proPlan, "video-to-mp3")).toBe(true); expect(canRunOperation(proPlan, 99999)).toBe(true); expect(featureEnabled(proPlan, "batch")).toBe(true); });
  it("keeps advertising logic separate from payment activation", () => { expect(shouldShowAds(freePlan, "free")).toBe(true); expect(shouldShowAds(proPlan, "free")).toBe(false); expect(shouldShowAds(freePlan, "none")).toBe(false); });
});
