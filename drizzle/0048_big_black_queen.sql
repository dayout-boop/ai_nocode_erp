CREATE TABLE `git_rollback_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branch` varchar(100) NOT NULL,
	`targetSha` varchar(40) NOT NULL,
	`previousHeadSha` varchar(40),
	`newCommitSha` varchar(40),
	`reason` text,
	`success` boolean NOT NULL DEFAULT true,
	`errorMessage` text,
	`performedBy` int,
	`performedByName` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `git_rollback_logs_id` PRIMARY KEY(`id`)
);
