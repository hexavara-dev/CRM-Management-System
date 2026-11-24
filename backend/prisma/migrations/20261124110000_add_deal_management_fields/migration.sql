-- Deal Management: link a transaction to its Property Management unit and financing data.

ALTER TABLE `deal`
  ADD COLUMN `unit_id` VARCHAR(36) NULL,
  ADD COLUMN `payment_method` ENUM('CASH', 'KPR', 'KPR_SHARIA') NOT NULL DEFAULT 'CASH',
  ADD COLUMN `bank_name` VARCHAR(150) NULL,
  ADD INDEX `deal_company_id_unit_id_idx` (`company_id`, `unit_id`),
  ADD INDEX `deal_company_id_payment_method_idx` (`company_id`, `payment_method`);

ALTER TABLE `deal`
  ADD CONSTRAINT `deal_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `product_units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
