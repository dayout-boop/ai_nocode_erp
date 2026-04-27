ALTER TABLE `affiliates` ADD `contactName` varchar(100);--> statement-breakpoint
ALTER TABLE `affiliates` ADD `type` enum('golf_domestic','golf_overseas','hotel','attraction','transport','other') DEFAULT 'golf_domestic';--> statement-breakpoint
ALTER TABLE `affiliates` ADD `holeCount` int DEFAULT 18;--> statement-breakpoint
ALTER TABLE `affiliates` ADD `courseCount` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `affiliates` ADD `greenFeeMin` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `affiliates` ADD `greenFeeMax` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `affiliates` ADD `prepaidBalance` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `affiliates` ADD `depositBalance` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `affiliates` ADD `status` enum('active','inactive','pending') DEFAULT 'active';