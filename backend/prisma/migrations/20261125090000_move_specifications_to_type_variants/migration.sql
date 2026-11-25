-- Spesifikasi unit pindah dari tipe (product_variants) ke varian (product_type_variants).
ALTER TABLE `product_attributes` ADD COLUMN `type_variant_id` VARCHAR(36) NULL;

-- Salin spesifikasi tipe ke semua variannya; bila ada nilai ganda, yang terakhir diubah yang dipakai.
INSERT INTO `product_attributes`
    (`id`, `company_id`, `product_id`, `variant_id`, `type_variant_id`, `attribute_id`, `value`, `created_at`, `updated_at`)
SELECT UUID(), src.`company_id`, src.`product_id`, src.`variant_id`, tv.`id`, src.`attribute_id`, src.`value`, src.`created_at`, src.`updated_at`
FROM (
    SELECT pa.*, ROW_NUMBER() OVER (
        PARTITION BY pa.`variant_id`, pa.`attribute_id`
        ORDER BY pa.`updated_at` DESC, pa.`id`
    ) AS `row_no`
    FROM `product_attributes` pa
    WHERE pa.`variant_id` IS NOT NULL
) src
JOIN `product_type_variants` tv
    ON tv.`product_variant_id` = src.`variant_id` AND tv.`company_id` = src.`company_id`
WHERE src.`row_no` = 1;

-- Hapus baris tipe lama hanya bila salinannya ada.
DELETE old_row FROM `product_attributes` old_row
JOIN (
    SELECT DISTINCT `variant_id`, `attribute_id`
    FROM `product_attributes`
    WHERE `type_variant_id` IS NOT NULL
) copied
    ON copied.`variant_id` = old_row.`variant_id` AND copied.`attribute_id` = old_row.`attribute_id`
WHERE old_row.`type_variant_id` IS NULL;

CREATE UNIQUE INDEX `product_attributes_type_variant_id_attribute_id_key`
    ON `product_attributes`(`type_variant_id`, `attribute_id`);

ALTER TABLE `product_attributes`
    ADD CONSTRAINT `product_attributes_type_variant_id_fkey`
        FOREIGN KEY (`type_variant_id`) REFERENCES `product_type_variants`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;
