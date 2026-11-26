-- Luas boleh dua angka di belakang koma; nilai lama (bulat) tetap sama.
ALTER TABLE `product_attributes` MODIFY `value` DECIMAL(12, 2) NOT NULL;

-- Kode varian unik per tipe, bukan per company. Indeks pengganti dibuat lebih dulu karena dipakai foreign key.
CREATE INDEX `product_type_variants_company_id_idx` ON `product_type_variants`(`company_id`);
CREATE UNIQUE INDEX `product_type_variants_product_variant_id_code_key` ON `product_type_variants`(`product_variant_id`, `code`);
DROP INDEX `product_type_variants_company_id_code_key` ON `product_type_variants`;
