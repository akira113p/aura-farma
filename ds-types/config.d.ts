/**
 * Central runtime configuration, read from Vite environment variables.
 *
 * Only variables prefixed with `VITE_` are exposed to the client bundle.
 * Never put secrets here — anything in the frontend bundle is public.
 */
export declare const config: {
    /**
     * Base URL of the backend API (Node/Express + MongoDB).
     *
     * In a production build we default to the relative `/api`, which the Vercel
     * rewrite (see `frontend/vercel.json`) proxies to the Render backend as a
     * first-party request — so the session cookie works and stock loads from any
     * device. In dev we hit the local backend directly. `VITE_API_BASE_URL`
     * overrides either default.
     */
    readonly apiBaseUrl: any;
    /**
     * When true, the app uses the in-memory localStorage mock and needs no backend.
     * Defaults to FALSE now that the data API exists: stock/sales/requests/counts
     * are persisted in MongoDB. Set `VITE_USE_MOCK=true` to run the front without a
     * backend (dev only).
     */
    readonly useMock: boolean;
};
