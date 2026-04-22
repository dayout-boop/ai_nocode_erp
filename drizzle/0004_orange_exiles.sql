CREATE TABLE `dev_features` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`currentVersion` varchar(20) DEFAULT '1.0.0',
	`status` varchar(30) NOT NULL DEFAULT 'active',
	`category` varchar(50) DEFAULT 'system',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dev_features_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dev_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'pending',
	`priority` varchar(20) NOT NULL DEFAULT 'medium',
	`slackMessageTs` varchar(50),
	`slackChannelId` varchar(50),
	`result` text,
	`featureId` int,
	`createdBy` int,
	`createdByName` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dev_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dev_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`featureId` int NOT NULL,
	`version` varchar(20) NOT NULL,
	`description` text NOT NULL,
	`changeType` varchar(30) DEFAULT 'feature',
	`checkpointId` varchar(100),
	`isRollbackable` boolean DEFAULT true,
	`createdBy` int,
	`createdByName` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dev_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `regionUsed` varchar(50) DEFAULT 'global';--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `backend` varchar(20) DEFAULT 'studio';--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `isSuccess` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `errorType` varchar(50);--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `responseTimeMs` int;