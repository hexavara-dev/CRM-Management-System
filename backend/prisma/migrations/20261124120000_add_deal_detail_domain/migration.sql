-- Detail Deal: customer-facing summary, financing bank, transaction summary,
-- and verified Lost Deal workflow. Deal pipeline stages remain configurable.

CREATE TABLE `financing_banks` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `logo_url` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL,
  UNIQUE INDEX `financing_banks_company_id_name_key` (`company_id`, `name`),
  INDEX `financing_banks_company_id_is_active_idx` (`company_id`, `is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `deal`
  ADD COLUMN `notes` TEXT NULL,
  ADD COLUMN `financing_bank_id` VARCHAR(36) NULL,
  ADD COLUMN `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  ADD INDEX `deal_company_id_financing_bank_id_idx` (`company_id`, `financing_bank_id`);

CREATE TABLE `deal_payments` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `deal_id` VARCHAR(36) NOT NULL,
  `type` ENUM('ITJ', 'DP', 'SETTLEMENT') NOT NULL,
  `amount` BIGINT NOT NULL,
  `status` ENUM('PENDING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `due_date` DATE NULL,
  `paid_at` DATETIME(6) NULL,
  `notes` TEXT NULL,
  `recorded_by_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL,
  INDEX `deal_payments_company_id_deal_id_type_status_idx` (`company_id`, `deal_id`, `type`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `deal_lost_requests` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `deal_id` VARCHAR(36) NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `chronology` TEXT NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `active_guard` VARCHAR(10) NULL DEFAULT 'active',
  `previous_status_id` VARCHAR(36) NULL,
  `requested_by_id` VARCHAR(36) NOT NULL,
  `requested_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `reviewed_by_id` VARCHAR(36) NULL,
  `reviewed_at` DATETIME(6) NULL,
  `review_notes` TEXT NULL,
  UNIQUE INDEX `deal_lost_requests_deal_id_active_guard_key` (`deal_id`, `active_guard`),
  INDEX `deal_lost_requests_company_id_status_requested_at_idx` (`company_id`, `status`, `requested_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `financing_banks`
  ADD CONSTRAINT `financing_banks_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `deal`
  ADD CONSTRAINT `deal_financing_bank_id_fkey` FOREIGN KEY (`financing_bank_id`) REFERENCES `financing_banks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `deal_payments`
  ADD CONSTRAINT `deal_payments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `deal_payments_deal_id_fkey` FOREIGN KEY (`deal_id`) REFERENCES `deal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `deal_payments_recorded_by_id_fkey` FOREIGN KEY (`recorded_by_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `deal_lost_requests`
  ADD CONSTRAINT `deal_lost_requests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `deal_lost_requests_deal_id_fkey` FOREIGN KEY (`deal_id`) REFERENCES `deal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `deal_lost_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `deal_lost_requests_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
