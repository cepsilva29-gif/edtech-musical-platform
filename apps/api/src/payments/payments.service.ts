import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, PaymentInvoice, SubscriptionStatus, WebhookEventStatus } from '@prisma/client';
import {
  PaginatedResult,
  PaginationQueryDto,
  paginationArgs,
  toPaginatedResult,
} from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { NormalizedWebhookEvent, PaymentGateway } from './payment-gateway.interface';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentGateway: PaymentGateway,
  ) {}

  /**
   * Unico ponto de escrita de estado de assinatura/fatura (docs/00-primeira-entrega.md, secao 7):
   * o estado real de uma assinatura so muda por confirmacao de webhook, nunca por resposta do
   * checkout ao frontend. Idempotencia garantida pela constraint unica (gateway, eventId), nao por
   * logica de aplicacao - uma tentativa duplicada simplesmente encontra o registro ja existente e
   * retorna sem reprocessar.
   */
  async processWebhookEvent(
    gatewayName: string,
    rawBody: string,
    signature: string | undefined,
  ): Promise<void> {
    if (gatewayName !== this.paymentGateway.name) {
      throw new BadRequestException(
        `Gateway "${gatewayName}" nao e o provedor configurado (PAYMENT_PROVIDER).`,
      );
    }
    if (!this.paymentGateway.verifySignature(rawBody, signature)) {
      throw new UnauthorizedException('Assinatura de webhook invalida.');
    }

    const event = this.paymentGateway.mapWebhookEvent(rawBody);

    let record;
    try {
      record = await this.prisma.paymentWebhookEvent.create({
        data: {
          gateway: gatewayName,
          eventId: event.eventId,
          type: event.type,
          payload: JSON.parse(rawBody) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }

    try {
      await this.applyEvent(event);
      await this.prisma.paymentWebhookEvent.update({
        where: { id: record.id },
        data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() },
      });
    } catch (error) {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: record.id },
        data: { status: WebhookEventStatus.FAILED },
      });
      throw error;
    }
  }

  async getInvoicesForUser(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<PaymentInvoice>> {
    const where: Prisma.PaymentInvoiceWhereInput = { userSubscription: { userId } };

    const [items, total] = await Promise.all([
      this.prisma.paymentInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query.page, query.limit),
      }),
      this.prisma.paymentInvoice.count({ where }),
    ]);

    return toPaginatedResult(items, total, query.page, query.limit);
  }

  private async applyEvent(event: NormalizedWebhookEvent): Promise<void> {
    switch (event.type) {
      case 'subscription.updated': {
        await this.prisma.userSubscription.update({
          where: { gatewaySubscriptionId: event.gatewaySubscriptionId },
          data: {
            status: event.status,
            currentPeriodStart: event.currentPeriodStart,
            currentPeriodEnd: event.currentPeriodEnd,
          },
        });
        return;
      }
      case 'subscription.canceled': {
        await this.prisma.userSubscription.update({
          where: { gatewaySubscriptionId: event.gatewaySubscriptionId },
          data: { status: SubscriptionStatus.CANCELED, canceledAt: event.canceledAt ?? new Date() },
        });
        return;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const subscription = await this.prisma.userSubscription.findUnique({
          where: { gatewaySubscriptionId: event.gatewaySubscriptionId },
        });
        if (!subscription) {
          throw new NotFoundException(
            `Assinatura ${event.gatewaySubscriptionId} nao encontrada para o evento de fatura.`,
          );
        }
        const invoice = event.invoice;
        if (!invoice) {
          throw new BadRequestException(`Evento "${event.type}" sem dados de fatura.`);
        }

        await this.prisma.paymentInvoice.upsert({
          where: { gatewayInvoiceId: invoice.gatewayInvoiceId },
          create: {
            userSubscriptionId: subscription.id,
            amountCents: invoice.amountCents,
            currency: invoice.currency,
            status: invoice.status,
            gatewayInvoiceId: invoice.gatewayInvoiceId,
            dueDate: invoice.dueDate,
            paidAt: invoice.paidAt,
            receiptUrl: invoice.receiptUrl,
          },
          update: {
            status: invoice.status,
            paidAt: invoice.paidAt,
            receiptUrl: invoice.receiptUrl,
          },
        });

        if (event.type === 'invoice.payment_failed') {
          await this.prisma.userSubscription.update({
            where: { id: subscription.id },
            data: { status: SubscriptionStatus.PAST_DUE },
          });
        }
        return;
      }
    }
  }
}
