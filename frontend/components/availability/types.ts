export type UnitStatus =
  | "available"
  | "processing"
  | "reserved"
  | "sold"
  | "blocked";

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
}

export interface AvailabilitySummary {
  total: number;
  available: number;
  processing: number;
  reserved: number;
  sold: number;
  blocked: number;
}
