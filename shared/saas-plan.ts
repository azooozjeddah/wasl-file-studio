export type PlanCode = "free" | "basic" | "pro" | "business";
export type PlanEntitlements = {
  code: PlanCode;
  dailyOperations: number;
  maxFileMb: number;
  visibleAds: boolean;
  enabled: boolean;
  toolSlugs?: string[] | null;
  entitlements?: Record<string, boolean | string | number> | null;
  usageWindow: "daily" | "monthly";
};

/** Pure entitlement helpers: billing can be attached later without changing product rules. */
export function canUseTool(plan: PlanEntitlements, toolSlug: string) {
  return !plan.toolSlugs?.length || plan.toolSlugs.includes(toolSlug);
}

export function isWithinFileLimit(plan: PlanEntitlements, bytes: number) {
  return plan.maxFileMb === 0 || bytes <= plan.maxFileMb * 1024 * 1024;
}

export function canRunOperation(plan: PlanEntitlements, usedOperations: number) {
  return plan.dailyOperations === 0 || usedOperations < plan.dailyOperations;
}

export function shouldShowAds(plan: PlanEntitlements, placementAudience: "free" | "all" | "none") {
  if (placementAudience === "none" || !plan.visibleAds) return false;
  return placementAudience === "all" || plan.code === "free";
}

export function featureEnabled(plan: PlanEntitlements, flag: string) {
  return plan.entitlements?.[flag] === true;
}
