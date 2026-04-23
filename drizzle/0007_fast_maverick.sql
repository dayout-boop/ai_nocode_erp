CREATE TABLE `ai_engine_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(200) NOT NULL,
	`errorType` enum('runtime','api','validation','unknown') NOT NULL DEFAULT 'unknown',
	`errorMessage` text NOT NULL,
	`stackTrace` text,
	`path` varchar(500),
	`fixRequestId` int,
	`status` enum('new','analyzing','fixed','ignored') NOT NULL DEFAULT 'new',
	`aiAnalysis` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_engine_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_fix_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text NOT NULL,
	`targetFile` varchar(500),
	`targetFunction` varchar(200),
	`priority` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`isCritical` boolean NOT NULL DEFAULT false,
	`status` enum('pending','in_review','approved','rejected','applied','failed') NOT NULL DEFAULT 'pending',
	`aiFixCode` text,
	`aiFixExplanation` text,
	`userFeedback` text,
	`approvedBy` int,
	`errorLogId` int,
	`requestSource` enum('auto','manual') NOT NULL DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_fix_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_review_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fixRequestId` int NOT NULL,
	`reviewStage` enum('syntax','logic','security','test','final') NOT NULL DEFAULT 'syntax',
	`result` enum('pass','fail','warning') NOT NULL DEFAULT 'pass',
	`details` text,
	`issues` json,
	`reviewModel` varchar(100),
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_review_results_id` PRIMARY KEY(`id`)
);
