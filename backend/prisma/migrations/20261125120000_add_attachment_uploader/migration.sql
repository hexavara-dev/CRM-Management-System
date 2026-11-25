-- AlterTable
ALTER TABLE `attachment`
    ADD COLUMN `uploaded_by_id` VARCHAR(36) NULL,
    ADD COLUMN `lead_activity_id` VARCHAR(36) NULL;

-- AddForeignKey
ALTER TABLE `attachment`
    ADD CONSTRAINT `attachment_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `attachment_lead_activity_id_fkey` FOREIGN KEY (`lead_activity_id`) REFERENCES `lead_activity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
