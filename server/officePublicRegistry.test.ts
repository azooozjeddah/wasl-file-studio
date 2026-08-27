import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isOfficeTool, officeToolSlugs, toolDefinitions } from "../client/src/lib/tools";

describe("Office public registry", () => {
  it("adds exactly six ready server Office tools to the original 56 definitions", () => {
    const officeTools = toolDefinitions.filter((tool) => isOfficeTool(tool.slug));
    const otherTools = toolDefinitions.filter((tool) => !isOfficeTool(tool.slug));
    expect(toolDefinitions).toHaveLength(62);
    expect(otherTools).toHaveLength(56);
    expect(new Set(officeTools.map((tool) => tool.slug))).toEqual(new Set(officeToolSlugs));
    expect(new Set(toolDefinitions.map((tool) => tool.slug)).size).toBe(62);
    for (const tool of officeTools) {
      expect(tool.processingMode).toBe("server");
      expect(tool.local).toBe(false);
      expect(tool.experimental).not.toBe(true);
      expect(tool.readiness).not.toBe("improving");
    }
  });

  it("exposes Office from public pages and removes the Admin-only route and guards", async () => {
    const root = process.cwd();
    const [home, index, category, app, dashboard, toolPage, workspace, router] = await Promise.all([
      readFile(resolve(root, "client/src/pages/Home.tsx"), "utf8"),
      readFile(resolve(root, "client/src/pages/ToolsIndexPage.tsx"), "utf8"),
      readFile(resolve(root, "client/src/pages/ToolCategoryPage.tsx"), "utf8"),
      readFile(resolve(root, "client/src/App.tsx"), "utf8"),
      readFile(resolve(root, "client/src/components/DashboardLayout.tsx"), "utf8"),
      readFile(resolve(root, "client/src/pages/ToolPage.tsx"), "utf8"),
      readFile(resolve(root, "client/src/components/OfficeEncryptionWorkspace.tsx"), "utf8"),
      readFile(resolve(root, "server/routers/officeEncryption.ts"), "utf8"),
    ]);
    expect(home).toContain("catalog.publicHomeTools");
    expect(home).toContain("isOfficeTool");
    expect(index).toContain("catalog.publicHomeTools");
    expect(index).toContain("isOfficeTool");
    expect(category).toContain("catalog.publicHomeTools");
    expect(app).not.toContain('path="/admin/office"');
    expect(dashboard).not.toContain("Office الداخلي");
    expect(toolPage).toContain("isOfficeTool(tool.slug) ? <OfficeEncryptionWorkspace");
    expect(toolPage.indexOf("isOfficeTool(tool.slug)")).toBeLessThan(toolPage.indexOf('tool.category === "spreadsheet"'));
    expect(workspace).not.toContain('auth.data.role !== "admin"');
    expect(workspace).not.toContain("متاحة للمدير فقط");
    expect(router).toContain("protectedProcedure");
    expect(router).not.toContain("adminProcedure");
  });
});
