CREATE TABLE `user_tool_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`toolSlug` varchar(80) NOT NULL,
	`isAllowed` boolean NOT NULL DEFAULT true,
	`assignedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_tool_permissions_id` PRIMARY KEY(`id`)
);
