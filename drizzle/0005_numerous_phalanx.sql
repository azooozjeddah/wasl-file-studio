CREATE TABLE `user_plan_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planCode` enum('free','basic','pro','business') NOT NULL DEFAULT 'free',
	`status` enum('active','paused','expired') NOT NULL DEFAULT 'active',
	`source` enum('admin','future_billing','migration') NOT NULL DEFAULT 'admin',
	`startsAt` timestamp NOT NULL DEFAULT (now()),
	`endsAt` timestamp,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_plan_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_plan_assignments_userId_unique` UNIQUE(`userId`)
);
