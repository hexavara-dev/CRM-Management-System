import { AuthUseCases } from '../src/usecases/auth/AuthUseCases.js';
import { LeadUseCases } from '../src/usecases/lead/LeadUseCases.js';
import type { IRepository } from '../src/domain/repositories/IRepository.js';

// 1. Generic Mock Repository to satisfy behavior without actual DB
class MockRepository implements IRepository<any> {
  public items: any[] = [];

  // The LeadUseCases class bypasses IRepository and uses .delegate directly.
  // For test mocking, we provide this delegate that points back to our internal items.
  get delegate() {
    return {
      findUnique: async (args: any) => this.findById(args.where.id),
      findMany: async (_args: any) => this.findAll(),
      create: async (args: any) => this.create(args.data),
      update: async (args: any) => this.update(args.where.id, args.data),
      delete: async (args: any) => this.delete(args.where.id),
    };
  }

  async create(data: any) {
    const item = {
      id: `id-${Math.random().toString(36).substr(2, 9)}`,
      isDeleted: false,
      ...data,
      tenantId: data.tenantId ?? data.tenant?.connect?.id,
    };
    this.items.push(item);
    return item;
  }

  async findById(id: string) {
    return this.items.find((i) => i.id === id) || null;
  }

  async findOne(where: any) {
    return (
      this.items.find((item) => {
        return Object.entries(where).every(([key, value]) => item[key] === value);
      }) || null
    );
  }

  async update(id: string, data: any) {
    const index = this.items.findIndex((i) => i.id === id);
    if (index === -1) throw new Error('Not found');
    this.items[index] = { ...this.items[index], ...data };
    return this.items[index];
  }

  async delete(id: string) {
    const index = this.items.findIndex((i) => i.id === id);
    if (index === -1) throw new Error('Not found');
    const item = this.items[index];
    this.items.splice(index, 1);
    return item;
  }

  async findAll(_include?: any, _where?: any) {
    return this.items;
  }
}

describe('CRM Main Business Flow Integration Test (Mocked Persistence)', () => {
  let userRepo: MockRepository;
  let tenantRepo: MockRepository;
  let leadRepo: MockRepository;
  let dealRepo: MockRepository;
  let inviteRepo: MockRepository;

  let authUseCases: AuthUseCases;
  let leadUseCases: LeadUseCases;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-only-jwt-secret';
    userRepo = new MockRepository();
    tenantRepo = new MockRepository();
    leadRepo = new MockRepository();
    dealRepo = new MockRepository();
    inviteRepo = new MockRepository();

    authUseCases = new AuthUseCases(userRepo, inviteRepo, tenantRepo);
    leadUseCases = new LeadUseCases(leadRepo, dealRepo);
  });

  it('should complete the full lifecycle: onboarding -> lead creation -> conversion', async () => {
    // --- STEP 1: ONBOARDING ---
    const onboardResult = await authUseCases.onboard(
      'Acme Corp',
      'owner@acme.com',
      'secure-password',
      'Acme Owner'
    );

    expect(onboardResult).toHaveProperty('token');
    expect(onboardResult.tenant.name).toBe('Acme Corp');
    expect(onboardResult.user.role).toBe('owner');
    const tenantId = onboardResult.tenant.id;

    // --- STEP 2: LEAD CREATION ---
    const lead = await leadUseCases.createLead({
      tenantId: tenantId,
      firstName: 'Potential',
      lastName: 'Client',
      email: 'client@gmail.com',
      type: 'inbound',
      notes: 'Interested in enterprise license',
    });

    expect(lead).toHaveProperty('id');
    expect(lead.tenant.connect.id).toBe(tenantId);
    const leadId = lead.id;

    // --- STEP 3: LEAD TO DEAL CONVERSION ---
    const convertResult = await leadUseCases.convertLeadToDeal(
      leadId,
      {
        expectedAmount: 50000,
        currency: 'USD',
        unitId: 'unit-1',
        paymentMethod: 'CASH',
      },
      tenantId
    );

    expect(convertResult).toHaveProperty('id');
    expect(convertResult.lead.connect.id).toBe(leadId);

    // Verify the lead state changed in our mock storage
    const updatedLead = await leadRepo.findById(leadId);
    expect(updatedLead.converted).toBe(true);
    expect(updatedLead.convertedDate).toBeDefined();

    // --- STEP 4: AUTHENTICATION (LOGIN) ---
    const loginResult = await authUseCases.login('owner@acme.com', 'secure-password');
    expect(loginResult).toHaveProperty('token');
    expect(loginResult.user.email).toBe('owner@acme.com');

    // --- STEP 5: VERIFY PROFILE RETRIEVAL ---
    const profile = await authUseCases.getMe(onboardResult.user.id);
    expect(profile).toHaveProperty('id', onboardResult.user.id);
    expect(profile).not.toHaveProperty('password');
  });

  it('should handle failed login attempts correctly', async () => {
    await authUseCases.onboard('Test', 'test@test.com', 'password-123');
    await expect(authUseCases.login('test@test.com', 'wrong-pass')).rejects.toThrow(
      'Invalid email or password'
    );
  });

  it('should prevent creating a user with an existing email', async () => {
    await authUseCases.onboard('Tenant 1', 'unique@email.com', 'password-123');
    await expect(authUseCases.onboard('Tenant 2', 'unique@email.com', 'password-456')).rejects.toThrow(
      'Email already registered'
    );
  });
});
