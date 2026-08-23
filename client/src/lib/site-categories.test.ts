import { describe, expect, it } from "vitest";
import { toolDefinitions } from "./tools";
import { siteCategoryForTool, siteToolCategories, toolsForSiteCategory } from "./site-categories";

describe("site information architecture", () => {
  it("assigns every existing tool to exactly one public category", () => {
    const assignedSlugs = siteToolCategories.flatMap((category) =>
      toolsForSiteCategory(category.id).map((tool) => tool.slug),
    );

    expect(new Set(assignedSlugs).size).toBe(assignedSlugs.length);
    expect(new Set(assignedSlugs)).toEqual(new Set(toolDefinitions.map((tool) => tool.slug)));
  });

  it("keeps category routes unique and each tool aligned to its displayed group", () => {
    const slugs = siteToolCategories.map((category) => category.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const category of siteToolCategories) {
      for (const tool of toolsForSiteCategory(category.id)) {
        expect(siteCategoryForTool(tool)).toBe(category.id);
      }
    }
  });
});
