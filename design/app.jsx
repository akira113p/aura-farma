// farmaDimin — App root
const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "regular"
}/*EDITMODE-END*/;

function TopBar({ route, onReset, onSeed, populated, theme, density, setTweak }) {
  const labels = {
    dashboard: { title: "Dashboard", sub: "Visão geral do dia" },
    produtos: { title: "Produtos", sub: "Catálogo e estoque" },
    vendas: { title: "Nova venda", sub: "Registrar venda no PDV" },
    solicitados: { title: "Solicitados", sub: "Pedidos de clientes" },
    historico: { title: "Histórico", sub: "Vendas anteriores" },
    contagem: { title: "Contagem", sub: "Conferir estoque físico" },
    relatorios: { title: "Relatórios", sub: "Análises e exportações" },
  };
  const meta = labels[route] || { title: "" };
  return (
    <div className="topbar">
      <span className="crumb">{meta.title} <span className="crumb-sub">/ {meta.sub}</span></span>
      <div className="topbar-spacer" />
      {!populated ? (
        <Button kind="primary" size="sm" icon="sparkle" onClick={onSeed}>Popular com dados de exemplo</Button>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={onReset} title="Limpar todos os dados">
          <Icon name="trash" size={13} />
          Limpar dados
        </button>
      )}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setTweak("theme", theme === "light" ? "dark" : "light")}
        title={theme === "light" ? "Modo escuro" : "Modo claro"}
      >
        <Icon name={theme === "light" ? "moon" : "sun"} size={14} />
      </button>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [state, setStateRaw] = useState(() => loadState());
  const [route, setRoute] = useState("dashboard");
  const [flashMsg, setFlashMsg] = useState(null);

  useEffect(() => { saveState(state); }, [state]);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", t.theme);
    document.documentElement.setAttribute("data-density", t.density);
  }, [t.theme, t.density]);

  const setState = useCallback((s) => setStateRaw(typeof s === "function" ? s : s), []);

  const flash = useCallback((msg) => {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 2400);
  }, []);

  const lowStockCount = state.products.filter(p => p.stock <= p.min).length;

  function handleSeed() {
    setState(seedState());
    flash("Dados de exemplo carregados");
  }
  function handleReset() {
    if (confirm("Limpar todos os produtos, vendas e solicitações? Esta ação não pode ser desfeita.")) {
      setState(clearState());
      flash("Dados limpos");
    }
  }

  let screen = null;
  switch (route) {
    case "dashboard":   screen = <Dashboard state={state} setState={setState} />; break;
    case "produtos":    screen = <Produtos state={state} setState={setState} />; break;
    case "vendas":      screen = <Vendas state={state} setState={setState} flash={flash} />; break;
    case "solicitados": screen = <Solicitados state={state} setState={setState} />; break;
    case "historico":   screen = <Historico state={state} />; break;
    case "contagem":    screen = <Contagem state={state} setState={setState} flash={flash} />; break;
    case "relatorios":  screen = <Relatorios state={state} />; break;
    default:            screen = null;
  }

  return (
    <div className="app">
      <Sidebar
        route={route}
        setRoute={setRoute}
        requestCount={state.requests.length}
        lowStockCount={lowStockCount}
      />
      <div className="main">
        <TopBar
          route={route}
          onSeed={handleSeed}
          onReset={handleReset}
          populated={state.populated}
          theme={t.theme}
          density={t.density}
          setTweak={setTweak}
        />
        <div className="page">
          <div className="page-head">
            <div>
              <h1 className="page-title">{
                route === "dashboard" ? "Bom dia" :
                route === "produtos" ? "Produtos" :
                route === "vendas" ? "Nova venda" :
                route === "solicitados" ? "Produtos solicitados" :
                route === "historico" ? "Histórico de vendas" :
                route === "contagem" ? "Contagem de estoque" :
                route === "relatorios" ? "Relatórios" : ""
              }</h1>
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

      <TweaksPanel>
        <TweakSection label="Aparência" />
        <TweakRadio
          label="Tema"
          value={t.theme}
          options={["light", "dark"]}
          onChange={(v) => setTweak("theme", v)}
        />
        <TweakRadio
          label="Densidade"
          value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)}
        />
        <TweakSection label="Dados" />
        <TweakButton label="Popular com dados de exemplo" onClick={handleSeed} />
        <TweakButton label="Limpar todos os dados" onClick={handleReset} secondary />
      </TweaksPanel>
    </div>
  );
}

function routeSub(route, state) {
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  switch (route) {
    case "dashboard": return `${today} · ${state.products.length} produto(s) cadastrado(s)`;
    case "produtos": return `${state.products.length} produto(s) no catálogo`;
    case "vendas": return "Escaneie ou clique nos produtos para adicionar ao carrinho.";
    case "solicitados": return "Itens que clientes pediram e que você ainda não tem em estoque.";
    case "historico": return `${state.sales.length} venda(s) no histórico`;
    case "contagem": return "Conferência periódica do estoque físico vs sistema.";
    case "relatorios": return "Resumos gerados por IA e métricas do período.";
    default: return "";
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
