import type { ReactNode } from 'react';
interface InputProps {
    value: string | number;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
    autoFocus?: boolean;
}
export declare function Input({ value, onChange, placeholder, type, autoFocus }: InputProps): import("react").JSX.Element;
interface FieldProps {
    label: string;
    children: ReactNode;
}
export declare function Field({ label, children }: FieldProps): import("react").JSX.Element;
export {};
