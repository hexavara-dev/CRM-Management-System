export type Stage = {
  id: string;
  tenantId: string;
  name: string;
  position: number;
  entityType: string;
  isTerminal: boolean;
  color: string;
  description?: string | null;
  probability?: number;
  isActive?: boolean;
};
