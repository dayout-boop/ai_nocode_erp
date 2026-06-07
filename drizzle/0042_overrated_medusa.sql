CREATE TABLE `tenant_ai_credits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`type` enum('charge','deduct','refund','monthly_reset') NOT NULL,
	`amount` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`paidAmountKrw` int,
	`aiCostLogId` int,
	`memo` text,
	`processedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_ai_credits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_api_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`serviceName` varchar(100) NOT NULL,
	`serviceLabel` varchar(200),
	`apiKeyEncrypted` text,
	`apiSecretEncrypted` text,
	`configJson` text,
	`status` enum('active','error','pending','disabled') NOT NULL DEFAULT 'pending',
	`lastTestedAt` timestamp,
	`lastError` text,
	`aiAnalysisMemo` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_api_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_api_dev_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`apiConnectionId` int,
	`title` varchar(300) NOT NULL,
	`requestContent` text NOT NULL,
	`aiAnalysis` text,
	`feasibility` enum('possible','conditional','impossible','global') DEFAULT 'possible',
	`isGlobalImprovement` boolean NOT NULL DEFAULT false,
	`approvalStatus` enum('pending','approved','rejected','in_progress','completed') NOT NULL DEFAULT 'pending',
	`approvalMemo` text,
	`approvedBy` int,
	`approvedAt` timestamp,
	`completedAt` timestamp,
	`notifiedTenant` boolean NOT NULL DEFAULT false,
	`notifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_api_dev_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_cost_logs` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `ai_logs` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `ai_routing_logs` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `tenants` ADD `aiCreditsBalance` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `aiCreditsMonthlyLimit` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `aiCreditsUsedThisMonth` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `aiCreditsResetAt` timestamp;--> statement-breakpoint
ALTER TABLE `tenants` ADD `customOpenrouterKeyEncrypted` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `customGeminiKeyEncrypted` text;