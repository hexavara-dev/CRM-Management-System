export type UnitSpecification = { key: string; label: string };

export type UnitDetail = {
  id: string;
  code: string;
  projectId: string;
  projectCode: string;
  /** Unit project nonaktif tidak dapat direservasi. */
  projectActive: boolean;
  clusterCode: string;
  number: string;
  status: string;
  project: string;
  cluster: string;
  location: string;
  locationLevel: string;
  block: string;
  type: string;
  variant: string;
  buildingArea: string;
  landArea: string;
  price: number;
  basePrice: number;
  promo: number;
  finalPrice: number;
  images: string[];
  floorPlan: string | null;
  specifications: UnitSpecification[];
};
