import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { prisma } from './infrastructure/database/prisma.js';
import { PrismaGenericRepository } from './infrastructure/repositories/PrismaGenericRepository.js';
import { GenericUseCases } from './usecases/GenericUseCases.js';
import { GenericController } from './presentation/controllers/GenericController.js';
import { LeadController } from './presentation/controllers/LeadController.js';
import { LeadUseCases } from './usecases/lead/LeadUseCases.js';
import { DealController } from './presentation/controllers/DealController.js';
import { DealUseCases } from './usecases/deal/DealUseCases.js';
import { AuthController } from './presentation/controllers/AuthController.js';
import { AuthUseCases } from './usecases/auth/AuthUseCases.js';
import { authMiddleware, requireRole } from './presentation/middlewares/AuthMiddleware.js';
import { uploadTenantAccessMiddleware } from './presentation/middlewares/UploadAccessMiddleware.js';
import { StatisticsUseCases } from './usecases/statistics/StatisticsUseCases.js';
import { StatisticsController } from './presentation/controllers/StatisticsController.js';
import multer from 'multer';
import { UploadUseCases } from './usecases/upload/UploadUseCases.js';
import { UploadController } from './presentation/controllers/UploadController.js';
import type { Attachment, Prisma } from '@prisma/client';

import { TaskUseCases } from './usecases/task/TaskUseCases.js';
import { TaskController } from './presentation/controllers/TaskController.js';
import { NoteUseCases } from './usecases/note/NoteUseCases.js';
import { NoteController } from './presentation/controllers/NoteController.js';
import { ViewingUseCase } from './usecases/viewing/ViewingUseCase.js';
import { ViewingController } from './presentation/controllers/ViewingController.js';
import { StatusUseCase } from './usecases/status/StatusUseCase.js';
import { StatusController } from './presentation/controllers/StatusController.js';
import { StageUseCase } from './usecases/stage/StageUseCase.js';
import { StageController } from './presentation/controllers/StageController.js';
import { respondWithError } from './infrastructure/utils/HttpErrorMapper.js';
import { ProductCategoryUseCase } from './usecases/product/ProductCategoryUseCase.js';
import { ProductUseCase } from './usecases/product/ProductUseCase.js';
import { CharacteristicUseCase } from './usecases/product/CharacteristicUseCase.js';
import { ProductMediaUseCase } from './usecases/product/ProductMediaUseCase.js';
import { ProductUnitUseCase } from './usecases/product/ProductUnitUseCase.js';
import { AttributeUseCase } from './usecases/product/AttributeUseCase.js';
import { ProductController } from './presentation/controllers/ProductController.js';

// Prisma returns BigInt for price columns; JSON.stringify cannot serialize it.
// Prices stay below Number.MAX_SAFE_INTEGER (enforced by request validation).
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

const app = express();
app.use(express.json());
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3001')
  .split(',')
  .map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(
  '/uploads',
  authMiddleware,
  uploadTenantAccessMiddleware,
  express.static('uploads', {
    dotfiles: 'deny',
    index: false,
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Only raster images may render inline; everything else (e.g. stray .html) is forced to download.
      if (!/\.(jpe?g|png|webp)$/i.test(filePath)) res.setHeader('Content-Disposition', 'attachment');
    },
  })
);

// Specialized Upload Setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      callback(new Error('Unsupported file type'));
      return;
    }
    callback(null, true);
  },
});
const customerDelegate = (prisma as any).customer;
const customerRepoForUpload = new PrismaGenericRepository<any, any>(customerDelegate, 'customer');
const attachmentDelegate = (prisma as any).attachment;
const attachmentRepo = new PrismaGenericRepository<Attachment, Prisma.AttachmentDelegate>(
  attachmentDelegate,
  'attachment'
);
const uploadUseCases = new UploadUseCases(
  customerRepoForUpload,
  attachmentRepo,
  new PrismaGenericRepository((prisma as any).lead, 'lead'),
  new PrismaGenericRepository((prisma as any).deal, 'deal')
);
const uploadController = new UploadController(uploadUseCases);

app.post('/api/customer/:id/upload', authMiddleware, upload.single('document'), (req, res) =>
  uploadController.uploadCustomerDocument(req, res)
);
app.post('/api/lead/:id/upload', authMiddleware, upload.single('document'), (req, res) =>
  uploadController.uploadAttachment(req, res, 'lead')
);
app.post('/api/deal/:id/upload', authMiddleware, upload.single('document'), (req, res) =>
  uploadController.uploadAttachment(req, res, 'deal')
);
app.delete('/api/attachment/:id', authMiddleware, (req, res) =>
  uploadController.deleteAttachment(req, res)
);

// List of standard Prisma models from schema defined internally
const models = [
  'company',
  'user',
  'invite',
  'stage',
  'status',
  'source',
  'organization',
  'customer',
  'lead',
  'leadItem',
  'deal',
  'leadActivity',
  'dealActivity',
  'note',
  'task',
  'callLog',
  'itemCategory',
  'item',
  'location',
  'inventorySlot',
  'gridConfig',
  'entry',
  'operation',
  'record',
  'viewing',
  'attachment',
  'auditLog',
];

// Pre-instantiate repositories to handle cross-dependencies
const repositories: Record<string, PrismaGenericRepository<any>> = {};
models.forEach((modelName) => {
  const delegate = (prisma as any)[modelName];
  if (delegate) {
    repositories[modelName] = new PrismaGenericRepository(delegate, modelName);
  }
});

const requireRepository = (modelName: string): PrismaGenericRepository<any> => {
  const repository = repositories[modelName];
  if (!repository) {
    throw new Error(`Repository not found for model: ${modelName}`);
  }
  return repository;
};

// Specialized Auth Setup
const authUseCases = new AuthUseCases(
  requireRepository('user'),
  requireRepository('invite'),
  requireRepository('company'),
  requireRepository('status'),
  prisma
);
const authController = new AuthController(authUseCases);

app.post('/api/auth/login', (req, res) => authController.login(req, res));
app.post('/api/auth/logout', (req, res) => authController.logout(req, res));
app.post('/api/auth/register', authMiddleware, (req, res) => authController.register(req, res));
app.post('/api/auth/onboard', (req, res) => authController.onboard(req, res));
app.get('/api/auth/me', authMiddleware, (req, res) => authController.getMe(req, res));
app.put('/api/auth/update-account', authMiddleware, (req, res) =>
  authController.updateAccount(req, res)
);
app.get('/api/user', authMiddleware, (req, res) => authController.getUsers(req, res));
app.delete('/api/user/:id', authMiddleware, (req, res) => authController.deleteUser(req, res));

// Specialized Statistics Setup
const statisticsUseCases = new StatisticsUseCases(prisma as any);
const statisticsController = new StatisticsController(statisticsUseCases);
app.get('/api/statistics', authMiddleware, (req, res) =>
  statisticsController.getStatistics(req, res)
);

// Setup dynamic routes
const modelIncludes: Record<string, any> = {
  customer: { organization: true },
  organization: {},
  deal: {
    lead: { include: { customer: { include: { organization: true } } } },
    status: true,
    stage: true,
    source: true,
    assignedUser: {
      select: { id: true, tenantId: true, email: true, name: true, role: true, createdAt: true },
    },
    attachments: true,
  },
  lead: {
    customer: { include: { organization: true } },
    status: true,
    stage: true,
    source: true,
    attachments: true,
  },
  viewing: {
    source: true,
    status: true,
    location: true,
    actor: { select: { id: true, name: true, email: true } },
  },
  task: {
    assignedUser: {
      select: { id: true, tenantId: true, email: true, name: true, role: true, createdAt: true },
    },
    leadActivity: true,
    dealActivity: true,
  },
};

models.forEach((modelName) => {
  // These models require dedicated authorization rules and must never receive generic CRUD routes.
  if (['company', 'user', 'auditLog'].includes(modelName)) return;
  const repo = repositories[modelName];
  if (!repo) return;

  let controller: any;
  const routeName = modelName.toLowerCase();
  const include = modelIncludes[modelName] || undefined;

  if (modelName === 'lead') {
    const useCases = new LeadUseCases(
      repo,
      requireRepository('deal'),
      requireRepository('leadActivity'),
      requireRepository('status'),
      requireRepository('stage'),
      requireRepository('customer'),
      requireRepository('auditLog'),
      prisma
    );
    controller = new LeadController(useCases);
    app.post(`/api/${routeName}/:id/convert`, authMiddleware, (req, res) =>
      controller.convert(req, res)
    );
    app.post(`/api/${routeName}/:id/set-status`, authMiddleware, (req, res) =>
      controller.setStatus(req, res)
    );
    app.post(`/api/${routeName}/:id/set-stage`, authMiddleware, (req, res) =>
      controller.setStage(req, res)
    );
  } else if (modelName === 'deal') {
    const useCases = new DealUseCases(
      repo,
      requireRepository('dealActivity'),
      requireRepository('lead'),
      requireRepository('user'),
      requireRepository('stage'),
      requireRepository('status'),
      prisma
    );
    controller = new DealController(useCases);
  } else if (modelName === 'task') {
    const useCases = new TaskUseCases(repo, prisma);
    controller = new TaskController(useCases);
  } else if (modelName === 'note') {
    const useCases = new NoteUseCases(repo, prisma);
    controller = new NoteController(useCases);
  } else if (modelName === 'stage') {
    const useCases = new StageUseCase(repo, prisma);
    controller = new StageController(useCases);
    app.put(`/api/${routeName}/reorder`, authMiddleware, (req, res) => controller.reorder(req, res));
  } else if (modelName === 'status') {
    const useCases = new StatusUseCase(repo, prisma);
    controller = new StatusController(useCases);
  } else if (modelName === 'viewing') {
    const useCases = new ViewingUseCase(
      repo,
      requireRepository('status'),
      requireRepository('attachment'),
      prisma
    );
    controller = new ViewingController(useCases);
    app.post(
      `/api/${routeName}/:id/upload-evidence`,
      authMiddleware,
      upload.single('evidence'),
      (req, res) => controller.uploadEvidence(req, res)
    );
    app.post(`/api/${routeName}/:id/fail`, authMiddleware, (req, res) => controller.fail(req, res));
  } else {
    const useCases = new GenericUseCases(repo, prisma);
    controller = new GenericController(useCases, include);
  }

  app.post(`/api/${routeName}`, authMiddleware, (req, res) => controller.create(req, res));
  app.get(`/api/${routeName}`, authMiddleware, (req, res) => controller.getAll(req, res));
  if (typeof (controller as any).getMe === 'function') {
    app.get(`/api/${routeName}/me`, authMiddleware, (req, res) =>
      (controller as any).getMe(req, res)
    );
  }
  app.get(`/api/${routeName}/:id`, authMiddleware, (req, res) => controller.getById(req, res));
  app.put(`/api/${routeName}/:id`, authMiddleware, (req, res) => controller.update(req, res));
  app.delete(`/api/${routeName}/:id`, authMiddleware, (req, res) => controller.delete(req, res));
});

// Product catalog. Owner menulis, member hanya membaca.
const productController = new ProductController(
  new ProductCategoryUseCase(prisma),
  new ProductUseCase(prisma),
  new CharacteristicUseCase(prisma),
  new ProductMediaUseCase(prisma),
  new ProductUnitUseCase(prisma),
  new AttributeUseCase(prisma)
);
const ownerOnly = requireRole('owner');
const pc = productController;
app.get('/api/categories', authMiddleware, pc.listCategories);
app.get('/api/categories/:id', authMiddleware, pc.getCategory);
app.post('/api/categories', authMiddleware, ownerOnly, pc.createCategory);
app.put('/api/categories/:id', authMiddleware, ownerOnly, pc.updateCategory);
app.delete('/api/categories/:id', authMiddleware, ownerOnly, pc.deleteCategory);
app.get('/api/products', authMiddleware, pc.listProducts);
app.get('/api/products/:id', authMiddleware, pc.getProduct);
app.post('/api/products', authMiddleware, ownerOnly, pc.createProduct);
app.put('/api/products/:id', authMiddleware, ownerOnly, pc.updateProduct);
app.delete('/api/products/:id', authMiddleware, ownerOnly, pc.deleteProduct);
app.post('/api/products/:id/variants', authMiddleware, ownerOnly, pc.createVariant);
app.put('/api/products/:id/variants/:variantId', authMiddleware, ownerOnly, pc.updateVariant);
app.delete('/api/products/:id/variants/:variantId', authMiddleware, ownerOnly, pc.deleteVariant);
app.post('/api/products/:id/attributes', authMiddleware, ownerOnly, pc.createAttribute);
app.put('/api/products/:id/attributes/:attributeId', authMiddleware, ownerOnly, pc.updateAttribute);
app.delete('/api/products/:id/attributes/:attributeId', authMiddleware, ownerOnly, pc.deleteAttribute);
app.get('/api/products/:id/media', authMiddleware, pc.listMedia);
app.post('/api/products/:id/media', authMiddleware, ownerOnly, upload.single('file'), pc.uploadMedia);
app.post('/api/products/:id/media-links', authMiddleware, ownerOnly, pc.addMediaLink);
app.patch('/api/media/:id', authMiddleware, ownerOnly, pc.updateMedia);
app.delete('/api/media/:id', authMiddleware, ownerOnly, pc.deleteMedia);
app.get('/api/attributes', authMiddleware, pc.listAttributeDefinitions);
app.post('/api/attributes', authMiddleware, ownerOnly, pc.createAttributeDefinition);
app.put('/api/attributes/:id', authMiddleware, ownerOnly, pc.updateAttributeDefinition);
app.delete('/api/attributes/:id', authMiddleware, ownerOnly, pc.deleteAttributeDefinition);
app.get('/api/units', authMiddleware, pc.listUnits);
app.get('/api/characteristics', authMiddleware, pc.listCharacteristics);
app.post('/api/characteristics', authMiddleware, ownerOnly, pc.createCharacteristic);
app.put('/api/characteristics/:id', authMiddleware, ownerOnly, pc.updateCharacteristic);
app.delete('/api/characteristics/:id', authMiddleware, ownerOnly, pc.deleteCharacteristic);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Hexavara CRM API is running' });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  return respondWithError(res, error);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running internally on port ${PORT}`);
});
