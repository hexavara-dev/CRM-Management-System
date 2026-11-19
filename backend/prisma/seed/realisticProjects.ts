import type { ProductUnitStatus } from '@prisma/client';
import type { ProductInput, VariantInput } from '../../src/usecases/product/ProductUseCase.js';
import type { LocationInput, UnitInput } from '../../src/usecases/product/catalogStructure.js';

type TypeOption = { name: string; code: string; price: number; weight: number };
type UnitType = {
  name: string;
  buildingArea: number;
  surfaceArea: number;
  floors: number;
  bedroom: number;
  bathroom: number;
  carport: number;
  options: TypeOption[];
};

export type RealisticProjectScenario = {
  payload: ProductInput;
  facilityCodes: string[];
  summary: { locations: number; units: number; statuses: Record<ProductUnitStatus, number> };
};

const STATUS_ORDER: ProductUnitStatus[] = ['AVAILABLE', 'RESERVED', 'BOOKED', 'SOLD', 'BLOCKED'];

function rng(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function statusOf(random: () => number, distribution: [ProductUnitStatus, number][]) {
  const roll = random() * 100;
  let cursor = 0;
  for (const [status, percentage] of distribution) {
    cursor += percentage;
    if (roll < cursor) return status;
  }
  return distribution.at(-1)?.[0] ?? 'AVAILABLE';
}

function typeVariantOf(types: UnitType[], random: () => number) {
  const choices = types.flatMap((type, variantIndex) =>
    type.options.map((option, typeVariantIndex) => ({ variantIndex, typeVariantIndex, weight: option.weight })),
  );
  const total = choices.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const choice of choices) {
    roll -= choice.weight;
    if (roll < 0) return choice;
  }
  return choices[choices.length - 1] as (typeof choices)[number];
}

function variantsOf(types: UnitType[], units: UnitInput[]): VariantInput[] {
  return types.map((type, variantIndex) => ({
    name: type.name,
    attributes: [
      { name: 'Building Area', code: 'building_area', dataType: 'NUMBER', unit: 'm²', value: type.buildingArea },
      { name: 'Surface Area', code: 'surface_area', dataType: 'NUMBER', unit: 'm²', value: type.surfaceArea },
      { name: 'Floors', code: 'floors', dataType: 'NUMBER', value: type.floors },
      { name: 'Bedroom', code: 'bedroom', dataType: 'NUMBER', value: type.bedroom },
      { name: 'Bathroom', code: 'bathroom', dataType: 'NUMBER', value: type.bathroom },
      { name: 'Carport', code: 'carport', dataType: 'NUMBER', value: type.carport },
    ],
    typeVariants: type.options.map((option, typeVariantIndex) => ({
      name: option.name,
      code: option.code,
      basePrice: option.price,
      currentPrice: option.price,
      minPrice: Math.round(option.price * 0.96),
      stock: units.filter((unit) => unit.variantIndex === variantIndex && unit.typeVariantIndex === typeVariantIndex).length,
      isActive: true,
    })),
  }));
}

function summaryOf(locations: LocationInput[], units: UnitInput[]) {
  const statuses = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0])) as Record<ProductUnitStatus, number>;
  units.forEach((unit) => { statuses[unit.status ?? 'AVAILABLE'] += 1; });
  return { locations: locations.length, units: units.length, statuses };
}

function landedInventory(input: {
  code: string;
  seed: number;
  clusterNames: string[];
  blocksPerCluster: number;
  unitsPerBlock: number;
  types: UnitType[];
}) {
  const random = rng(input.seed);
  const locations: LocationInput[] = [];
  const units: UnitInput[] = [];
  const distribution: [ProductUnitStatus, number][] = [
    ['AVAILABLE', 52], ['RESERVED', 11], ['BOOKED', 7], ['SOLD', 27], ['BLOCKED', 3],
  ];
  input.clusterNames.forEach((clusterName, clusterIndex) => {
    const clusterKey = `cluster-${clusterIndex + 1}`;
    locations.push({ key: clusterKey, parentKey: null, name: `Cluster ${clusterName}`, type: 'CLUSTER' });
    for (let blockIndex = 0; blockIndex < input.blocksPerCluster; blockIndex += 1) {
      const blockLabel = String.fromCharCode(65 + blockIndex);
      const blockKey = `${clusterKey}-block-${blockLabel}`;
      locations.push({ key: blockKey, parentKey: clusterKey, name: `Blok ${blockLabel}`, type: 'BLOCK' });
      for (let lot = 1; lot <= input.unitsPerBlock; lot += 1) {
        const selected = typeVariantOf(input.types, random);
        units.push({
          code: `${input.code}-${String(clusterIndex + 1).padStart(2, '0')}${blockLabel}-${String(lot).padStart(3, '0')}`,
          name: `Kavling ${blockLabel}-${String(lot).padStart(3, '0')}`,
          locationKey: blockKey,
          ...selected,
          status: statusOf(random, distribution),
          isHook: lot === 1 || lot === input.unitsPerBlock,
        });
      }
    }
  });
  return { locations, units };
}

function verticalInventory(input: {
  code: string;
  seed: number;
  towerNames: string[];
  floors: number;
  unitsPerFloor: number;
  types: UnitType[];
}) {
  const random = rng(input.seed);
  const locations: LocationInput[] = [];
  const units: UnitInput[] = [];
  const distribution: [ProductUnitStatus, number][] = [
    ['AVAILABLE', 44], ['RESERVED', 14], ['BOOKED', 9], ['SOLD', 31], ['BLOCKED', 2],
  ];
  input.towerNames.forEach((towerName, towerIndex) => {
    const towerKey = `tower-${towerIndex + 1}`;
    locations.push({ key: towerKey, parentKey: null, name: `Tower ${towerName}`, type: 'TOWER' });
    for (let floor = 1; floor <= input.floors; floor += 1) {
      const floorKey = `${towerKey}-floor-${floor}`;
      locations.push({ key: floorKey, parentKey: towerKey, name: `Lantai ${floor}`, type: 'FLOOR' });
      for (let door = 1; door <= input.unitsPerFloor; door += 1) {
        const selected = typeVariantOf(input.types, random);
        units.push({
          code: `${input.code}-${String(towerIndex + 1)}${String(floor).padStart(2, '0')}${String(door).padStart(2, '0')}`,
          name: `Unit ${towerName}-${String(floor).padStart(2, '0')}${String(door).padStart(2, '0')}`,
          locationKey: floorKey,
          ...selected,
          status: statusOf(random, distribution),
          isHook: door === 1 || door === input.unitsPerFloor,
        });
      }
    }
  });
  return { locations, units };
}

function commercialInventory(input: {
  code: string;
  seed: number;
  zoneNames: string[];
  blocksPerZone: number;
  unitsPerBlock: number;
  types: UnitType[];
}) {
  const random = rng(input.seed);
  const locations: LocationInput[] = [];
  const units: UnitInput[] = [];
  const distribution: [ProductUnitStatus, number][] = [
    ['AVAILABLE', 49], ['RESERVED', 13], ['BOOKED', 6], ['SOLD', 28], ['BLOCKED', 4],
  ];
  input.zoneNames.forEach((zoneName, zoneIndex) => {
    const zoneKey = `zone-${zoneIndex + 1}`;
    locations.push({ key: zoneKey, parentKey: null, name: `Zona ${zoneName}`, type: 'ZONE' });
    for (let blockIndex = 0; blockIndex < input.blocksPerZone; blockIndex += 1) {
      const blockLabel = String.fromCharCode(65 + blockIndex);
      const blockKey = `${zoneKey}-block-${blockLabel}`;
      locations.push({ key: blockKey, parentKey: zoneKey, name: `Blok ${blockLabel}`, type: 'BLOCK' });
      for (let unitNo = 1; unitNo <= input.unitsPerBlock; unitNo += 1) {
        const selected = typeVariantOf(input.types, random);
        units.push({
          code: `${input.code}-Z${zoneIndex + 1}${blockLabel}-${String(unitNo).padStart(3, '0')}`,
          name: `Kavling Usaha ${blockLabel}-${String(unitNo).padStart(3, '0')}`,
          locationKey: blockKey,
          ...selected,
          status: statusOf(random, distribution),
          isHook: unitNo === 1 || unitNo === input.unitsPerBlock,
        });
      }
    }
  });
  return { locations, units };
}

function scenario(
  info: Omit<ProductInput, 'variants' | 'locations' | 'units' | 'facilityAttributeIds'>,
  types: UnitType[],
  inventory: { locations: LocationInput[]; units: UnitInput[] },
  facilityCodes: string[],
): RealisticProjectScenario {
  return {
    payload: { ...info, variants: variantsOf(types, inventory.units), locations: inventory.locations, units: inventory.units },
    facilityCodes,
    summary: summaryOf(inventory.locations, inventory.units),
  };
}

export function buildRealisticProjectScenarios(): RealisticProjectScenario[] {
  const bekasiTypes: UnitType[] = [
    { name: 'Tipe Canna 36', buildingArea: 36, surfaceArea: 60, floors: 1, bedroom: 2, bathroom: 1, carport: 1, options: [
      { name: 'Standard', code: 'QABKS-C36-STD', price: 785_000_000, weight: 16 },
      { name: 'Smart Home', code: 'QABKS-C36-SMT', price: 845_000_000, weight: 8 },
    ] },
    { name: 'Tipe Aralia 45', buildingArea: 45, surfaceArea: 72, floors: 1, bedroom: 2, bathroom: 1, carport: 1, options: [
      { name: 'Standard', code: 'QABKS-A45-STD', price: 975_000_000, weight: 14 },
      { name: 'Corner', code: 'QABKS-A45-COR', price: 1_090_000_000, weight: 5 },
    ] },
    { name: 'Tipe Magnolia 60', buildingArea: 60, surfaceArea: 90, floors: 2, bedroom: 3, bathroom: 2, carport: 1, options: [
      { name: 'Classic', code: 'QABKS-M60-CLS', price: 1_385_000_000, weight: 10 },
      { name: 'Premium', code: 'QABKS-M60-PRM', price: 1_525_000_000, weight: 6 },
    ] },
    { name: 'Tipe Samara 90', buildingArea: 90, surfaceArea: 120, floors: 2, bedroom: 4, bathroom: 3, carport: 2, options: [
      { name: 'Garden', code: 'QABKS-S90-GDN', price: 2_150_000_000, weight: 4 },
      { name: 'Boulevard', code: 'QABKS-S90-BLV', price: 2_375_000_000, weight: 3 },
    ] },
  ];
  const bekasiInventory = landedInventory({ code: 'QABKS26', seed: 260101, clusterNames: ['Magnolia', 'Akasia', 'Cendana', 'Damar', 'Flamboyan', 'Jasmine'], blocksPerCluster: 8, unitsPerBlock: 24, types: bekasiTypes });

  const bandungTypes: UnitType[] = [
    { name: 'Tipe Pinus 40', buildingArea: 40, surfaceArea: 72, floors: 1, bedroom: 2, bathroom: 1, carport: 1, options: [
      { name: 'Valley', code: 'QAKBP-P40-VLY', price: 895_000_000, weight: 15 },
      { name: 'Hill View', code: 'QAKBP-P40-HIL', price: 975_000_000, weight: 8 },
    ] },
    { name: 'Tipe Cemara 55', buildingArea: 55, surfaceArea: 90, floors: 2, bedroom: 3, bathroom: 2, carport: 1, options: [
      { name: 'Valley', code: 'QAKBP-C55-VLY', price: 1_275_000_000, weight: 13 },
      { name: 'Corner', code: 'QAKBP-C55-COR', price: 1_425_000_000, weight: 5 },
    ] },
    { name: 'Tipe Arunika 75', buildingArea: 75, surfaceArea: 105, floors: 2, bedroom: 3, bathroom: 3, carport: 2, options: [
      { name: 'Mountain View', code: 'QAKBP-A75-MNT', price: 1_825_000_000, weight: 7 },
      { name: 'Premium Garden', code: 'QAKBP-A75-GDN', price: 2_050_000_000, weight: 4 },
    ] },
  ];
  const bandungInventory = landedInventory({ code: 'QAKBP26', seed: 260202, clusterNames: ['Puspa', 'Sagara', 'Arunika', 'Nawasena', 'Kirana', 'Pradipa', 'Wanasari', 'Lembayung'], blocksPerCluster: 6, unitsPerBlock: 20, types: bandungTypes });

  const surabayaTypes: UnitType[] = [
    { name: 'Studio', buildingArea: 24, surfaceArea: 0, floors: 1, bedroom: 1, bathroom: 1, carport: 0, options: [
      { name: 'City View', code: 'QASBY-STD-CIT', price: 525_000_000, weight: 18 },
      { name: 'Pool View', code: 'QASBY-STD-POL', price: 565_000_000, weight: 8 },
    ] },
    { name: 'One Bedroom', buildingArea: 36, surfaceArea: 0, floors: 1, bedroom: 1, bathroom: 1, carport: 0, options: [
      { name: 'City View', code: 'QASBY-1BR-CIT', price: 785_000_000, weight: 15 },
      { name: 'Corner', code: 'QASBY-1BR-COR', price: 865_000_000, weight: 6 },
    ] },
    { name: 'Two Bedroom', buildingArea: 52, surfaceArea: 0, floors: 1, bedroom: 2, bathroom: 2, carport: 1, options: [
      { name: 'City View', code: 'QASBY-2BR-CIT', price: 1_175_000_000, weight: 12 },
      { name: 'Pool View', code: 'QASBY-2BR-POL', price: 1_275_000_000, weight: 5 },
    ] },
    { name: 'Three Bedroom', buildingArea: 78, surfaceArea: 0, floors: 1, bedroom: 3, bathroom: 2, carport: 1, options: [
      { name: 'Skyline', code: 'QASBY-3BR-SKY', price: 1_850_000_000, weight: 5 },
      { name: 'Corner Skyline', code: 'QASBY-3BR-COR', price: 2_075_000_000, weight: 3 },
    ] },
  ];
  const surabayaInventory = verticalInventory({ code: 'QASBY26', seed: 260303, towerNames: ['Arjuna', 'Bromo', 'Cakrawala', 'Dahana'], floors: 30, unitsPerFloor: 12, types: surabayaTypes });

  const businessTypes: UnitType[] = [
    { name: 'Gudang Ringan 90', buildingArea: 90, surfaceArea: 120, floors: 1, bedroom: 0, bathroom: 1, carport: 2, options: [
      { name: 'Standard', code: 'QARNG-G90-STD', price: 1_450_000_000, weight: 16 },
      { name: 'Loading Bay', code: 'QARNG-G90-LOD', price: 1_625_000_000, weight: 8 },
    ] },
    { name: 'Gudang Menengah 180', buildingArea: 180, surfaceArea: 240, floors: 1, bedroom: 0, bathroom: 2, carport: 3, options: [
      { name: 'Standard', code: 'QARNG-G180-STD', price: 2_750_000_000, weight: 12 },
      { name: 'High Ceiling', code: 'QARNG-G180-HCL', price: 3_050_000_000, weight: 7 },
    ] },
    { name: 'Biz Loft 120', buildingArea: 120, surfaceArea: 90, floors: 2, bedroom: 0, bathroom: 2, carport: 2, options: [
      { name: 'Inner Boulevard', code: 'QARNG-B120-INR', price: 2_150_000_000, weight: 9 },
      { name: 'Main Boulevard', code: 'QARNG-B120-MBL', price: 2_475_000_000, weight: 5 },
    ] },
  ];
  const businessInventory = commercialInventory({ code: 'QARNG26', seed: 260404, zoneNames: ['Logistik', 'Manufaktur Ringan', 'Niaga', 'Distribusi'], blocksPerZone: 8, unitsPerBlock: 20, types: businessTypes });

  return [
    scenario({
      name: 'QA Township Bekasi Utara 2026', code: 'QA-BEKASI-TOWNSHIP-2026', isActive: true,
      description: '<p><strong>Dataset QA realistis.</strong> Township landed house skala besar untuk pengujian stok, availability, reservasi, dan distribusi unit multi-cluster. Data geografis memakai wilayah administratif nyata; inventori dan nama proyek bersifat sintetis untuk pengujian.</p>',
      province: 'Jawa Barat', city: 'Kota Bekasi', subdistrict: 'Bekasi Utara', village: 'Marga Mulya', postalCode: '17142', address: 'Koridor Boulevard Ahmad Yani, Marga Mulya, Bekasi Utara', mapsUrl: 'https://www.google.com/maps?q=-6.2253,106.9991',
    }, bekasiTypes, bekasiInventory, ['facility_security', 'facility_parking', 'facility_park', 'facility_pool', 'facility_playground', 'facility_mosque', 'facility_smart_home']),
    scenario({
      name: 'QA Highland Residence Padalarang 2026', code: 'QA-PADALARANG-HIGHLAND-2026', isActive: true,
      description: '<p><strong>Dataset QA realistis.</strong> Kawasan hunian berkontur dengan cluster dan blok bervariasi untuk pengujian tipe rumah, unit hook, dan status penjualan. Wilayah administratif nyata; inventori sintetis.</p>',
      province: 'Jawa Barat', city: 'Kabupaten Bandung Barat', subdistrict: 'Padalarang', village: 'Cipeundeuy', postalCode: '40553', address: 'Koridor Padalarang, Cipeundeuy, Kabupaten Bandung Barat', mapsUrl: 'https://www.google.com/maps?q=-6.8487,107.4774',
    }, bandungTypes, bandungInventory, ['facility_security', 'facility_park', 'facility_playground', 'facility_mosque', 'facility_smart_home']),
    scenario({
      name: 'QA Vertical Residence Surabaya Barat 2026', code: 'QA-SURABAYA-VERTICAL-2026', isActive: true,
      description: '<p><strong>Dataset QA realistis.</strong> Empat tower apartemen dengan 30 lantai per tower untuk pengujian performa tabel, availability vertikal, filter status, dan variasi view. Wilayah administratif nyata; inventori sintetis.</p>',
      province: 'Jawa Timur', city: 'Kota Surabaya', subdistrict: 'Sambikerep', village: 'Lontar', postalCode: '60216', address: 'Koridor Jalan Raya Lontar, Sambikerep, Surabaya', mapsUrl: 'https://www.google.com/maps?q=-7.2739,112.6606',
    }, surabayaTypes, surabayaInventory, ['facility_security', 'facility_parking', 'facility_pool', 'facility_playground', 'facility_mosque', 'facility_smart_home']),
    scenario({
      name: 'QA Rungkut Business Park 2026', code: 'QA-RUNGKUT-BUSINESS-2026', isActive: true,
      description: '<p><strong>Dataset QA realistis.</strong> Kawasan gudang dan biz loft untuk pengujian inventory komersial, zona operasional, pricing, dan okupansi. Wilayah administratif nyata; inventori sintetis.</p>',
      province: 'Jawa Timur', city: 'Kota Surabaya', subdistrict: 'Rungkut', village: 'Rungkut Kidul', postalCode: '60293', address: 'Koridor Rungkut Industri, Rungkut Kidul, Surabaya', mapsUrl: 'https://www.google.com/maps?q=-7.3337,112.7581',
    }, businessTypes, businessInventory, ['facility_security', 'facility_parking', 'facility_mosque']),
  ];
}
