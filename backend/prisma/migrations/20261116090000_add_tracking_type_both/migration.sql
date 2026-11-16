-- Inventory tracking: add BOTH to company.tracking_type.
-- Existing companies keep their value (UNIT); new companies default to BOTH.
ALTER TABLE `company` MODIFY `tracking_type` ENUM('QUANTITY', 'UNIT', 'BOTH') NOT NULL DEFAULT 'BOTH';
