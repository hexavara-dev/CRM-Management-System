-- Evidence baru tidak boleh menghambat Lead lama yang telah pernah mencapai suatu fase.
ALTER TABLE `lead`
    ADD COLUMN `evidence_grandfathered_stage_ids` JSON NULL;

-- Inisialisasi Lead lama dari fase saat ini dan semua format audit perpindahan fase yang pernah dipakai.
UPDATE `lead` AS l
LEFT JOIN (
    SELECT distinct_history.`entity_id`, JSON_ARRAYAGG(distinct_history.`stage_id`) AS `stage_ids`
    FROM (
        SELECT DISTINCT h.`entity_id`, h.`stage_id`
        FROM (
            SELECT `entity_id`, JSON_UNQUOTE(JSON_EXTRACT(`changes`, '$.stageId.old')) AS `stage_id`
            FROM `audit_log`
            WHERE `entity_type` = 'lead' AND `action` IN ('stage_changed', 'stage-change')
            UNION ALL
            SELECT `entity_id`, JSON_UNQUOTE(JSON_EXTRACT(`changes`, '$.stageId.new')) AS `stage_id`
            FROM `audit_log`
            WHERE `entity_type` = 'lead' AND `action` IN ('stage_changed', 'stage-change')
        ) AS h
        WHERE h.`stage_id` IS NOT NULL
    ) AS distinct_history
    GROUP BY distinct_history.`entity_id`
) AS history ON history.`entity_id` = l.`id`
SET l.`evidence_grandfathered_stage_ids` = CASE
    WHEN history.`stage_ids` IS NULL THEN IF(l.`stage_id` IS NULL, JSON_ARRAY(), JSON_ARRAY(l.`stage_id`))
    WHEN l.`stage_id` IS NULL THEN history.`stage_ids`
    ELSE JSON_ARRAY_APPEND(history.`stage_ids`, '$', l.`stage_id`)
END;
