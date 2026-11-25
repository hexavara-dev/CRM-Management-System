import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination, parseSearch } from '../../infrastructure/utils/RequestValidation.js';
import type { ProductCategoryUseCase } from '../../usecases/product/ProductCategoryUseCase.js';
import type { ProductUseCase } from '../../usecases/product/ProductUseCase.js';
import type { ProjectTypeImage, ProjectTypeVariantImage, TypeImageUploads, ProjectUnitImage } from '../../usecases/product/ProductUseCase.js';
import type { CharacteristicUseCase } from '../../usecases/product/CharacteristicUseCase.js';
import type { ProductMediaUseCase } from '../../usecases/product/ProductMediaUseCase.js';
import type { AttributeUseCase } from '../../usecases/product/AttributeUseCase.js';
import type { ProductUnitUseCase } from '../../usecases/product/ProductUnitUseCase.js';
import {
  parseCategoryFilters,
  parseProductFilters,
  parseUnitFilters,
  parseUnitPhotoFilters,
  validateAttribute,
  validateAttributeDefinition,
  validateCategory,
  validateCharacteristic,
  validateMediaLink,
  validateMediaMeta,
  validateProduct,
  validateUploadFields,
  validateVariant,
} from '../validation/ProductRequestValidation.js';

type Handler = (req: Request, res: Response, tenantId: string) => Promise<unknown>;

const tenantOf = (req: Request): string => {
  const tenantId = (req as Request & { user?: { tenantId?: string } }).user?.tenantId;
  if (!tenantId) throw new Error('Tenant context missing');
  return tenantId;
};

const param = (req: Request, name: string) => String(req.params[name]);

/** JSON array sent next to uploaded files; must match the number of files. */
function uploadIndexes(raw: unknown, count: number, label: string): unknown[] {
  let indexes: unknown = [];
  if (raw !== undefined) {
    try { indexes = JSON.parse(raw as string); }
    catch { throw new Error(`Invalid ${label} indexes`); }
  }
  if (!Array.isArray(indexes) || indexes.length !== count) throw new Error(`Invalid ${label} indexes`);
  return indexes;
}

const isIndex = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

/** Request body: JSON, or the "payload" field of a multipart request. */
function requestBody(req: Request): unknown {
  if (!req.is('multipart/form-data')) return req.body;
  if (typeof req.body?.payload !== 'string') throw new Error('Invalid project payload');
  try {
    return JSON.parse(req.body.payload);
  } catch {
    throw new Error('Invalid project payload');
  }
}

/** Photos of one type (variant routes). */
function typeUploads(req: Request): TypeImageUploads {
  const files = req.files && !Array.isArray(req.files) ? req.files : {};
  const variantFiles = files.typeVariantImages ?? [];
  const indexes = uploadIndexes(req.body?.typeVariantImageIndexes, variantFiles.length, 'type variant image');
  if (!indexes.every(isIndex)) throw new Error('Invalid type variant image indexes');
  return {
    type: files.typeImages ?? [],
    variants: variantFiles.map((file, index) => ({ file, typeVariantIndex: indexes[index] as number })),
  };
}

function projectUploads(req: Request, variantCount: number) {
  const files = req.files && !Array.isArray(req.files) ? req.files : {};
  const covers = files.covers ?? (Array.isArray(req.files) ? req.files : []);
  const typeFiles = files.typeImages ?? [];
  const typeVariantFiles = files.typeVariantImages ?? [];
  const unitFiles = files.unitImages ?? [];
  const siteplan = files.siteplan?.[0];
  const indexes = uploadIndexes(req.body?.typeImageIndexes, typeFiles.length, 'type image');
  if (!indexes.every((index) => isIndex(index) && index < variantCount)) throw new Error('Invalid type image indexes');
  const pairs = uploadIndexes(req.body?.typeVariantImageIndexes, typeVariantFiles.length, 'type variant image');
  if (!pairs.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every(isIndex) && (pair[0] as number) < variantCount)) {
    throw new Error('Invalid type variant image indexes');
  }
  const rawUnitIndexes = req.body?.unitImageIndexes;
  let unitIndexes: unknown = [];
  if (rawUnitIndexes !== undefined) {
    try { unitIndexes = JSON.parse(rawUnitIndexes); }
    catch { throw new Error('Invalid unit image indexes'); }
  }
  if (!Array.isArray(unitIndexes) || unitIndexes.length !== unitFiles.length ||
    unitIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= (Number(req.body?.unitCount) || 0))) {
    throw new Error('Invalid unit image indexes');
  }
  return {
    covers,
    siteplan,
    typeImages: typeFiles.map((file, index): ProjectTypeImage => ({ file, variantIndex: indexes[index] as number })),
    typeVariantImages: typeVariantFiles.map((file, index): ProjectTypeVariantImage => {
      const [variantIndex, typeVariantIndex] = pairs[index] as [number, number];
      return { file, variantIndex, typeVariantIndex };
    }),
    unitImages: unitFiles.map((file, index): ProjectUnitImage => ({ file, unitIndex: unitIndexes[index] as number })),
  };
}

function sanitizeProjectLogBody(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeProjectLogBody);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /password|token|secret|authorization|credential|private.?key/i.test(key)
        ? '[REDACTED]'
        : sanitizeProjectLogBody(entry),
    ]),
  );
}

/** Wraps a handler with tenant extraction and error mapping. */
function handle(fn: Handler) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res, tenantOf(req));
    } catch (error) {
      respondWithError(res, error);
    }
  };
}

export class ProductController {
  constructor(
    private categories: ProductCategoryUseCase,
    private products: ProductUseCase,
    private characteristics: CharacteristicUseCase,
    private media: ProductMediaUseCase,
    private units: ProductUnitUseCase,
    private attributeDefinitions: AttributeUseCase
  ) {}

  // ---------- categories ----------
  listCategories = handle(async (req, res, tenantId) => {
    res.json(await this.categories.list(tenantId, parseCategoryFilters(req.query)));
  });
  getCategory = handle(async (req, res, tenantId) => {
    res.json(await this.categories.get(param(req, 'id'), tenantId));
  });
  createCategory = handle(async (req, res, tenantId) => {
    res.status(201).json(await this.categories.create(tenantId, validateCategory(req.body)));
  });
  updateCategory = handle(async (req, res, tenantId) => {
    res.json(await this.categories.update(param(req, 'id'), tenantId, validateCategory(req.body, true)));
  });
  deleteCategory = handle(async (req, res, tenantId) => {
    await this.categories.remove(param(req, 'id'), tenantId);
    res.status(204).send();
  });

  // ---------- products ----------
  listProducts = handle(async (req, res, tenantId) => {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePagination(query, 12);
    res.json(
      await this.products.list(tenantId, {
        page,
        limit,
        search: parseSearch(query),
        ...parseProductFilters(query),
      })
    );
  });
  getProduct = handle(async (req, res, tenantId) => {
    res.json(await this.products.get(param(req, 'id'), tenantId));
  });
  getProductEdit = handle(async (req, res, tenantId) => {
    res.json(await this.products.getEdit(param(req, 'id'), tenantId));
  });
  createProduct = handle(async (req, res, tenantId) => {
    const body = requestBody(req);
    const payload = validateProduct(body);
    const { covers, siteplan, typeImages, typeVariantImages, unitImages } = projectUploads(req, payload.variants?.length ?? 0);
    try {
      const project = await this.products.create(tenantId, payload, covers, typeImages, siteplan, unitImages, typeVariantImages);
      console.info('[Project insert succeeded]', JSON.stringify({
        requestId: res.locals.requestId,
        projectId: project.id,
        body: sanitizeProjectLogBody(body),
      }));
      res.status(201).json(project);
    } catch (error) {
      const candidate = error as { name?: unknown; code?: unknown; message?: unknown } | null;
      console.error('[Project insert failed]', JSON.stringify({
        requestId: res.locals.requestId,
        body: sanitizeProjectLogBody(body),
        errorType: typeof candidate?.name === 'string' ? candidate.name : 'UnknownError',
        errorCode: typeof candidate?.code === 'string' ? candidate.code : undefined,
        errorMessage: typeof candidate?.message === 'string' ? candidate.message : 'Unknown error',
      }));
      throw error;
    }
  });
  updateProduct = handle(async (req, res, tenantId) => {
    const body = requestBody(req);
    const payload = validateProduct(body, true);
    const { covers, siteplan, typeImages, typeVariantImages, unitImages } = projectUploads(req, payload.variants?.length ?? 0);
    res.json(await this.products.update(param(req, 'id'), tenantId, payload, covers, typeImages, siteplan, unitImages, typeVariantImages));
  });
  deleteProduct = handle(async (req, res, tenantId) => {
    const fileUrls = await this.products.remove(param(req, 'id'), tenantId);
    await this.media.removeFiles(fileUrls);
    res.status(204).send();
  });

  // ---------- variants ----------
  createVariant = handle(async (req, res, tenantId) => {
    res
      .status(201)
      .json(await this.products.addVariant(param(req, 'id'), tenantId, validateVariant(requestBody(req)), typeUploads(req)));
  });
  updateVariant = handle(async (req, res, tenantId) => {
    res.json(
      await this.products.updateVariant(
        param(req, 'id'),
        param(req, 'variantId'),
        tenantId,
        validateVariant(requestBody(req), true),
        typeUploads(req)
      )
    );
  });
  deleteVariant = handle(async (req, res, tenantId) => {
    await this.products.removeVariant(param(req, 'id'), param(req, 'variantId'), tenantId);
    res.status(204).send();
  });

  // ---------- attributes ----------
  createAttribute = handle(async (req, res, tenantId) => {
    res
      .status(201)
      .json(await this.products.addAttribute(param(req, 'id'), tenantId, validateAttribute(req.body)));
  });
  updateAttribute = handle(async (req, res, tenantId) => {
    res.json(
      await this.products.updateAttribute(
        param(req, 'id'),
        param(req, 'attributeId'),
        tenantId,
        validateAttribute(req.body, true)
      )
    );
  });
  deleteAttribute = handle(async (req, res, tenantId) => {
    await this.products.removeAttribute(param(req, 'id'), param(req, 'attributeId'), tenantId);
    res.status(204).send();
  });

  // ---------- attribute master data ----------
  listAttributeDefinitions = handle(async (_req, res, tenantId) => {
    res.json(await this.attributeDefinitions.list(tenantId));
  });
  createAttributeDefinition = handle(async (req, res, tenantId) => {
    res
      .status(201)
      .json(await this.attributeDefinitions.create(tenantId, validateAttributeDefinition(req.body)));
  });
  updateAttributeDefinition = handle(async (req, res, tenantId) => {
    res.json(
      await this.attributeDefinitions.update(
        param(req, 'id'),
        tenantId,
        validateAttributeDefinition(req.body, true)
      )
    );
  });
  deleteAttributeDefinition = handle(async (req, res, tenantId) => {
    await this.attributeDefinitions.remove(param(req, 'id'), tenantId);
    res.status(204).send();
  });

  // ---------- units ----------
  listUnits = handle(async (req, res, tenantId) => {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePagination(query, 20);
    res.json(
      await this.units.list(tenantId, { page, limit, search: parseSearch(query), ...parseUnitFilters(query) })
    );
  });

  listUnitPhotos = handle(async (req, res, tenantId) => {
    const query = req.query as Record<string, unknown>;
    const { page, limit } = parsePagination(query, 20);
    res.json(
      await this.units.photos(tenantId, param(req, 'id'), { page, limit, search: parseSearch(query), ...parseUnitPhotoFilters(query) })
    );
  });

  // ---------- characteristics ----------
  listCharacteristics = handle(async (_req, res, tenantId) => {
    res.json(await this.characteristics.list(tenantId));
  });
  createCharacteristic = handle(async (req, res, tenantId) => {
    res.status(201).json(await this.characteristics.create(tenantId, validateCharacteristic(req.body)));
  });
  updateCharacteristic = handle(async (req, res, tenantId) => {
    res.json(
      await this.characteristics.update(param(req, 'id'), tenantId, validateCharacteristic(req.body, true))
    );
  });
  deleteCharacteristic = handle(async (req, res, tenantId) => {
    await this.characteristics.remove(param(req, 'id'), tenantId);
    res.status(204).send();
  });

  // ---------- media ----------
  listMedia = handle(async (req, res, tenantId) => {
    res.json(await this.media.list(param(req, 'id'), tenantId));
  });
  uploadMedia = handle(async (req, res, tenantId) => {
    if (!req.file) throw new Error('file is required');
    const meta = validateUploadFields(req.body as Record<string, unknown> | undefined);
    res.status(201).json(await this.media.upload(param(req, 'id'), tenantId, req.file, meta));
  });
  addMediaLink = handle(async (req, res, tenantId) => {
    res.status(201).json(await this.media.addLink(param(req, 'id'), tenantId, validateMediaLink(req.body)));
  });
  updateMedia = handle(async (req, res, tenantId) => {
    res.json(await this.media.update(param(req, 'id'), tenantId, validateMediaMeta(req.body)));
  });
  deleteMedia = handle(async (req, res, tenantId) => {
    await this.media.remove(param(req, 'id'), tenantId);
    res.status(204).send();
  });
}
