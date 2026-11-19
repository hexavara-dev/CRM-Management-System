export type UnitStatus =
  | "available"
  | "processing"
  | "reserved"
  | "sold"
  | "blocked";
export type Block = string;
export type BlockFilter = string;
export type ClusterView = "grid" | "list";

export type ClusterUnit = {
  id: string;
  code: string;
  isHook: boolean;
  type: string;
  variant: string;
  price: number;
  basePrice: number;
  block: Block;
  location: string;
  locationLevel: string;
  image: string | null;
  status: UnitStatus;
  customer: string | null;
  discount?: boolean;
};
