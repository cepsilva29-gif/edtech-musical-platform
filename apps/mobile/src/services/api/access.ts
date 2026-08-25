import type { AccessSummary } from 'shared';
import { apiRequest } from '../api-client';

export const accessApi = {
  me: () => apiRequest<AccessSummary>('/access/me'),
};
