CREATE TABLE `admin_accounts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `username` varchar(100) NOT NULL UNIQUE,
  `passwordHash` varchar(255) NOT NULL,
  `name` varchar(100),
  `email` varchar(320),
  `phone` varchar(30),
  `role` enum('admin', 'master') NOT NULL DEFAULT 'admin',
  `isActive` boolean NOT NULL DEFAULT true,
  `createdBy` int,
  `lastLoginAt` timestamp,
  `memo` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
