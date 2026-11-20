export type UnitStatus =
  | "available"
  | "processing"
  | "reserved"
  | "sold"
  | "blocked";

export interface AvailabilityIntegrity {
  status: "healthy" | "degraded";
  ignoredUnitCount: number;
  skippedCycleEdges: number;
}

export interface ProjectAvailability {
  id: string;
  code: string;
  name: string;
  location: string;
  image: string | null;
  total: number;
  available: number;
  processing: number;
  reserved: number;
  sold: number;
  blocked: number;
  integrity?: AvailabilityIntegrity;
}

export interface AvailabilitySummary {
  total: number;
  available: number;
  processing: number;
  reserved: number;
  sold: number;
  blocked: number;
}
