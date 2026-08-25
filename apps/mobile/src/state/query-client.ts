import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../services/api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // 401/403/404/409 sao respostas de negocio, nao falhas de rede - nao adianta tentar de novo.
        if (error instanceof ApiError && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});
