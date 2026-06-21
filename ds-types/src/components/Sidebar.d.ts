import type { AuthUser, Route } from '../types';
interface SidebarProps {
    route: Route;
    setRoute: (route: Route) => void;
    requestCount: number;
    lowStockCount: number;
    /** Pedidos de reposição em andamento (a caminho). */
    orderCount: number;
    /** Whether the mobile drawer is open (ignored on desktop, where it's a column). */
    open: boolean;
    /** Close the mobile drawer. */
    onClose: () => void;
    /** Logged-in account shown in the footer. */
    user: AuthUser;
    onLogout: () => void;
}
export declare function Sidebar({ route, setRoute, requestCount, lowStockCount, orderCount, open, onClose, user, onLogout }: SidebarProps): import("react").JSX.Element;
export {};
