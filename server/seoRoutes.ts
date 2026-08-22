import type { Express } from "express";

export const PUBLIC_SITE_ORIGIN = "https://waslfile-b7bks7br.manus.space";

export const robotsTxt = `User-agent: *
Allow: /
Sitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml
`;

export const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${PUBLIC_SITE_ORIGIN}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${PUBLIC_SITE_ORIGIN}/privacy</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>${PUBLIC_SITE_ORIGIN}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>${PUBLIC_SITE_ORIGIN}/merge-pdf</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${PUBLIC_SITE_ORIGIN}/compress-pdf</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${PUBLIC_SITE_ORIGIN}/convert-image</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
</urlset>`;

/** Serve crawl metadata before static/fallback middleware can substitute a historical domain. */
export function registerSeoRoutes(app: Pick<Express, "get">) {
  app.get("/robots.txt", (_request, response) => {
    response.type("text/plain").set("Cache-Control", "public, max-age=300").send(robotsTxt);
  });

  app.get("/sitemap.xml", (_request, response) => {
    response.type("application/xml").set("Cache-Control", "public, max-age=300").send(sitemapXml);
  });
}
