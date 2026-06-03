import type { ChartPeriod, Sale, SeriesPoint } from '../types';

/** Bucket sales into a time series for the given period. */
export function buildSeries(sales: Sale[], period: ChartPeriod): SeriesPoint[] {
  const now = new Date();

  if (period === 'day') {
    const today = now.toISOString().slice(0, 10);
    const buckets: SeriesPoint[] = Array(24)
      .fill(0)
      .map((_, h) => ({ label: String(h).padStart(2, '0') + 'h', value: 0 }));
    sales.forEach((s) => {
      if (s.ts.slice(0, 10) !== today) return;
      const h = new Date(s.ts).getHours();
      buckets[h].value += s.total;
    });
    return buckets.slice(7, 22); // 07h — 21h
  }

  if (period === 'week') {
    const arr: SeriesPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      const total = sales.filter((s) => s.ts.slice(0, 10) === k).reduce((a, s) => a + s.total, 0);
      arr.push({ label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), value: total, date: d });
    }
    return arr;
  }

  if (period === 'month') {
    const arr: SeriesPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      const total = sales.filter((s) => s.ts.slice(0, 10) === k).reduce((a, s) => a + s.total, 0);
      arr.push({ label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: total, date: d });
    }
    return arr;
  }

  if (period === 'year') {
    const arr: SeriesPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const total = sales
        .filter((s) => {
          const ts = new Date(s.ts);
          return ts >= d && ts < next;
        })
        .reduce((a, s) => a + s.total, 0);
      arr.push({ label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), value: total, date: d });
    }
    return arr;
  }

  return [];
}
