CREATE TABLE `ai_interaction_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userName` varchar(100),
	`query` text NOT NULL,
	`response` text NOT NULL,
	`modelName` varchar(50) DEFAULT 'gemini-2.5-flash',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_interaction_logs_id` PRIMARY KEY(`id`)
);
