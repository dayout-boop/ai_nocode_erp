ALTER TABLE `ai_dev_requests` ADD `devRequestId` int;--> statement-breakpoint
ALTER TABLE `charge_records` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `deposit_records` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `income_records` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `prepaid_records` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `remittance_records` ADD `tenantId` int;