import type {
  CancelSubscriptionResult,
  CheckoutRequest,
  CheckoutResult,
  CurrentSubscription,
  PaginatedResult,
  PaymentInvoice,
  SubscriptionPlan,
} from 'shared';
import { apiRequest } from '../api-client';

export const subscriptionsApi = {
  listPlans: (query?: { page?: number; limit?: number }) =>
    apiRequest<PaginatedResult<SubscriptionPlan>>('/subscription-plans', { query }),

  getPlan: (id: string) => apiRequest<SubscriptionPlan>(`/subscription-plans/${id}`),

  checkout: (body: CheckoutRequest) =>
    apiRequest<CheckoutResult>('/subscriptions/checkout', { method: 'POST', body }),

  cancel: () => apiRequest<CancelSubscriptionResult>('/subscriptions/cancel', { method: 'POST' }),

  mine: () => apiRequest<CurrentSubscription>('/subscriptions/me'),

  listInvoices: (query?: { page?: number; limit?: number }) =>
    apiRequest<PaginatedResult<PaymentInvoice>>('/payments/invoices/me', { query }),
};
