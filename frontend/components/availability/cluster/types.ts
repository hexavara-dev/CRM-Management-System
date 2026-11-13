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
  type: number;
  price: number;
  block: Block;
  status: UnitStatus;
  discount?: boolean;
};
