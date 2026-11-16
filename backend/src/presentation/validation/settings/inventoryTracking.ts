import type { TrackingType } from '@prisma/client';
import { TRACKING_TYPES } from '../../../usecases/settings/InventoryTrackingUseCase.js';

export function validateInventoryTracking(body: unknown): TrackingType {
  const data = (body ?? {}) as Record<string, unknown>;
  const extra = Object.keys(data).filter((key) => key !== 'mode');
  if (extra.length > 0) throw new Error(`Unsupported field: ${extra.join(', ')}`);
  const mode = typeof data.mode === 'string' ? data.mode.toUpperCase() : undefined;
  if (!mode) throw new Error('mode is required');
  if (!(TRACKING_TYPES as readonly string[]).includes(mode)) {
    throw new Error(`mode must be one of: ${TRACKING_TYPES.join(', ')}`);
  }
  return mode as TrackingType;
}
