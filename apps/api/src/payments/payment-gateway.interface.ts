import { InvoiceStatus, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

export interface CreateCustomerInput {
  userId: string;
  email: string;
  name: string;
}

export interface CreateCustomerResult {
  gatewayCustomerId: string;
}

export interface CreateSubscriptionInput {
  gatewayCustomerId: string;
  plan: SubscriptionPlan;
}

export interface CreateSubscriptionResult {
  gatewaySubscriptionId: string;
  /** Presente em gateways que exigem redirecionamento (ex.: Stripe Checkout). */
  checkoutUrl?: string;
}

export type NormalizedWebhookEventType =
  'subscription.updated' | 'subscription.canceled' | 'invoice.paid' | 'invoice.payment_failed';

export interface NormalizedInvoiceEvent {
  gatewayInvoiceId: string;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  dueDate?: Date;
  paidAt?: Date;
  receiptUrl?: string;
}

export interface NormalizedWebhookEvent {
  eventId: string;
  type: NormalizedWebhookEventType;
  gatewaySubscriptionId: string;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  canceledAt?: Date;
  invoice?: NormalizedInvoiceEvent;
}

export interface SimulatedWebhookCall {
  rawBody: string;
  signature: string;
}

/**
 * Abstracao de gateway de pagamento (docs/ARCHITECTURE.md, decisao 3): nenhum modulo de dominio
 * deve depender de um SDK concreto (Stripe/Asaas/Pagar.me) diretamente, so desta interface.
 * Implementacao escolhida via env PAYMENT_PROVIDER (ver PaymentsModule). Nesta fase so existe
 * FakePaymentGateway (dev/simulacao) - adapters reais entram quando houver credenciais, sem
 * precisar mudar nenhum consumidor desta interface (SubscriptionsService/PaymentsService).
 */
export abstract class PaymentGateway {
  abstract readonly name: string;

  abstract createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  abstract createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  abstract cancelSubscription(gatewaySubscriptionId: string): Promise<void>;
  abstract verifySignature(rawBody: string, signature: string | undefined): boolean;
  abstract mapWebhookEvent(rawBody: string): NormalizedWebhookEvent;

  /**
   * Somente gateways de simulacao (dev/test) implementam isto: drena e assina os eventos que um
   * gateway real enviaria de forma assincrona ao endpoint de webhook, para alimentar o mesmo
   * PaymentsService.processWebhookEvent sem depender de um servidor exposto publicamente.
   */
  drainSimulatedEvents?(): SimulatedWebhookCall[];
}
