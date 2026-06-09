ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `googleId` varchar(200);--> statement-breakpoint
ALTER TABLE `users` ADD `authProvider` enum('manus','local','google') DEFAULT 'manus' NOT NULL;