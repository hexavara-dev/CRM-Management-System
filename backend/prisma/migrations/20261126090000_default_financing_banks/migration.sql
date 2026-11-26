-- Pilihan bank pembiayaan awal untuk setiap company yang sudah ada.
-- Bank dengan nama yang sama di company tersebut dilewati, jadi data lama tidak berubah.
INSERT INTO `financing_banks` (`id`, `company_id`, `name`, `is_active`, `created_at`, `updated_at`)
SELECT UUID(), `company`.`id`, `starter`.`name`, true, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
FROM `company`
CROSS JOIN (
    SELECT 'Bank BRI' AS `name`
    UNION ALL SELECT 'Bank Mandiri'
    UNION ALL SELECT 'Bank BNI'
    UNION ALL SELECT 'Bank BTN'
    UNION ALL SELECT 'Bank BCA'
    UNION ALL SELECT 'Bank Syariah Indonesia (BSI)'
    UNION ALL SELECT 'Bank BCA Syariah'
    UNION ALL SELECT 'Bank Muamalat'
    UNION ALL SELECT 'Bank CIMB Niaga'
    UNION ALL SELECT 'Bank Danamon'
    UNION ALL SELECT 'Bank Permata'
    UNION ALL SELECT 'Bank OCBC Indonesia'
    UNION ALL SELECT 'Bank Maybank Indonesia'
    UNION ALL SELECT 'Bank Panin'
    UNION ALL SELECT 'Bank Mega'
    UNION ALL SELECT 'Bank UOB Indonesia'
    UNION ALL SELECT 'Bank DBS Indonesia'
    UNION ALL SELECT 'Bank HSBC Indonesia'
) AS `starter`
WHERE NOT EXISTS (
    SELECT 1 FROM `financing_banks` AS `existing`
    WHERE `existing`.`company_id` = `company`.`id`
      AND `existing`.`name` = `starter`.`name`
);
