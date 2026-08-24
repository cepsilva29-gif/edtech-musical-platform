import { ConflictException, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const userWithRoles = {
  include: { userRoles: { include: { role: true } } },
} as const;

export type UserWithRoles = NonNullable<Awaited<ReturnType<UsersService['findByEmail']>>>;

interface CreateStudentInput {
  name: string;
  email: string;
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, ...userWithRoles });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, ...userWithRoles });
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

  static toRoleNames(user: { userRoles: { role: { name: string } }[] }): string[] {
    return user.userRoles.map((userRole) => userRole.role.name);
  }
}
