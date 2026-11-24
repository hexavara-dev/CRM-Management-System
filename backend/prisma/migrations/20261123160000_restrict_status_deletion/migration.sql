-- Status adalah master konfigurasi. Jangan lepaskan relasi Lead, Deal, atau Visit saat status dihapus.
ALTER TABLE `lead`
    DROP FOREIGN KEY `lead_status_id_fkey`;
ALTER TABLE `lead`
    ADD CONSTRAINT `lead_status_id_fkey`
        FOREIGN KEY (`status_id`) REFERENCES `status`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `deal`
    DROP FOREIGN KEY `deal_status_id_fkey`;
ALTER TABLE `deal`
    ADD CONSTRAINT `deal_status_id_fkey`
        FOREIGN KEY (`status_id`) REFERENCES `status`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `viewing`
    DROP FOREIGN KEY `viewing_status_id_fkey`;
ALTER TABLE `viewing`
    ADD CONSTRAINT `viewing_status_id_fkey`
        FOREIGN KEY (`status_id`) REFERENCES `status`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;
