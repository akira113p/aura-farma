interface TabOption<T extends string> {
    value: T;
    label: string;
}
interface TabsProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: TabOption<T>[];
}
export declare function Tabs<T extends string>({ value, onChange, options }: TabsProps<T>): import("react").JSX.Element;
export {};
