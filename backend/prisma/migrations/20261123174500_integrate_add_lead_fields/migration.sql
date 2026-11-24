ALTER TABLE `lead`
    ADD COLUMN `project_id` VARCHAR(36) NULL,
    ADD COLUMN `product_variant_id` VARCHAR(36) NULL,
    ADD COLUMN `priority` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM';

CREATE INDEX `lead_project_id_idx` ON `lead`(`project_id`);
CREATE INDEX `lead_product_variant_id_idx` ON `lead`(`product_variant_id`);

ALTER TABLE `lead`
    ADD CONSTRAINT `lead_project_id_fkey`
        FOREIGN KEY (`project_id`) REFERENCES `products`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `lead_product_variant_id_fkey`
        FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;
