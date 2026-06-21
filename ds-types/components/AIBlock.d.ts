import type { ReactNode } from 'react';
interface AIBlockProps {
    title?: string;
    subtitle?: string;
    loading?: boolean;
    body?: ReactNode;
    action?: ReactNode;
}
export declare function AIBlock({ title, subtitle, loading, body, action }: AIBlockProps): import("react").JSX.Element;
export {};
