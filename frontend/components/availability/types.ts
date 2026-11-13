export type UnitStatus = "available" | "processing" | "reserved" | "sold";

export interface ProjectAvailability {
  id: string;
  name: string;
  location: string;
  image: string | null;
  total: number;
  available: number;
  processing: number;
  reserved: number;
  sold: number;
  blocked: number;
}

export interface AvailabilitySummary {
  total: number;
  available: number;
  processing: number;
  reserved: number;
  sold: number;
  blocked: number;
}
