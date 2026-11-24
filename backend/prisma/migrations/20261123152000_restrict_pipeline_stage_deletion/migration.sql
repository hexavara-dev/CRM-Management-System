-- Pipeline stage yang masih digunakan Lead atau Deal tidak boleh dihapus.
ALTER TABLE `lead`
    DROP FOREIGN KEY `lead_stage_id_fkey`;
ALTER TABLE `lead`
    ADD CONSTRAINT `lead_stage_id_fkey`
        FOREIGN KEY (`stage_id`) REFERENCES `stage`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `deal`
    DROP FOREIGN KEY `deal_stage_id_fkey`;
ALTER TABLE `deal`
    ADD CONSTRAINT `deal_stage_id_fkey`
        FOREIGN KEY (`stage_id`) REFERENCES `stage`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;
