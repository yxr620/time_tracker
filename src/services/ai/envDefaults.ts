import type { AIProvider } from './providers';

export interface AIDefaultConfig {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

function readEnv(env: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function resolveProviderId(raw: string, providers: AIProvider[]): string {
  const fallback = providers[0]?.id || 'custom';
  if (!raw) return fallback;

  const normalized = raw.toLowerCase();
  const hit = providers.find(p => p.id.toLowerCase() === normalized);
  return hit?.id || fallback;
}

export function resolveAIDefaultConfig(
  env: Record<string, unknown>,
  providers: AIProvider[],
): AIDefaultConfig {
  const providerId = resolveProviderId(
    readEnv(env, ['VITE_AI_PROVIDER_ID', 'VITE_AI_PROVIDER', 'AI_PROVIDER_ID', 'AI_PROVIDER']),
    providers,
  );

  const provider = providers.find(p => p.id === providerId);

  const baseURL =
    readEnv(env, ['VITE_AI_BASE_URL', 'AI_BASE_URL']) ||
    provider?.baseURL ||
    '';

  const model =
    readEnv(env, ['VITE_AI_MODEL', 'AI_MODEL']) ||
    provider?.models[0] ||
    '';

  const apiKey = readEnv(env, ['VITE_AI_API_KEY', 'AI_API_KEY']);

  return {
    providerId,
    baseURL,
    apiKey,
    model,
  };
}
