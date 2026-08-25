import { UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UserWithRoles, UsersService } from './users.service';

function userFixture(overrides: Partial<UserWithRoles> = {}): UserWithRoles {
  return {
    id: 'user-1',
    name: 'Aluno Teste',
    email: 'aluno@example.com',
    passwordHash: 'hash',
    status: UserStatus.ACTIVE,
    emailVerifiedAt: null,
    lastLoginAt: null,
    gatewayCustomerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    userRoles: [
      { userId: 'user-1', roleId: 'role-student', role: { id: 'role-student', name: 'student' } },
    ],
    ...overrides,
  } as UserWithRoles;
}

const actor: AuthenticatedUser = { id: 'admin-1', email: 'admin@example.com', roles: ['admin'] };

describe('UsersService - audit logging (FASE 14)', () => {
  it('setRoles grava um audit log com o ator, os papeis antigos e os novos', async () => {
    const before = userFixture({
      userRoles: [
        { userId: 'user-1', roleId: 'role-student', role: { id: 'role-student', name: 'student' } },
      ],
    });
    const after = userFixture({
      userRoles: [
        { userId: 'user-1', roleId: 'role-teacher', role: { id: 'role-teacher', name: 'teacher' } },
      ],
    });

    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after) },
      role: { findMany: jest.fn().mockResolvedValue([{ id: 'role-teacher', name: 'teacher' }]) },
      userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as PrismaService;

    const auditService = { record: jest.fn() } as unknown as AuditService;
    const service = new UsersService(prisma, auditService);

    const result = await service.setRoles(actor, 'user-1', ['teacher'], '203.0.113.1');

    expect(result.userRoles[0].role.name).toBe('teacher');
    expect(auditService.record).toHaveBeenCalledWith({
      userId: 'admin-1',
      action: 'user.roles_updated',
      entity: 'user',
      entityId: 'user-1',
      metadata: { before: ['student'], after: ['teacher'] },
      ip: '203.0.113.1',
    });
  });

  it('setStatus grava um audit log com o ator, o status antigo e o novo', async () => {
    const before = userFixture({ status: UserStatus.ACTIVE });
    const after = userFixture({ status: UserStatus.BLOCKED });

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after),
        update: jest.fn(),
      },
    } as unknown as PrismaService;

    const auditService = { record: jest.fn() } as unknown as AuditService;
    const service = new UsersService(prisma, auditService);

    const result = await service.setStatus(actor, 'user-1', UserStatus.BLOCKED, null);

    expect(result.status).toBe(UserStatus.BLOCKED);
    expect(auditService.record).toHaveBeenCalledWith({
      userId: 'admin-1',
      action: 'user.status_updated',
      entity: 'user',
      entityId: 'user-1',
      metadata: { before: UserStatus.ACTIVE, after: UserStatus.BLOCKED },
      ip: null,
    });
  });
});
