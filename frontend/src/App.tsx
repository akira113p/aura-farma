import { useCallback, useState } from 'react';
import type { AppState, Route } from './types';
import { Icon, Sidebar } from './components';
import { useAppState } from './hooks/useAppState';
import { useTweaks } from './hooks/useTweaks';
import { clearState, seedState } from './services/store';
import { TopBar } from './features/TopBar';
import { Dashboard } from './features/Dashboard';
import { Produtos } from './features/Produtos';
import { Vendas } from './features/Vendas';
import { Solicitados } from './features/Solicitados';
import { Historico } from './features/Historico';
import { Contagem } from './features/Contagem';
import { Relatorios } from './features/Relatorios';

const PAGE_TITLES: Record<Route, string> = {
  dashboard: 'Bom dia',
  produtos: 'Produtos',
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
    case 'produtos':
      return `${state.products.length} produto(s) no catálogo`;
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
  const [tweaks, setTweak] = useTweaks();
  const [state, setState] = useAppState();
  const [route, setRoute] = useState<Route>('dashboard');
  const [flashMsg, setFlashMsg] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 2400);
  }, []);

  const lowStockCount = state.products.filter((p) => p.stock <= p.min).length;

  function handleSeed() {
    setState(seedState());
    flash('Dados de exemplo carregados');
  }
  function handleReset() {
    if (confirm('Limpar todos os produtos, vendas e solicitações? Esta ação não pode ser desfeita.')) {
      setState(clearState());
      flash('Dados limpos');
    }
  }

  let screen: React.ReactNode = null;
  switch (route) {
    case 'dashboard':
      screen = <Dashboard state={state} setState={setState} />;
      break;
    case 'produtos':
      screen = <Produtos state={state} setState={setState} />;
      break;
    case 'vendas':
      screen = <Vendas state={state} setState={setState} flash={flash} />;
      break;
    case 'solicitados':
      screen = <Solicitados state={state} setState={setState} />;
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
      <Sidebar route={route} setRoute={setRoute} requestCount={state.requests.length} lowStockCount={lowStockCount} />
      <div className="main">
        <TopBar
          route={route}
          onSeed={handleSeed}
          onReset={handleReset}
          populated={state.populated}
          theme={tweaks.theme}
          setTheme={(t) => setTweak('theme', t)}
        />
        <div className="page">
          <div className="page-head">
            <div>
              <h1 className="page-title">{PAGE_TITLES[route]}</h1>
              <div className="page-sub">{routeSub(route, state)}</div>
            </div>
          </div>
          {screen}
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
