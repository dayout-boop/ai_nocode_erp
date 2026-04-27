CREATE TABLE `partner_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`memo` text,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`assignedTo` varchar(100),
	`color` varchar(20) DEFAULT '#16a34a',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(200) NOT NULL,
	`businessNumber` varchar(20),
	`tourismLicenseNo` varchar(50),
	`onlineSalesNo` varchar(50),
	`bankName` varchar(50),
	`accountNumber` varchar(50),
	`accountHolder` varchar(100),
	`contactName` varchar(100),
	`contactPhone` varchar(20),
	`contactEmail` varchar(320),
	`loginId` varchar(100),
	`loginPwHash` varchar(255),
	`memo` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partners_id` PRIMARY KEY(`id`)
);
