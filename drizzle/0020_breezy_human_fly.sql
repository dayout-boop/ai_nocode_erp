CREATE TABLE `inquiry_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`category` enum('golf_booking','accommodation','transport','general') DEFAULT 'golf_booking',
	`content` text NOT NULL,
	`variables` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`useCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inquiry_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reservation_inquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`reservationNo` varchar(30),
	`sortOrder` int DEFAULT 0,
	`inquiryText` text,
	`autoText` text,
	`replyText` text,
	`inquiryStatus` enum('draft','sent','replied','confirmed') DEFAULT 'draft',
	`templateId` int,
	`updatedBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reservation_inquiries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reservations` ADD `userType` enum('customer','partner','manager') DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE `reservations` ADD `partnerId` int;--> statement-breakpoint
ALTER TABLE `reservations` ADD `partnerCompanyName` varchar(200);--> statement-breakpoint
ALTER TABLE `reservations` ADD `partnerContactName` varchar(100);--> statement-breakpoint
ALTER TABLE `reservations` ADD `partnerContactPhone` varchar(30);--> statement-breakpoint
ALTER TABLE `reservations` ADD `managerName` varchar(100);--> statement-breakpoint
ALTER TABLE `reservations` ADD `managerPhone` varchar(30);