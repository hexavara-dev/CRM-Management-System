-- AlterTable
ALTER TABLE `lead` ADD COLUMN `budget` BIGINT NULL,
    ADD COLUMN `campaign_id` VARCHAR(36) NULL,
    ADD COLUMN `custom_values` JSON NULL,
    ADD COLUMN `form_template_version_id` VARCHAR(36) NULL,
    ADD COLUMN `needs_notes` TEXT NULL,
    ADD COLUMN `temperature_label_id` VARCHAR(36) NULL;

-- CreateTable
CREATE TABLE `lead_interests` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL,
    `variant_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `lead_interests_company_id_product_id_idx`(`company_id`, `product_id`),
    INDEX `lead_interests_lead_id_idx`(`lead_id`),
    INDEX `lead_interests_variant_id_idx`(`variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `lead_campaign_id_idx` ON `lead`(`campaign_id`);

-- CreateIndex
CREATE INDEX `lead_temperature_label_id_idx` ON `lead`(`temperature_label_id`);

-- CreateIndex
CREATE INDEX `lead_form_template_version_id_idx` ON `lead`(`form_template_version_id`);

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `lead_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_temperature_label_id_fkey` FOREIGN KEY (`temperature_label_id`) REFERENCES `lead_labels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_form_template_version_id_fkey` FOREIGN KEY (`form_template_version_id`) REFERENCES `lead_form_template_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_interests` ADD CONSTRAINT `lead_interests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_interests` ADD CONSTRAINT `lead_interests_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_interests` ADD CONSTRAINT `lead_interests_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_interests` ADD CONSTRAINT `lead_interests_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

