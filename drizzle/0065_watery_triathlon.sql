ALTER TABLE `partner_onboarding` ADD `businessNumberNormalized` varchar(10);--> statement-breakpoint
ALTER TABLE `partners` ADD `businessNumberNormalized` varchar(10);--> statement-breakpoint
ALTER TABLE `tenants` ADD `businessNumberNormalized` varchar(10);--> statement-breakpoint
ALTER TABLE `tenants` ADD CONSTRAINT `tenants_businessNumberNormalized_unique` UNIQUE(`businessNumberNormalized`);