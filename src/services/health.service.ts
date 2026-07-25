import { apiClient } from './client';
import type { HealthResponse } from './types';

export const healthService = {
  check: (): Promise<HealthResponse> =>
    apiClient.get<HealthResponse>('/api/health', {
      cache: 'no-store',
    }),
};
