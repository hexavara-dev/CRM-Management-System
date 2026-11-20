-- AlterTable
ALTER TABLE `stage` ADD COLUMN `is_won` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `won_guard` VARCHAR(10) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `stage_company_id_won_guard_key` ON `stage`(`company_id`, `won_guard`);

