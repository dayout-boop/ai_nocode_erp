CREATE TABLE `reservation_affiliate_costs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`affiliateId` int,
	`affiliateName` varchar(200),
	`costType` enum('golf','accommodation','transport','other') DEFAULT 'golf',
	`date` timestamp,
	`confirmedTime` varchar(20),
	`unitPrice` int DEFAULT 0,
	`salePrice` int DEFAULT 0,
	`quantity` int DEFAULT 1,
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `reservation_affiliate_costs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reservation_itineraries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`dayIndex` int NOT NULL,
	`date` timestamp,
	`dayType` enum('departure','stay','arrival','daytrip') DEFAULT 'stay',
	`golfAffiliateId` int,
	`holeCount` int DEFAULT 18,
	`teeTime` varchar(10),
	`accommodationAffiliateId` int,
	`roomType` varchar(100),
	`roomCount` int DEFAULT 1,
	`flightInfo` text,
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `reservation_itineraries_id` PRIMARY KEY(`id`)
);
