import { useEffect, useState } from 'react';
import type { AppState } from '../types';
import { loadState, saveState } from '../services/store';

/**
 * Holds the whole AppState and persists it (currently to localStorage via the
 * store service). The returned setter accepts a value or an updater function,
 * mirroring React's `useState`.
 */
export function useAppState(): [AppState, React.Dispatch<React.SetStateAction<AppState>>] {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  return [state, setState];
}
