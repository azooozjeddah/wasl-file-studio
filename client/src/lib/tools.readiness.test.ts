import { describe, expect, it } from "vitest";
import { featuredToolDefinitions, findTool, toolDefinitions, toolIconFor } from "./tools";

describe("homepage tool prioritization", () => {
  it("promotes only established ready tools and demotes experimental or improving work", () => {
    expect(featuredToolDefinitions.length).toBeGreaterThan(0);
    featuredToolDefinitions.forEach(tool => {
      expect(tool.experimental).not.toBe(true);
      expect(tool.readiness).not.toBe("improving");
      expect(["code", "sign", "utility", "audio", "video"]).not.toContain(tool.category);
    });
  });

  it("keeps PowerPoint deferred until a verified local conversion path exists and removes the linear barcode definition", () => {
    expect(findTool("pptx-to-pdf")).toMatchObject({ category: "document", local: true, experimental: true, readiness: "improving" });
    expect(findTool("barcode-generator")).toBeUndefined();
    expect(toolDefinitions.some(tool => tool.slug === "barcode-generator")).toBe(false);
    expect(toolIconFor("pptx-to-pdf", findTool("pptx-to-pdf")!.icon)).toBeDefined();
  });
});
