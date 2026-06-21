import type { ReactNode } from 'react';
import { type IconName } from './Icon';
interface ButtonProps {
    kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'lg';
    block?: boolean;
    icon?: IconName;
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit' | 'reset';
}
export declare function Button({ kind, size, block, icon, children, onClick, disabled, loading, type, }: ButtonProps): import("react").JSX.Element;
export {};
