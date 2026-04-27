CREATE TABLE `affiliates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('golf_domestic','golf_overseas','accommodation','attraction','other') NOT NULL,
	`name` varchar(200) NOT NULL,
	`region` varchar(100),
	`country` varchar(50) DEFAULT '한국',
	`address` text,
	`phone` varchar(30),
	`email` varchar(200),
	`website` varchar(300),
	`contactPerson` varchar(100),
	`contactPhone` varchar(30),
	`contractType` enum('direct','agency','platform') DEFAULT 'direct',
	`supplyPrice` int,
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `charge_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardCompany` varchar(50),
	`golfCourseName` varchar(200),
	`amount` int NOT NULL,
	`transactionDate` timestamp NOT NULL,
	`reservationNo` varchar(30),
	`matchedReservationId` int,
	`rawText` text,
	`matchStatus` enum('unmatched','matched','partial') NOT NULL DEFAULT 'unmatched',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `charge_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deposit_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int,
	`reservationNo` varchar(30),
	`type` enum('unpaid','expected','deduct_other','deduct_shinhan') NOT NULL,
	`amount` int NOT NULL,
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deposit_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `income_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionDate` timestamp NOT NULL,
	`bankName` varchar(50),
	`amount` int NOT NULL,
	`depositorName` varchar(100),
	`detail` text,
	`reservationNo` varchar(30),
	`matchedReservationId` int,
	`matchStatus` enum('unmatched','matched','partial') NOT NULL DEFAULT 'unmatched',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `income_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prepaid_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliateId` int,
	`golfCourseName` varchar(200) NOT NULL,
	`prepaidAmount` int NOT NULL,
	`usedAmount` int DEFAULT 0,
	`remainingAmount` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prepaid_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `remittance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionDate` timestamp NOT NULL,
	`bankName` varchar(50),
	`amount` int NOT NULL,
	`recipientName` varchar(100),
	`detail` text,
	`reservationNo` varchar(30),
	`matchedReservationId` int,
	`affiliateId` int,
	`matchStatus` enum('unmatched','matched','partial') NOT NULL DEFAULT 'unmatched',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `remittance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationNo` varchar(30) NOT NULL,
	`productName` varchar(300) NOT NULL,
	`golfCourseName` varchar(200),
	`affiliateId` int,
	`departureDate` timestamp NOT NULL,
	`nights` int DEFAULT 0,
	`teams` int DEFAULT 1,
	`headcount` int DEFAULT 1,
	`customerName` varchar(100) NOT NULL,
	`customerPhone` varchar(30),
	`customerEmail` varchar(200),
	`assignedTo` varchar(100),
	`agentName` varchar(200),
	`salePricePerPerson` int DEFAULT 0,
	`salePriceTotal` int DEFAULT 0,
	`depositPrice` int DEFAULT 0,
	`extraFee` int DEFAULT 0,
	`profit` int DEFAULT 0,
	`status` enum('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
	`paymentStatus` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
	`paidAmount` int DEFAULT 0,
	`remittedAmount` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `reservations_reservationNo_unique` UNIQUE(`reservationNo`)
);
