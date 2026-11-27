-- Kontrol per template untuk menampilkan opsi "Buat Deal Sekaligus" di form Add Lead.
ALTER TABLE `lead_form_templates`
  ADD COLUMN `show_deal_creation_option` BOOLEAN NOT NULL DEFAULT false;
