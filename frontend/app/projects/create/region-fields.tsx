"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RegionSelect, loadRegions, type Province } from "./region-select";

export function RegionFields({ postal, address }: { postal: ReactNode; address: ReactNode }) {
  const [regions, setRegions] = useState<Province[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provinceCode, setProvinceCode] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [villageCode, setVillageCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadRegions()
      .then((data) => !cancelled && setRegions(data))
      .catch(() => !cancelled && setError("Gagal memuat data wilayah. Muat ulang halaman."));
    return () => {
      cancelled = true;
    };
  }, []);

  const province = regions?.find((p) => p.c === provinceCode);
  const cities = province?.r ?? [];
  const city = cities.find((c) => c.c === cityCode);
  const districts = city?.d ?? [];
  const district = districts.find((d) => d.c === districtCode);
  const villages = district?.v ?? [];

  const loading = !regions && !error;
  const loadingHint = loading ? "Memuat data…" : error ?? "";

  return (
    <>
      {error && <p className="text-xs text-[#D64545] md:col-span-2">{error}</p>}
      <RegionSelect
        label="Province"
        name="province"
        value={provinceCode}
        onChange={(c) => {
          setProvinceCode(c);
          setCityCode("");
          setDistrictCode("");
          setVillageCode("");
        }}
        options={(regions ?? []).map(({ c, n }) => ({ c, n }))}
        placeholder="Pilih provinsi"
        emptyHint={loadingHint || "Data provinsi kosong"}
        disabled={loading}
      />
      {postal}
      <RegionSelect
        label="City/Regency"
        name="city"
        value={cityCode}
        onChange={(c) => {
          setCityCode(c);
          setDistrictCode("");
          setVillageCode("");
        }}
        options={cities}
        placeholder="Pilih kota/kabupaten"
        emptyHint={provinceCode ? "Tidak ada data kota/kabupaten" : "Pilih provinsi terlebih dahulu"}
        disabled={!provinceCode}
      />
      {address}
      <RegionSelect
        label="Subdistrict"
        name="subdistrict"
        value={districtCode}
        onChange={(c) => {
          setDistrictCode(c);
          setVillageCode("");
        }}
        options={districts}
        placeholder="Pilih kecamatan"
        emptyHint={cityCode ? "Tidak ada data kecamatan" : "Pilih kota/kabupaten terlebih dahulu"}
        disabled={!cityCode}
      />
      <RegionSelect
        label="Village"
        name="village"
        value={villageCode}
        onChange={setVillageCode}
        options={villages}
        placeholder="Pilih kelurahan/desa"
        emptyHint={districtCode ? "Tidak ada data kelurahan/desa" : "Pilih kecamatan terlebih dahulu"}
        disabled={!districtCode}
      />
    </>
  );
}
