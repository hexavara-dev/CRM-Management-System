-- CreateTable
CREATE TABLE `lead_campaigns` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `source_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(500) NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `lead_campaigns_company_id_source_id_idx`(`company_id`, `source_id`),
    UNIQUE INDEX `lead_campaigns_source_id_name_key`(`source_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lead_campaigns` ADD CONSTRAINT `lead_campaigns_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_campaigns` ADD CONSTRAINT `lead_campaigns_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

