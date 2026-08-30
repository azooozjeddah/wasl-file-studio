import type { Express } from "express";
import { and, eq, ne } from "drizzle-orm";
import { toolCatalog } from "../drizzle/schema";
import { getDb } from "./db";
import { siteCategoryForTool, siteToolCategories } from "../client/src/lib/site-categories";
import { toolDefinitions } from "../client/src/lib/tools";

export const PUBLIC_SITE_ORIGIN = "https://waselfile.com";

const STATIC_APP_PATHS = new Set([
  "/",
  "/tools",
  "/dashboard",
  "/login",
  "/register",
  "/account/security",
  "/admin",
  "/admin/users",
  "/admin/processing",
  "/first-admin",
  "/privacy",
  "/terms",
  "/about",
  "/contact",
  "/404",
]);

const normalizePathname = (pathname: string) => {
  const withoutTrailingSlash = pathname.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
};

export function isKnownAppRoute(pathname: string) {
  const normalized = normalizePathname(pathname);
  if (STATIC_APP_PATHS.has(normalized)) return true;
  if (normalized.startsWith("/tools/")) {
    return siteToolCategories.some(category => normalized === `/tools/${category.slug}`);
  }
  return toolDefinitions.some(tool => normalized === `/${tool.slug}`);
}

export function publicSeoPaths(activeToolSlugs = toolDefinitions.map(tool => tool.slug)) {
  const active = new Set(activeToolSlugs);
  const publicTools = toolDefinitions.filter(tool => active.has(tool.slug) && !tool.experimental && tool.readiness !== "improving");
  const categoryPaths = siteToolCategories
    .filter(category => publicTools.some(tool => siteCategoryForTool(tool) === category.id))
    .map(category => `/tools/${category.slug}`);
  return [
    "/",
    "/tools",
    ...categoryPaths,
    ...publicTools.map(tool => `/${tool.slug}`),
    "/about",
    "/contact",
    "/terms",
    "/privacy",
  ];
}

export function buildSitemapXml(activeToolSlugs = toolDefinitions.map(tool => tool.slug)) {
  const urls = publicSeoPaths(activeToolSlugs)
    .map(pathname => `  <url><loc>${PUBLIC_SITE_ORIGIN}${pathname}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /login
Disallow: /register
Disallow: /dashboard
Disallow: /account/
Disallow: /first-admin
Disallow: /api/
Sitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml
`;

/** Serve crawl metadata before static/fallback middleware can substitute a historical domain. */
export function registerSeoRoutes(app: Pick<Express, "get">) {
  app.get("/robots.txt", (_request, response) => {
    response.type("text/plain").set("Cache-Control", "public, max-age=300").send(robotsTxt);
  });

  app.get("/sitemap.xml", async (_request, response) => {
    let activeToolSlugs = toolDefinitions.map(tool => tool.slug);
    try {
      const db = await getDb();
      if (db) {
        const rows = await db
          .select({ slug: toolCatalog.slug })
          .from(toolCatalog)
          .where(and(eq(toolCatalog.isActive, true), ne(toolCatalog.lifecycleStatus, "disabled")));
        if (rows.length > 0) activeToolSlugs = rows.map(row => row.slug);
      }
    } catch (error) {
      console.warn("[SEO] Could not read catalog for sitemap; using static public tool definitions.", error);
    }
    response.type("application/xml").set("Cache-Control", "public, max-age=300").send(buildSitemapXml(activeToolSlugs));
  });
}
