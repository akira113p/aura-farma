import type { ReactNode } from 'react';
interface BadgeProps {
    tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
    children: ReactNode;
    dot?: boolean;
}
export declare function Badge({ tone, children, dot }: BadgeProps): import("react").JSX.Element;
export {};
