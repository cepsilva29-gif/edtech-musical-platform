import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PublishStatus, SubscriptionPlan } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { isAdmin } from '../common/utils/catalog-visibility.util';
import { paginationArgs, PaginatedResult, toPaginatedResult } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { ListSubscriptionPlansQueryDto } from './dto/list-subscription-plans-query.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

@Injectable()
export class SubscriptionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthenticatedUser,
    query: ListSubscriptionPlansQueryDto,
  ): Promise<PaginatedResult<SubscriptionPlan>> {
    const where: Prisma.SubscriptionPlanWhereInput = isAdmin(user)
      ? query.status
        ? { status: query.status }
        : {}
      : { status: PublishStatus.PUBLISHED };

    const [items, total] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({
        where,
        orderBy: { priceCents: 'asc' },
        ...paginationArgs(query.page, query.limit),
      }),
      this.prisma.subscriptionPlan.count({ where }),
    ]);

    return toPaginatedResult(items, total, query.page, query.limit);
  }

  async findVisibleById(user: AuthenticatedUser, id: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan || (plan.status !== PublishStatus.PUBLISHED && !isAdmin(user))) {
      throw new NotFoundException('Plano nao encontrado.');
    }
    return plan;
  }

  /** Checkout precisa de um plano de fato comercializavel, independente do papel de quem chama. */
  async findPublishedOrThrow(id: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan || plan.status !== PublishStatus.PUBLISHED) {
      throw new NotFoundException('Plano nao encontrado ou indisponivel para assinatura.');
    }
    return plan;
  }

  async findByIdOrThrow(id: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plano nao encontrado.');
    }
    return plan;
  }

  async create(dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        priceCents: dto.priceCents,
        currency: dto.currency ?? 'BRL',
        interval: dto.interval,
        trialDays: dto.trialDays ?? 0,
        status: dto.status ?? PublishStatus.DRAFT,
        gatewayPriceId: dto.gatewayPriceId,
      },
    });
  }

  async update(id: string, dto: UpdateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    await this.findByIdOrThrow(id);
    return this.prisma.subscriptionPlan.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    const subscriptionsCount = await this.prisma.userSubscription.count({ where: { planId: id } });
    if (subscriptionsCount > 0) {
      throw new ConflictException('Nao e possivel excluir um plano com assinaturas vinculadas.');
    }

    await this.prisma.subscriptionPlan.delete({ where: { id } });
  }
}
