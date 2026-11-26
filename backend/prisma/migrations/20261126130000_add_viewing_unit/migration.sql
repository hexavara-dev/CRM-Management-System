ALTER TABLE `viewing`
  ADD COLUMN `unit_id` VARCHAR(36) NULL,
  ADD INDEX `viewing_company_id_unit_id_idx` (`company_id`, `unit_id`),
  ADD CONSTRAINT `viewing_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `product_units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
