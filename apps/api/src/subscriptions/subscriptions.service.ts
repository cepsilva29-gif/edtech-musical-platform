import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus, UserSubscription } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { PaymentGateway } from '../payments/payment-gateway.interface';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service';
import { CheckoutDto } from './dto/checkout.dto';

const OPEN_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
];

export interface CheckoutResult {
  subscriptionId: string;
  checkoutUrl: string | null;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionPlansService: SubscriptionPlansService,
    private readonly paymentGateway: PaymentGateway,
    private readonly paymentsService: PaymentsService,
  ) {}

  async checkout(user: AuthenticatedUser, dto: CheckoutDto): Promise<CheckoutResult> {
    const plan = await this.subscriptionPlansService.findPublishedOrThrow(dto.planId);

    const existing = await this.prisma.userSubscription.findFirst({
      where: {
        userId: user.id,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      },
    });
    if (existing) {
      throw new ConflictException('Voce ja possui uma assinatura ativa.');
    }

    const dbUser = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    let gatewayCustomerId = dbUser.gatewayCustomerId;
    if (!gatewayCustomerId) {
      const customer = await this.paymentGateway.createCustomer({
        userId: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
      });
      gatewayCustomerId = customer.gatewayCustomerId;
      await this.prisma.user.update({ where: { id: dbUser.id }, data: { gatewayCustomerId } });
    }

    const subscriptionResult = await this.paymentGateway.createSubscription({
      gatewayCustomerId,
      plan,
    });

    const subscription = await this.prisma.userSubscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        gateway: this.paymentGateway.name,
        gatewaySubscriptionId: subscriptionResult.gatewaySubscriptionId,
        status: SubscriptionStatus.INCOMPLETE,
      },
    });

    await this.drainSimulatedEvents();

    return { subscriptionId: subscription.id, checkoutUrl: subscriptionResult.checkoutUrl ?? null };
  }

  async cancel(user: AuthenticatedUser): Promise<{ requested: true }> {
    const subscription = await this.prisma.userSubscription.findFirst({
      where: { userId: user.id, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription?.gatewaySubscriptionId) {
      throw new NotFoundException('Nenhuma assinatura ativa encontrada.');
    }

    await this.paymentGateway.cancelSubscription(subscription.gatewaySubscriptionId);
    await this.drainSimulatedEvents();

    return { requested: true };
  }

  getMine(
    user: AuthenticatedUser,
  ): Promise<(UserSubscription & { plan: { name: string } }) | null> {
    return this.prisma.userSubscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true } } },
    });
  }

  private async drainSimulatedEvents(): Promise<void> {
    if (!this.paymentGateway.drainSimulatedEvents) {
      return;
    }

    const events = this.paymentGateway.drainSimulatedEvents();
    for (const event of events) {
      await this.paymentsService.processWebhookEvent(
        this.paymentGateway.name,
        event.rawBody,
        event.signature,
      );
    }
  }
}
