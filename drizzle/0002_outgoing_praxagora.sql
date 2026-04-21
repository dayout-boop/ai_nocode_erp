CREATE TABLE `package_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`imageUrl` varchar(1000) NOT NULL,
	`imageKey` varchar(500) NOT NULL,
	`altText` varchar(200),
	`sortOrder` int DEFAULT 0,
	`isCover` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `package_images_id` PRIMARY KEY(`id`)
);
