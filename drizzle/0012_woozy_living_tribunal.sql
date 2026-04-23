ALTER TABLE `packages` ADD `isSpecialDeal` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `packages` ADD `isTrending` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `packages` ADD `courseType` enum('resort','oceanfront','mountain','tropical','parkland','links','desert','tournament') DEFAULT 'resort';