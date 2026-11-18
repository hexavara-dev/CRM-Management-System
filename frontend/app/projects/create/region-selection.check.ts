// Cek: nilai wilayah tersimpan proyek dipassing ke select sebagai selected option.
// Jalankan: npx tsx app/projects/create/region-selection.check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Province } from "./region-select";
import { SAVED_CITY, SAVED_PROVINCE, resolveRegionSelection } from "./region-selection";

const regions = JSON.parse(readFileSync(join(process.cwd(), "public/data/wilayah.json"), "utf8")) as Province[];
const names = (s: ReturnType<typeof resolveRegionSelection>) =>
  [s.province.selected?.n, s.city.selected?.n, s.district.selected?.n, s.village.selected?.n];

// 1. Proyek tersimpan (Green Sukma) + wilayah.json termuat -> keempat level terpilih dengan kode wilayah asli.
const greenSukma = { province: "Jawa Barat", city: "Kota Bogor", subdistrict: "Bogor Utara", village: "Bantarjati" };
const loaded = resolveRegionSelection(regions, greenSukma, {});
assert.deepEqual(names(loaded), ["Jawa Barat", "Kota Bogor", "Bogor Utara", "Bantarjati"]);
assert.equal(loaded.province.code, regions.find((p) => p.n === "Jawa Barat")?.c);
assert.ok(!loaded.province.code.startsWith("__saved"));
assert.ok(loaded.province.options.some((o) => o.c === loaded.province.code), "kode terpilih harus ada di options");

// 2. Sebelum wilayah.json termuat -> nilai tersimpan tetap tampil sebagai selected option sementara.
const loading = resolveRegionSelection(null, greenSukma, {});
assert.equal(loading.province.code, SAVED_PROVINCE);
assert.equal(loading.city.code, SAVED_CITY);
assert.deepEqual(names(loading), ["Jawa Barat", "Kota Bogor", "Bogor Utara", "Bantarjati"]);

// 3. Seed lain (DIY) dan nama kota tanpa awalan "Kota" tetap cocok.
const diy = resolveRegionSelection(regions, { province: "Daerah Istimewa Yogyakarta", city: "Yogyakarta", subdistrict: "Gondokusuman", village: "Demangan" }, {});
assert.deepEqual(names(diy), ["Daerah Istimewa Yogyakarta", "Kota Yogyakarta", "Gondokusuman", "Demangan"]);

// 4. Nama yang tidak ada di data resmi tetap dipertahankan sebagai selected option.
const legacy = resolveRegionSelection(regions, { province: "Provinsi Lama", city: "", subdistrict: "", village: "" }, {});
assert.equal(legacy.province.code, SAVED_PROVINCE);
assert.equal(legacy.province.selected?.n, "Provinsi Lama");

// 5. Proyek tanpa wilayah tersimpan ('' di DB) -> tidak ada yang bisa dipilih otomatis.
const empty = resolveRegionSelection(regions, { province: "", city: "", subdistrict: "", village: "" }, {});
assert.equal(empty.province.code, "");
assert.equal(empty.province.selected, undefined);

// 6. User ganti provinsi -> level bawah dikosongkan, bukan memakai nilai tersimpan lama.
const jatim = regions.find((p) => p.n === "Jawa Timur")?.c ?? "";
const changed = resolveRegionSelection(regions, greenSukma, { province: jatim, city: "", district: "", village: "" });
assert.equal(changed.province.selected?.n, "Jawa Timur");
assert.equal(changed.city.code, "");
assert.equal(changed.city.selected, undefined);

process.stdout.write("region-selection.check: OK\n");
