-- Dokumen persyaratan Deal: keterangan dan jenis pembayaran pada evidence tahapan.
ALTER TABLE `stage_evidence_requirements`
    ADD COLUMN `description` VARCHAR(255) NULL,
    ADD COLUMN `payment_methods` JSON NULL;

-- Berkas mencatat nama dokumen dan tahapan asalnya.
ALTER TABLE `attachment`
    ADD COLUMN `document_name` VARCHAR(150) NULL,
    ADD COLUMN `document_stage_id` VARCHAR(36) NULL;

CREATE INDEX `attachment_document_stage_id_idx` ON `attachment`(`document_stage_id`);

ALTER TABLE `attachment`
    ADD CONSTRAINT `attachment_document_stage_id_fkey`
        FOREIGN KEY (`document_stage_id`) REFERENCES `stage`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- Deal lama tidak memegang status unit.
ALTER TABLE `deal` ADD COLUMN `unit_claimed` BOOLEAN NOT NULL DEFAULT false;
