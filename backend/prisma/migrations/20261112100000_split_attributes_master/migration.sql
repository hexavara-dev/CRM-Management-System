-- Split attribute definitions (master `attributes`) from their values (pivot `product_attributes`).

-- CreateTable
CREATE TABLE `attributes` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `data_type` ENUM('NUMBER', 'STRING') NOT NULL,
    `unit` VARCHAR(30) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `attributes_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- One master row per (company, code) taken from the existing attribute rows
INSERT INTO `attributes` (`id`, `company_id`, `name`, `code`, `data_type`, `unit`, `updated_at`)
SELECT UUID(), `company_id`, MIN(`name`), `code`, MIN(`data_type`), MIN(`unit`), NOW(6)
FROM `product_attributes`
GROUP BY `company_id`, `code`;

-- Point every value row to its master row, then drop the definition columns
ALTER TABLE `product_attributes` ADD COLUMN `attribute_id` VARCHAR(36) NULL;
UPDATE `product_attributes` pa
    JOIN `attributes` a ON a.`company_id` = pa.`company_id` AND a.`code` = pa.`code`
    SET pa.`attribute_id` = a.`id`;
ALTER TABLE `product_attributes`
    MODIFY `attribute_id` VARCHAR(36) NOT NULL,
    DROP COLUMN `name`,
    DROP COLUMN `code`,
    DROP COLUMN `data_type`,
    DROP COLUMN `unit`;

-- CreateIndex
CREATE INDEX `product_attributes_attribute_id_idx` ON `product_attributes`(`attribute_id`);

-- AddForeignKey
ALTER TABLE `attributes` ADD CONSTRAINT `attributes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_attributes` ADD CONSTRAINT `product_attributes_attribute_id_fkey` FOREIGN KEY (`attribute_id`) REFERENCES `attributes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
