const DEFAULT_API_URL = 'http://localhost:3000/api/v1';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}
