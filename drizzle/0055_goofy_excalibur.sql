CREATE TABLE `tenant_affiliates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`masterAffiliateId` int,
	`customName` varchar(200) NOT NULL,
	`category` enum('golf_domestic','golf_overseas','hotel','attraction','transport','other') DEFAULT 'golf_domestic',
	`customGreenFee` int DEFAULT 0,
	`prepaidBalance` int DEFAULT 0,
	`depositBalance` int DEFAULT 0,
	`contactName` varchar(100),
	`contactPhone` varchar(30),
	`notes` text,
	`status` enum('active','inactive','pending') DEFAULT 'active',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_affiliates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`companyName` varchar(200) NOT NULL,
	`partnerType` enum('travel_agency','accommodation','agency','other') DEFAULT 'travel_agency',
	`businessNumber` varchar(20),
	`contactName` varchar(100),
	`contactPhone` varchar(30),
	`bankName` varchar(50),
	`accountNumber` varchar(50),
	`accountHolder` varchar(100),
	`notes` text,
	`status` enum('active','inactive','pending') DEFAULT 'active',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_partners_id` PRIMARY KEY(`id`)
);
