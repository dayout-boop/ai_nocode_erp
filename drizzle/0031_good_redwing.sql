ALTER TABLE `dev_requests` ADD `manusProjectId` varchar(100);--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `manusRoutingType` enum('new_task','send_message');--> statement-breakpoint
ALTER TABLE `dev_requests` ADD `manusRoutingReason` varchar(255);