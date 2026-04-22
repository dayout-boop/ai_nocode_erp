CREATE TABLE `automation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pipelineName` varchar(100) NOT NULL,
	`triggerType` varchar(50) NOT NULL,
	`triggerEntityId` int,
	`status` enum('success','failed','pending') NOT NULL DEFAULT 'pending',
	`webhookUrl` varchar(500),
	`requestPayload` json,
	`responseStatus` int,
	`errorMessage` text,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `automation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kakao_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int,
	`recipientPhone` varchar(20) NOT NULL,
	`templateCode` varchar(50) NOT NULL,
	`messageType` enum('booking_confirmed','booking_cancelled','departure_reminder','custom') NOT NULL,
	`status` enum('sent','failed','pending') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kakao_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `package_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`videoUrl` varchar(500) NOT NULL,
	`videoKey` varchar(255),
	`thumbnailUrl` varchar(500),
	`title` varchar(200),
	`durationSec` int,
	`generatedBy` enum('runway','manual','ai') DEFAULT 'manual',
	`status` enum('processing','ready','failed') DEFAULT 'processing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `package_videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`stripePaymentIntentId` varchar(255),
	`stripeCustomerId` varchar(255),
	`amount` decimal(12,0) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'krw',
	`status` enum('pending','succeeded','failed','refunded','cancelled') NOT NULL DEFAULT 'pending',
	`paymentMethod` varchar(50),
	`receiptUrl` varchar(500),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_stripePaymentIntentId_unique` UNIQUE(`stripePaymentIntentId`)
);
