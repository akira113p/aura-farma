interface StatProps {
    label: string;
    value: string;
    sub?: string;
    delta?: number | null;
}
export declare function Stat({ label, value, sub, delta }: StatProps): import("react").JSX.Element;
export {};
