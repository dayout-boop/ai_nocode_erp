CREATE TABLE `manus_task_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(100) NOT NULL,
	`taskName` varchar(200) NOT NULL,
	`projectName` varchar(200),
	`description` text,
	`taskType` enum('erp','homepage','new_project','other') DEFAULT 'erp',
	`isDefault` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastUsedAt` timestamp,
	`useCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manus_task_candidates_id` PRIMARY KEY(`id`),
	CONSTRAINT `manus_task_candidates_taskId_unique` UNIQUE(`taskId`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text,
	`description` text,
	`updatedBy` varchar(200),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_settingKey_unique` UNIQUE(`settingKey`)
);
