-- Project location fields (the wizard's step 1) on products.
ALTER TABLE `products`
    ADD COLUMN `province` VARCHAR(100) NULL AFTER `description`,
    ADD COLUMN `city` VARCHAR(100) NULL AFTER `province`,
    ADD COLUMN `subdistrict` VARCHAR(100) NULL AFTER `city`,
    ADD COLUMN `village` VARCHAR(100) NULL AFTER `subdistrict`,
    ADD COLUMN `address` VARCHAR(255) NULL AFTER `village`,
    ADD COLUMN `postal_code` VARCHAR(10) NULL AFTER `address`;
