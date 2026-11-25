-- Foto varian: product_media menempel ke product_type_variants.
ALTER TABLE `product_media` ADD COLUMN `type_variant_id` VARCHAR(36) NULL;

CREATE INDEX `product_media_type_variant_id_idx` ON `product_media`(`type_variant_id`);

ALTER TABLE `product_media`
    ADD CONSTRAINT `product_media_type_variant_id_fkey`
        FOREIGN KEY (`type_variant_id`) REFERENCES `product_type_variants`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;
