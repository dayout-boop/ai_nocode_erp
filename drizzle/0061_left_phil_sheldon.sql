CREATE TABLE `partner_staff_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`staffId` int NOT NULL,
	`feature` varchar(100) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_staff_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `file_analysis` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `packages` ADD `aiGeneratedFrom` int;--> statement-breakpoint
ALTER TABLE `packages` ADD `approvalStatus` enum('pending','approved','rejected');