-- model_routing_rules 테이블 재구성 (복잡도 기반으로 변경)
-- 기존 taskType 기반 컬럼들 제거 후 새 구조로 교체
ALTER TABLE `model_routing_rules` DROP COLUMN IF EXISTS `taskType`;
ALTER TABLE `model_routing_rules` DROP COLUMN IF EXISTS `primaryModel`;
ALTER TABLE `model_routing_rules` DROP COLUMN IF EXISTS `fallbackModel`;
ALTER TABLE `model_routing_rules` DROP COLUMN IF EXISTS `maxTokens`;
ALTER TABLE `model_routing_rules` DROP COLUMN IF EXISTS `temperature`;
ALTER TABLE `model_routing_rules` DROP COLUMN IF EXISTS `cacheTtlSeconds`;

-- 새 컬럼 추가
ALTER TABLE `model_routing_rules` ADD COLUMN IF NOT EXISTS `complexity` ENUM('high','medium','low') NOT NULL DEFAULT 'medium';
ALTER TABLE `model_routing_rules` ADD COLUMN IF NOT EXISTS `modelId` varchar(200) NOT NULL DEFAULT '';
ALTER TABLE `model_routing_rules` ADD COLUMN IF NOT EXISTS `modelName` varchar(200) NOT NULL DEFAULT '';
ALTER TABLE `model_routing_rules` ADD COLUMN IF NOT EXISTS `inputPricePerMillion` decimal(10,4) DEFAULT '0';
ALTER TABLE `model_routing_rules` ADD COLUMN IF NOT EXISTS `outputPricePerMillion` decimal(10,4) DEFAULT '0';
ALTER TABLE `model_routing_rules` ADD COLUMN IF NOT EXISTS `priority` int DEFAULT 10 NOT NULL;
ALTER TABLE `model_routing_rules` ADD COLUMN IF NOT EXISTS `updatedBy` varchar(200);
ALTER TABLE `model_routing_rules` ADD COLUMN IF NOT EXISTS `createdAt` timestamp DEFAULT (now());

-- ai_routing_logs 신규 테이블 생성
CREATE TABLE IF NOT EXISTS `ai_routing_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `taskType` varchar(100),
  `complexity` ENUM('high','medium','low') NOT NULL,
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
  `createdAt` timestamp DEFAULT (now())
);
