CREATE TABLE `processing_job_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`eventType` enum('queued','uploading','processing','progress','completed','failed','cancelled','expired') NOT NULL,
	`progress` int,
	`message` varchar(500),
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processing_job_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `processing_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(48) NOT NULL,
	`ownerUserId` int NOT NULL,
	`toolSlug` varchar(80) NOT NULL,
	`processingMode` enum('server','hybrid') NOT NULL,
	`state` enum('queued','uploading','processing','completed','failed','cancelled','expired') NOT NULL DEFAULT 'queued',
	`progress` int NOT NULL DEFAULT 0,
	`queuePriority` int NOT NULL DEFAULT 0,
	`engineKey` varchar(80) NOT NULL,
	`inputBytes` int NOT NULL,
	`inputMimeType` varchar(140) NOT NULL,
	`resultBytes` int,
	`resultMimeType` varchar(140),
	`errorCode` varchar(80),
	`errorMessage` varchar(500),
	`expiresAt` timestamp NOT NULL,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `processing_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `processing_jobs_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `processing_rate_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectHash` varchar(96) NOT NULL,
	`bucketKey` varchar(80) NOT NULL,
	`hitCount` int NOT NULL DEFAULT 0,
	`windowExpiresAt` timestamp NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `processing_rate_limits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `processing_workers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workerKey` varchar(80) NOT NULL,
	`status` enum('offline','ready','busy','degraded') NOT NULL DEFAULT 'offline',
	`capabilities` json NOT NULL,
	`queueDepth` int NOT NULL DEFAULT 0,
	`lastHeartbeatAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `processing_workers_id` PRIMARY KEY(`id`),
	CONSTRAINT `processing_workers_workerKey_unique` UNIQUE(`workerKey`)
);
--> statement-breakpoint
CREATE TABLE `temporary_file_references` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`objectKey` varchar(500) NOT NULL,
	`purpose` enum('input','result') NOT NULL,
	`contentType` varchar(140) NOT NULL,
	`byteSize` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`releasedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `temporary_file_references_id` PRIMARY KEY(`id`),
	CONSTRAINT `temporary_file_references_objectKey_unique` UNIQUE(`objectKey`)
);
--> statement-breakpoint
CREATE TABLE `usage_counters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planCode` varchar(32) NOT NULL,
	`windowKey` varchar(20) NOT NULL,
	`operationCount` int NOT NULL DEFAULT 0,
	`serverBytes` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `usage_counters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tool_catalog` MODIFY COLUMN `processingMode` enum('local','server','hybrid','server-ready') NOT NULL DEFAULT 'local';--> statement-breakpoint
ALTER TABLE `site_settings` ADD `serverProcessingEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `serverMaxFileMb` int DEFAULT 250 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `temporaryRetentionHours` int DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `defaultProcessingMode` enum('local','server','hybrid') DEFAULT 'local' NOT NULL;