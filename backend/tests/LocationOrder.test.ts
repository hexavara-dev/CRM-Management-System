import { byLocationName } from '../src/usecases/product/catalogStructure.js';

describe('byLocationName', () => {
  it('reads numbers as numbers and sorts letters alphabetically', () => {
    const sort = (names: string[]) => names.map((name) => ({ name })).sort(byLocationName).map(({ name }) => name);
    expect(sort(['Lantai 25', 'Lantai 2', 'Lantai 10', 'Lantai 1'])).toEqual(['Lantai 1', 'Lantai 2', 'Lantai 10', 'Lantai 25']);
    expect(sort(['Blok C', 'blok b', 'Blok A'])).toEqual(['Blok A', 'blok b', 'Blok C']);
  });
});
