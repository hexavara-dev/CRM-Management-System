import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import type { CharacteristicInput } from '../../../usecases/product/CharacteristicUseCase.js';
import type { MediaLinkInput, MediaMetaInput } from '../../../usecases/product/ProductMediaUseCase.js';

export const characteristicRules: Record<string, FieldRule> = {
  group: { type: 'string', required: true, max: 100 },
  code: { type: 'string', required: true, max: 100 },
  name: { type: 'string', required: true, max: 150 },
};

const mediaMetaRules: Record<string, FieldRule> = {
  title: { type: 'string', nullable: true, allowEmpty: true, max: 150 },
  variantId: { type: 'string', nullable: true, max: 36 },
  sortOrder: { type: 'number', integer: true, min: 0 },
  isPrimary: { type: 'boolean' },
};

export const validateCharacteristic = (body: unknown, partial = false) =>
  validateBody(body, characteristicRules, { partial }) as CharacteristicInput;

export const validateMediaMeta = (body: unknown) =>
  validateBody(body, mediaMetaRules, { partial: true }) as MediaMetaInput;

export const validateMediaLink = (body: unknown) =>
  validateBody(
    body,
    { ...mediaMetaRules, fileUrl: { type: 'string', required: true, max: 2000 } },
  ) as MediaLinkInput;

/** Multipart fields arrive as strings; convert them before validation. */
export function validateUploadFields(body: Record<string, unknown> | undefined) {
  const source = body ?? {};
  const converted: Record<string, unknown> = {};
  if (typeof source.title === 'string' && source.title !== '') converted.title = source.title;
  if (typeof source.variantId === 'string' && source.variantId !== '') {
    converted.variantId = source.variantId;
  }
  if (source.isPrimary !== undefined) converted.isPrimary = source.isPrimary === 'true';
  if (source.sortOrder !== undefined && source.sortOrder !== '') {
    converted.sortOrder = Number(source.sortOrder);
  }
  return Object.keys(converted).length ? validateMediaMeta(converted) : {};
}
