ALTER TABLE `banners` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `bookings` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `inquiries` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `notices` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `packages` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `partners` ADD `googleId` varchar(200);--> statement-breakpoint
ALTER TABLE `partners` ADD `googleEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `partners` ADD `googleName` varchar(200);--> statement-breakpoint
ALTER TABLE `partners` ADD `googlePicture` varchar(500);--> statement-breakpoint
ALTER TABLE `partners` ADD `lastGoogleLoginAt` timestamp;--> statement-breakpoint
ALTER TABLE `partners` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `reservations` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `settlements` ADD `tenantId` int;