CREATE TABLE `admin_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(100) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`name` varchar(100),
	`email` varchar(320),
	`phone` varchar(30),
	`role` enum('admin','master') NOT NULL DEFAULT 'admin',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`lastLoginAt` timestamp,
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_accounts_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `ai_agent_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(100) NOT NULL,
	`tool_name` varchar(100) NOT NULL,
	`tool_args` json,
	`plan_description` text,
	`status` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
	`requested_by` int,
	`approved_by` int,
	`rejection_reason` text,
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agent_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('dev_complete','deploy','feature','system','error') NOT NULL DEFAULT 'system',
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`devRequestId` int,
	`checkpointVersionId` varchar(50),
	`isRead` boolean NOT NULL DEFAULT false,
	`actionUrl` varchar(300),
	`actionLabel` varchar(100),
	`priority` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`source` enum('ai','system','manual') NOT NULL DEFAULT 'ai',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_routing_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskType` varchar(100),
	`complexity` enum('high','medium','low') NOT NULL,
	`modelId` varchar(200) NOT NULL,
	`modelName` varchar(200),
	`tokensIn` int DEFAULT 0,
	`tokensOut` int DEFAULT 0,
	`costUsd` decimal(10,6) DEFAULT '0',
	`durationMs` int DEFAULT 0,
	`cacheHit` boolean DEFAULT false,
	`isSuccess` boolean DEFAULT true,
	`errorMessage` text,
	`assistantType` varchar(50),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `ai_routing_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_scheduled_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskType` enum('report','reminder','analysis','custom') NOT NULL DEFAULT 'custom',
	`title` varchar(200) NOT NULL,
	`prompt` text NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`status` enum('pending','running','completed','cancelled','failed') NOT NULL DEFAULT 'pending',
	`result` text,
	`errorMessage` varchar(500),
	`executedAt` timestamp,
	`createdBy` int,
	`notifyOnComplete` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_scheduled_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_session_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(100) NOT NULL,
	`state_key` varchar(200) NOT NULL,
	`state_value` text,
	`is_sensitive` boolean NOT NULL DEFAULT false,
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_session_state_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `erp_api_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceKey` varchar(100) NOT NULL,
	`serviceName` varchar(200) NOT NULL,
	`apiKeyEncrypted` text,
	`apiKeyMasked` varchar(50),
	`extraConfig` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `erp_api_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `erp_api_settings_serviceKey_unique` UNIQUE(`serviceKey`)
);
--> statement-breakpoint
CREATE TABLE `file_analysis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`extractedText` text,
	`extractStatus` enum('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
	`extractError` text,
	`sessionId` varchar(100),
	`summary` text,
	`analyzed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `file_analysis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `image_archive_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driveFileId` varchar(200) NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`driveUrl` text NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`source` varchar(100) NOT NULL DEFAULT 'kakaowork',
	`sourceDetail` varchar(300),
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	`isDeleted` boolean NOT NULL DEFAULT false,
	`deletedAt` timestamp,
	`deletedBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `image_archive_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_block_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`knowledgeName` varchar(300) NOT NULL,
	`blockReason` text,
	`blockType` enum('auto','manual') NOT NULL DEFAULT 'auto',
	`sourceDeskHint` varchar(200),
	`sessionId` varchar(100),
	`isBlocked` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_block_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_block_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ruleName` varchar(300) NOT NULL,
	`keywords` text NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` varchar(100) DEFAULT 'master',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_block_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manus_webhook_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(200),
	`eventType` varchar(100) NOT NULL,
	`content` text,
	`role` varchar(50) DEFAULT 'assistant',
	`devRequestId` int,
	`rawPayload` text,
	`isVerified` boolean NOT NULL DEFAULT false,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manus_webhook_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_onboarding` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('pending','reviewing','approved','rejected','active') NOT NULL DEFAULT 'pending',
	`companyName` varchar(200) NOT NULL,
	`businessNumber` varchar(20),
	`ceoName` varchar(100),
	`businessType` varchar(100),
	`businessItem` varchar(100),
	`address` text,
	`contactName` varchar(100) NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`contactPhone` varchar(30),
	`businessLicenseKey` varchar(500),
	`businessLicenseUrl` varchar(500),
	`ocrRawText` text,
	`ocrResult` text,
	`tourismLicenseKey` varchar(500),
	`tourismLicenseUrl` varchar(500),
	`tourismOcrRawText` text,
	`tourismOcrResult` text,
	`tourismLicenseNo` varchar(50),
	`tourismLicenseType` varchar(100),
	`tourismOpenDate` varchar(20),
	`sampleCategory` enum('golf_tour_domestic','golf_tour_overseas','golf_tour_mixed') DEFAULT 'golf_tour_mixed',
	`subscriptionPlan` enum('starter','standard','premium') DEFAULT 'starter',
	`billingCycle` enum('monthly','yearly') DEFAULT 'monthly',
	`stripeSessionId` varchar(200),
	`stripeSubscriptionId` varchar(200),
	`portonePaymentId` varchar(200),
	`partnerId` int,
	`adminNote` text,
	`reviewedBy` varchar(200),
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_onboarding_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerId` int NOT NULL,
	`onboardingId` int,
	`name` varchar(100) NOT NULL,
	`email` varchar(320),
	`phone` varchar(30),
	`role` enum('manager','staff') NOT NULL DEFAULT 'staff',
	`loginId` varchar(100) NOT NULL,
	`loginPwHash` varchar(255) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`memo` text,
	`lastLoginAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_staff_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_staff_loginId_unique` UNIQUE(`loginId`)
);
--> statement-breakpoint
CREATE TABLE `partner_staff_password_reset` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_staff_password_reset_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_staff_password_reset_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`onboardingId` int,
	`partnerId` int,
	`slug` varchar(100) NOT NULL,
	`companyName` varchar(200) NOT NULL,
	`subscriptionPlan` enum('starter','standard','premium') NOT NULL DEFAULT 'starter',
	`billingCycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
	`subscriptionStatus` enum('trial','active','suspended','cancelled') NOT NULL DEFAULT 'trial',
	`subscriptionExpiresAt` timestamp,
	`stripeCustomerId` varchar(200),
	`stripeSubscriptionId` varchar(200),
	`isActive` boolean NOT NULL DEFAULT true,
	`sampleCategory` enum('golf_tour_domestic','golf_tour_overseas','golf_tour_mixed') DEFAULT 'golf_tour_mixed',
	`sampleSeeded` boolean NOT NULL DEFAULT false,
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `model_routing_rules` DROP INDEX `model_routing_rules_taskType_unique`;--> statement-breakpoint
ALTER TABLE `model_routing_rules` MODIFY COLUMN `updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `site_nav_items` MODIFY COLUMN `icon` varchar(100);--> statement-breakpoint
ALTER TABLE `ai_cost_logs` ADD `assistant` varchar(20) DEFAULT 'master';--> statement-breakpoint
ALTER TABLE `model_routing_rules` ADD `complexity` enum('high','medium','low') NOT NULL;--> statement-breakpoint
ALTER TABLE `model_routing_rules` ADD `modelId` varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE `model_routing_rules` ADD `modelName` varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE `model_routing_rules` ADD `inputPricePerMillion` decimal(10,4) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `model_routing_rules` ADD `outputPricePerMillion` decimal(10,4) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `model_routing_rules` ADD `priority` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `model_routing_rules` ADD `updatedBy` varchar(200);--> statement-breakpoint
ALTER TABLE `model_routing_rules` ADD `createdAt` timestamp DEFAULT (now());--> statement-breakpoint
ALTER TABLE `model_routing_rules` DROP COLUMN `taskType`;--> statement-breakpoint
ALTER TABLE `model_routing_rules` DROP COLUMN `primaryModel`;--> statement-breakpoint
ALTER TABLE `model_routing_rules` DROP COLUMN `fallbackModel`;--> statement-breakpoint
ALTER TABLE `model_routing_rules` DROP COLUMN `maxTokens`;--> statement-breakpoint
ALTER TABLE `model_routing_rules` DROP COLUMN `temperature`;--> statement-breakpoint
ALTER TABLE `model_routing_rules` DROP COLUMN `cacheTtlSeconds`;