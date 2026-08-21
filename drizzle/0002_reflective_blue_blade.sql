CREATE TABLE `admin_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(80),
	`summary` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`nameAr` varchar(100) NOT NULL,
	`nameEn` varchar(100) NOT NULL,
	`description` text,
	`permissions` json NOT NULL,
	`isSystem` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_roles_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `faq_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locale` enum('ar','en') NOT NULL DEFAULT 'ar',
	`question` varchar(500) NOT NULL,
	`answer` text NOT NULL,
	`category` varchar(80) NOT NULL DEFAULT 'general',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faq_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_role_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	`assignedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_role_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `site_settings` ADD `logoUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `site_settings` ADD `metaTitle` varchar(180);--> statement-breakpoint
ALTER TABLE `site_settings` ADD `metaDescription` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `supportEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD `toolSlugs` json;--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD `entitlements` json;--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD `planRank` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD `usageWindow` enum('daily','monthly') DEFAULT 'daily' NOT NULL;