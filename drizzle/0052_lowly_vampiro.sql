CREATE TABLE `deploy_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`requestId` int,
	`phase` enum('build','restart','full') NOT NULL,
	`commitSha` varchar(40),
	`success` boolean NOT NULL DEFAULT false,
	`outputSummary` text,
	`durationMs` int,
	`performedBy` int,
	`performedByName` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deploy_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_dev_requests` ADD `tenantId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_dev_requests` ADD `devSource` enum('manus','engine','manual','system') DEFAULT 'manus' NOT NULL;