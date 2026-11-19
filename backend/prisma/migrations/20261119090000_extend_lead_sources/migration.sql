-- AlterTable
ALTER TABLE `source` ADD COLUMN `description` VARCHAR(500) NULL,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `name` VARCHAR(255) NOT NULL;

