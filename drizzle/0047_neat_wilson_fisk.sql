CREATE TABLE `admin_sessions` (
	`sessionId` varchar(100) NOT NULL,
	`adminId` int NOT NULL,
	`username` varchar(100) NOT NULL,
	`role` varchar(20) NOT NULL,
	`loginTime` bigint NOT NULL,
	`lastActivity` bigint NOT NULL,
	`expiresAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_sessions_sessionId` PRIMARY KEY(`sessionId`)
);
