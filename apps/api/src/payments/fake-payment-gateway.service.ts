import { Logger } from '@nestjs/common';
import { InvoiceStatus, SubscriptionStatus } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
import { addInterval, intervalForPlan } from './date-interval.util';
import {
  CreateCustomerInput,
  CreateCustomerResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  NormalizedWebhookEvent,
  PaymentGateway,
  SimulatedWebhookCall,
} from './payment-gateway.interface';

/**
 * Gateway de desenvolvimento/simulacao: nao chama nenhuma API externa. Aprova toda assinatura
 * instantaneamente e enfileira os eventos de webhook "assincronos" que um gateway real enviaria,
 * para serem drenados e processados pelo mesmo PaymentsService.processWebhookEvent usado em
 * producao - nenhum atalho que bypasse o pipeline de webhook (ver docs/ARCHITECTURE.md, decisao 3
 * e decisao 17-19 da FASE 5/6).
 */
export class FakePaymentGateway extends PaymentGateway {
  readonly name = 'fake';
  private readonly logger = new Logger(FakePaymentGateway.name);
  private readonly pending: NormalizedWebhookEvent[] = [];

  constructor(private readonly secret: string) {
    super();
  }

  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    this.logger.log(`[DEV PAYMENTS] cliente fake criado para ${input.email}`);
    return Promise.resolve({ gatewayCustomerId: `fake_cus_${randomUUID()}` });
  }

  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const gatewaySubscriptionId = `fake_sub_${randomUUID()}`;
    const now = new Date();
    const isTrial = input.plan.trialDays > 0;
    const status = isTrial ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE;
    const periodEnd = addInterval(
      now,
      isTrial ? { days: input.plan.trialDays } : intervalForPlan(input.plan.interval),
    );

    this.logger.log(
      `[DEV PAYMENTS] assinatura fake ${gatewaySubscriptionId} criada para o plano "${input.plan.name}" ` +
        `(aprovacao instantanea simulada, status inicial ${status}).`,
    );

    this.pending.push({
      eventId: randomUUID(),
      type: 'subscription.updated',
      gatewaySubscriptionId,
      status,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });

    if (!isTrial) {
      this.pending.push({
        eventId: randomUUID(),
        type: 'invoice.paid',
        gatewaySubscriptionId,
        invoice: {
          gatewayInvoiceId: `fake_inv_${randomUUID()}`,
          amountCents: input.plan.priceCents,
          currency: input.plan.currency,
          status: InvoiceStatus.PAID,
          paidAt: now,
        },
      });
    }

    return Promise.resolve({ gatewaySubscriptionId });
  }

  cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    this.logger.log(`[DEV PAYMENTS] cancelamento fake solicitado para ${gatewaySubscriptionId}.`);
    this.pending.push({
      eventId: randomUUID(),
      type: 'subscription.canceled',
      gatewaySubscriptionId,
      canceledAt: new Date(),
    });
    return Promise.resolve();
  }

  verifySignature(rawBody: string, signature: string | undefined): boolean {
    if (!signature) {
      return false;
    }
    const expected = createHmac('sha256', this.secret).update(rawBody).digest('hex');
    return signature === expected;
  }

  mapWebhookEvent(rawBody: string): NormalizedWebhookEvent {
    const parsed = JSON.parse(rawBody) as NormalizedWebhookEvent;
    return {
      ...parsed,
      currentPeriodStart: parsed.currentPeriodStart
        ? new Date(parsed.currentPeriodStart)
        : undefined,
      currentPeriodEnd: parsed.currentPeriodEnd ? new Date(parsed.currentPeriodEnd) : undefined,
      canceledAt: parsed.canceledAt ? new Date(parsed.canceledAt) : undefined,
      invoice: parsed.invoice
        ? {
            ...parsed.invoice,
            dueDate: parsed.invoice.dueDate ? new Date(parsed.invoice.dueDate) : undefined,
            paidAt: parsed.invoice.paidAt ? new Date(parsed.invoice.paidAt) : undefined,
          }
        : undefined,
    };
  }

  drainSimulatedEvents(): SimulatedWebhookCall[] {
    const events = this.pending.splice(0, this.pending.length);
    return events.map((event) => {
      const rawBody = JSON.stringify(event);
      return {
        rawBody,
        signature: createHmac('sha256', this.secret).update(rawBody).digest('hex'),
      };
    });
  }
}
