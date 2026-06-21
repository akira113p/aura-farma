import type { ReactNode } from 'react';
interface CardProps {
    title?: ReactNode;
    sub?: ReactNode;
    action?: ReactNode;
    children?: ReactNode;
    flush?: boolean;
}
export declare function Card({ title, sub, action, children, flush }: CardProps): import("react").JSX.Element;
export {};
