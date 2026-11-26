import { validateProduct } from '../src/presentation/validation/ProductRequestValidation.js';
import { assertUnitsOnLeaves } from '../src/usecases/product/catalogStructure.js';

const locations = [
  { key: 'tower', name: 'Tower', type: 'TOWER' as const },
  { key: 'floor', parentKey: 'tower', name: 'Lantai 1', type: 'FLOOR' as const },
];
const unit = (locationKey?: string) => ({ code: '01', variantIndex: 0, ...(locationKey ? { locationKey } : {}) });
const check = (key: string | undefined, newLocation: boolean, newUnit: boolean) =>
  assertUnitsOnLeaves([unit(key)], locations, { location: () => newLocation, unit: () => newUnit });

describe('assertUnitsOnLeaves', () => {
  it('accepts units on the lowest location or on the project root', () => {
    expect(() => check('floor', true, true)).not.toThrow();
    expect(() => check(undefined, true, true)).not.toThrow();
  });

  it('rejects a new sub-location under units and a new unit above sub-locations', () => {
    expect(() => check('tower', true, false)).toThrow(/Invalid location: Tower sudah memiliki unit/);
    expect(() => check('tower', false, true)).toThrow(/Invalid unit location: Tower memiliki sub-lokasi/);
  });

  it('keeps existing data savable', () => {
    expect(() => check('tower', false, false)).not.toThrow();
  });
});

describe('unit validation', () => {
  it('no longer accepts the hook flag', () => {
    const body = (extra: object) => ({ name: 'P', code: 'P', units: [{ code: '1', variantIndex: 0, ...extra }] });
    expect(() => validateProduct(body({}))).not.toThrow();
    expect(() => validateProduct(body({ isHook: true }))).toThrow(/isHook/);
  });
});
