import type { Request, Response } from 'express';
import { respondWithError } from '../../infrastructure/utils/HttpErrorMapper.js';
import { parsePagination, parseSearch } from '../../infrastructure/utils/RequestValidation.js';
import type { ProductCategoryUseCase } from '../../usecases/product/ProductCategoryUseCase.js';
import type { ProductUseCase } from '../../usecases/product/ProductUseCase.js';
import type { CharacteristicUseCase } from '../../usecases/product/CharacteristicUseCase.js';
import type { ProductMediaUseCase } from '../../usecases/product/ProductMediaUseCase.js';
import {
  parseCategoryFilters,
  parseProductFilters,
  validateAttribute,
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
    private media: ProductMediaUseCase
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
  createProduct = handle(async (req, res, tenantId) => {
    res.status(201).json(await this.products.create(tenantId, validateProduct(req.body)));
  });
  updateProduct = handle(async (req, res, tenantId) => {
    res.json(await this.products.update(param(req, 'id'), tenantId, validateProduct(req.body, true)));
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
      .json(await this.products.addVariant(param(req, 'id'), tenantId, validateVariant(req.body)));
  });
  updateVariant = handle(async (req, res, tenantId) => {
    res.json(
      await this.products.updateVariant(
        param(req, 'id'),
        param(req, 'variantId'),
        tenantId,
        validateVariant(req.body, true)
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
