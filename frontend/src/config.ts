/**
 * Central runtime configuration, read from Vite environment variables.
 *
 * Only variables prefixed with `VITE_` are exposed to the client bundle.
 * Never put secrets here — anything in the frontend bundle is public.
 */
export const config = {
  /** Base URL of the future backend API (Node/Express + MongoDB). */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api',

  /**
   * When true, the app uses the in-memory localStorage mock and needs no backend.
   * Defaults to FALSE now that the data API exists: stock/sales/requests/counts
   * are persisted in MongoDB. Set `VITE_USE_MOCK=true` to run the front without a
   * backend (dev only).
   */
  useMock: (import.meta.env.VITE_USE_MOCK ?? 'false') === 'true',
} as const;
