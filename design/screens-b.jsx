// farmaDimin — PDV (Vendas), Histórico, Contagem, Relatórios
const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;

// --- Vendas / PDV ---
function Vendas({ state, setState, flash }) {
  const [cart, setCart] = useState([]); // [{pid, qty}]
  const [search, setSearch] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [payment, setPayment] = useState("pix");
  const [finishing, setFinishing] = useState(false);
  const scanRef = useRef(null);

  const products = state.products;
  const matches = products.filter(p =>
    !search ? true :
    p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)
  ).slice(0, 30);

  function addToCart(p) {
    if (p.stock <= 0) return;
    setCart((c) => {
      const existing = c.find(x => x.pid === p.id);
      if (existing) {
        if (existing.qty >= p.stock) return c;
        return c.map(x => x.pid === p.id ? { ...x, qty: x.qty + 1 } : x);
      }
      return [...c, { pid: p.id, qty: 1 }];
    });
  }
  function setQty(pid, qty) {
    const p = products.find(p => p.id === pid);
    const max = p ? p.stock : 99;
    if (qty <= 0) setCart(c => c.filter(x => x.pid !== pid));
    else setCart(c => c.map(x => x.pid === pid ? { ...x, qty: Math.min(qty, max) } : x));
  }
  function removeFromCart(pid) { setCart(c => c.filter(x => x.pid !== pid)); }

  function handleScan(e) {
    e.preventDefault();
    const term = scanInput.trim();
    if (!term) return;
    const p = products.find(p => p.sku === term || p.name.toLowerCase() === term.toLowerCase());
    if (p) {
      addToCart(p);
      setScanInput("");
      // tiny visual feedback
      if (scanRef.current) {
        scanRef.current.style.borderColor = "var(--success)";
        setTimeout(() => { if (scanRef.current) scanRef.current.style.borderColor = ""; }, 250);
      }
    } else {
      if (scanRef.current) {
        scanRef.current.style.borderColor = "var(--danger)";
        setTimeout(() => { if (scanRef.current) scanRef.current.style.borderColor = ""; }, 600);
      }
    }
  }

  const items = cart.map(c => {
    const p = products.find(p => p.id === c.pid);
    return { ...c, p };
  }).filter(x => x.p);
  const subtotal = items.reduce((a, it) => a + it.qty * it.p.price, 0);

  function finalize() {
    if (items.length === 0) return;
    setFinishing(true);
    setTimeout(() => {
      const next = applySale(state, cart, payment);
      setState(next);
      setCart([]);
      setFinishing(false);
      flash(`Venda finalizada · ${BRL(subtotal)} · ${items.length} item(ns) descontado(s) do estoque`);
    }, 400);
  }

  if (!state.populated) {
    return (
      <Card>
        <Empty
          icon="cart"
          title="Adicione produtos para vender"
          sub="Você precisa de um catálogo antes de registrar vendas."
          action={<Button kind="primary" icon="sparkle" onClick={() => setState(seedState())}>Popular com dados de exemplo</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="pdv-grid">
      <Card flush>
        <div className="card-head">
          <h3 className="card-title tighter">Adicionar ao carrinho</h3>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            Escaneie o código ou clique no produto
          </div>
        </div>
        <div style={{ padding: 14, borderBottom: "1px solid var(--border)" }}>
          <form onSubmit={handleScan} style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)" }}>
                <Icon name="barcode" size={14} />
              </div>
              <input
                ref={scanRef}
                className="input"
                style={{ paddingLeft: 32, fontFamily: "var(--font-mono)" }}
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                placeholder="Código de barras ou nome…"
                autoFocus
              />
            </div>
            <Button kind="primary" type="submit">Adicionar</Button>
          </form>
          <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
            <div className="search" style={{ maxWidth: 240 }}>
              <Icon name="search" size={14} />
              <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar produtos…" />
            </div>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
              {matches.length} produto(s)
            </div>
          </div>
        </div>

        <div className="picker">
          {matches.length === 0 ? (
            <Empty icon="search" title="Nenhum produto encontrado" />
          ) : matches.map(p => (
            <div className="picker-row" key={p.id} onClick={() => addToCart(p)} style={{ opacity: p.stock === 0 ? 0.4 : 1, cursor: p.stock === 0 ? "not-allowed" : "pointer" }}>
              <div>
                <div className="nm">{p.name}</div>
                <div className="sku">{p.sku} · {p.cat}</div>
              </div>
              <div className="stock">
                {p.stock === 0 ? <Badge tone="danger">Sem estoque</Badge>
                  : p.stock <= p.min ? <Badge tone="warning">{p.stock} restantes</Badge>
                  : <span>{p.stock} em estoque</span>}
              </div>
              <div className="px tabular">{BRL(p.price)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card flush>
        <div className="card-head">
          <h3 className="card-title tighter">Carrinho</h3>
          {items.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setCart([])}>Limpar</button>
          )}
        </div>
        <div className="cart-list">
          {items.length === 0 ? (
            <Empty icon="cart" title="Carrinho vazio" sub="Adicione produtos para iniciar a venda." />
          ) : items.map(it => (
            <div className="cart-row" key={it.pid}>
              <div>
                <div className="nm">{it.p.name}</div>
                <div className="meta tabular">{BRL(it.p.price)} × {it.qty} = <strong>{BRL(it.p.price * it.qty)}</strong></div>
              </div>
              <div className="qty-stepper">
                <button onClick={() => setQty(it.pid, it.qty - 1)}>−</button>
                <span className="v">{it.qty}</span>
                <button onClick={() => setQty(it.pid, it.qty + 1)}>+</button>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => removeFromCart(it.pid)} title="Remover">
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="totals">
          <div className="tot-row"><span>Itens</span><span>{items.reduce((a, x) => a + x.qty, 0)}</span></div>
          <div className="tot-row"><span>Subtotal</span><span>{BRL(subtotal)}</span></div>
          <div className="tot-row grand"><span>Total</span><span>{BRL(subtotal)}</span></div>
        </div>

        <div style={{ padding: "0 16px 14px" }}>
          <div className="field" style={{ marginBottom: 10 }}>
            <label className="field-label">Forma de pagamento</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[["pix", "PIX"], ["cartão", "Cartão"], ["dinheiro", "Dinheiro"]].map(([v, l]) => (
                <button
                  key={v}
                  className={"btn " + (payment === v ? "btn-primary" : "btn-secondary")}
                  style={{ flex: 1, height: 34 }}
                  onClick={() => setPayment(v)}
                >{l}</button>
              ))}
            </div>
          </div>
          <Button kind="primary" size="lg" block onClick={finalize} disabled={items.length === 0 || finishing}>
            {finishing ? "Processando…" : `Finalizar venda · ${BRL(subtotal)}`}
          </Button>
          <div className="sub muted" style={{ textAlign: "center", marginTop: 8, fontSize: 11 }}>
            Ao finalizar, o estoque é descontado automaticamente.
          </div>
        </div>
      </Card>
    </div>
  );
}

// --- Histórico ---
function Historico({ state }) {
  const [expanded, setExpanded] = useState(null);
  const sorted = [...state.sales].sort((a, b) => b.ts.localeCompare(a.ts));
  const grouped = sorted.reduce((acc, s) => {
    const k = s.ts.slice(0, 10);
    (acc[k] = acc[k] || []).push(s);
    return acc;
  }, {});
  const days = Object.keys(grouped);

  if (state.sales.length === 0) {
    return (
      <Card>
        <Empty icon="history" title="Nenhuma venda registrada" sub="As vendas aparecerão aqui assim que você finalizar uma." />
      </Card>
    );
  }

  function fmtDate(d) {
    const dt = new Date(d + "T12:00:00");
    const t = new Date(); t.setHours(0,0,0,0);
    const y = new Date(t); y.setDate(y.getDate() - 1);
    if (dt.toDateString() === t.toDateString()) return "Hoje";
    if (dt.toDateString() === y.toDateString()) return "Ontem";
    return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      {days.map(d => {
        const ds = grouped[d];
        const dayTotal = ds.reduce((a, s) => a + s.total, 0);
        const dayItems = ds.reduce((a, s) => a + s.items.reduce((b, it) => b + it.qty, 0), 0);
        return (
          <Card key={d} title={fmtDate(d)} sub={`${ds.length} venda(s) · ${dayItems} item(ns) · ${BRL(dayTotal)}`} flush>
            <div className="list">
              {ds.map(s => (
                <Fragment key={s.id}>
                  <div className="list-item" style={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                    <div>
                      <div className="nm tabular">
                        {new Date(s.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {s.items.length} item(ns)
                      </div>
                      <div className="sub">
                        {s.items.slice(0, 2).map(it => it.name).join(", ")}
                        {s.items.length > 2 && ` +${s.items.length - 2}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Badge>{s.payment}</Badge>
                      <span className="tabular" style={{ fontWeight: 600, minWidth: 88, textAlign: "right" }}>{BRL(s.total)}</span>
                      <Icon name={expanded === s.id ? "chevronUp" : "chevronDown"} size={14} />
                    </div>
                  </div>
                  {expanded === s.id && (
                    <div style={{ background: "var(--surface-2)", padding: "12px 24px", borderBottom: "1px solid var(--border)" }}>
                      {s.items.map((it, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                          <span>{it.name} <span className="muted">× {it.qty}</span></span>
                          <span className="tabular">{BRL(it.qty * it.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// --- Contagem ---
function Contagem({ state, setState, flash }) {
  const [session, setSession] = useState(null); // { products: [{pid, expected, counted}] }
  const [filter, setFilter] = useState("");

  function start() {
    setSession({
      products: state.products.map(p => ({ pid: p.id, expected: p.stock, counted: "" })),
    });
  }

  function setCounted(pid, v) {
    setSession(s => ({
      ...s,
      products: s.products.map(x => x.pid === pid ? { ...x, counted: v } : x),
    }));
  }

  function apply() {
    const adjustments = session.products
      .filter(x => x.counted !== "" && !isNaN(parseInt(x.counted)))
      .map(x => ({ pid: x.pid, newStock: parseInt(x.counted), diff: parseInt(x.counted) - x.expected }));
    const adjMap = Object.fromEntries(adjustments.map(a => [a.pid, a.newStock]));
    const products = state.products.map(p => adjMap[p.id] !== undefined ? { ...p, stock: adjMap[p.id] } : p);
    const totalDiff = adjustments.reduce((a, x) => a + x.diff, 0);
    setState({
      ...state,
      products,
      counts: [
        { id: "c" + Date.now(), ts: new Date().toISOString(), adjustments, total: adjustments.length },
        ...state.counts,
      ],
      activity: [{ id: "a" + Date.now(), kind: "count", text: `Contagem aplicada — ${adjustments.length} ajuste(s), diferença ${totalDiff > 0 ? "+" : ""}${totalDiff}`, ts: new Date().toISOString() }, ...state.activity].slice(0, 50),
    });
    setSession(null);
    flash(`Contagem aplicada · ${adjustments.length} ajuste(s) salvos`);
  }

  if (!state.populated) {
    return (
      <Card>
        <Empty icon="list" title="Sem produtos para contar" sub="Adicione produtos ou popule com exemplos primeiro." />
      </Card>
    );
  }

  if (!session) {
    return (
      <div className="col" style={{ gap: 14 }}>
        <Card>
          <div className="row-between">
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Iniciar nova contagem</div>
              <div className="muted" style={{ fontSize: 13 }}>Percorra a farmácia e registre o estoque físico de cada produto. Ao final, aplique os ajustes para alinhar o sistema com a realidade.</div>
            </div>
            <Button kind="primary" icon="list" onClick={start}>Começar contagem</Button>
          </div>
        </Card>

        <Card title="Contagens anteriores" sub={state.counts.length + " realizada(s)"} flush>
          {state.counts.length === 0 ? (
            <Empty icon="list" title="Nenhuma contagem ainda" />
          ) : (
            <div className="list">
              {state.counts.slice(0, 10).map(c => {
                const totalDiff = c.adjustments.reduce((a, x) => a + x.diff, 0);
                return (
                  <div className="list-item" key={c.id}>
                    <div>
                      <div className="nm">{new Date(c.ts).toLocaleString("pt-BR")}</div>
                      <div className="sub">{c.adjustments.length} ajuste(s) aplicado(s)</div>
                    </div>
                    <Badge tone={totalDiff === 0 ? "success" : totalDiff > 0 ? "info" : "warning"}>
                      Diferença {totalDiff > 0 ? "+" : ""}{totalDiff}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  const filtered = session.products.filter(x => {
    const p = state.products.find(p => p.id === x.pid);
    return !filter || (p && p.name.toLowerCase().includes(filter.toLowerCase()));
  });
  const counted = session.products.filter(x => x.counted !== "" && !isNaN(parseInt(x.counted)));

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={14} />
          <input className="input" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar produto…" />
        </div>
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 13 }}>{counted.length} de {session.products.length} contados</span>
        <Button kind="ghost" onClick={() => setSession(null)}>Cancelar</Button>
        <Button kind="primary" onClick={apply} disabled={counted.length === 0} icon="check">Aplicar ajustes ({counted.length})</Button>
      </div>

      <Card flush>
        <table className="table">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="num" style={{ width: 110 }}>Sistema</th>
              <th className="num" style={{ width: 140 }}>Contado</th>
              <th className="num" style={{ width: 110 }}>Diferença</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(x => {
              const p = state.products.find(p => p.id === x.pid);
              if (!p) return null;
              const cv = parseInt(x.counted);
              const diff = !isNaN(cv) ? cv - x.expected : null;
              return (
                <tr key={x.pid}>
                  <td>
                    <div>{p.name}</div>
                    <div className="mono" style={{ color: "var(--text-subtle)" }}>{p.sku}</div>
                  </td>
                  <td className="num tabular muted">{x.expected}</td>
                  <td className="num">
                    <input
                      className="input"
                      style={{ width: 100, textAlign: "right", marginLeft: "auto" }}
                      type="number"
                      value={x.counted}
                      onChange={e => setCounted(x.pid, e.target.value)}
                      placeholder="—"
                    />
                  </td>
                  <td className="num tabular">
                    {diff === null ? <span className="subtle">—</span>
                      : diff === 0 ? <Badge tone="success">igual</Badge>
                      : <Badge tone={diff > 0 ? "info" : "warning"}>{diff > 0 ? "+" : ""}{diff}</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// --- Relatórios ---
function Relatorios({ state }) {
  const [period, setPeriod] = useState("week");
  const summary = useMemo(() => summarize(state), [state]);
  const [aiText, setAiText] = useState(null);
  const [aiLoading, setAiLoading] = useState(true);
  const stats = summary[period];

  useEffect(() => {
    if (!state.populated) return;
    let cancel = false;
    setAiLoading(true);
    setAiText(null);
    (async () => {
      const text = await generateAISummary(period, stats, summary.lowStock, summary.topProducts, state.requests.length);
      if (!cancel) { setAiText(text); setAiLoading(false); }
    })();
    return () => { cancel = true; };
  }, [period, state.populated]);

  const series = useMemo(() => buildSeries(state.sales, period), [state.sales, period]);

  if (!state.populated) {
    return (
      <Card>
        <Empty icon="chart" title="Sem dados para relatório" sub="Popule o sistema para ver os relatórios." />
      </Card>
    );
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row-between">
        <Tabs
          value={period}
          onChange={setPeriod}
          options={[
            { value: "day", label: "Hoje" },
            { value: "week", label: "Semana" },
            { value: "month", label: "Mês" },
          ]}
        />
        <div className="muted" style={{ fontSize: 13 }}>
          Período: {period === "day" ? "últimas 24h" : period === "week" ? "últimos 7 dias" : "últimos 30 dias"}
        </div>
      </div>

      <AIBlock
        title={`Análise ${period === "day" ? "diária" : period === "week" ? "semanal" : "mensal"}`}
        loading={aiLoading}
        body={aiText ? aiText.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>) : null}
      />

      <div className="stat-grid">
        <Stat label="Receita" value={BRL(stats.revenue)} sub={`${stats.sales} vendas`} />
        <Stat label="Custo das vendas" value={BRL(stats.cost)} sub="Estimado pelo cadastro" />
        <Stat label="Lucro estimado" value={BRL(stats.revenue - stats.cost)} sub={`Margem ${stats.revenue > 0 ? Math.round((stats.revenue - stats.cost)/stats.revenue * 100) : 0}%`} />
        <Stat label="Itens vendidos" value={fmtInt(stats.items)} sub={`Ticket médio ${BRL(stats.sales > 0 ? stats.revenue/stats.sales : 0)}`} />
      </div>

      <Card title="Receita" sub={period === "day" ? "Hoje, por hora" : period === "week" ? "Últimos 7 dias" : "Últimos 30 dias"}>
        <LineChart data={series} />
      </Card>

      <div className="cols-2">
        <Card title="Top produtos do período" flush>
          {summary.topProducts.length === 0 ? <Empty icon="chart" title="Sem dados" /> :
          <table className="table">
            <thead><tr><th>Produto</th><th className="num">Qtd</th><th className="num">Receita</th></tr></thead>
            <tbody>
              {summary.topProducts.map(({ p, qty }) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="num tabular">{qty}</td>
                  <td className="num tabular">{BRL(qty * p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>}
        </Card>
        <Card title="Sugestões da IA" sub="Possíveis novos produtos" flush>
          {state.requests.length === 0 ? <Empty icon="bookmark" title="Sem solicitações" /> :
          <div className="list">
            {[...state.requests].sort((a,b) => b.count - a.count).slice(0, 5).map(r => (
              <div className="list-item" key={r.id}>
                <div>
                  <div className="nm">{r.name}</div>
                  <div className="sub">Pedido por clientes {r.count}×</div>
                </div>
                <Badge tone={r.count >= 4 ? "warning" : "info"}>{r.count >= 4 ? "Alta demanda" : "Considerar"}</Badge>
              </div>
            ))}
          </div>}
        </Card>
      </div>
    </div>
  );
}

// --- Series builder for charts ---
function buildSeries(sales, period) {
  const now = new Date();
  if (period === "day") {
    const today = now.toISOString().slice(0, 10);
    const buckets = Array(24).fill(0).map((_, h) => ({ label: String(h).padStart(2, "0") + "h", value: 0 }));
    sales.forEach(s => {
      if (s.ts.slice(0, 10) !== today) return;
      const h = new Date(s.ts).getHours();
      buckets[h].value += s.total;
    });
    return buckets.slice(7, 22); // 07h — 21h
  }
  if (period === "week") {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      const total = sales.filter(s => s.ts.slice(0, 10) === k).reduce((a, s) => a + s.total, 0);
      arr.push({ label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""), value: total, date: d });
    }
    return arr;
  }
  if (period === "month") {
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      const total = sales.filter(s => s.ts.slice(0, 10) === k).reduce((a, s) => a + s.total, 0);
      arr.push({ label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value: total, date: d });
    }
    return arr;
  }
  if (period === "year") {
    const arr = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const total = sales.filter(s => {
        const ts = new Date(s.ts);
        return ts >= d && ts < next;
      }).reduce((a, s) => a + s.total, 0);
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      arr.push({ label, value: total, date: d });
    }
    return arr;
  }
  return [];
}

// --- Line chart ---
function LineChart({ data, height = 200, unit = "BRL" }) {
  const W = 800, H = height, padL = 44, padR = 16, padT = 14, padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  if (!data || data.length === 0) {
    return <div className="empty" style={{ padding: 24 }}>Sem dados no período</div>;
  }
  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const allZero = total === 0;
  const pts = data.map((d, i) => ({
    x: padL + (data.length <= 1 ? innerW / 2 : i * (innerW / (data.length - 1))),
    y: padT + innerH - (d.value / max) * innerH,
    d,
  }));
  const linePts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath =
    `M ${pts[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} ` +
    `L ${pts.map(p => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" L ")} ` +
    `L ${pts[pts.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  const ticks = 4;
  const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
  const fmtY = (v) => unit === "BRL" ? ("R$\u00a0" + compact.format(v)) : compact.format(v);
  const xStep = Math.max(1, Math.ceil(data.length / 8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block" }}>
      {/* y-grid */}
      {Array(ticks + 1).fill(0).map((_, i) => {
        const y = padT + innerH * (i / ticks);
        const v = max * (1 - i / ticks);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeDasharray={i === ticks ? "0" : "2 4"} />
            {i < ticks && (
              <text x={padL - 6} y={y + 3} fontSize="9" textAnchor="end" fill="var(--text-subtle)" fontFamily="var(--font-mono)">
                {fmtY(v)}
              </text>
            )}
          </g>
        );
      })}
      {/* area + line (skip if all zero, just show baseline) */}
      {!allZero && (
        <>
          <path d={areaPath} fill="var(--accent)" opacity="0.08" />
          <polyline points={linePts} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="2.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.6" />
              <title>{p.d.label}: {BRL(p.d.value)}</title>
            </g>
          ))}
        </>
      )}
      {/* x labels */}
      {data.map((d, i) => (i % xStep === 0 || i === data.length - 1) && (
        <text key={i} x={pts[i].x} y={H - 8} fontSize="9" textAnchor="middle" fill="var(--text-subtle)" fontFamily="var(--font-mono)">
          {d.label}
        </text>
      ))}
    </svg>
  );
}

Object.assign(window, { Vendas, Historico, Contagem, Relatorios, LineChart, buildSeries });
