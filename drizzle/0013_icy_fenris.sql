ALTER TABLE `packages` ADD `badgeType` enum('none','best','exclusive','new','limited','hot') DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `packages` ADD `departureCities` json;--> statement-breakpoint
ALTER TABLE `packages` ADD `includesAirfare` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `packages` ADD `includesGreenFee` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `packages` ADD `includesHotel` boolean DEFAULT false;