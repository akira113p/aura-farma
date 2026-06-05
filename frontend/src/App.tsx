import { useCallback, useState } from 'react';
import type { AppState, Route } from './types';
import { Icon, Sidebar } from './components';
import { useAppState } from './hooks/useAppState';
import { useTweaks } from './hooks/useTweaks';
import { useAuth } from './context/AuthContext';
import { seedData, resetData } from './services/dados';
import { AuthScreen } from './features/auth/AuthScreen';
import { TopBar } from './features/TopBar';
import { Dashboard } from './features/Dashboard';
import { Estoque } from './features/Estoque';
import { Vendas } from './features/Vendas';
import { Solicitados } from './features/Solicitados';
import { Historico } from './features/Historico';
import { Contagem } from './features/Contagem';
import { Relatorios } from './features/Relatorios';

const PAGE_TITLES: Record<Route, string> = {
  dashboard: 'Bom dia',
  estoque: 'Estoque',
  vendas: 'Nova venda',
  solicitados: 'Produtos solicitados',
  historico: 'Histórico de vendas',
  contagem: 'Contagem de estoque',
  relatorios: 'Relatórios',
};

function routeSub(route: Route, state: AppState): string {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  switch (route) {
    case 'dashboard':
      return `${today} · ${state.products.length} produto(s) cadastrado(s)`;
    case 'estoque':
      return `${state.products.length} medicamento(s) no estoque`;
    case 'vendas':
      return 'Escaneie ou clique nos produtos para adicionar ao carrinho.';
    case 'solicitados':
      return 'Itens que clientes pediram e que você ainda não tem em estoque.';
    case 'historico':
      return `${state.sales.length} venda(s) no histórico`;
    case 'contagem':
      return 'Conferência periódica do estoque físico vs sistema.';
    case 'relatorios':
      return 'Resumos gerados por IA e métricas do período.';
  }
}

export default function App() {
  const { user, loading, logout } = useAuth();
  const [tweaks, setTweak] = useTweaks();
  const [state, setState, dataLoading] = useAppState();
  const [route, setRoute] = useState<Route>('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 2400);
  }, []);

  // Auth gate (all hooks above run unconditionally to keep hook order stable).
  if (loading) {
    return (
      <div className="auth-wrap">
        <div className="muted">Carregando…</div>
      </div>
    );
  }
  if (!user) return <AuthScreen />;

  const lowStockCount = state.products.filter((p) => p.stock <= p.min).length;

  async function handleSeed() {
    try {
      setState(await seedData());
      flash('Dados de exemplo carregados');
    } catch {
      flash('Não foi possível popular os dados — o servidor está no ar?');
    }
  }
  async function handleReset() {
    if (!confirm('Limpar todos os produtos, vendas e solicitações? Esta ação não pode ser desfeita.')) return;
    try {
      setState(await resetData());
      flash('Dados limpos');
    } catch {
      flash('Não foi possível limpar os dados.');
    }
  }

  let screen: React.ReactNode = null;
  switch (route) {
    case 'dashboard':
      screen = <Dashboard state={state} setState={setState} />;
      break;
    case 'estoque':
      screen = <Estoque state={state} setState={setState} flash={flash} />;
      break;
    case 'vendas':
      screen = <Vendas state={state} setState={setState} flash={flash} />;
      break;
    case 'solicitados':
      screen = <Solicitados state={state} setState={setState} flash={flash} />;
      break;
    case 'historico':
      screen = <Historico state={state} />;
      break;
    case 'contagem':
      screen = <Contagem state={state} setState={setState} flash={flash} />;
      break;
    case 'relatorios':
      screen = <Relatorios state={state} />;
      break;
  }

  return (
    <div className="app">
      <Sidebar
        route={route}
        setRoute={setRoute}
        requestCount={state.requests.length}
        lowStockCount={lowStockCount}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        user={user}
        onLogout={logout}
      />
      <div className="main">
        <TopBar
          route={route}
          onSeed={handleSeed}
          onReset={handleReset}
          populated={state.populated}
          theme={tweaks.theme}
          setTheme={(t) => setTweak('theme', t)}
          onMenu={() => setNavOpen(true)}
        />
        <div className="page">
          <div className="page-head">
            <div>
              <h1 className="page-title">{PAGE_TITLES[route]}</h1>
              <div className="page-sub">{routeSub(route, state)}</div>
            </div>
          </div>
          {dataLoading ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="btn-spinner" style={{ display: 'block', margin: '0 auto 12px', color: 'var(--text-subtle)' }} />
              <div>Carregando dados…</div>
            </div>
          ) : (
            screen
          )}
        </div>
      </div>

      {flashMsg && (
        <div className="flash-success">
          <Icon name="check" size={14} />
          {flashMsg}
        </div>
      )}
    </div>
  );
}
