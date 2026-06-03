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
   * When true, the app uses the in-memory mock data source and needs no backend.
   * Defaults to true until the real API exists.
   */
  useMock: (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false',
} as const;
