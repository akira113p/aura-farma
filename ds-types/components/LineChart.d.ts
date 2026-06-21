import type { SeriesPoint } from '../types';
interface LineChartProps {
    data: SeriesPoint[];
    height?: number;
    unit?: 'BRL' | 'count';
}
export declare function LineChart({ data, height, unit }: LineChartProps): import("react").JSX.Element;
export {};
