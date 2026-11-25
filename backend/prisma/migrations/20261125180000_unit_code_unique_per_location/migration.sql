-- Kode unit unik per lokasi (blok/lantai), bukan per company.
-- Indeks pengganti dibuat lebih dulu karena dipakai foreign key.
CREATE INDEX `product_units_company_id_code_idx` ON `product_units`(`company_id`, `code`);
CREATE UNIQUE INDEX `product_units_category_id_code_key` ON `product_units`(`category_id`, `code`);
DROP INDEX `product_units_company_id_code_key` ON `product_units`;
DROP INDEX `product_units_category_id_idx` ON `product_units`;
