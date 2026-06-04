import type { Route } from '../types';
import type { Theme } from '../hooks/useTweaks';
import { Button, Icon } from '../components';

interface TopBarProps {
  route: Route;
  onReset: () => void;
  onSeed: () => void;
  populated: boolean;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Open the mobile navigation drawer. */
  onMenu: () => void;
}

const LABELS: Record<Route, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'Visão geral do dia' },
  estoque: { title: 'Estoque', sub: 'Medicamentos e quantidades' },
  vendas: { title: 'Nova venda', sub: 'Registrar venda no PDV' },
  solicitados: { title: 'Solicitados', sub: 'Pedidos de clientes' },
  historico: { title: 'Histórico', sub: 'Vendas anteriores' },
  contagem: { title: 'Contagem', sub: 'Conferir estoque físico' },
  relatorios: { title: 'Relatórios', sub: 'Análises e exportações' },
};

export function TopBar({ route, onReset, onSeed, populated, theme, setTheme, onMenu }: TopBarProps) {
  const meta = LABELS[route];
  return (
    <div className="topbar">
      <button className="nav-toggle" onClick={onMenu} aria-label="Abrir menu de navegação">
        <Icon name="menu" size={18} />
      </button>
      <span className="crumb">
        {meta.title} <span className="crumb-sub">/ {meta.sub}</span>
      </span>
      <div className="topbar-spacer" />
      {!populated ? (
        // Hidden on phones (≤560px) — the empty states already offer this action.
        <span className="topbar-seed">
          <Button kind="primary" size="sm" icon="sparkle" onClick={onSeed}>
            Popular com dados de exemplo
          </Button>
        </span>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={onReset} title="Limpar todos os dados">
          <Icon name="trash" size={13} />
          Limpar dados
        </button>
      )}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
      >
        <Icon name={theme === 'light' ? 'moon' : 'sun'} size={14} />
      </button>
    </div>
  );
}
