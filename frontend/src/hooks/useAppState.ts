import { useEffect, useState } from 'react';
import type { AppState } from '../types';
import { emptyState } from '../services/store';
import { loadAppState } from '../services/dados';

/**
 * Holds the whole AppState, scoped to the logged-in account.
 *
 * The load is keyed by `userId`: it (re)runs whenever the account changes, so
 * data is fetched from the backend **right after login** (not just on the first
 * mount, when nobody is logged in yet) and is cleared on logout — letting you
 * see your stock from any device once you sign in. Pass `null` when no user is
 * authenticated. Mutations are persisted per-action by the screens (via
 * `services/dados`), not by this hook.
 */
export function useAppState(
  userId: string | null,
): [AppState, React.Dispatch<React.SetStateAction<AppState>>, boolean] {
  const [state, setState] = useState<AppState>(emptyState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // No account yet (or just logged out): clear any previous data, don't fetch.
    if (!userId) {
      setState(emptyState());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    loadAppState()
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch(() => {
        /* keep the empty state if the load fails (e.g. backend down) */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return [state, setState, loading];
}
