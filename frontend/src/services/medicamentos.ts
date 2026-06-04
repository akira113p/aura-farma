import { apiClient } from '../lib/apiClient';
import type { CatalogMed } from '../types';

/**
 * Real-medicine catalog search.
 *
 * The catalog (ANVISA) lives in the backend and is searched with a
 * typo-tolerant fuzzy index, so this ALWAYS calls the API — independent of
 * `config.useMock` (the rest of the app's stock still uses the local mock).
 * The backend must be running for this feature to work.
 */
export interface CatalogSearchResult {
  results: CatalogMed[];
  total: number;
}

export const medicamentosApi = {
  busca: (q: string, limit = 12) =>
    apiClient.get<CatalogSearchResult>(
      `/medicamentos/busca?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
};
