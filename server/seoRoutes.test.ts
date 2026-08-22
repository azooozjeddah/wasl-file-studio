import { describe, expect, it } from "vitest";
import { PUBLIC_SITE_ORIGIN, robotsTxt, sitemapXml } from "./seoRoutes";

describe("production SEO route documents", () => {
  it("uses the active origin in robots and sitemap documents", () => {
    expect(robotsTxt).toContain(`Sitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml`);
    expect(sitemapXml).toContain(`<loc>${PUBLIC_SITE_ORIGIN}/merge-pdf</loc>`);
    expect(robotsTxt).not.toContain("wasl-file-studio.manus.space");
    expect(sitemapXml).not.toContain("wasl-file-studio.manus.space");
  });
});
