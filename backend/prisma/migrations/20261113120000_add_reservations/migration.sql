-- Reservation records are tenant-scoped and keep a historical link to a product unit.
CREATE TABLE `reservations` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `unit_id` VARCHAR(36) NOT NULL,
    `sales_id` VARCHAR(36) NOT NULL,
    `ref_code` VARCHAR(80) NOT NULL,
    `customer_name` VARCHAR(150) NOT NULL,
    `customer_email` VARCHAR(255) NULL,
    `customer_phone` VARCHAR(30) NULL,
    `reserved_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `expires_at` DATETIME(6) NULL,
    `price` BIGINT NOT NULL,
    `status` ENUM('ACTIVE', 'PAYMENT_PENDING', 'EXPIRED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `reservations_company_id_ref_code_key`(`company_id`, `ref_code`),
    INDEX `reservations_company_id_status_reserved_at_idx`(`company_id`, `status`, `reserved_at`),
    INDEX `reservations_unit_id_status_idx`(`unit_id`, `status`),
    INDEX `reservations_sales_id_idx`(`sales_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `reservations`
    ADD CONSTRAINT `reservations_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `reservations_unit_id_fkey`
    FOREIGN KEY (`unit_id`) REFERENCES `product_units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `reservations_sales_id_fkey`
    FOREIGN KEY (`sales_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
