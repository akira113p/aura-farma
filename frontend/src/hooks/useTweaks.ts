import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type Density = 'compact' | 'regular' | 'comfy';

export interface Tweaks {
  theme: Theme;
  density: Density;
}

const STORAGE_KEY = 'farmadimin.tweaks.v1';
const DEFAULTS: Tweaks = { theme: 'light', density: 'regular' };

function load(): Tweaks {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Tweaks>) };
  } catch {
    /* noop */
  }
  return DEFAULTS;
}

/**
 * Appearance preferences (theme + density), persisted to localStorage and
 * reflected onto <html data-theme data-density> so the CSS tokens apply.
 */
export function useTweaks(): [Tweaks, <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void] {
  const [tweaks, setTweaks] = useState<Tweaks>(() => load());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
    document.documentElement.setAttribute('data-density', tweaks.density);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      /* noop */
    }
  }, [tweaks]);

  const setTweak = <K extends keyof Tweaks>(key: K, value: Tweaks[K]) =>
    setTweaks((prev) => ({ ...prev, [key]: value }));

  return [tweaks, setTweak];
}
