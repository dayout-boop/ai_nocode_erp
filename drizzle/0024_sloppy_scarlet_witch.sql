CREATE TABLE `customer_estimate_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`includeItems` text,
	`excludeItems` text,
	`notes` text,
	`schedule` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`useCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_estimate_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `estimates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`token` varchar(100) NOT NULL,
	`templateId` int,
	`estimateType` enum('partner','customer') DEFAULT 'customer',
	`customData` text,
	`isSent` boolean DEFAULT false,
	`sentAt` timestamp,
	`sentVia` enum('email','kakao') DEFAULT 'email',
	`createdBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `estimates_id` PRIMARY KEY(`id`),
	CONSTRAINT `estimates_token_unique` UNIQUE(`token`)
);
