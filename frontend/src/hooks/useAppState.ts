import { useEffect, useState } from 'react';
import type { AppState } from '../types';
import { emptyState } from '../services/store';
import { loadAppState } from '../services/dados';

/**
 * Holds the whole AppState. On mount it loads from the data layer
 * (`services/dados` -> backend API, or localStorage in mock mode). The third
 * tuple element is a loading flag for the initial fetch. Mutations are persisted
 * per-action by the screens (via `services/dados`), not by this hook.
 */
export function useAppState(): [AppState, React.Dispatch<React.SetStateAction<AppState>>, boolean] {
  const [state, setState] = useState<AppState>(emptyState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
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
  }, []);

  return [state, setState, loading];
}
