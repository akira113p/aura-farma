import { useEffect } from 'react';
import type { AuthUser, Route } from '../types';
import { Icon, type IconName } from './Icon';

interface SidebarProps {
  route: Route;
  setRoute: (route: Route) => void;
  requestCount: number;
  lowStockCount: number;
  /** Whether the mobile drawer is open (ignored on desktop, where it's a column). */
  open: boolean;
  /** Close the mobile drawer. */
  onClose: () => void;
  /** Logged-in account shown in the footer. */
  user: AuthUser;
  onLogout: () => void;
}

interface NavItem {
  id: Route;
  label: string;
  icon: IconName;
  count?: number;
}

export function Sidebar({ route, setRoute, requestCount, lowStockCount, open, onClose, user, onLogout }: SidebarProps) {
  const items: NavItem[] = [
    { id: 'estoque', label: 'Estoque', icon: 'box', count: lowStockCount },
    { id: 'vendas', label: 'Nova venda', icon: 'cart' },
    { id: 'solicitados', label: 'Solicitados', icon: 'bookmark', count: requestCount },
    { id: 'historico', label: 'Histórico', icon: 'history' },
    { id: 'contagem', label: 'Contagem', icon: 'list' },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'relatorios', label: 'Relatórios', icon: 'chart' },
  ];

  // Close the drawer with Escape while it's open (mobile).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function go(id: Route) {
    setRoute(id);
    onClose();
  }

  return (
    <>
      <div className={'nav-backdrop' + (open ? ' open' : '')} onClick={onClose} aria-hidden="true" />
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="sidebar-brand">
          <div className="brand-mark">f</div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span className="brand-name tighter">farmaDimin</span>
            <span className="brand-sub">controle de estoque</span>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Fechar menu">
            <Icon name="x" size={16} />
          </button>
        </div>
        <nav className="sidebar-section">
          {items.map((it) => (
            <button
              key={it.id}
              className={'nav-item' + (route === it.id ? ' active' : '')}
              onClick={() => go(it.id)}
              style={{ justifyContent: 'flex-start', alignItems: 'center', fontWeight: 500 }}
            >
              <Icon name={it.icon} size={15} />
              <span>{it.label}</span>
              {it.count !== undefined && it.count > 0 && <span className="count">{it.count}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="account">
            <div className="brand-mark" title={user.pharmacyName}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="account-info">
              <span className="account-name">{user.username}</span>
              <span className="account-sub">{user.pharmacyName}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onLogout} style={{ justifyContent: 'flex-start' }}>
            <Icon name="x" size={14} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
