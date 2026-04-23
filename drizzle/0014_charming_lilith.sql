CREATE TABLE `ai_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(100) NOT NULL,
	`userId` int,
	`assistant` enum('master','golftalk','manager') NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`modelUsed` varchar(100),
	`tokensIn` int DEFAULT 0,
	`tokensOut` int DEFAULT 0,
	`costUsd` decimal(10,6) DEFAULT '0',
	`grounded` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(100) NOT NULL,
	`channel` enum('golftalk','manager') NOT NULL,
	`userId` int,
	`partnerId` int,
	`status` enum('active','closed','pending') DEFAULT 'active',
	`summary` text,
	`packageId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `module` varchar(100);--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `manusTaskId` varchar(100);--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `source` enum('manual','auto_cycle','master_ai') DEFAULT 'manual';