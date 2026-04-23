CREATE TABLE `model_routing_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskType` varchar(50) NOT NULL,
	`primaryModel` varchar(100) NOT NULL,
	`fallbackModel` varchar(100),
	`maxTokens` int DEFAULT 2048,
	`temperature` varchar(10) DEFAULT '0.7',
	`cacheTtlSeconds` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_routing_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `model_routing_rules_taskType_unique` UNIQUE(`taskType`)
);
--> statement-breakpoint
CREATE TABLE `prompt_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`taskType` varchar(50) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`systemPrompt` text NOT NULL,
	`userPromptTemplate` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`abGroup` varchar(5),
	`metrics` json,
	`createdBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prompt_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `taskType` varchar(50) DEFAULT 'chat';--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `cacheHit` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `promptVersionId` int;--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `feedback` varchar(20);--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `feedbackNote` text;--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `inputTokens` int;--> statement-breakpoint
ALTER TABLE `ai_interaction_logs` ADD `outputTokens` int;