ALTER TABLE `viewing`
  ADD COLUMN `customer_id` VARCHAR(36) NULL;

UPDATE `viewing` v
INNER JOIN `lead` l ON l.`id` = v.`lead_id`
SET v.`customer_id` = l.`customer_id`
WHERE v.`customer_id` IS NULL;

ALTER TABLE `viewing`
  MODIFY COLUMN `customer_id` VARCHAR(36) NOT NULL,
  ADD INDEX `viewing_company_id_customer_id_idx` (`company_id`, `customer_id`),
  ADD CONSTRAINT `viewing_customer_id_fkey`
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  DROP FOREIGN KEY `viewing_lead_id_fkey`,
  DROP COLUMN `lead_id`;
