CREATE TABLE `managed_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`manusProjectId` varchar(100),
	`manusWebdevPath` varchar(500),
	`manusDeployUrl` varchar(500),
	`techStack` varchar(500),
	`keyFiles` text,
	`devInstructions` text,
	`customContext` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managed_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `managed_projects_slug_unique` UNIQUE(`slug`)
);
