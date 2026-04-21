CREATE TABLE `banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`subtitle` varchar(300),
	`imageUrl` varchar(500) NOT NULL,
	`linkUrl` varchar(500),
	`isActive` boolean DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `banners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingNumber` varchar(20) NOT NULL,
	`packageId` int NOT NULL,
	`slotId` int,
	`userId` int,
	`leaderName` varchar(100) NOT NULL,
	`leaderPhone` varchar(20) NOT NULL,
	`leaderEmail` varchar(320),
	`adultCount` int DEFAULT 1,
	`childCount` int DEFAULT 0,
	`totalPeople` int DEFAULT 1,
	`departureDate` timestamp,
	`returnDate` timestamp,
	`selectedOptions` json,
	`roundCount` int DEFAULT 2,
	`cartIncluded` boolean DEFAULT false,
	`caddieIncluded` boolean DEFAULT false,
	`basePrice` decimal(12,0) DEFAULT '0',
	`optionPrice` decimal(12,0) DEFAULT '0',
	`discountAmount` decimal(12,0) DEFAULT '0',
	`totalAmount` decimal(12,0) NOT NULL,
	`paidAmount` decimal(12,0) DEFAULT '0',
	`status` enum('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
	`paymentStatus` enum('unpaid','partial','paid','refunded') DEFAULT 'unpaid',
	`customerMemo` text,
	`adminMemo` text,
	`cancelReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_bookingNumber_unique` UNIQUE(`bookingNumber`)
);
--> statement-breakpoint
CREATE TABLE `customer_memos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`customerName` varchar(100),
	`customerPhone` varchar(20),
	`content` text NOT NULL,
	`memoType` enum('call','kakao','email','visit','other') DEFAULT 'call',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_memos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320),
	`packageId` int,
	`packageName` varchar(200),
	`travelDate` varchar(50),
	`peopleCount` int,
	`message` text,
	`status` enum('new','in_progress','replied','closed') DEFAULT 'new',
	`adminReply` text,
	`repliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inquiries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('notice','event','new_product','tip') DEFAULT 'notice',
	`title` varchar(300) NOT NULL,
	`content` text,
	`imageUrl` varchar(500),
	`isImportant` boolean DEFAULT false,
	`isPublished` boolean DEFAULT true,
	`viewCount` int DEFAULT 0,
	`startDate` timestamp,
	`endDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `package_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`optionType` enum('cart','caddie','accommodation','vehicle','meal','insurance','other') NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`price` decimal(12,0) DEFAULT '0',
	`isIncluded` boolean DEFAULT false,
	`isRequired` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `package_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `package_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`season` enum('peak','normal','off') NOT NULL DEFAULT 'normal',
	`minPeople` int DEFAULT 1,
	`maxPeople` int DEFAULT 99,
	`pricePerPerson` decimal(12,0) NOT NULL,
	`singleSupplement` decimal(12,0) DEFAULT '0',
	`validFrom` timestamp,
	`validTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `package_prices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `package_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`departureDate` timestamp NOT NULL,
	`returnDate` timestamp,
	`totalSlots` int DEFAULT 20,
	`bookedSlots` int DEFAULT 0,
	`status` enum('open','closed','sold_out') DEFAULT 'open',
	`priceOverride` decimal(12,0),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `package_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`titleEn` varchar(200),
	`country` varchar(50) NOT NULL,
	`region` varchar(100),
	`duration` varchar(50),
	`roundCount` int DEFAULT 2,
	`description` text,
	`highlights` json,
	`includes` json,
	`excludes` json,
	`imageUrl` varchar(500),
	`imageUrls` json,
	`status` enum('draft','active','inactive','sold_out') NOT NULL DEFAULT 'draft',
	`isFeatured` boolean DEFAULT false,
	`isPopular` boolean DEFAULT false,
	`sortOrder` int DEFAULT 0,
	`viewCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`supplierName` varchar(100) NOT NULL,
	`supplierType` enum('golf_course','hotel','transport','other') NOT NULL,
	`amount` decimal(12,0) NOT NULL,
	`currency` varchar(10) DEFAULT 'KRW',
	`dueDate` timestamp,
	`paidDate` timestamp,
	`status` enum('pending','paid','overdue') DEFAULT 'pending',
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `travelers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameEn` varchar(100),
	`birthDate` varchar(10),
	`gender` enum('male','female'),
	`passportNumber` varchar(30),
	`passportExpiry` varchar(10),
	`phone` varchar(20),
	`isLeader` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `travelers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `memo` text;