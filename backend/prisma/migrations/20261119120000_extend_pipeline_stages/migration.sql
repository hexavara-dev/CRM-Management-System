-- AlterTable
ALTER TABLE `stage` ADD COLUMN `description` VARCHAR(500) NULL,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `probability` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `stage_evidence_requirements` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `stage_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `file_types` JSON NOT NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `stage_evidence_requirements_stage_id_sort_order_idx`(`stage_id`, `sort_order`),
    INDEX `stage_evidence_requirements_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stage_evidence_requirements` ADD CONSTRAINT `stage_evidence_requirements_stage_id_fkey` FOREIGN KEY (`stage_id`) REFERENCES `stage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_evidence_requirements` ADD CONSTRAINT `stage_evidence_requirements_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

