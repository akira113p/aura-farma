/** Locale-aware formatting + small helpers (pt-BR). */
export declare const BRL: (n: number) => string;
export declare const fmtInt: (n: number) => string;
export declare const todayISO: () => string;
/** Inclusive random integer in [min, max]. */
export declare const rand: (min: number, max: number) => number;
/** ISO date (YYYY-MM-DD) offset from today by `delta` days. */
export declare const relDays: (delta: number) => string;
