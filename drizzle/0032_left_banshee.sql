ALTER TABLE `dev_requests` ADD `accuracyScore` int;--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `userFeedback` text;--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `engineType` varchar(50);--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `accuracyEvaluated` boolean DEFAULT false NOT NULL;