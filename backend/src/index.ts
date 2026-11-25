import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { prisma } from './infrastructure/database/prisma.js';
import { PrismaGenericRepository } from './infrastructure/repositories/PrismaGenericRepository.js';
import { GenericUseCases } from './usecases/GenericUseCases.js';
import { GenericController } from './presentation/controllers/GenericController.js';
import { LeadController } from './presentation/controllers/LeadController.js';
import { LeadUseCases } from './usecases/lead/LeadUseCases.js';
import { LeadArchiveController } from './presentation/controllers/LeadArchiveController.js';
import { LeadArchiveUseCase } from './usecases/lead/LeadArchiveUseCase.js';
import { DealController } from './presentation/controllers/DealController.js';
import { DealUseCases } from './usecases/deal/DealUseCases.js';
import { CreateDealUseCase } from './usecases/deal/CreateDealUseCase.js';
import { MAX_DEAL_DOCUMENTS } from './usecases/deal/dealDocuments.js';
import { CreateDealController } from './presentation/controllers/CreateDealController.js';
import { AuthController } from './presentation/controllers/AuthController.js';
import { AuthUseCases } from './usecases/auth/AuthUseCases.js';
import { authMiddleware, requireRole } from './presentation/middlewares/AuthMiddleware.js';
import { requestLogMiddleware } from './presentation/middlewares/RequestLogMiddleware.js';
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
import { ProjectFacilityUseCase } from './usecases/product/ProjectFacilityUseCase.js';
import { ProjectFacilityController } from './presentation/controllers/ProjectFacilityController.js';
import { ProductController } from './presentation/controllers/ProductController.js';
import { ReservationController } from './presentation/controllers/ReservationController.js';
import { ReservationUseCase } from './usecases/reservation/ReservationUseCase.js';
import { UnitPriceUseCase } from './usecases/pricing/UnitPriceUseCase.js';
import { UnitPriceController } from './presentation/controllers/UnitPriceController.js';
import { LeadLabelUseCase } from './usecases/crm/LeadLabelUseCase.js';
import { LeadLabelController } from './presentation/controllers/LeadLabelController.js';
import { LeadSourceUseCase } from './usecases/crm/LeadSourceUseCase.js';
import { LeadSourceController } from './presentation/controllers/LeadSourceController.js';
import { LeadActivityTypeUseCase } from './usecases/crm/LeadActivityTypeUseCase.js';
import { LeadActivityTypeController } from './presentation/controllers/LeadActivityTypeController.js';
import { LeadCampaignUseCase } from './usecases/crm/LeadCampaignUseCase.js';
import { LeadCampaignController } from './presentation/controllers/LeadCampaignController.js';
import { LeadFormSubmissionUseCase } from './usecases/crm/LeadFormSubmissionUseCase.js';
import { LeadFormSubmissionController } from './presentation/controllers/LeadFormSubmissionController.js';
import { PipelineStageUseCase } from './usecases/crm/PipelineStageUseCase.js';
import { PipelineStageController } from './presentation/controllers/PipelineStageController.js';
import { LeadFormTemplateUseCase } from './usecases/crm/LeadFormTemplateUseCase.js';
import { LeadFormTemplateController } from './presentation/controllers/LeadFormTemplateController.js';
import { AvailabilityUseCase } from './usecases/availability/AvailabilityUseCase.js';
import { AvailabilityController } from './presentation/controllers/AvailabilityController.js';
import { DealDetailUseCase } from './usecases/deal/DealDetailUseCase.js';
import { DealDetailController } from './presentation/controllers/DealDetailController.js';
import { CustomerProfileUseCase } from './usecases/customer/CustomerProfileUseCase.js';
import { CustomerProfileController } from './presentation/controllers/CustomerProfileController.js';
import { FinancingBankUseCase } from './usecases/deal/FinancingBankUseCase.js';
import { FinancingBankController } from './presentation/controllers/FinancingBankController.js';

// Prisma returns BigInt for price columns; JSON.stringify cannot serialize it.
// Prices stay below Number.MAX_SAFE_INTEGER (enforced by request validation).
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

const app = express();
app.use(requestLogMiddleware);
// Proyek besar (sampai 5000 unit) mengirim struktur unit jauh di atas bawaan 100 KB.
const MAX_PROJECT_PAYLOAD_BYTES = 2 * 1024 * 1024;
app.use(express.json({ limit: MAX_PROJECT_PAYLOAD_BYTES }));
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
  limits: { fileSize: 10 * 1024 * 1024, fieldSize: MAX_PROJECT_PAYLOAD_BYTES },
  fileFilter: (_req, file, callback) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
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

// Tambah Deal dari Lead yang ada. Didaftarkan sebelum CRUD generik agar rutenya menang.
const createDeal = new CreateDealController(new CreateDealUseCase(prisma));
const dealDocumentUploads = upload.array('documents', MAX_DEAL_DOCUMENTS);
app.get('/api/lead/deal-options', authMiddleware, createDeal.leadOptions);
app.post('/api/deal', authMiddleware, dealDocumentUploads, createDeal.create);

// Archive routes are explicit: archive state is not generic Lead CRUD.
const leadArchiveController = new LeadArchiveController(new LeadArchiveUseCase(prisma));
app.get('/api/leads/archive', authMiddleware, leadArchiveController.list);
app.post('/api/leads/:id/archive', authMiddleware, leadArchiveController.archiveLead);
app.post('/api/leads/:id/reactivate', authMiddleware, leadArchiveController.reactivate);
app.patch('/api/leads/:id/archive-category', authMiddleware, leadArchiveController.changeCategory);
app.delete('/api/leads/:id/permanent', authMiddleware, leadArchiveController.permanentDelete);
app.post('/api/leads/archive/bulk-reactivate', authMiddleware, leadArchiveController.bulkReactivate);
app.patch('/api/leads/archive/bulk-category', authMiddleware, leadArchiveController.bulkChangeCategory);
app.post('/api/leads/archive/bulk-permanent-delete', authMiddleware, leadArchiveController.bulkPermanentDelete);

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

// Detail Deal domain. Pipeline stages stay configurable and are read through the
// existing stage/pipeline endpoints; these routes only own transaction, history,
// customer profile, and verified Lost Deal workflows.
const dealDetail = new DealDetailController(new DealDetailUseCase(prisma));
app.get('/api/deal/:id/history', authMiddleware, dealDetail.history);
app.get('/api/deal/:id/payments', authMiddleware, dealDetail.payments);
app.post('/api/deal/:id/payments', authMiddleware, dealDetail.createPayment);
app.put('/api/deal/:id/payments/:paymentId', authMiddleware, dealDetail.updatePayment);
app.get('/api/deal/:id/lost-requests', authMiddleware, dealDetail.lostRequests);
app.post('/api/deal/:id/lost-requests', authMiddleware, dealDetail.requestLost);
app.post('/api/deal/:id/lost-requests/:requestId/approve', authMiddleware, dealDetail.approveLost);
app.post('/api/deal/:id/lost-requests/:requestId/reject', authMiddleware, dealDetail.rejectLost);

const customerProfiles = new CustomerProfileController(new CustomerProfileUseCase(prisma));
app.get('/api/customers/:id/profile', authMiddleware, customerProfiles.get);

const financingBanks = new FinancingBankController(new FinancingBankUseCase(prisma));
app.get('/api/financing-banks', authMiddleware, financingBanks.list);
app.post('/api/financing-banks', authMiddleware, financingBanks.create);
app.put('/api/financing-banks/:id', authMiddleware, financingBanks.update);
app.delete('/api/financing-banks/:id', authMiddleware, financingBanks.remove);

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
app.get('/api/products/:id/edit-data', authMiddleware, pc.getProductEdit);
const projectUploads = upload.fields([{ name: 'covers', maxCount: 10 }, { name: 'typeImages', maxCount: 500 }, { name: 'typeVariantImages', maxCount: 500 }, { name: 'unitImages', maxCount: 500 }, { name: 'siteplan', maxCount: 1 }]);
app.post('/api/products', authMiddleware, ownerOnly, projectUploads, pc.createProduct);
app.put('/api/products/:id', authMiddleware, ownerOnly, projectUploads, pc.updateProduct);
app.delete('/api/products/:id', authMiddleware, ownerOnly, pc.deleteProduct);
const typeUploads = upload.fields([{ name: 'typeImages', maxCount: 5 }, { name: 'typeVariantImages', maxCount: 500 }]);
app.post('/api/products/:id/variants', authMiddleware, ownerOnly, typeUploads, pc.createVariant);
app.put('/api/products/:id/variants/:variantId', authMiddleware, ownerOnly, typeUploads, pc.updateVariant);
app.delete('/api/products/:id/variants/:variantId', authMiddleware, ownerOnly, pc.deleteVariant);
app.post('/api/products/:id/attributes', authMiddleware, ownerOnly, pc.createAttribute);
app.put('/api/products/:id/attributes/:attributeId', authMiddleware, ownerOnly, pc.updateAttribute);
app.delete('/api/products/:id/attributes/:attributeId', authMiddleware, ownerOnly, pc.deleteAttribute);
app.get('/api/products/:id/unit-photos', authMiddleware, pc.listUnitPhotos);
app.get('/api/products/:id/media', authMiddleware, pc.listMedia);
app.post('/api/products/:id/media', authMiddleware, ownerOnly, upload.single('file'), pc.uploadMedia);
app.post('/api/products/:id/media-links', authMiddleware, ownerOnly, pc.addMediaLink);
app.patch('/api/media/:id', authMiddleware, ownerOnly, pc.updateMedia);
app.delete('/api/media/:id', authMiddleware, ownerOnly, pc.deleteMedia);
app.get('/api/attributes', authMiddleware, pc.listAttributeDefinitions);
app.post('/api/attributes', authMiddleware, ownerOnly, pc.createAttributeDefinition);
app.put('/api/attributes/:id', authMiddleware, ownerOnly, pc.updateAttributeDefinition);
app.delete('/api/attributes/:id', authMiddleware, ownerOnly, pc.deleteAttributeDefinition);
// Konfigurasi fasilitas proyek per company. Semua user membaca, owner mengubah.
const projectFacilities = new ProjectFacilityController(new ProjectFacilityUseCase(prisma));
app.get('/api/project-facilities', authMiddleware, projectFacilities.list);
app.post('/api/project-facilities', authMiddleware, ownerOnly, projectFacilities.create);
app.put('/api/project-facilities/:id', authMiddleware, ownerOnly, projectFacilities.update);
app.delete('/api/project-facilities/:id', authMiddleware, ownerOnly, projectFacilities.remove);
app.get('/api/units', authMiddleware, pc.listUnits);
app.get('/api/characteristics', authMiddleware, pc.listCharacteristics);
app.post('/api/characteristics', authMiddleware, ownerOnly, pc.createCharacteristic);
app.put('/api/characteristics/:id', authMiddleware, ownerOnly, pc.updateCharacteristic);
app.delete('/api/characteristics/:id', authMiddleware, ownerOnly, pc.deleteCharacteristic);

const reservationController = new ReservationController(new ReservationUseCase(prisma));
app.get('/api/reservations', authMiddleware, reservationController.list);
app.post('/api/reservations', authMiddleware, reservationController.create);
app.get('/api/reservations/:id', authMiddleware, reservationController.get);
app.patch('/api/reservations/:id', authMiddleware, reservationController.update);
app.patch('/api/reservations/:id/status', authMiddleware, reservationController.updateStatus);

const availabilityController = new AvailabilityController(new AvailabilityUseCase(prisma));
app.get('/api/availability', authMiddleware, availabilityController.overview);
app.get('/api/availability/:projectRef', authMiddleware, availabilityController.project);
app.get(
  '/api/availability/:projectRef/hierarchy/:nodeRef',
  authMiddleware,
  availabilityController.hierarchyNode
);
app.get('/api/availability/:projectRef/clusters/:clusterRef', authMiddleware, availabilityController.cluster);
app.get(
  '/api/availability/:projectRef/clusters/:clusterRef/units/:unitRef',
  authMiddleware,
  availabilityController.unit
);

// Konfigurasi Leads Label (Temperature dan Tags) per company. Semua user membaca, owner mengubah.
const leadLabels = new LeadLabelController(new LeadLabelUseCase(prisma));
app.get('/api/lead-labels', authMiddleware, leadLabels.list);
app.post('/api/lead-labels', authMiddleware, ownerOnly, leadLabels.create);
app.put('/api/lead-labels/:id', authMiddleware, ownerOnly, leadLabels.update);
app.delete('/api/lead-labels/:id', authMiddleware, ownerOnly, leadLabels.remove);

// Konfigurasi Leads Source per company (tabel `source`, tipe lead). Semua user membaca, owner mengubah.
const leadSources = new LeadSourceController(new LeadSourceUseCase(prisma));
app.get('/api/lead-sources', authMiddleware, leadSources.list);
app.post('/api/lead-sources', authMiddleware, ownerOnly, leadSources.create);
app.put('/api/lead-sources/:id', authMiddleware, ownerOnly, leadSources.update);
app.delete('/api/lead-sources/:id', authMiddleware, ownerOnly, leadSources.remove);

const leadCampaigns = new LeadCampaignController(new LeadCampaignUseCase(prisma));
app.get('/api/lead-campaigns', authMiddleware, leadCampaigns.list);
app.post('/api/lead-campaigns', authMiddleware, ownerOnly, leadCampaigns.create);
app.put('/api/lead-campaigns/:id', authMiddleware, ownerOnly, leadCampaigns.update);
app.delete('/api/lead-campaigns/:id', authMiddleware, ownerOnly, leadCampaigns.remove);

// Form Add Lead dari template default: semua user login dapat membaca dan mengirim.
const leadForm = new LeadFormSubmissionController(new LeadFormSubmissionUseCase(prisma));
app.get('/api/lead-form', authMiddleware, leadForm.defaultForm);
app.post('/api/lead-form/submissions', authMiddleware, leadForm.submit);

const leadActivityTypes = new LeadActivityTypeController(new LeadActivityTypeUseCase(prisma));
app.get('/api/lead-activity-types', authMiddleware, leadActivityTypes.list);
app.post('/api/lead-activity-types', authMiddleware, ownerOnly, leadActivityTypes.create);
app.put('/api/lead-activity-types/:id', authMiddleware, ownerOnly, leadActivityTypes.update);
app.delete('/api/lead-activity-types/:id', authMiddleware, ownerOnly, leadActivityTypes.remove);

// Konfigurasi pipeline (tahapan Lead/Deal beserta evidence) per company. Semua user membaca, owner mengubah.
const pipelineStages = new PipelineStageController(new PipelineStageUseCase(prisma));
app.get('/api/pipeline-stages', authMiddleware, pipelineStages.list);
app.post('/api/pipeline-stages', authMiddleware, ownerOnly, pipelineStages.create);
app.put('/api/pipeline-stages/reorder', authMiddleware, ownerOnly, pipelineStages.reorder);
app.put('/api/pipeline-stages/:id', authMiddleware, ownerOnly, pipelineStages.update);
app.delete('/api/pipeline-stages/:id', authMiddleware, ownerOnly, pipelineStages.remove);

// Konfigurasi Form Template (custom field Lead, berversi) per company. Semua user membaca, owner mengubah.
const formTemplates = new LeadFormTemplateController(new LeadFormTemplateUseCase(prisma));
app.get('/api/lead-form-templates', authMiddleware, formTemplates.list);
app.get('/api/lead-form-templates/:id', authMiddleware, formTemplates.get);
app.post('/api/lead-form-templates', authMiddleware, ownerOnly, formTemplates.create);
app.post('/api/lead-form-templates/:id/duplicate', authMiddleware, ownerOnly, formTemplates.duplicate);
app.put('/api/lead-form-templates/:id', authMiddleware, ownerOnly, formTemplates.update);
app.delete('/api/lead-form-templates/:id', authMiddleware, ownerOnly, formTemplates.remove);

// Unit price management (CRM-51, CRM-52, CRM-53). Sementara hanya owner yang menulis.
const unitPrices = new UnitPriceController(new UnitPriceUseCase(prisma));
app.get('/api/unit-prices', authMiddleware, unitPrices.list);
app.post('/api/unit-prices/bulk-adjustments', authMiddleware, ownerOnly, unitPrices.createBulkAdjustment);
app.get('/api/unit-prices/:unitId', authMiddleware, unitPrices.detail);
app.get('/api/unit-prices/:unitId/history', authMiddleware, unitPrices.history);
app.post('/api/unit-prices/:unitId/adjustments', authMiddleware, ownerOnly, unitPrices.createAdjustment);
app.get('/api/unit-price-adjustments', authMiddleware, unitPrices.listAdjustments);
app.post('/api/unit-price-adjustments/:id/approve', authMiddleware, ownerOnly, unitPrices.approve);
app.post('/api/unit-price-adjustments/:id/reject', authMiddleware, ownerOnly, unitPrices.reject);

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
