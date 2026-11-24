-- Satu Lead dapat memiliki banyak label Prospek melalui tabel penghubung.
CREATE TABLE `lead_label_assignments` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `label_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `lead_label_assignments_lead_id_label_id_key`(`lead_id`, `label_id`),
    INDEX `lead_label_assignments_company_id_label_id_idx`(`company_id`, `label_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Pertahankan assignment Temperature tunggal dari implementasi sebelumnya.
INSERT INTO `lead_label_assignments` (`id`, `company_id`, `lead_id`, `label_id`)
SELECT UUID(), `company_id`, `id`, `temperature_label_id`
FROM `lead`
WHERE `temperature_label_id` IS NOT NULL;

ALTER TABLE `lead_label_assignments`
    ADD CONSTRAINT `lead_label_assignments_company_id_fkey`
        FOREIGN KEY (`company_id`) REFERENCES `company`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `lead_label_assignments_lead_id_fkey`
        FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `lead_label_assignments_label_id_fkey`
        FOREIGN KEY (`label_id`) REFERENCES `lead_labels`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `lead`
    DROP FOREIGN KEY `lead_temperature_label_id_fkey`,
    DROP INDEX `lead_temperature_label_id_idx`,
    DROP COLUMN `temperature_label_id`;
