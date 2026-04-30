CREATE TABLE `site_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tableName` varchar(100) NOT NULL,
	`recordId` varchar(100),
	`action` varchar(20) NOT NULL,
	`oldValue` text,
	`newValue` text,
	`changedBy` varchar(100),
	`changedByUserId` int,
	`ipAddress` varchar(50),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `site_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_featured_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`section` varchar(50) NOT NULL DEFAULT 'recommended',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_featured_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_footer` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(200),
	`ceoName` varchar(100),
	`businessNumber` varchar(50),
	`mailOrderNumber` varchar(100),
	`tourismLicenseNumber` varchar(100),
	`address` varchar(500),
	`phone` varchar(50),
	`email` varchar(200),
	`businessHours` varchar(200),
	`bankAccounts` text,
	`kakaoUrl` varchar(500),
	`instagramUrl` varchar(500),
	`youtubeUrl` varchar(500),
	`naverBlogUrl` varchar(500),
	`copyright` varchar(300),
	`businessLicenseImageUrl` varchar(1000),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(100),
	CONSTRAINT `site_footer_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_hero_slides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200),
	`subtitle` varchar(200),
	`description` text,
	`imageUrl` varchar(1000),
	`mobileImageUrl` varchar(1000),
	`ctaText` varchar(100),
	`ctaLink` varchar(500),
	`destination` varchar(100),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`startAt` timestamp,
	`endAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_hero_slides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_nav_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(100) NOT NULL,
	`href` varchar(500) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isVisible` boolean NOT NULL DEFAULT true,
	`openInNewTab` boolean NOT NULL DEFAULT false,
	`icon` varchar(50),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_nav_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text,
	`description` varchar(300),
	`settingGroup` varchar(50) DEFAULT 'general',
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(100),
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_settings_settingKey_unique` UNIQUE(`settingKey`)
);
