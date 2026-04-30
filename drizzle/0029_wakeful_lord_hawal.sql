ALTER TABLE `package_slots` ADD `minPax` int DEFAULT 3;--> statement-breakpoint
ALTER TABLE `package_slots` ADD `adultPrice` decimal(12,0);--> statement-breakpoint
ALTER TABLE `package_slots` ADD `childPrice` decimal(12,0);--> statement-breakpoint
ALTER TABLE `package_slots` ADD `infantPrice` decimal(12,0);--> statement-breakpoint
ALTER TABLE `package_slots` ADD `notes` varchar(500);