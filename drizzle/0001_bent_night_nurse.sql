CREATE TABLE `ad_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`placement` enum('home_top','home_between_tools','tool_top','tool_bottom','mobile_sticky') NOT NULL,
	`label` varchar(100) NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT false,
	`audience` enum('free','all','none') NOT NULL DEFAULT 'free',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `ad_slots_placement_unique` UNIQUE(`placement`)
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` enum('visit','tool_open','process_start','process_success','process_error') NOT NULL,
	`toolSlug` varchar(80),
	`locale` enum('ar','en'),
	`platform` varchar(40),
	`browser` varchar(40),
	`processingMs` int,
	`sizeBucket` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentKey` varchar(100) NOT NULL,
	`locale` enum('ar','en') NOT NULL DEFAULT 'ar',
	`title` varchar(240) NOT NULL,
	`body` text,
	`metaTitle` varchar(180),
	`metaDescription` text,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `error_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`toolSlug` varchar(80),
	`errorCode` varchar(80) NOT NULL,
	`message` varchar(500) NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	`isResolved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `error_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` int NOT NULL,
	`siteName` varchar(120) NOT NULL DEFAULT 'وصل للملفات',
	`taglineAr` text,
	`taglineEn` text,
	`logoText` varchar(24) NOT NULL DEFAULT 'وصل',
	`accentColor` varchar(24) NOT NULL DEFAULT '#7157F8',
	`defaultLocale` enum('ar','en') NOT NULL DEFAULT 'ar',
	`defaultTheme` enum('light','dark','system') NOT NULL DEFAULT 'light',
	`adsEnabled` boolean NOT NULL DEFAULT false,
	`analyticsEnabled` boolean NOT NULL DEFAULT true,
	`localMaxFileMb` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` enum('free','basic','pro','business') NOT NULL,
	`nameAr` varchar(80) NOT NULL,
	`nameEn` varchar(80) NOT NULL,
	`dailyOperations` int NOT NULL DEFAULT 0,
	`maxFileMb` int NOT NULL DEFAULT 0,
	`visibleAds` boolean NOT NULL DEFAULT true,
	`enabled` boolean NOT NULL DEFAULT false,
	`featureFlags` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_plans_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `tool_catalog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`category` enum('pdf','image','document','ocr','audio','video') NOT NULL,
	`nameAr` varchar(140) NOT NULL,
	`nameEn` varchar(140) NOT NULL,
	`descriptionAr` text,
	`descriptionEn` text,
	`icon` varchar(40) NOT NULL DEFAULT 'FileCog',
	`processingMode` enum('local','server-ready') NOT NULL DEFAULT 'local',
	`supportedFormats` json NOT NULL,
	`sizeLimitMb` int NOT NULL DEFAULT 100,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`isFeatured` boolean NOT NULL DEFAULT false,
	`showOnHome` boolean NOT NULL DEFAULT true,
	`seoTitleAr` varchar(180),
	`seoTitleEn` varchar(180),
	`seoDescriptionAr` text,
	`seoDescriptionEn` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tool_catalog_id` PRIMARY KEY(`id`),
	CONSTRAINT `tool_catalog_slug_unique` UNIQUE(`slug`)
);
