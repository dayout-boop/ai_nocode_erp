ALTER TABLE `dev_requests` ADD `aiCategory` varchar(30);--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `aiSuggestedPriority` varchar(20);--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `estimatedHours` int;--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `suggestedTeam` varchar(100);--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `aiAnalysis` text;--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `aiAnalyzed` boolean DEFAULT false NOT NULL;