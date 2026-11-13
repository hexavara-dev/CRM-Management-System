export type ClusterAvailability = {
  id: string;
  name: string;
  units: number;
  blocks: number;
  available: number;
  processing: number;
  reserved: number;
  sold: number;
  blocked: number;
};

export type ProjectAvailabilityDetail = {
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
