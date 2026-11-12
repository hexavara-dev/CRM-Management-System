-- Align product domain with the team ERD (2026-11-12).
-- Destructive: drops products.tracking_type, products.project_category_id,
-- product_categories.slug/sort_order, product_variants.code, company.inventory_tracking_mode.

-- company.tracking_type replaces company.inventory_tracking_mode (BOTH becomes UNIT)
ALTER TABLE `company` ADD COLUMN `tracking_type` ENUM('QUANTITY', 'UNIT') NOT NULL DEFAULT 'UNIT';
UPDATE `company` SET `tracking_type` = 'QUANTITY' WHERE `inventory_tracking_mode` = 'QUANTITY_ONLY';
ALTER TABLE `company` DROP COLUMN `inventory_tracking_mode`;

-- products: no tracking_type, no project_category_id
ALTER TABLE `products` DROP FOREIGN KEY `products_project_category_id_fkey`;
DROP INDEX `products_project_category_id_idx` ON `products`;
ALTER TABLE `products` DROP COLUMN `project_category_id`, DROP COLUMN `tracking_type`;

-- product_categories: type gains ZONE, TOWER, FLOOR; no slug, no sort_order
DROP INDEX `product_categories_company_id_slug_key` ON `product_categories`;
ALTER TABLE `product_categories`
    DROP COLUMN `slug`,
    DROP COLUMN `sort_order`,
    MODIFY `type` ENUM('CATEGORY', 'PROJECT', 'CLUSTER', 'BLOCK', 'WAREHOUSE', 'RACK', 'BIN', 'ZONE', 'TOWER', 'FLOOR') NOT NULL;

-- product_variants: no code, BIGINT prices (houses above 2.1 billion), current_price and stock
ALTER TABLE `product_variants` DROP FOREIGN KEY `product_variants_company_id_fkey`;
DROP INDEX `product_variants_company_id_code_key` ON `product_variants`;
ALTER TABLE `product_variants`
    DROP COLUMN `code`,
    MODIFY `base_price` BIGINT NOT NULL,
    ADD COLUMN `current_price` BIGINT NULL,
    ADD COLUMN `stock` INTEGER NOT NULL DEFAULT 0;
UPDATE `product_variants` SET `current_price` = `base_price`;
ALTER TABLE `product_variants` MODIFY `current_price` BIGINT NOT NULL;
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- product_attributes: data_type NUMBER or STRING, integer value
UPDATE `product_attributes`
    SET `value` = CASE WHEN `value` = 'true' THEN '1' ELSE '0' END, `data_type` = 'NUMBER'
    WHERE `data_type` = 'BOOLEAN';
UPDATE `product_attributes` SET `value` = '0' WHERE `value` NOT REGEXP '^-?[0-9]{1,9}$';
ALTER TABLE `product_attributes`
    MODIFY `data_type` ENUM('NUMBER', 'STRING') NOT NULL,
    MODIFY `value` INTEGER NOT NULL;

-- product_variant_price_logs: integer adjustment_price, end_date, status
ALTER TABLE `product_variant_price_logs`
    MODIFY `adjustment_price` BIGINT NOT NULL,
    RENAME COLUMN `effective_end` TO `end_date`,
    ADD COLUMN `status` ENUM('IMPLEMENT', 'SCHEDULED', 'EXPIRED') NOT NULL DEFAULT 'IMPLEMENT';
UPDATE `product_variant_price_logs`
    SET `status` = CASE
        WHEN `effective_start` > CURDATE() THEN 'SCHEDULED'
        WHEN `end_date` IS NOT NULL AND `end_date` < CURDATE() THEN 'EXPIRED'
        ELSE 'IMPLEMENT'
    END;
