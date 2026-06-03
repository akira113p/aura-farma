/** Locale-aware formatting + small helpers (pt-BR). */

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const intFormatter = new Intl.NumberFormat('pt-BR');

export const BRL = (n: number): string => brlFormatter.format(n);
export const fmtInt = (n: number): string => intFormatter.format(n);
export const todayISO = (): string => new Date().toISOString().slice(0, 10);

/** Inclusive random integer in [min, max]. */
export const rand = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** ISO date (YYYY-MM-DD) offset from today by `delta` days. */
export const relDays = (delta: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};
