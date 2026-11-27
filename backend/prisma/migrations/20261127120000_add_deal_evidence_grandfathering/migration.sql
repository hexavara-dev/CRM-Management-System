-- Evidence baru tidak boleh menghambat Deal lama yang telah pernah mencapai suatu fase.
ALTER TABLE `deal`
    ADD COLUMN `evidence_grandfathered_stage_ids` JSON NULL;

-- Inisialisasi Deal lama dari fase saat ini dan audit perpindahan fase yang sudah ada.
-- JSON_ARRAY_APPEND boleh menyimpan satu ID duplikat; pengecekan aplikasi memperlakukannya sebagai set.
UPDATE `deal` AS d
LEFT JOIN (
    SELECT distinct_history.`entity_id`, JSON_ARRAYAGG(distinct_history.`stage_id`) AS `stage_ids`
    FROM (
        SELECT DISTINCT h.`entity_id`, h.`stage_id`
        FROM (
        SELECT `entity_id`, JSON_UNQUOTE(JSON_EXTRACT(`changes`, '$.stageId.old')) AS `stage_id`
        FROM `audit_log`
        WHERE `entity_type` = 'deal' AND `action` = 'stage_changed'
        UNION ALL
        SELECT `entity_id`, JSON_UNQUOTE(JSON_EXTRACT(`changes`, '$.stageId.new')) AS `stage_id`
        FROM `audit_log`
        WHERE `entity_type` = 'deal' AND `action` = 'stage_changed'
        ) AS h
        WHERE h.`stage_id` IS NOT NULL
    ) AS distinct_history
    GROUP BY distinct_history.`entity_id`
) AS history ON history.`entity_id` = d.`id`
SET d.`evidence_grandfathered_stage_ids` = CASE
    WHEN history.`stage_ids` IS NULL THEN IF(d.`stage_id` IS NULL, JSON_ARRAY(), JSON_ARRAY(d.`stage_id`))
    WHEN d.`stage_id` IS NULL THEN history.`stage_ids`
    ELSE JSON_ARRAY_APPEND(history.`stage_ids`, '$', d.`stage_id`)
END;
