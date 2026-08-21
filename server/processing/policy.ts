export type AssignedPlan = { planCode: "free" | "basic" | "pro" | "business"; status: "active" | "paused" | "expired" } | undefined;

export function activePlanCode(assignment: AssignedPlan): "free" | "basic" | "pro" | "business" { return assignment?.status === "active" ? assignment.planCode : "free"; }
export function effectiveQuota(planOperations: number | undefined) { return planOperations && planOperations > 0 ? planOperations : 10; }
export function hasQuota(usedOperations: number | undefined, quota: number) { return (usedOperations || 0) < quota; }
export function mayReadJob(ownerUserId: number, requesterUserId: number, requesterRole: "admin" | "user") { return ownerUserId === requesterUserId || requesterRole === "admin"; }
export function mayExposeTemporaryResult(state: string, expiresAt: Date, hasPrivateResult: boolean, now = new Date()) { return state === "completed" && expiresAt > now && hasPrivateResult; }
