import type { PublishStatus } from './catalog';

export type SubscriptionStatus =
  'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'INCOMPLETE';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  interval: 'month' | 'year';
  trialDays: number;
  status: PublishStatus;
  gatewayPriceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  gateway: string;
  gatewaySubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Resposta de GET /subscriptions/me - inclui o nome do plano, ou null se nunca assinou. */
export type CurrentSubscription = (UserSubscription & { plan: { name: string } }) | null;

export interface CheckoutRequest {
  planId: string;
}

export interface CheckoutResult {
  subscriptionId: string;
  checkoutUrl: string | null;
}

export interface CancelSubscriptionResult {
  requested: true;
}
