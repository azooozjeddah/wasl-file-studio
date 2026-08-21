import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Core identity table backed by Manus OAuth. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"), email: varchar("email", { length: 320 }), loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Central public identity. It stores settings only; file bytes never live in this database. */
export const siteSettings = mysqlTable("site_settings", {
  id: int("id").primaryKey(), siteName: varchar("siteName", { length: 120 }).notNull().default("وصل للملفات"), taglineAr: text("taglineAr"), taglineEn: text("taglineEn"), logoText: varchar("logoText", { length: 24 }).notNull().default("وصل"), accentColor: varchar("accentColor", { length: 24 }).notNull().default("#7157F8"),
  logoUrl: varchar("logoUrl", { length: 500 }), metaTitle: varchar("metaTitle", { length: 180 }), metaDescription: text("metaDescription"), supportEmail: varchar("supportEmail", { length: 320 }),
  defaultLocale: mysqlEnum("defaultLocale", ["ar", "en"]).notNull().default("ar"), defaultTheme: mysqlEnum("defaultTheme", ["light", "dark", "system"]).notNull().default("light"), adsEnabled: boolean("adsEnabled").notNull().default(false), analyticsEnabled: boolean("analyticsEnabled").notNull().default(true), localMaxFileMb: int("localMaxFileMb").notNull().default(100),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const toolCatalog = mysqlTable("tool_catalog", {
  id: int("id").autoincrement().primaryKey(), slug: varchar("slug", { length: 80 }).notNull().unique(), category: mysqlEnum("category", ["pdf", "image", "document", "ocr", "audio", "video"]).notNull(), nameAr: varchar("nameAr", { length: 140 }).notNull(), nameEn: varchar("nameEn", { length: 140 }).notNull(), descriptionAr: text("descriptionAr"), descriptionEn: text("descriptionEn"), icon: varchar("icon", { length: 40 }).notNull().default("FileCog"), processingMode: mysqlEnum("processingMode", ["local", "server-ready"]).notNull().default("local"), supportedFormats: json("supportedFormats").$type<string[]>().notNull(), sizeLimitMb: int("sizeLimitMb").notNull().default(100), sortOrder: int("sortOrder").notNull().default(0), isActive: boolean("isActive").notNull().default(true), isFeatured: boolean("isFeatured").notNull().default(false), showOnHome: boolean("showOnHome").notNull().default(true), seoTitleAr: varchar("seoTitleAr", { length: 180 }), seoTitleEn: varchar("seoTitleEn", { length: 180 }), seoDescriptionAr: text("seoDescriptionAr"), seoDescriptionEn: text("seoDescriptionEn"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contentEntries = mysqlTable("content_entries", {
  id: int("id").autoincrement().primaryKey(), contentKey: varchar("contentKey", { length: 100 }).notNull(), locale: mysqlEnum("locale", ["ar", "en"]).notNull().default("ar"), title: varchar("title", { length: 240 }).notNull(), body: text("body"), metaTitle: varchar("metaTitle", { length: 180 }), metaDescription: text("metaDescription"), updatedBy: int("updatedBy"), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Editable public FAQ, authored through the protected dashboard. */
export const faqEntries = mysqlTable("faq_entries", {
  id: int("id").autoincrement().primaryKey(), locale: mysqlEnum("locale", ["ar", "en"]).notNull().default("ar"), question: varchar("question", { length: 500 }).notNull(), answer: text("answer").notNull(), category: varchar("category", { length: 80 }).notNull().default("general"), sortOrder: int("sortOrder").notNull().default(0), isActive: boolean("isActive").notNull().default(true), updatedBy: int("updatedBy"), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const adSlots = mysqlTable("ad_slots", {
  id: int("id").autoincrement().primaryKey(), placement: mysqlEnum("placement", ["home_top", "home_between_tools", "tool_top", "tool_bottom", "mobile_sticky"]).notNull().unique(), label: varchar("label", { length: 100 }).notNull(), isEnabled: boolean("isEnabled").notNull().default(false), audience: mysqlEnum("audience", ["free", "all", "none"]).notNull().default("free"), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Aggregated or anonymous telemetry only. Do not persist names, file content, IPs, or user identifiers. */
export const analyticsEvents = mysqlTable("analytics_events", {
  id: int("id").autoincrement().primaryKey(), eventType: mysqlEnum("eventType", ["visit", "tool_open", "process_start", "process_success", "process_error"]).notNull(), toolSlug: varchar("toolSlug", { length: 80 }), locale: mysqlEnum("locale", ["ar", "en"]), platform: varchar("platform", { length: 40 }), browser: varchar("browser", { length: 40 }), processingMs: int("processingMs"), sizeBucket: varchar("sizeBucket", { length: 20 }), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const errorLogs = mysqlTable("error_logs", {
  id: int("id").autoincrement().primaryKey(), toolSlug: varchar("toolSlug", { length: 80 }), errorCode: varchar("errorCode", { length: 80 }).notNull(), message: varchar("message", { length: 500 }).notNull(), count: int("count").notNull().default(1), isResolved: boolean("isResolved").notNull().default(false), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Payment remains disabled. Plans and limits are stored now for a future billing connector. */
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(), code: mysqlEnum("code", ["free", "basic", "pro", "business"]).notNull().unique(), nameAr: varchar("nameAr", { length: 80 }).notNull(), nameEn: varchar("nameEn", { length: 80 }).notNull(), dailyOperations: int("dailyOperations").notNull().default(0), maxFileMb: int("maxFileMb").notNull().default(0), visibleAds: boolean("visibleAds").notNull().default(true), enabled: boolean("enabled").notNull().default(false), featureFlags: json("featureFlags").$type<string[]>().notNull(), toolSlugs: json("toolSlugs").$type<string[]>(), entitlements: json("entitlements").$type<Record<string, boolean | string | number>>(), planRank: int("planRank").notNull().default(0), usageWindow: mysqlEnum("usageWindow", ["daily", "monthly"]).notNull().default("daily"), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Extensible roles exist alongside the core login enum for granular future permissions. */
export const adminRoles = mysqlTable("admin_roles", {
  id: int("id").autoincrement().primaryKey(), code: varchar("code", { length: 64 }).notNull().unique(), nameAr: varchar("nameAr", { length: 100 }).notNull(), nameEn: varchar("nameEn", { length: 100 }).notNull(), description: text("description"), permissions: json("permissions").$type<string[]>().notNull(), isSystem: boolean("isSystem").notNull().default(false), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const userRoleAssignments = mysqlTable("user_role_assignments", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), roleId: int("roleId").notNull(), assignedBy: int("assignedBy"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Management actions only: no document payloads or customer file information. */
export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(), actorUserId: int("actorUserId").notNull(), action: varchar("action", { length: 100 }).notNull(), entityType: varchar("entityType", { length: 80 }).notNull(), entityId: varchar("entityId", { length: 80 }), summary: varchar("summary", { length: 500 }), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ToolCatalogItem = typeof toolCatalog.$inferSelect;
