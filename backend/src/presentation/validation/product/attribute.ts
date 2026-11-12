import { validateBody, type FieldRule } from '../../../infrastructure/utils/RequestValidation.js';
import type {
  AttributeInput,
} from '../../../usecases/product/ProductUseCase.js';
import type { AttributeDefinitionInput } from '../../../usecases/product/AttributeUseCase.js';
import { DATA_TYPES, INT_MAX } from './constants.js';

/** product_attributes.value is always INT; when omitted the use case stores 0. */
const attributeValueRule: FieldRule = {
  type: 'number',
  integer: true,
  min: -INT_MAX,
  max: INT_MAX,
};

/** Master data: the definition of an attribute. */
const attributeDefinitionRules: Record<string, FieldRule> = {
  name: { type: 'string', required: true, max: 150 },
  code: { type: 'string', required: true, max: 100 },
  dataType: { type: 'string', required: true, values: DATA_TYPES },
  unit: { type: 'string', nullable: true, allowEmpty: true, max: 30 },
};

/** Attribute sent with a new product: definition (found or created by code) plus value. */
export const newAttributeRules: Record<string, FieldRule> = {
  ...attributeDefinitionRules,
  value: attributeValueRule,
};

/** Pivot: the value of a master attribute for a product or variant. */
const attributeRules: Record<string, FieldRule> = {
  variantId: { type: 'string', nullable: true, max: 36 },
  attributeId: { type: 'string', required: true, max: 36 },
  value: attributeValueRule,
};

export const validateAttribute = (body: unknown, partial = false) =>
  validateBody(body, attributeRules, { partial }) as AttributeInput;

export const validateAttributeDefinition = (body: unknown, partial = false) =>
  validateBody(body, attributeDefinitionRules, { partial }) as AttributeDefinitionInput;
