-- Tabel sementara untuk kategori dan lokasi (milik epic CRM-2).
-- Hapus migrasi ini setelah migrasi kategori dari PR CRM-2 masuk ke main.

-- CreateTable
CREATE TABLE `product_categories` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `parent_id` VARCHAR(36) NULL,
    `name` VARCHAR(150) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(150) NOT NULL,
    `type` ENUM('CATEGORY', 'PROJECT', 'CLUSTER', 'BLOCK', 'WAREHOUSE', 'RACK', 'BIN') NOT NULL,
    `siteplan_img` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `product_categories_tenant_id_type_idx`(`tenant_id`, `type`),
    INDEX `product_categories_parent_id_idx`(`parent_id`),
    UNIQUE INDEX `product_categories_tenant_id_code_key`(`tenant_id`, `code`),
    UNIQUE INDEX `product_categories_tenant_id_slug_key`(`tenant_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `product_categories`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
