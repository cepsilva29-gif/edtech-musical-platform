import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { paginationArgs, PaginatedResult, toPaginatedResult } from '../common/utils/pagination';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

const userWithRoles = {
  include: { userRoles: { include: { role: true } } },
} as const;

export type UserWithRoles = NonNullable<Awaited<ReturnType<UsersService['findByEmail']>>>;

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: string[];
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

interface CreateStudentInput {
  name: string;
  email: string;
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, ...userWithRoles });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, ...userWithRoles });
  }

  async findByIdOrThrow(id: string): Promise<UserWithRoles> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    return user;
  }

  async createStudent(input: CreateStudentInput): Promise<UserWithRoles> {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('E-mail ja cadastrado.');
    }

    const studentRole = await this.prisma.role.findUnique({ where: { name: 'student' } });
    if (!studentRole) {
      throw new Error(
        'Role "student" nao encontrada. Rode o seed do banco (npm run prisma:seed) antes de usar a API.',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        userRoles: { create: { roleId: studentRole.id } },
      },
      ...userWithRoles,
    });

    return user;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date(), status: UserStatus.ACTIVE },
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  }

  /** Listagem administrativa (painel admin/professor - FASE 11). */
  async listAdmin(query: ListUsersQueryDto): Promise<PaginatedResult<AdminUserView>> {
    const where: Prisma.UserWhereInput = {
      status: query.status,
      ...(query.role ? { userRoles: { some: { role: { name: query.role } } } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...userWithRoles,
        ...paginationArgs(query.page, query.limit),
      }),
      this.prisma.user.count({ where }),
    ]);

    return toPaginatedResult(
      items.map((user) => UsersService.toAdminView(user)),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * Substitui integralmente os papeis do usuario (ex.: promover a professor). Auditado (FASE 14 -
   * escalonamento/rebaixamento de privilegio e exatamente o tipo de "acao sensivel" que a secao 13
   * do prompt-mestre exige registrar - achado real na auditoria final: so `auth.service.ts` gravava
   * audit log ate aqui).
   */
  async setRoles(
    actor: AuthenticatedUser,
    userId: string,
    roleNames: string[],
    ip?: string | null,
  ): Promise<UserWithRoles> {
    const before = await this.findByIdOrThrow(userId);

    const uniqueNames = Array.from(new Set(roleNames));
    const roles = await this.prisma.role.findMany({ where: { name: { in: uniqueNames } } });
    if (roles.length !== uniqueNames.length) {
      const found = new Set(roles.map((role) => role.name));
      const missing = uniqueNames.filter((name) => !found.has(name));
      throw new BadRequestException(`Papel(is) inexistente(s): ${missing.join(', ')}`);
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({ data: roles.map((role) => ({ userId, roleId: role.id })) }),
    ]);

    const after = await this.findByIdOrThrow(userId);
    await this.auditService.record({
      userId: actor.id,
      action: 'user.roles_updated',
      entity: 'user',
      entityId: userId,
      metadata: {
        before: UsersService.toRoleNames(before),
        after: UsersService.toRoleNames(after),
      },
      ip,
    });

    return after;
  }

  /**
   * Bloqueia/reativa um usuario (UserStatus.BLOCKED/ACTIVE). Auditado pelo mesmo motivo de
   * `setRoles` acima.
   */
  async setStatus(
    actor: AuthenticatedUser,
    userId: string,
    status: UserStatus,
    ip?: string | null,
  ): Promise<UserWithRoles> {
    const before = await this.findByIdOrThrow(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    const after = await this.findByIdOrThrow(userId);

    await this.auditService.record({
      userId: actor.id,
      action: 'user.status_updated',
      entity: 'user',
      entityId: userId,
      metadata: { before: before.status, after: after.status },
      ip,
    });

    return after;
  }

  static toRoleNames(user: { userRoles: { role: { name: string } }[] }): string[] {
    return user.userRoles.map((userRole) => userRole.role.name);
  }

  static toAdminView(user: UserWithRoles): AdminUserView {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roles: UsersService.toRoleNames(user),
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }
}
