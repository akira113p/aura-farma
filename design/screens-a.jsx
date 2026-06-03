// farmaDimin — Dashboard, Produtos, Solicitados
const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;

// --- AI text generation (with claude.complete fallback to canned) ---
async function generateAISummary(period, stats, lowStock, topProducts, requestsCount) {
  const periodLabel = { day: "do dia", week: "da semana", month: "do mês" }[period] || "do dia";
  // Try claude.complete if available
  const ctx = {
    periodo: periodLabel,
    receita: BRL(stats.revenue),
    custo: BRL(stats.cost),
    lucro: BRL(stats.revenue - stats.cost),
    margem: stats.revenue > 0 ? ((stats.revenue - stats.cost) / stats.revenue * 100).toFixed(1) + "%" : "0%",
    itens_vendidos: stats.items,
    num_vendas: stats.sales,
    produtos_em_baixa: lowStock.slice(0, 3).map(p => `${p.name} (${p.stock} restantes, mín ${p.min})`).join("; "),
    mais_vendidos: topProducts.slice(0, 3).map(t => `${t.p.name} (${t.qty} unidades)`).join("; "),
    pedidos_clientes: requestsCount,
  };
  const prompt = `Você é um assistente para o dono de uma pequena farmácia. Escreva um resumo curto e amigável (mas profissional) em português brasileiro sobre o desempenho ${periodLabel}. Tom: como um colega contador conversando, sem firulas. Dados:
${JSON.stringify(ctx, null, 2)}

Estruture em 3 parágrafos curtos:
1) Resumo do desempenho (receita, lucro, vendas)
2) Atenção aos produtos em baixa e o que repor com urgência
3) Recomendação: produtos pedidos por clientes que poderiam entrar no catálogo e o que está vendendo bem

Sem markdown, sem listas. Texto corrido. Máximo 110 palavras.`;

  if (window.claude && typeof window.claude.complete === "function") {
    try {
      const r = await window.claude.complete(prompt);
      if (r && typeof r === "string") return r.trim();
    } catch (e) { /* fallback below */ }
  }
  // Canned plausible fallback
  return cannedSummary(period, stats, lowStock, topProducts, requestsCount);
}

function cannedSummary(period, stats, lowStock, topProducts, requestsCount) {
  const periodLabel = { day: "Hoje", week: "Nesta semana", month: "Neste mês" }[period] || "Hoje";
  const lucro = stats.revenue - stats.cost;
  const margem = stats.revenue > 0 ? Math.round(lucro / stats.revenue * 100) : 0;
  const low = lowStock.slice(0, 2).map(p => p.name).join(" e ");
  const top = topProducts.slice(0, 2).map(t => t.p.name).join(" e ");
  return [
    `${periodLabel} sua farmácia faturou ${BRL(stats.revenue)} em ${stats.sales} vendas, totalizando ${stats.items} itens. Descontando custos de ${BRL(stats.cost)}, sobraram ${BRL(lucro)} de margem — cerca de ${margem}% sobre a receita. É um resultado consistente com o ritmo recente.`,
    lowStock.length ? `Atenção ao estoque: ${low} estão abaixo do mínimo configurado. Reponha estes itens antes do próximo final de semana para não perder vendas de alta rotação. No total, ${lowStock.length} produto(s) precisam de reposição.` : `O estoque está saudável: nenhum item está abaixo do mínimo configurado. Boa hora para revisar os mínimos e ajustar conforme a sazonalidade.`,
    `Os campeões de venda foram ${top || "—"}, vale garantir presença constante na gôndola. Você tem ${requestsCount} pedido(s) de clientes registrado(s) — considere avaliar se algum desses itens vale a pena incluir no catálogo, especialmente os que foram solicitados mais de uma vez.`
  ].join("\n\n");
}

// --- Dashboard ---
function Dashboard({ state, setState }) {
  const summary = useMemo(() => summarize(state), [state]);
  const [aiText, setAiText] = useState(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [period, setPeriod] = useState("day");
  const [chartPeriod, setChartPeriod] = useState("month");
  const chartSeries = useMemo(() => buildSeries(state.sales, chartPeriod), [state.sales, chartPeriod]);
  const chartTotal = useMemo(() => chartSeries.reduce((a, p) => a + p.value, 0), [chartSeries]);
  const stats = summary[period];

  const regenerate = useCallback(async () => {
    setAiLoading(true);
    setAiText(null);
    const text = await generateAISummary(period, stats, summary.lowStock, summary.topProducts, state.requests.length);
    setAiText(text);
    setAiLoading(false);
  }, [period, stats, summary.lowStock, summary.topProducts, state.requests.length]);

  useEffect(() => { if (state.populated) regenerate(); }, [period, state.populated]);

  if (!state.populated) {
    return (
      <Card>
        <Empty
          icon="db"
          title="Nenhum dado ainda"
          sub="Popule o sistema com produtos e vendas de exemplo para ver o dashboard em ação."
          action={<Button kind="primary" icon="sparkle" onClick={() => setState(seedState())}>Popular com dados de exemplo</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <AIBlock
        title={`Resumo ${period === "day" ? "do dia" : period === "week" ? "da semana" : "do mês"}`}
        subtitle="Gerado por IA com base nos seus dados"
        loading={aiLoading}
        body={aiText ? aiText.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>) : null}
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Tabs
              value={period}
              onChange={setPeriod}
              options={[
                { value: "day", label: "Dia" },
                { value: "week", label: "Semana" },
                { value: "month", label: "Mês" },
              ]}
            />
            <Button kind="ghost" size="sm" icon="sparkle" onClick={regenerate} disabled={aiLoading}>Regerar</Button>
          </div>
        }
      />

      <div className="stat-grid">
        <Stat label="Receita" value={BRL(stats.revenue)} delta={period === "week" ? summary.week.delta : null} sub={`${stats.sales} vendas`} />
        <Stat label="Lucro estimado" value={BRL(stats.revenue - stats.cost)} sub={`Custo ${BRL(stats.cost)}`} />
        <Stat label="Itens vendidos" value={fmtInt(stats.items)} sub={`${period === "day" ? "hoje" : period === "week" ? "últimos 7 dias" : "no mês"}`} />
        <Stat label="Ticket médio" value={BRL(stats.sales > 0 ? stats.revenue / stats.sales : 0)} sub="por venda" />
      </div>

      <Card
        title="Receita ao longo do tempo"
        sub={chartPeriod === "day" ? "Hoje, por hora" : chartPeriod === "week" ? "Últimos 7 dias" : chartPeriod === "month" ? "Últimos 30 dias" : "Últimos 12 meses"}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="tabular" style={{ fontWeight: 600, fontSize: 13 }}>{BRL(chartTotal)}</span>
            <Tabs
              value={chartPeriod}
              onChange={setChartPeriod}
              options={[
                { value: "day", label: "Dia" },
                { value: "week", label: "Semana" },
                { value: "month", label: "Mês" },
                { value: "year", label: "Ano" },
              ]}
            />
          </div>
        }
      >
        <LineChart data={chartSeries} height={220} />
      </Card>

      <div className="cols-2-3">
        <Card title="Mais vendidos" sub="Últimos 7 dias">
          {summary.topProducts.length === 0 ? (
            <Empty icon="chart" title="Sem vendas ainda" sub="As vendas aparecerão aqui." />
          ) : (
            <div className="list" style={{ margin: -16 }}>
              {summary.topProducts.map(({ p, qty }) => (
                <div className="list-item" key={p.id}>
                  <div>
                    <div className="nm">{p.name}</div>
                    <div className="sub">{p.cat} · {BRL(p.price)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="tabular" style={{ fontWeight: 600 }}>{qty}</div>
                    <div className="sub">unidades</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Repor com urgência" sub={summary.lowStock.length + " produto(s)"} action={summary.lowStock.length > 0 && <Badge tone="warning" dot>Baixo</Badge>}>
          {summary.lowStock.length === 0 ? (
            <Empty icon="check" title="Tudo em ordem" sub="Nenhum produto abaixo do mínimo." />
          ) : (
            <div className="list" style={{ margin: -16 }}>
              {summary.lowStock.map(p => (
                <div className="list-item" key={p.id}>
                  <div>
                    <div className="nm">{p.name}</div>
                    <div className="sub">Mín. {p.min} · {p.cat}</div>
                  </div>
                  <Badge tone={p.stock === 0 ? "danger" : "warning"}>{p.stock} restante{p.stock !== 1 ? "s" : ""}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, delta }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value tighter">{value}</div>
      {(sub || delta !== null) && (
        <div className="stat-delta">
          {delta !== null && delta !== undefined && (
            <span className={delta > 0.5 ? "delta-up" : delta < -0.5 ? "delta-down" : "delta-flat"}>
              <Icon name={delta > 0.5 ? "arrowUp" : delta < -0.5 ? "arrowDown" : "check"} size={11} />
              {Math.abs(delta).toFixed(1)}% vs semana anterior
            </span>
          )}
          {sub && (delta === null || delta === undefined) && <span className="muted">{sub}</span>}
        </div>
      )}
    </div>
  );
}

// --- Produtos ---
function Produtos({ state, setState }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState(null); // product or {new:true}
  const products = state.products;
  const filtered = products.filter(p =>
    (!cat || p.cat === cat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search))
  );

  function saveProduct(p) {
    if (p.id) {
      setState({ ...state, products: state.products.map(x => x.id === p.id ? p : x) });
    } else {
      const id = "p" + Date.now();
      setState({ ...state, products: [...state.products, { ...p, id }] });
    }
    setEditing(null);
  }
  function deleteProduct(id) {
    setState({ ...state, products: state.products.filter(p => p.id !== id) });
  }

  if (!state.populated) {
    return (
      <Card>
        <Empty
          icon="box"
          title="Catálogo vazio"
          sub="Adicione produtos manualmente ou popule com dados de exemplo."
          action={
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Button kind="primary" icon="plus" onClick={() => setEditing({ new: true })}>Novo produto</Button>
              <Button kind="secondary" icon="sparkle" onClick={() => setState(seedState())}>Popular exemplo</Button>
            </div>
          }
        />
        {editing && <ProductModal product={editing} onClose={() => setEditing(null)} onSave={saveProduct} />}
      </Card>
    );
  }

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={14} />
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou código…" />
        </div>
        <select className="select" style={{ width: "auto", minWidth: 160 }} value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Todas categorias</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <Button kind="primary" icon="plus" onClick={() => setEditing({ new: true })}>Novo produto</Button>
      </div>

      <Card flush>
        {filtered.length === 0 ? (
          <Empty icon="search" title="Nenhum resultado" sub="Tente outros termos de busca." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th style={{ width: 180 }}>Estoque</th>
                <th className="num" style={{ width: 80 }}>Mín.</th>
                <th className="num" style={{ width: 100 }}>Preço</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} onClick={() => setEditing(p)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span>{p.name}</span>
                      <span className="mono" style={{ color: "var(--text-subtle)" }}>{p.sku}</span>
                    </div>
                  </td>
                  <td className="muted">{p.cat}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <StockBar stock={p.stock} min={p.min} />
                      <span className="tabular">{p.stock}</span>
                      {p.stock === 0 ? <Badge tone="danger">Sem estoque</Badge>
                        : p.stock <= p.min ? <Badge tone="warning">Baixo</Badge> : null}
                    </div>
                  </td>
                  <td className="num tabular muted">{p.min}</td>
                  <td className="num tabular">{BRL(p.price)}</td>
                  <td onClick={(e) => { e.stopPropagation(); deleteProduct(p.id); }} style={{ textAlign: "center" }}>
                    <button className="btn btn-ghost btn-sm" title="Excluir"><Icon name="trash" size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && <ProductModal product={editing} onClose={() => setEditing(null)} onSave={saveProduct} onDelete={(id) => { deleteProduct(id); setEditing(null); }} />}
    </>
  );
}

function ProductModal({ product, onClose, onSave, onDelete }) {
  const isNew = !product.id;
  const [f, setF] = useState({
    id: product.id,
    name: product.name || "",
    sku: product.sku || "",
    cat: product.cat || CATEGORIES[0],
    price: product.price || 0,
    cost: product.cost || 0,
    stock: product.stock ?? 0,
    min: product.min ?? 5,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim().length > 0 && f.sku.trim().length > 0;
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Novo produto" : "Editar produto"}
      footer={
        <>
          {!isNew && <Button kind="danger" onClick={() => onDelete(f.id)} icon="trash">Excluir</Button>}
          <div style={{ flex: 1 }} />
          <Button kind="ghost" onClick={onClose}>Cancelar</Button>
          <Button kind="primary" onClick={() => onSave(f)} disabled={!valid}>Salvar</Button>
        </>
      }
    >
      <Field label="Nome">
        <Input value={f.name} onChange={(v) => set("name", v)} autoFocus placeholder="Ex: Dipirona 500mg c/10" />
      </Field>
      <div className="cols-2">
        <Field label="Código de barras (SKU)">
          <Input value={f.sku} onChange={(v) => set("sku", v)} placeholder="789…" />
        </Field>
        <Field label="Categoria">
          <select className="select" value={f.cat} onChange={(e) => set("cat", e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="cols-3">
        <Field label="Preço (R$)">
          <Input type="number" value={f.price} onChange={(v) => set("price", parseFloat(v) || 0)} />
        </Field>
        <Field label="Custo (R$)">
          <Input type="number" value={f.cost} onChange={(v) => set("cost", parseFloat(v) || 0)} />
        </Field>
        <Field label="Estoque mín.">
          <Input type="number" value={f.min} onChange={(v) => set("min", parseInt(v) || 0)} />
        </Field>
      </div>
      <Field label="Estoque atual">
        <Input type="number" value={f.stock} onChange={(v) => set("stock", parseInt(v) || 0)} />
      </Field>
    </Modal>
  );
}

// --- Solicitados ---
function Solicitados({ state, setState }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", note: "" });

  function addRequest() {
    if (!form.name.trim()) return;
    const existing = state.requests.find(r => r.name.toLowerCase() === form.name.trim().toLowerCase());
    if (existing) {
      setState({
        ...state,
        requests: state.requests.map(r => r.id === existing.id ? { ...r, count: r.count + 1, date: todayISO() } : r),
      });
    } else {
      const r = { id: "r" + Date.now(), name: form.name.trim(), note: form.note.trim(), count: 1, date: todayISO() };
      setState({ ...state, requests: [r, ...state.requests] });
    }
    setForm({ name: "", note: "" });
    setAdding(false);
  }
  function bump(id) {
    setState({ ...state, requests: state.requests.map(r => r.id === id ? { ...r, count: r.count + 1, date: todayISO() } : r) });
  }
  function remove(id) {
    setState({ ...state, requests: state.requests.filter(r => r.id !== id) });
  }
  function promote(req) {
    // convert to product (open modal-ish: just set defaults and route to produtos? simplify: add a product with stock 0 and remove request)
    const id = "p" + Date.now();
    const p = { id, sku: "novo-" + id.slice(-4), name: req.name, cat: CATEGORIES[0], price: 0, cost: 0, stock: 0, min: 3 };
    setState({
      ...state,
      products: [...state.products, p],
      requests: state.requests.filter(r => r.id !== req.id),
      activity: [{ id: "a" + Date.now(), kind: "promote", text: `Solicitado adicionado ao catálogo: ${req.name}`, ts: new Date().toISOString() }, ...state.activity].slice(0, 50),
    });
  }

  const sorted = [...state.requests].sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="toolbar">
        <div className="muted">{state.requests.length} produto(s) solicitado(s) por clientes</div>
        <div style={{ flex: 1 }} />
        <Button kind="primary" icon="plus" onClick={() => setAdding(true)}>Registrar solicitação</Button>
      </div>

      <Card flush>
        {sorted.length === 0 ? (
          <Empty
            icon="bookmark"
            title="Nenhuma solicitação ainda"
            sub="Sempre que um cliente pedir algo que você não tem, registre aqui."
            action={<Button kind="primary" icon="plus" onClick={() => setAdding(true)}>Registrar solicitação</Button>}
          />
        ) : (
          <div className="list">
            {sorted.map(r => (
              <div className="list-item" key={r.id} style={{ gridTemplateColumns: "1fr auto auto" }}>
                <div>
                  <div className="nm">{r.name}</div>
                  {r.note && <div className="sub">{r.note}</div>}
                  <div className="sub" style={{ marginTop: 4 }}>
                    Último pedido em {new Date(r.date).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge tone={r.count >= 5 ? "warning" : r.count >= 3 ? "info" : "neutral"}>{r.count} pedido(s)</Badge>
                  <button className="btn btn-ghost btn-sm" title="Mais um pedido" onClick={() => bump(r.id)}><Icon name="plus" size={13} /></button>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <Button kind="secondary" size="sm" onClick={() => promote(r)}>Adicionar ao catálogo</Button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(r.id)} title="Remover"><Icon name="trash" size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Registrar solicitação de cliente"
        footer={
          <>
            <Button kind="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button kind="primary" onClick={addRequest} disabled={!form.name.trim()}>Registrar</Button>
          </>
        }
      >
        <Field label="O que o cliente pediu?">
          <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoFocus placeholder="Ex: Pomada para queimadura" />
        </Field>
        <Field label="Observação (opcional)">
          <textarea className="textarea" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Detalhes do pedido, perfil do cliente, etc." />
        </Field>
      </Modal>
    </>
  );
}

Object.assign(window, { Dashboard, Produtos, Solicitados, generateAISummary, cannedSummary });
