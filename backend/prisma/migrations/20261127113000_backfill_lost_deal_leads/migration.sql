-- Deal Lost lama juga harus muncul pada Arsip Leads. Histori Deal tetap utuh;
-- migration hanya mengisi state arsip Lead yang berelasi.
UPDATE `lead` AS l
INNER JOIN (
    SELECT
        d.`lead_id`,
        MAX(COALESCE(d.`closing_date`, d.`updated_at`)) AS `lost_at`,
        MAX(d.`lost_reason`) AS `lost_reason`
    FROM `deal` AS d
    INNER JOIN `status` AS s ON s.`id` = d.`status_id`
    WHERE s.`is_failed_status` = TRUE
      AND d.`lead_id` IS NOT NULL
    GROUP BY d.`lead_id`
) AS lost ON lost.`lead_id` = l.`id`
SET
    l.`archive_category` = 'DEAL_LOST',
    l.`archive_reason` = LEFT(COALESCE(lost.`lost_reason`, l.`archive_reason`, 'Deal Lost'), 500),
    l.`archived_at` = COALESCE(l.`archived_at`, lost.`lost_at`, CURRENT_TIMESTAMP(6));
