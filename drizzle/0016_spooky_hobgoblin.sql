ALTER TABLE `partner_schedules` ADD `recurrenceType` varchar(20) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_schedules` ADD `recurrenceInterval` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `partner_schedules` ADD `recurrenceEndDate` timestamp;--> statement-breakpoint
ALTER TABLE `partner_schedules` ADD `parentScheduleId` int;