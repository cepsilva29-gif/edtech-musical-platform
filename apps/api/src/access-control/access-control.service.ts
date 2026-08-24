import { ForbiddenException, Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Le o estado de assinatura ja modelado no schema (FASE 2) para decidir se um usuario pode
 * consumir conteudo premium. A criacao/gestao real de assinaturas (checkout, gateway, webhooks)
 * fica para a FASE 6 - aqui so existe o lado "consumidor" da entitlement, que ja pode ser
 * exercitado manualmente (seed/admin) enquanto a FASE 6 nao chega.
 */
@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async hasActiveEntitlement(userId: string): Promise<boolean> {
    const now = new Date();
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: now } }],
      },
      select: { id: true },
    });

    return !!subscription;
  }

  /**
   * Regra unica de consumo de conteudo premium (materiais, progresso, playback - decisao 18/24):
   * quem gerencia o curso (admin/professor dono) sempre passa; qualquer outro usuario precisa de
   * assinatura ativa. `canManage` vem pre-calculado pelo chamador (ex.
   * `LessonsService.canManage(user, lesson)`) para este servico nao precisar depender do modulo de
   * catalogo.
   */
  async assertEntitled(userId: string, canManage: boolean): Promise<void> {
    if (canManage) {
      return;
    }

    const hasAccess = await this.hasActiveEntitlement(userId);
    if (!hasAccess) {
      throw new ForbiddenException('Assinatura ativa necessaria para acessar este conteudo.');
    }
  }
}
