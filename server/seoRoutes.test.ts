import { describe, expect, it } from "vitest";
import { buildSitemapXml, isKnownAppRoute, PUBLIC_SITE_ORIGIN, robotsTxt } from "./seoRoutes";

describe("SEO P0 routes", () => {
  it("uses the official origin and includes only public route families", () => {
    const sitemap = buildSitemapXml(["merge-pdf", "protect-pdf", "html-to-pdf"]);
    expect(sitemap).toContain(`${PUBLIC_SITE_ORIGIN}/`);
    expect(sitemap).toContain(`${PUBLIC_SITE_ORIGIN}/tools`);
    expect(sitemap).toContain(`${PUBLIC_SITE_ORIGIN}/tools/pdf`);
    expect(sitemap).toContain(`${PUBLIC_SITE_ORIGIN}/merge-pdf`);
    expect(sitemap).toContain(`${PUBLIC_SITE_ORIGIN}/protect-pdf`);
    expect(sitemap).not.toContain("html-to-pdf");
    expect(sitemap).not.toContain("manus.space");
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/login");
  });

  it("keeps private paths out of robots crawling while leaving public tools crawlable", () => {
    expect(robotsTxt).toContain(`Sitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml`);
    expect(robotsTxt).toContain("Allow: /");
    expect(robotsTxt).toContain("Disallow: /admin");
    expect(robotsTxt).toContain("Disallow: /api/");
    expect(robotsTxt).not.toContain("Disallow: /tools");
  });

  it("recognizes existing SPA routes and rejects unknown paths", () => {
    expect(isKnownAppRoute("/")).toBe(true);
    expect(isKnownAppRoute("/tools")).toBe(true);
    expect(isKnownAppRoute("/tools/pdf")).toBe(true);
    expect(isKnownAppRoute("/merge-pdf")).toBe(true);
    expect(isKnownAppRoute("/merge-pdf/")).toBe(true);
    expect(isKnownAppRoute("/not-a-real-route")).toBe(false);
    expect(isKnownAppRoute("/tools/not-a-real-category")).toBe(false);
  });
});
