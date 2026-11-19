"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RegionSelect, loadRegions, type Province } from "./region-select";
import { resolveRegionSelection, type RegionEdits } from "./region-selection";
import type { ProjectInfo } from "./preview-step";

export function RegionFields({ postal, address, initial }: { postal: ReactNode; address: ReactNode; initial?: ProjectInfo }) {
  const [regions, setRegions] = useState<Province[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Nilai tersimpan dihitung langsung dari initial; state ini hanya berisi pilihan baru pengguna.
  const [edited, setEdited] = useState<RegionEdits>({});

  useEffect(() => {
    let cancelled = false;
    loadRegions()
      .then((data) => {
        if (cancelled) return;
        setRegions(data);
      })
      .catch(() => !cancelled && setError("Gagal memuat data wilayah. Muat ulang halaman."));
    return () => {
      cancelled = true;
    };
  }, []);

  // Nilai wilayah tersimpan proyek -> kode selected option tiap select (lihat region-selection.check.ts).
  const { province, city, district, village } = resolveRegionSelection(regions, initial, edited);
  const provinceCode = province.code;
  const provinceOptions = province.options;
  const cityCode = city.code;
  const cities = city.options;
  const districtCode = district.code;
  const districts = district.options;
  const villageCode = village.code;
  const villages = village.options;

  const loading = !regions && !error;
  const loadingHint = loading ? "Memuat data…" : error ?? "";

  return (
    <>
      {error && <p className="text-xs text-[#D64545] md:col-span-2">{error}</p>}
      <RegionSelect
        label="Provinsi"
        name="province"
        value={provinceCode}
        onChange={(c) => {
          setEdited({ province: c, city: "", district: "", village: "" });
        }}
        options={provinceOptions.map(({ c, n }) => ({ c, n }))}
        placeholder="Pilih provinsi"
        emptyHint={loadingHint || "Data provinsi kosong"}
        disabled={loading}
      />
      {postal}
      <RegionSelect
        label="Kota/Kabupaten"
        name="city"
        value={cityCode}
        onChange={(c) => {
          setEdited((current) => ({ ...current, city: c, district: "", village: "" }));
        }}
        options={cities}
        placeholder="Pilih kota/kabupaten"
        emptyHint={provinceCode ? "Tidak ada data kota/kabupaten" : "Pilih provinsi terlebih dahulu"}
        disabled={!provinceCode}
      />
      {address}
      <RegionSelect
        label="Kecamatan"
        name="subdistrict"
        value={districtCode}
        onChange={(c) => {
          setEdited((current) => ({ ...current, district: c, village: "" }));
        }}
        options={districts}
        placeholder="Pilih kecamatan"
        emptyHint={cityCode ? "Tidak ada data kecamatan" : "Pilih kota/kabupaten terlebih dahulu"}
        disabled={!cityCode}
      />
      <RegionSelect
        label="Kelurahan/Desa"
        name="village"
        value={villageCode}
        onChange={(c) => setEdited((current) => ({ ...current, village: c }))}
        options={villages}
        placeholder="Pilih kelurahan/desa"
        emptyHint={districtCode ? "Tidak ada data kelurahan/desa" : "Pilih kecamatan terlebih dahulu"}
        disabled={!districtCode}
      />
    </>
  );
}
