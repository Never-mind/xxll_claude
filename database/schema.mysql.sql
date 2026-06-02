CREATE DATABASE IF NOT EXISTS `quotation` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `quotation`;

CREATE TABLE IF NOT EXISTS `products` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `productCode` VARCHAR(100) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `spec` VARCHAR(255) NULL,
  `brand` VARCHAR(255) NULL,
  `category` VARCHAR(255) NULL,
  `unit` VARCHAR(50) NOT NULL DEFAULT 'pcs',
  `length` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `width` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `height` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `grossWeight` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `hsCodeCn` VARCHAR(100) NULL,
  `hsCodeMx` VARCHAR(100) NOT NULL,
  `suggestedPrice` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `isMagnetic` TINYINT(1) NOT NULL DEFAULT 0,
  `isElectric` TINYINT(1) NOT NULL DEFAULT 0,
  `needNom` TINYINT(1) NOT NULL DEFAULT 0,
  `imageUrl` TEXT NULL,
  `createdAt` VARCHAR(32) NOT NULL,
  `updatedAt` VARCHAR(32) NOT NULL,
  INDEX `idx_products_keyword` (`productCode`, `name`, `category`)
);

CREATE TABLE IF NOT EXISTS `tariff_rates` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `deviceType` VARCHAR(255) NOT NULL,
  `hsCode` VARCHAR(100) NOT NULL,
  `taxRate` DECIMAL(8,4) NOT NULL DEFAULT 0,
  `needNom` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` VARCHAR(32) NOT NULL,
  `updatedAt` VARCHAR(32) NOT NULL,
  UNIQUE KEY `uniq_tariff_device_type` (`deviceType`),
  INDEX `idx_tariff_rates_keyword` (`deviceType`, `hsCode`)
);

CREATE TABLE IF NOT EXISTS `customers` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `address` TEXT NULL,
  `contactName` VARCHAR(255) NULL,
  `contactPhone` VARCHAR(100) NULL,
  `createdAt` VARCHAR(32) NOT NULL,
  `updatedAt` VARCHAR(32) NOT NULL,
  INDEX `idx_customers_keyword` (`name`, `contactName`, `contactPhone`)
);

CREATE TABLE IF NOT EXISTS `history_quotations` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `quotationDate` VARCHAR(32) NOT NULL,
  `customerName` VARCHAR(255) NOT NULL,
  `productCode` VARCHAR(100) NOT NULL,
  `productName` VARCHAR(255) NOT NULL,
  `spec` VARCHAR(255) NULL,
  `brand` VARCHAR(255) NULL,
  `transportType` VARCHAR(20) NOT NULL DEFAULT 'sea',
  `customerPriceUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `createdAt` VARCHAR(32) NOT NULL,
  `updatedAt` VARCHAR(32) NOT NULL,
  INDEX `idx_history_keyword` (`customerName`, `productCode`, `productName`)
);

CREATE TABLE IF NOT EXISTS `quotations` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `quotationNo` VARCHAR(100) NOT NULL UNIQUE,
  `exchangeRateUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `exchangeRateMxn` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `capitalCostRate` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `accountPeriod` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `badDebtRate` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `customsFeeRate` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `vatOverseas` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `markupRate` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `seaFreightRate` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `airFreightRate` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `nomFee` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `customsMiscFee` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `lastMileFee` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `storageOperationFee` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `implementationFee` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `publicFeeTotal` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `totalCifUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `totalDdpUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `totalRevenueUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `totalProfitUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `grossMarginRate` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `customerId` CHAR(36) NULL,
  `customerName` VARCHAR(255) NULL,
  `remark` TEXT NULL,
  `createdAt` VARCHAR(32) NOT NULL,
  `updatedAt` VARCHAR(32) NOT NULL,
  INDEX `idx_quotations_status` (`status`),
  INDEX `idx_quotations_created` (`createdAt`)
);

CREATE TABLE IF NOT EXISTS `quotation_items` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `quotationId` CHAR(36) NOT NULL,
  `productId` CHAR(36) NOT NULL,
  `productCode` VARCHAR(100) NOT NULL,
  `productName` VARCHAR(255) NOT NULL,
  `purchaseQty` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `purchasePriceCny` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `totalTaxIncludedCny` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `totalExclTaxCny` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `vatInputCny` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `transportType` VARCHAR(20) NOT NULL DEFAULT 'sea',
  `isCustomsClearance` TINYINT(1) NOT NULL DEFAULT 0,
  `firstMileFreightCny` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `cifCny` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `cifUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `igiTaxRate` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `tariffUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `capitalCostUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `customsFeeUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `nomFeeUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `publicFeeAllocationUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `ddpTotalUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `ddpUnitPriceUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `revenueUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `operatingProfitUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `grossMarginRate` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `badDebtProvisionUsd` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `markupRate` DECIMAL(14,4) NOT NULL DEFAULT 0,
  `enableNom` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` VARCHAR(32) NOT NULL,
  `updatedAt` VARCHAR(32) NOT NULL,
  INDEX `idx_quotation_items_quotation` (`quotationId`)
);
