CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('reservation','income','remittance','deposit','charge','prepaid') NOT NULL,
	`entityId` int NOT NULL,
	`entityNo` varchar(40),
	`action` enum('create','update','status_change','manager_change','amount_change','match_change','void') NOT NULL,
	`actorType` enum('master','partner_owner','partner_staff','system') NOT NULL,
	`actorId` int,
	`actorName` varchar(100),
	`summary` varchar(500),
	`fieldChanges` json,
	`tenantId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reservations` MODIFY COLUMN `status` enum('pending','confirmed','cancelled','completed','voided') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `charge_records` ADD `recordNo` varchar(40);--> statement-breakpoint
ALTER TABLE `charge_records` ADD `recordStatus` enum('active','void') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `charge_records` ADD `voidedAt` timestamp;--> statement-breakpoint
ALTER TABLE `charge_records` ADD `voidedBy` varchar(100);--> statement-breakpoint
ALTER TABLE `charge_records` ADD `voidReason` varchar(500);--> statement-breakpoint
ALTER TABLE `deposit_records` ADD `recordNo` varchar(40);--> statement-breakpoint
ALTER TABLE `deposit_records` ADD `recordStatus` enum('active','void') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `deposit_records` ADD `voidedAt` timestamp;--> statement-breakpoint
ALTER TABLE `deposit_records` ADD `voidedBy` varchar(100);--> statement-breakpoint
ALTER TABLE `deposit_records` ADD `voidReason` varchar(500);--> statement-breakpoint
ALTER TABLE `income_records` ADD `recordNo` varchar(40);--> statement-breakpoint
ALTER TABLE `income_records` ADD `recordStatus` enum('active','void') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `income_records` ADD `voidedAt` timestamp;--> statement-breakpoint
ALTER TABLE `income_records` ADD `voidedBy` varchar(100);--> statement-breakpoint
ALTER TABLE `income_records` ADD `voidReason` varchar(500);--> statement-breakpoint
ALTER TABLE `prepaid_records` ADD `recordNo` varchar(40);--> statement-breakpoint
ALTER TABLE `prepaid_records` ADD `recordStatus` enum('active','void') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `prepaid_records` ADD `voidedAt` timestamp;--> statement-breakpoint
ALTER TABLE `prepaid_records` ADD `voidedBy` varchar(100);--> statement-breakpoint
ALTER TABLE `prepaid_records` ADD `voidReason` varchar(500);--> statement-breakpoint
ALTER TABLE `remittance_records` ADD `recordNo` varchar(40);--> statement-breakpoint
ALTER TABLE `remittance_records` ADD `recordStatus` enum('active','void') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `remittance_records` ADD `voidedAt` timestamp;--> statement-breakpoint
ALTER TABLE `remittance_records` ADD `voidedBy` varchar(100);--> statement-breakpoint
ALTER TABLE `remittance_records` ADD `voidReason` varchar(500);--> statement-breakpoint
ALTER TABLE `reservations` ADD `voidedAt` timestamp;--> statement-breakpoint
ALTER TABLE `reservations` ADD `voidedBy` varchar(100);--> statement-breakpoint
ALTER TABLE `reservations` ADD `voidReason` varchar(500);