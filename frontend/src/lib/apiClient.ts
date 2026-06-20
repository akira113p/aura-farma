import { config } from '../config';
import { clientLog } from './clientLog';

/** Gera um identificador de requisição para rastreio fim-a-fim (regra 1). */
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Error thrown when the API responds with a non-2xx status. */
export class ApiError extends Error {
  readonly status: number;
  /** Field-level messages from the API (e.g. { email: "E-mail já cadastrado" }). */
  readonly details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

/**
 * Thin typed wrapper around fetch, pointed at the backend (`config.apiBaseUrl`).
 *
 * `credentials: 'include'` sends the httpOnly session cookie on every request,
 * which is how auth state is carried — the token is never read by JS.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const method = (rest.method ?? 'GET').toUpperCase();
  const requestId = newRequestId();
  const url = `${config.apiBaseUrl}${path}`;
  const start = performance.now();

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        // Rastreio fim-a-fim: o backend propaga este id de volta na resposta (regra 1).
        'X-Request-Id': requestId,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    // Falha de rede (offline, DNS, CORS bloqueado) — nunca chegou uma resposta.
    const ms = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    clientLog.error('falha de rede na requisição', { requestId, method, url, ms, error: message });
    throw err;
  }

  const ms = Math.round(performance.now() - start);

  if (!response.ok) {
    let message = `Request to ${path} failed (${response.status})`;
    let details: Record<string, string> | undefined;
    try {
      const data = (await response.json()) as { error?: string; details?: Record<string, string> };
      if (data?.error) message = data.error;
      details = data?.details;
    } catch {
      /* non-JSON error body */
    }
    clientLog.error('resposta da API não-2xx', {
      requestId,
      method,
      url,
      status: response.status,
      ms,
      error: message,
    });
    throw new ApiError(response.status, message, details);
  }

  clientLog.debug('requisição ok', { requestId, method, url, status: response.status, ms });

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
