CREATE TABLE `ai_dev_request_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`filePath` varchar(500) NOT NULL,
	`changeType` enum('ADD','MODIFY','DELETE') NOT NULL,
	`additions` int NOT NULL DEFAULT 0,
	`deletions` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_dev_request_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_dev_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` varchar(50) NOT NULL,
	`sourceBranch` varchar(100) NOT NULL DEFAULT 'dev-1',
	`targetBranch` varchar(100) NOT NULL DEFAULT 'dev-2-integration',
	`status` enum('INIT','CODE_GENERATED','INTEGRITY_PASSED','INTEGRITY_FAILED','INTEGRATED','MASTER_APPROVED','MASTER_REJECTED') NOT NULL DEFAULT 'INIT',
	`commitMessage` varchar(1000),
	`errorMessage` text,
	`auditSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_dev_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_git_commits` (
	`commitSha` varchar(40) NOT NULL,
	`requestId` int NOT NULL,
	`authorName` varchar(100) NOT NULL DEFAULT 'DuGolf-Server-Engine',
	`commitMessage` varchar(1000) NOT NULL,
	`branch` varchar(100) NOT NULL DEFAULT 'dev-1',
	`committedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_git_commits_commitSha` PRIMARY KEY(`commitSha`)
);
