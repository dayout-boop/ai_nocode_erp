ALTER TABLE `site_settings` DROP INDEX `site_settings_settingKey_unique`;--> statement-breakpoint
ALTER TABLE `site_featured_packages` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `site_footer` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `site_hero_slides` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `site_nav_items` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `tenantId` int;