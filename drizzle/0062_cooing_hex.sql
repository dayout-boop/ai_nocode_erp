CREATE TABLE `company_manage_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`staffId` int NOT NULL,
	`canEdit` boolean NOT NULL DEFAULT true,
	`grantedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_manage_permissions_id` PRIMARY KEY(`id`)
);
