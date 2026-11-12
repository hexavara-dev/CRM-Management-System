import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';
import type { IRepository } from '../../domain/repositories/IRepository.js';

// Masa berlaku sesi: token JWT dan cookie memakai nilai yang sama (365 hari).
export const SESSION_DAYS = 365;

export class AuthUseCases {
  private jwtSecret: string;

  constructor(
    private userRepository: IRepository<any>,
    private inviteRepository: IRepository<any>,
    private tenantRepository?: IRepository<any>,
    private statusRepository?: IRepository<any>,
    private prisma?: PrismaClient
  ) {
    if (!process.env.JWT_SECRET) throw new Error('Missing JWT_SECRET environment variable');
    this.jwtSecret = process.env.JWT_SECRET;
  }

  private publicUser(user: any) {
    const safeUser = { ...user };
    delete safeUser.password;
    return safeUser;
  }

  private validateEmail(email: unknown): asserts email is string {
    if (
      typeof email !== 'string' ||
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error('A valid email is required');
    }
  }

  private validatePassword(password: unknown) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      throw new Error('Password must be between 8 and 128 characters');
    }
  }

  async onboard(tenantName: string, email: string, password: string, name?: string) {
    if (!this.tenantRepository) throw new Error('Tenant repository not configured');
    if (typeof tenantName !== 'string' || !tenantName.trim() || tenantName.length > 150) {
      throw new Error('Tenant name is required');
    }
    this.validateEmail(email);
    this.validatePassword(password);
    if (name !== undefined && (typeof name !== 'string' || name.length > 150)) {
      throw new Error('Invalid name');
    }

    const existing = await this.userRepository.findOne({ email });
    if (existing) throw new Error('Email already registered');

    const hashedPassword = await bcrypt.hash(password, 10);

    const defaultStatuses = [
        {
          name: 'direncanakan',
          type: 'viewing',
          isDefaultStatus: true,
          isSystemStatus: true,
          priority: 1,
        },
        { name: 'belum dikerjakan', type: 'viewing', isSystemStatus: true, priority: 2 },
        { name: 'perlu reschedule', type: 'viewing', isSystemStatus: true, priority: 3 },
        {
          name: 'sudah visit',
          type: 'viewing',
          isClosingStatus: true,
          isSystemStatus: true,
          priority: 4,
        },
        { name: 'gagal', type: 'viewing', isFailedStatus: true, isSystemStatus: true, priority: 5 },
    ];

    let newTenant: any;
    let newUser: any;

    if (this.prisma) {
      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.company.create({ data: { name: tenantName, plan: 'free' } });
        const user = await tx.user.create({
          data: {
            tenant: { connect: { id: tenant.id } },
            email,
            password: hashedPassword,
            name: name || email.split('@')[0] || email,
            role: 'owner',
          },
        });
        await tx.status.createMany({
          data: defaultStatuses.map((status) => ({
            ...status,
            tenantId: tenant.id,
            defaultGuard: status.isDefaultStatus ? status.type : null,
            closingGuard: null,
          })),
        });
        return { tenant, user };
      });
      newTenant = result.tenant;
      newUser = result.user;
    } else {
      newTenant = await this.tenantRepository.create({ name: tenantName, plan: 'free' });
      newUser = await this.userRepository.create({
        tenant: { connect: { id: newTenant.id } },
        email,
        password: hashedPassword,
        name: name || email.split('@')[0] || email,
        role: 'owner',
      });

      if (this.statusRepository) {
        for (const status of defaultStatuses) {
          await this.statusRepository.create({
            tenant: { connect: { id: newTenant.id } },
            ...status,
            defaultGuard: status.isDefaultStatus ? status.type : null,
            closingGuard: null,
          });
        }
      }
    }

    const token = jwt.sign(
      { userId: newUser.id, tenantId: newUser.tenantId, role: newUser.role },
      this.jwtSecret,
      { expiresIn: `${SESSION_DAYS}d` }
    );

    return { token, user: this.publicUser(newUser), tenant: newTenant };
  }

  async createInvite(
    hostUserId: string,
    tenantId: string,
    email: string,
    role: string = 'member',
    name?: string
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.inviteRepository.create({
      tenant: { connect: { id: tenantId } },
      hostUser: { connect: { id: hostUserId } },
      email,
      name,
      role,
      expiresAt,
    });
  }

  async login(email: string, password: string) {
    this.validateEmail(email);
    if (typeof password !== 'string' || !password) throw new Error('Invalid email or password');
    const user = await this.userRepository.findOne({ email });
    if (!user) throw new Error('Invalid email or password');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error('Invalid email or password');

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role },
      this.jwtSecret,
      { expiresIn: `${SESSION_DAYS}d` }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async register(password: string, name: string, email: string, tenantId: string) {
    if (!tenantId) throw new Error('Missing required user fields');
    this.validateEmail(email);
    this.validatePassword(password);
    if (typeof name !== 'string' || !name.trim() || name.length > 150) {
      throw new Error('Name is required');
    }
    const existing = await this.userRepository.findOne({ email });
    if (existing) throw new Error('Email already registered');
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await this.userRepository.create({
      password: hashedPassword,
      name: name,
      email: email,
      role: 'member',
      tenant: { connect: { id: tenantId } },
    });

    return { user: this.publicUser(newUser) };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('User not found');
    return this.publicUser(user);
  }

  async updateAccount(
    requesterId: string,
    requesterRole: string,
    requesterTenantId: string,
    targetUserId: string,
    data: any
  ) {
    if (requesterRole !== 'owner') {
      throw new Error('Unauthorized: Only owners can update accounts');
    }

    const target = await this.userRepository.findOne({ id: targetUserId, tenantId: requesterTenantId });
    if (!target) throw new Error('User not found');
    if (requesterId === targetUserId && data.role && data.role !== 'owner') {
      throw new Error('Owners cannot remove their own owner role');
    }
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.password) {
      this.validatePassword(data.password);
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await this.userRepository.update(targetUserId, updateData);
    return this.publicUser(updatedUser);
  }

  async getUsers(tenantId: string) {
    const users = await this.userRepository.findAll({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    return { data: users.map((user: any) => this.publicUser(user)) };
  }

  async deleteUser(requesterId: string, requesterRole: string, tenantId: string, targetUserId: string) {
    if (requesterRole !== 'owner') throw new Error('Unauthorized: Only owners can delete accounts');
    if (requesterId === targetUserId) throw new Error('Owners cannot delete their own account');
    const target = await this.userRepository.findOne({ id: targetUserId, tenantId });
    if (!target) throw new Error('User not found');
    return this.publicUser(await this.userRepository.delete(targetUserId));
  }
}
