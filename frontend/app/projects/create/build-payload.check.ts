// Cek cepat penyusun payload simpan proyek. Jalankan: npx tsx app/projects/create/build-payload.check.ts
import assert from "node:assert/strict";
import { buildProjectPayload } from "./build-payload";

const info = { code: "CL", name: " Citraland ", status: "Inactive", description: "", province: "Jawa Timur", city: "Malang", subdistrict: " Bululawang ", village: "", address: "", postalCode: "" };
const type36 = { name: "Type 36", buildingArea: "36.4", surfaceArea: "", floors: "1", bedroom: "2", bathroom: "1", carport: "", stock: "3", basePrice: "350000000" };
const nodes = [
  { id: "n1", parentId: "root", name: "Cluster A", level: "Cluster" },
  { id: "n2", parentId: "n1", name: "Block A", level: "Block" },
];
const units = [{ id: "u1", locationId: "n2", code: "A-01", type: "Type 36", hook: "1", status: "Reserved" }];

const payload = buildProjectPayload({ info, unitTypes: [type36], nodes, units });
assert.equal(payload.name, "Citraland");
assert.equal(payload.isActive, false); // Inactive -> false; Active/In Development -> true
assert.equal("description" in payload, false); // kosong tidak dikirim
assert.deepEqual([payload.province, payload.city, payload.subdistrict], ["Jawa Timur", "Malang", "Bululawang"]); // di-trim
assert.equal("village" in payload, false);
assert.deepEqual(payload.variants[0].attributes.map((a) => [a.code, a.value]), [
  ["building_area", 36], // dibulatkan
  ["surface_area", 0], // kosong dikirim 0
  ["floors", 1],
  ["bedroom", 2],
  ["bathroom", 1],
  ["carport", 0],
]);
assert.deepEqual(payload.locations, [
  { key: "n1", parentKey: null, name: "Cluster A", type: "CLUSTER" },
  { key: "n2", parentKey: "n1", name: "Block A", type: "BLOCK" },
]);
assert.deepEqual(payload.units, [{ code: "A-01", variantIndex: 0, locationKey: "n2", status: "RESERVED" }]);

assert.throws(() => buildProjectPayload({ info, unitTypes: [type36], nodes: [{ ...nodes[0], level: "Room" }], units: [] }), /belum didukung/);
assert.throws(() => buildProjectPayload({ info, unitTypes: [type36, type36], nodes, units }), /tidak boleh sama/);
assert.throws(() => buildProjectPayload({ info, unitTypes: [type36], nodes, units: [{ ...units[0], type: "Type 99" }] }), /tidak ada di Unit Type/);

console.log("build-payload OK");
