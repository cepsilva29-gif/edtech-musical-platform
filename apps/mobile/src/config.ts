import Constants from 'expo-constants';

/**
 * URL base da API (apps/api, prefixo /api/v1). Configuravel via `expo.extra.apiUrl` em app.json,
 * ou a env EXPO_PUBLIC_API_URL - nunca hardcoded, pois muda entre emulador Android
 * (10.0.2.2), dispositivo fisico (IP da maquina) e producao.
 */
const DEFAULT_API_URL = 'http://localhost:3000/api/v1';

export function getApiBaseUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  return process.env.EXPO_PUBLIC_API_URL ?? fromExtra ?? DEFAULT_API_URL;
}
