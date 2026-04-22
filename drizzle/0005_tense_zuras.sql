CREATE TABLE `ai_cost_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`model` varchar(100) NOT NULL,
	`modelName` varchar(100),
	`complexity` varchar(20) NOT NULL,
	`taskType` varchar(50) NOT NULL,
	`inputTokens` int DEFAULT 0,
	`outputTokens` int DEFAULT 0,
	`costUsd` decimal(12,8) DEFAULT '0',
	`cacheSavedUsd` decimal(12,8) DEFAULT '0',
	`cacheHit` boolean DEFAULT false,
	`durationMs` int DEFAULT 0,
	`isSuccess` boolean DEFAULT true,
	`errorMessage` text,
	`userId` int,
	`promptPreview` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_cost_logs_id` PRIMARY KEY(`id`)
);
