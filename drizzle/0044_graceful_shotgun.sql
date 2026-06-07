CREATE TABLE `tenant_credit_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`requestType` enum('pg','manual') NOT NULL DEFAULT 'manual',
	`packageId` varchar(50) NOT NULL,
	`credits` int NOT NULL,
	`amountKrw` int NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`pgPaymentId` varchar(200),
	`depositorName` varchar(100),
	`depositMemo` text,
	`adminNote` text,
	`approvedBy` int,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_credit_requests_id` PRIMARY KEY(`id`)
);
