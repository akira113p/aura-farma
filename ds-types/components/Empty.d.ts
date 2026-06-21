import type { ReactNode } from 'react';
import { type IconName } from './Icon';
interface EmptyProps {
    icon?: IconName;
    title: ReactNode;
    sub?: ReactNode;
    action?: ReactNode;
}
export declare function Empty({ icon, title, sub, action }: EmptyProps): import("react").JSX.Element;
export {};
