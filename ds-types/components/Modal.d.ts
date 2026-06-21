import { type ReactNode } from 'react';
interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
}
export declare function Modal({ open, onClose, title, children, footer }: ModalProps): import("react").JSX.Element | null;
export {};
