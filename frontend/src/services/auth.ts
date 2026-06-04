import { apiClient } from '../lib/apiClient';
import type { AuthUser } from '../types';

export interface RegisterInput {
  username: string;
  pharmacyName: string;
  email: string;
  password: string;
}

export interface GoogleConfig {
  enabled: boolean;
  clientId: string;
}

/** /auth/google either logs the user in or asks the frontend to collect a profile. */
export type GoogleResult = { user: AuthUser } | { needsProfile: true; email: string; name: string };

/** Thin wrappers over the backend auth endpoints (cookie session is handled by the browser). */
export const authApi = {
  me: () => apiClient.get<{ user: AuthUser }>('/auth/me').then((r) => r.user),

  register: (input: RegisterInput) =>
    apiClient.post<{ user: AuthUser }>('/auth/register', input).then((r) => r.user),

  login: (identifier: string, password: string) =>
    apiClient.post<{ user: AuthUser }>('/auth/login', { identifier, password }).then((r) => r.user),

  logout: () => apiClient.post<void>('/auth/logout'),

  googleConfig: () => apiClient.get<GoogleConfig>('/auth/google/config'),

  google: (credential: string) => apiClient.post<GoogleResult>('/auth/google', { credential }),

  googleComplete: (credential: string, username: string, pharmacyName: string) =>
    apiClient
      .post<{ user: AuthUser }>('/auth/google/complete', { credential, username, pharmacyName })
      .then((r) => r.user),
};
