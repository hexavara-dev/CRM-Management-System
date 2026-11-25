-- Konfigurasi fasilitas proyek: status dan deskripsi pada master attribute.
ALTER TABLE `attributes`
    ADD COLUMN `description` VARCHAR(255) NULL,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- Fasilitas awal hanya untuk company yang belum memiliki fasilitas sama sekali.
INSERT INTO `attributes` (`id`, `company_id`, `name`, `code`, `data_type`, `source`, `icon_key`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), `company`.`id`, `starter`.`name`, `starter`.`code`, 'NUMBER', 'PROJECT', `starter`.`icon_key`, true, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
FROM `company`
CROSS JOIN (
    SELECT 'Keamanan 24 Jam' AS `name`, 'facility_security' AS `code`, 'shield-check' AS `icon_key`
    UNION ALL SELECT 'Area Parkir', 'facility_parking', 'parking-square'
    UNION ALL SELECT 'Taman', 'facility_park', 'trees'
    UNION ALL SELECT 'Kolam Renang', 'facility_pool', 'waves'
    UNION ALL SELECT 'Area Bermain', 'facility_playground', 'shapes'
    UNION ALL SELECT 'Tempat Ibadah', 'facility_mosque', 'landmark'
    UNION ALL SELECT 'Smart Home', 'facility_smart_home', 'house'
) AS `starter`
WHERE NOT EXISTS (
    SELECT 1 FROM `attributes` AS `existing`
    WHERE `existing`.`company_id` = `company`.`id`
      AND (`existing`.`source` = 'PROJECT' OR LEFT(`existing`.`code`, 9) = 'facility_')
);
