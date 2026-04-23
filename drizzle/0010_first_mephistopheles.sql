ALTER TABLE `ai_fix_requests` ADD `aiCategory` varchar(30);--> statement-breakpoint
ALTER TABLE `ai_fix_requests` ADD `aiSuggestedPriority` varchar(20);--> statement-breakpoint
ALTER TABLE `ai_fix_requests` ADD `aiEstimatedHours` int;--> statement-breakpoint
ALTER TABLE `ai_fix_requests` ADD `aiAnalyzed` boolean DEFAULT false NOT NULL;