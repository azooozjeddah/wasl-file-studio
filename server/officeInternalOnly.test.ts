import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { internalOfficeTools, officeOperations } from "../client/src/lib/internal-office-tools";
import { toolDefinitions } from "../client/src/lib/tools";

describe("Office internal-only registry", () => {
  it("keeps all six Office operations outside the public tool registry and its Catalog sync source", () => {
    const publicSlugs = new Set(toolDefinitions.map(tool => tool.slug));
    expect(internalOfficeTools.map(tool => tool.slug)).toEqual([...officeOperations]);
    expect(internalOfficeTools).toHaveLength(6);
    for (const slug of officeOperations) expect(publicSlugs.has(slug)).toBe(false);
  });

  it("keeps public catalog pages independent of the internal Office registry and exposes a dedicated Admin-only route", async () => {
    const root = process.cwd();
    const [home, index, category, adminRoute, adminOffice] = await Promise.all([
      readFile(resolve(root, "client/src/pages/Home.tsx"), "utf8"),
      readFile(resolve(root, "client/src/pages/ToolsIndexPage.tsx"), "utf8"),
      readFile(resolve(root, "client/src/pages/ToolCategoryPage.tsx"), "utf8"),
      readFile(resolve(root, "client/src/App.tsx"), "utf8"),
      readFile(resolve(root, "client/src/pages/AdminOfficeEncryptionPage.tsx"), "utf8"),
    ]);
    expect(home).toContain("catalog.publicHomeTools");
    expect(index).toContain("catalog.publicHomeTools");
    expect(category).toContain("catalog.publicHomeTools");
    expect(home).not.toContain("internalOfficeTools");
    expect(index).not.toContain("internalOfficeTools");
    expect(category).not.toContain("internalOfficeTools");
    expect(adminRoute).toContain('path="/admin/office"');
    expect(adminRoute).not.toContain('path="/protect-word"');
    expect(adminOffice).toContain('!user || user.role !== "admin"');
  });
});
