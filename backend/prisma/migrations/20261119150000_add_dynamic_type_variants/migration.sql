-- A product variant currently represents a unit type (for example Type 36).
-- Move price and stock into a dynamic child table so each type can own many variants.
CREATE TABLE `product_type_variants` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `product_variant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `code` VARCHAR(100) NULL,
    `base_price` BIGINT NOT NULL,
    `current_price` BIGINT NOT NULL,
    `min_price` BIGINT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `product_type_variants_product_variant_id_name_key`(`product_variant_id`, `name`),
    UNIQUE INDEX `product_type_variants_company_id_code_key`(`company_id`, `code`),
    INDEX `product_type_variants_product_variant_id_idx`(`product_variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `product_type_variants`
    ADD CONSTRAINT `product_type_variants_company_id_fkey`
        FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `product_type_variants_product_variant_id_fkey`
        FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every existing type's price and stock as its default child variant.
INSERT INTO `product_type_variants` (
    `id`, `company_id`, `product_variant_id`, `name`, `code`,
    `base_price`, `current_price`, `min_price`, `stock`, `is_active`,
    `created_at`, `updated_at`
)
SELECT
    UUID(), `company_id`, `id`, 'Default', NULL,
    `base_price`, `current_price`, `min_price`, `stock`, true,
    `created_at`, `updated_at`
FROM `product_variants`;

ALTER TABLE `product_units` ADD COLUMN `type_variant_id` VARCHAR(36) NULL AFTER `variant_id`;
UPDATE `product_units` AS unit_row
JOIN `product_type_variants` AS type_variant
  ON type_variant.`product_variant_id` = unit_row.`variant_id`
SET unit_row.`type_variant_id` = type_variant.`id`;
ALTER TABLE `product_units` MODIFY `type_variant_id` VARCHAR(36) NOT NULL;
CREATE INDEX `product_units_type_variant_id_idx` ON `product_units`(`type_variant_id`);
ALTER TABLE `product_units`
    ADD CONSTRAINT `product_units_type_variant_id_fkey`
        FOREIGN KEY (`type_variant_id`) REFERENCES `product_type_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `product_variant_price_logs` ADD COLUMN `type_variant_id` VARCHAR(36) NULL AFTER `variant_id`;
UPDATE `product_variant_price_logs` AS price_log
JOIN `product_type_variants` AS type_variant
  ON type_variant.`product_variant_id` = price_log.`variant_id`
SET price_log.`type_variant_id` = type_variant.`id`;
ALTER TABLE `product_variant_price_logs` MODIFY `type_variant_id` VARCHAR(36) NOT NULL;
CREATE INDEX `product_variant_price_logs_type_variant_id_idx` ON `product_variant_price_logs`(`type_variant_id`);
ALTER TABLE `product_variant_price_logs`
    ADD CONSTRAINT `product_variant_price_logs_type_variant_id_fkey`
        FOREIGN KEY (`type_variant_id`) REFERENCES `product_type_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `product_variant_price_logs` DROP FOREIGN KEY `product_variant_price_logs_variant_id_fkey`;
DROP INDEX `product_variant_price_logs_variant_id_idx` ON `product_variant_price_logs`;
ALTER TABLE `product_variant_price_logs` DROP COLUMN `variant_id`;

ALTER TABLE `product_variants`
    DROP COLUMN `base_price`,
    DROP COLUMN `current_price`,
    DROP COLUMN `min_price`,
    DROP COLUMN `stock`;
