/**
 * Data-access layer.
 *
 * Components and hooks import services from here — never `fetch` or mock data
 * directly. Each service exposes the same interface backed by either:
 *   - an in-memory MOCK implementation (used while there is no back end), or
 *   - the real `apiClient` talking to the Node/MongoDB API.
 *
 * The active implementation is chosen by `config.useMock`, so the rest of the
 * app is unaware of which one is in use. When the back end is ready, set
 * `VITE_USE_MOCK=false` and add the real implementations beside the mocks.
 *
 * Concrete services (e.g. for the entities in `auraFarma.html`) will be added
 * here once the design is available.
 */
export { apiClient, ApiError } from '../lib/apiClient';
export { config } from '../config';
