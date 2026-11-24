ALTER TABLE `lead`
    ADD COLUMN `archive_category` ENUM('NOT_RESPOND', 'INVALID', 'NOT_QUALIFIED') NULL,
    ADD COLUMN `archive_reason` VARCHAR(500) NULL,
    ADD COLUMN `archived_at` DATETIME(6) NULL,
    ADD COLUMN `archived_by_id` VARCHAR(36) NULL;

CREATE INDEX `lead_company_id_archived_at_idx` ON `lead`(`company_id`, `archived_at`);
CREATE INDEX `lead_company_id_archive_category_archived_at_idx`
    ON `lead`(`company_id`, `archive_category`, `archived_at`);

ALTER TABLE `lead`
    ADD CONSTRAINT `lead_archived_by_id_fkey`
    FOREIGN KEY (`archived_by_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
