import type { ChartPeriod, Sale, SeriesPoint } from '../types';
/** Bucket sales into a time series for the given period. */
export declare function buildSeries(sales: Sale[], period: ChartPeriod): SeriesPoint[];
