import { Meilisearch } from 'meilisearch';
import type { AppConfig } from '../../config/app-config';

export const MEILI_CLIENT = Symbol('MEILI_CLIENT');

export function createMeiliClient(config: AppConfig): Meilisearch {
  return new Meilisearch({
    host: config.search.host,
    apiKey: config.search.apiKey,
    timeout: 5_000,
  });
}
