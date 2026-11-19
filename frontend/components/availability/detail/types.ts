export type ClusterAvailability = {
  id: string;
  code: string;
  name: string;
  level: string;
  units: number;
  children: number;
  blocks: number;
  available: number;
  processing: number;
  reserved: number;
  sold: number;
  blocked: number;
};

export type ProjectAvailabilityDetail = {
  id: string;
  code: string;
  name: string;
  location: string;
  image: string | null;
  totalUnits: number;
  available: number;
  processing: number;
  reserved: number;
  sold: number;
  blocked: number;
};

export type AvailabilityMetricVariant = "available" | "reserved" | "sold";
