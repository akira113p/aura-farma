import { config } from '../config';

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
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

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
    throw new ApiError(response.status, message, details);
  }

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
