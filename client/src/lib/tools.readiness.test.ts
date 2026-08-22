import { describe, expect, it } from "vitest";
import { featuredToolDefinitions } from "./tools";

describe("homepage tool prioritization", () => {
  it("promotes only established ready tools and demotes experimental or improving work", () => {
    expect(featuredToolDefinitions.length).toBeGreaterThan(0);
    featuredToolDefinitions.forEach(tool => {
      expect(tool.experimental).not.toBe(true);
      expect(tool.readiness).not.toBe("improving");
      expect(["code", "sign", "utility", "audio", "video"]).not.toContain(tool.category);
    });
  });
});
