-- 0043: tenants 테이블 생성 (멀티테넌트 파트너 격리 구조)
CREATE TABLE IF NOT EXISTS `tenants` (
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
