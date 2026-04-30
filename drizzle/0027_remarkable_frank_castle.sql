CREATE TABLE `custom_variables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(100) NOT NULL,
	`label` varchar(100) NOT NULL,
	`variableKey` varchar(100) NOT NULL,
	`description` varchar(300),
	`isSystem` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_variables_id` PRIMARY KEY(`id`),
	CONSTRAINT `custom_variables_variableKey_unique` UNIQUE(`variableKey`)
);
--> statement-breakpoint
ALTER TABLE `reservation_itineraries` ADD `estimatedTeeTime` varchar(10);--> statement-breakpoint
ALTER TABLE `reservation_itineraries` ADD `confirmedTeeTime` varchar(10);