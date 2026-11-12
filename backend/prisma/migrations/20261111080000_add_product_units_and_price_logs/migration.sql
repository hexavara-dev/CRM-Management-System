-- AlterTable
ALTER TABLE `product_media` ADD COLUMN `unit_id` VARCHAR(36) NULL;

-- CreateTable
CREATE TABLE `product_units` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `variant_id` VARCHAR(36) NOT NULL,
    `category_id` VARCHAR(36) NOT NULL,
    `characteristic_id` VARCHAR(36) NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(150) NULL,
    `status` ENUM('AVAILABLE', 'RESERVED', 'BOOKED', 'SOLD', 'BLOCKED') NOT NULL DEFAULT 'AVAILABLE',
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `adjustment_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `adjustment_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `product_units_variant_id_idx`(`variant_id`),
    INDEX `product_units_category_id_idx`(`category_id`),
    INDEX `product_units_characteristic_id_idx`(`characteristic_id`),
    UNIQUE INDEX `product_units_tenant_id_code_key`(`tenant_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variant_price_logs` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `variant_id` VARCHAR(36) NOT NULL,
    `category_id` VARCHAR(36) NULL,
    `adjustment_price` DECIMAL(18, 2) NOT NULL,
    `effective_start` DATE NOT NULL,
    `effective_end` DATE NULL,
    `reason` TEXT NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `product_variant_price_logs_variant_id_idx`(`variant_id`),
    INDEX `product_variant_price_logs_category_id_idx`(`category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `product_media_unit_id_idx` ON `product_media`(`unit_id`);

-- AddForeignKey
ALTER TABLE `product_media` ADD CONSTRAINT `product_media_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `product_units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_units` ADD CONSTRAINT `product_units_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_units` ADD CONSTRAINT `product_units_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_units` ADD CONSTRAINT `product_units_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_units` ADD CONSTRAINT `product_units_characteristic_id_fkey` FOREIGN KEY (`characteristic_id`) REFERENCES `characteristics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variant_price_logs` ADD CONSTRAINT `product_variant_price_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variant_price_logs` ADD CONSTRAINT `product_variant_price_logs_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variant_price_logs` ADD CONSTRAINT `product_variant_price_logs_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

