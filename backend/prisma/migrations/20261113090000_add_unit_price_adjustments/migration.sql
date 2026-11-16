-- AlterTable
ALTER TABLE `product_variants` ADD COLUMN `min_price` BIGINT NULL;

-- CreateTable
CREATE TABLE `unit_price_adjustments` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `unit_id` VARCHAR(36) NOT NULL,
    `amount` BIGINT NOT NULL,
    `price_before` BIGINT NOT NULL,
    `price_after` BIGINT NOT NULL,
    `min_price` BIGINT NULL,
    `reason` TEXT NOT NULL,
    `effective_date` DATE NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL,
    `requested_by` VARCHAR(36) NOT NULL,
    `approved_by` VARCHAR(36) NULL,
    `approved_at` DATETIME(6) NULL,
    `review_note` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `unit_price_adjustments_company_id_unit_id_status_effective_d_idx`(`company_id`, `unit_id`, `status`, `effective_date`),
    INDEX `unit_price_adjustments_company_id_status_idx`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `unit_price_adjustments` ADD CONSTRAINT `unit_price_adjustments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_price_adjustments` ADD CONSTRAINT `unit_price_adjustments_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `product_units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_price_adjustments` ADD CONSTRAINT `unit_price_adjustments_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_price_adjustments` ADD CONSTRAINT `unit_price_adjustments_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

