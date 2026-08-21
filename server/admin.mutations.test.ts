import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(), insert: vi.fn(), update: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: vi.fn(async () => dbMock) }));
import { appRouter } from "./routers";

const chain = () => ({ from: () => ({ where: () => ({ limit: async () => [] }), orderBy: async () => [] }) });
const adminContext = { user: { id: 9, openId: "admin", email: "admin@example.com", name: "Admin", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("admin mutations", () => {
  beforeEach(() => { vi.clearAllMocks(); dbMock.select.mockImplementation(chain); dbMock.insert.mockImplementation(() => ({ values: vi.fn(async () => [{ insertId: 41 }]) })); dbMock.update.mockImplementation(() => ({ set: () => ({ where: async () => undefined }) })); });
  it("persists operational management inputs and writes audit rows", async () => {
    const caller = appRouter.createCaller(adminContext);
    await expect(caller.admin.saveTool({ slug: "merge-pdf", category: "pdf", nameAr: "دمج PDF", nameEn: "Merge PDF", descriptionAr: "دمج محلي", descriptionEn: "Local merge", icon: "FileCog", processingMode: "local", supportedFormats: ["PDF"], sizeLimitMb: 100, sortOrder: 0, isActive: true, isFeatured: true, showOnHome: true, seoTitleAr: "دمج PDF", seoTitleEn: "Merge PDF", seoDescriptionAr: "", seoDescriptionEn: "" })).resolves.toEqual({ id: 41 });
    await expect(caller.admin.reorderTools([{ id: 41, sortOrder: 0 }])).resolves.toEqual({ success: true });
    await expect(caller.admin.saveSettings({ siteName: "وصل", taglineAr: "", taglineEn: "", logoText: "وصل", logoUrl: "", accentColor: "#7157F8", metaTitle: "", metaDescription: "", supportEmail: "", defaultLocale: "ar", defaultTheme: "light", adsEnabled: false, analyticsEnabled: true, localMaxFileMb: 100 })).resolves.toEqual({ success: true });
    await expect(caller.admin.saveFaq({ locale: "ar", question: "هل تعمل محليًا؟", answer: "نعم، بحسب الأداة.", category: "privacy", sortOrder: 0, isActive: true })).resolves.toEqual({ success: true });
    await expect(caller.admin.savePlan({ code: "free", nameAr: "مجانية", nameEn: "Free", dailyOperations: 3, maxFileMb: 25, visibleAds: true, enabled: false, featureFlags: [], toolSlugs: ["merge-pdf"], entitlements: { batch: false }, planRank: 0, usageWindow: "daily" })).resolves.toEqual({ success: true });
    await expect(caller.admin.saveRole({ code: "content_editor", nameAr: "محرر محتوى", nameEn: "Content editor", description: "", permissions: ["content.manage"], isSystem: false })).resolves.toEqual({ success: true });
    await expect(caller.admin.resolveError({ id: 1, isResolved: true })).resolves.toEqual({ success: true });
    expect(dbMock.insert).toHaveBeenCalled(); expect(dbMock.update).toHaveBeenCalled();
  });
});
