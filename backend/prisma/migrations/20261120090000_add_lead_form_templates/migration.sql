-- CreateTable
CREATE TABLE `lead_form_templates` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(500) NULL,
    `icon` VARCHAR(50) NOT NULL,
    `color` VARCHAR(7) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `default_guard` VARCHAR(10) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `current_version_id` VARCHAR(36) NULL,
    `updated_by_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `lead_form_templates_company_id_name_key`(`company_id`, `name`),
    UNIQUE INDEX `lead_form_templates_company_id_default_guard_key`(`company_id`, `default_guard`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_form_template_versions` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `fields` JSON NOT NULL,
    `is_locked` BOOLEAN NOT NULL DEFAULT false,
    `created_by_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `lead_form_template_versions_company_id_idx`(`company_id`),
    UNIQUE INDEX `lead_form_template_versions_template_id_version_key`(`template_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lead_form_templates` ADD CONSTRAINT `lead_form_templates_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_form_templates` ADD CONSTRAINT `lead_form_templates_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_form_template_versions` ADD CONSTRAINT `lead_form_template_versions_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `lead_form_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_form_template_versions` ADD CONSTRAINT `lead_form_template_versions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_form_template_versions` ADD CONSTRAINT `lead_form_template_versions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

