import type {
  CreateSubscriptionPlanRequest,
  PaginatedResult,
  SubscriptionPlan,
  UpdateSubscriptionPlanRequest,
} from 'shared';
import { apiRequest } from '../api-client';

export const subscriptionPlansApi = {
  list: (query?: { page?: number; limit?: number; status?: string }) =>
    apiRequest<PaginatedResult<SubscriptionPlan>>('/subscription-plans', { query }),
  get: (id: string) => apiRequest<SubscriptionPlan>(`/subscription-plans/${id}`),
  create: (body: CreateSubscriptionPlanRequest) =>
    apiRequest<SubscriptionPlan>('/subscription-plans', { method: 'POST', body }),
  update: (id: string, body: UpdateSubscriptionPlanRequest) =>
    apiRequest<SubscriptionPlan>(`/subscription-plans/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => apiRequest<void>(`/subscription-plans/${id}`, { method: 'DELETE' }),
};
