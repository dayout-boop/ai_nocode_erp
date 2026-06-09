CREATE TABLE `partner_email_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`onboardingId` int,
	`receiverEmail` varchar(255) NOT NULL,
	`emailType` varchar(30) NOT NULL,
	`subject` varchar(300) NOT NULL,
	`status` varchar(20) NOT NULL,
	`messageId` varchar(300),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_email_logs_id` PRIMARY KEY(`id`)
);
