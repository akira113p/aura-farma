import type { Route } from '../types';
import { Icon, type IconName } from './Icon';

interface SidebarProps {
  route: Route;
  setRoute: (route: Route) => void;
  requestCount: number;
  lowStockCount: number;
}

interface NavItem {
  id: Route;
  label: string;
  icon: IconName;
  count?: number;
}

export function Sidebar({ route, setRoute, requestCount, lowStockCount }: SidebarProps) {
  const items: NavItem[] = [
    { id: 'produtos', label: 'Produtos', icon: 'box', count: lowStockCount },
    { id: 'vendas', label: 'Nova venda', icon: 'cart' },
    { id: 'solicitados', label: 'Solicitados', icon: 'bookmark', count: requestCount },
    { id: 'historico', label: 'Histórico', icon: 'history' },
    { id: 'contagem', label: 'Contagem', icon: 'list' },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'relatorios', label: 'Relatórios', icon: 'chart' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">f</div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span className="brand-name tighter">farmaDimin</span>
          <span className="brand-sub">controle de estoque</span>
        </div>
      </div>
      <nav className="sidebar-section">
        {items.map((it) => (
          <button
            key={it.id}
            className={'nav-item' + (route === it.id ? ' active' : '')}
            onClick={() => setRoute(it.id)}
            style={{ justifyContent: 'flex-start', alignItems: 'center', fontWeight: 500 }}
          >
            <Icon name={it.icon} size={15} />
            <span>{it.label}</span>
            {it.count !== undefined && it.count > 0 && <span className="count">{it.count}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
