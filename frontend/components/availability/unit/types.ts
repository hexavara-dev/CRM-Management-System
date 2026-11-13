export type UnitSpecification = { key: string; label: string };

export type UnitDetail = {
  id: string;
  number: string;
  status: string;
  project: string;
  cluster: string;
  block: string;
  type: string;
  buildingArea: string;
  landArea: string;
  price: number;
  promo: number;
  finalPrice: number;
  images: string[];
  floorPlan: string | null;
  specifications: UnitSpecification[];
};
