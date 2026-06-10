CREATE TABLE `master_session_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(100) NOT NULL,
	`summary` text,
	`keyTopics` text,
	`dbChanges` text,
	`devHistory` text,
	`messageCount` int DEFAULT 0,
	`model` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `master_session_summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `master_session_summaries_sessionId_unique` UNIQUE(`sessionId`)
);
