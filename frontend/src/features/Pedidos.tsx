import { useState } from 'react';
import type { AppState, Order, Product } from '../types';
import { Badge, Button, Card, Empty, Field, Icon, Input, Modal, StockBar, Tabs } from '../components';
import { createProduct, updateProduct } from '../services/dados';
import { ORDER_STAGES, SUPPLIER, suggestQty, buildExampleOrders } from '../services/pedidos';
import { BRL } from '../lib/format';
import { ApiError } from '../lib/apiClient';

interface PedidosProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  flash: (msg: string) => void;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Operação falhou. Tente novamente.');

function agoLabel(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora há pouco';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

function fmtOrderDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/* --- Stepper de estágios da logística --- */
function OrderStepper({ idx }: { idx: number }) {
  return (
    <div className="ostep">
      {ORDER_STAGES.map((st, i) => {
        const cls = i < idx ? 'done' : i === idx ? 'current' : '';
        return (
          <div className={'ostep-node ' + cls} key={st.key}>
            <span className="ostep-dot">{i < idx && <Icon name="check" size={10} className="" />}</span>
            <span className="ostep-lbl">{st.label}</span>
            <span className="ostep-hint">{st.hint}</span>
          </div>
        );
      })}
    </div>
  );
}

/* --- Um pedido em andamento (controles de estágio + itens a caminho) --- */
function ActiveOrder({
  order,
  products,
  onMove,
}: {
  order: Order;
  products: Product[];
  onMove: (id: string, delta: number) => void;
}) {
  const units = order.items.reduce((a, it) => a + it.qty, 0);
  const st = ORDER_STAGES[order.stage];
  const [open, setOpen] = useState(true);
  return (
    <Card flush>
      <div className="card-head" style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h3 className="card-title tighter" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mono" style={{ color: 'var(--text-muted)' }}>{order.id.toUpperCase()}</span>
            {order.supplier}
          </h3>
          <span className="card-sub">
            Enviado {agoLabel(order.placedAt)} · {fmtOrderDate(order.placedAt)} · {order.items.length} item(ns) · {units} un.
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Badge tone={st.tone} dot>{st.label}</Badge>
          <span className="tabular" style={{ fontWeight: 600, minWidth: 92, textAlign: 'right' }}>{BRL(order.total)}</span>
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} className="" />
        </div>
      </div>

      {open && (
        <>
          <div style={{ padding: '18px 20px 8px' }}>
            <OrderStepper idx={order.stage} />
          </div>

          <div className="list" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="list-item" style={{ background: 'var(--surface-2)', gridTemplateColumns: '1fr auto' }}>
              <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                Remédios a caminho
              </span>
              <div className="row" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="muted" style={{ fontSize: 11, marginRight: 4 }}>mover estágio</span>
                <Button kind="secondary" size="sm" onClick={() => onMove(order.id, -1)} disabled={order.stage === 0}>← Voltar</Button>
                <Button kind={order.stage >= 2 ? 'primary' : 'secondary'} size="sm" onClick={() => onMove(order.id, 1)}>
                  {order.stage >= 2 ? 'Marcar entregue ✓' : 'Avançar →'}
                </Button>
              </div>
            </div>
            {order.items.map((it, i) => {
              const p = it.pid ? products.find((pp) => pp.id === it.pid) : undefined;
              return (
                <div className="list-item" key={i} style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <div className="nm">{it.name}</div>
                    <div className="sub">
                      {p ? (
                        <>Em estoque: <strong>{p.stock}</strong> → <strong style={{ color: 'var(--success)' }}>{p.stock + it.qty}</strong> ao receber</>
                      ) : (
                        `${BRL(it.cost)} un. · entra no catálogo ao receber`
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Badge tone="info">+{it.qty} un.</Badge>
                    <span className="tabular muted" style={{ minWidth: 92, textAlign: 'right' }}>{BRL(it.qty * it.cost)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="order-bar">
            <div className="ob-tot">
              <div className="muted" style={{ fontSize: 12 }}>Total do pedido</div>
              <div className="v">{BRL(order.total)}</div>
            </div>
            <div style={{ flex: 1 }} />
            <span className="muted" style={{ fontSize: 12, maxWidth: 280, textAlign: 'right' }}>
              Ao marcar como entregue, o estoque é somado e o pedido vai para “Pedidos anteriores”.
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

interface ManualItem {
  key: string;
  pid: string | null;
  name: string;
  cost: number;
  qty: number;
}

interface OrderLine {
  kind: 'sug' | 'man';
  key: string;
  pid: string | null;
  p: Product | null;
  name: string;
  cost: number;
  qty: number;
  excluded: boolean;
  isFree: boolean;
}

export function Pedidos({ state, setState, flash, orders, setOrders }: PedidosProps) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [manual, setManual] = useState<ManualItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!state.populated) {
    return (
      <Card>
        <Empty
          icon="truck"
          title="Sem catálogo para repor"
          sub="Adicione produtos no Estoque ou use “Popular” no topo para gerar sugestões de reposição."
        />
      </Card>
    );
  }

  const inProgress = [...orders].filter((o) => !o.received).sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const past = [...orders].filter((o) => o.received).sort((a, b) => b.placedAt.localeCompare(a.placedAt));

  // Produtos já presentes num pedido ativo — não sugerir de novo.
  const pendingPids = new Set(inProgress.flatMap((o) => o.items.map((i) => i.pid)));
  const manualPids = new Set(manual.filter((m) => m.pid).map((m) => m.pid));

  const lowProducts = state.products
    .filter((p) => p.stock <= p.min && !pendingPids.has(p.id) && !manualPids.has(p.id))
    .sort((a, b) => a.stock / Math.max(a.min, 1) - b.stock / Math.max(b.min, 1));

  const suggestedLines: OrderLine[] = lowProducts.map((p) => ({
    kind: 'sug', key: p.id, pid: p.id, p, name: p.name, cost: p.cost,
    qty: overrides[p.id] !== undefined ? overrides[p.id] : suggestQty(p),
    excluded: !!excluded[p.id], isFree: false,
  }));
  const manualLines: OrderLine[] = manual.map((m) => ({
    kind: 'man', key: m.key, pid: m.pid,
    p: m.pid ? state.products.find((pp) => pp.id === m.pid) ?? null : null,
    name: m.name, cost: m.cost, qty: m.qty, excluded: false, isFree: !m.pid,
  }));
  const lines = [...suggestedLines, ...manualLines];
  const included = lines.filter((l) => !l.excluded && l.qty > 0);
  const totalCost = included.reduce((a, l) => a + l.cost * l.qty, 0);
  const totalItems = included.reduce((a, l) => a + l.qty, 0);
  const inOrderPids = new Set(included.filter((l) => l.pid).map((l) => l.pid as string));

  function onQty(line: OrderLine, v: string | number) {
    const n = Math.max(0, parseInt(String(v)) || 0);
    if (line.kind === 'sug') setOverrides((o) => ({ ...o, [line.pid as string]: n }));
    else setManual((m) => m.map((x) => (x.key === line.key ? { ...x, qty: n } : x)));
  }
  function onBump(line: OrderLine, delta: number) {
    onQty(line, Math.max(0, line.qty + delta));
  }
  function onRemove(line: OrderLine) {
    if (line.kind === 'sug') setExcluded((e) => ({ ...e, [line.pid as string]: !e[line.pid as string] }));
    else setManual((m) => m.filter((x) => x.key !== line.key));
  }
  function resetSuggestions() {
    setOverrides({});
    setExcluded({});
    setManual([]);
  }

  function addExisting(p: Product) {
    const isLow = p.stock <= p.min && !pendingPids.has(p.id);
    if (isLow) {
      setExcluded((e) => ({ ...e, [p.id]: false }));
      setOverrides((o) => ({ ...o, [p.id]: o[p.id] ?? suggestQty(p) }));
    } else {
      setManual((m) =>
        m.some((x) => x.pid === p.id)
          ? m.map((x) => (x.pid === p.id ? { ...x, qty: x.qty + 1 } : x))
          : [...m, { key: 'm' + Date.now() + Math.floor(Math.random() * 1000), pid: p.id, name: p.name, cost: p.cost, qty: suggestQty(p) }],
      );
    }
  }
  function addCustom(name: string, cost: string, qty: string) {
    if (!name.trim()) return;
    setManual((m) => [
      ...m,
      { key: 'm' + Date.now() + Math.floor(Math.random() * 1000), pid: null, name: name.trim(), cost: parseFloat(cost) || 0, qty: Math.max(1, parseInt(qty) || 1) },
    ]);
  }

  function confirmOrder() {
    if (included.length === 0) return;
    setConfirming(true);
    const order: Order = {
      id: 'o' + Date.now(),
      placedAt: new Date().toISOString(),
      supplier: SUPPLIER,
      stage: 0,
      received: false,
      items: included.map((l) => ({ pid: l.pid, name: l.name, qty: l.qty, cost: l.cost, free: !l.pid })),
      total: totalCost,
    };
    setOrders((prev) => [order, ...prev]);
    resetSuggestions();
    setConfirming(false);
    flash(`Pedido enviado à ${SUPPLIER} · ${included.length} item(ns) · agora em andamento`);
  }

  function moveStage(id: string, delta: number) {
    const order = orders.find((o) => o.id === id);
    if (!order || order.received) return;
    const next = Math.max(0, Math.min(3, order.stage + delta));
    if (delta > 0 && next === 3) {
      void receiveOrder(order);
      return;
    }
    if (next === order.stage) return;
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, stage: next } : o)));
  }

  /**
   * Recebe o pedido: soma o estoque de cada item via as ações REAIS de produto
   * (persistem no backend) e cadastra itens avulsos. Só então marca o pedido
   * como recebido. É aqui que a logística "encosta" no resto do sistema.
   */
  async function receiveOrder(order: Order) {
    let cur = state;
    let created = 0;
    try {
      for (const it of order.items) {
        const byId = it.pid ? cur.products.find((p) => p.id === it.pid) : undefined;
        const byName = !byId ? cur.products.find((p) => p.name.toLowerCase() === it.name.toLowerCase()) : undefined;
        const match = byId ?? byName;
        if (match) {
          cur = await updateProduct(cur, { ...match, stock: match.stock + it.qty });
        } else {
          created++;
          cur = await createProduct(cur, {
            id: '',
            sku: 'reposicao-' + Math.floor(1000 + Math.random() * 9000),
            name: it.name,
            cat: 'Genéricos',
            price: Math.round(it.cost * 1.6 * 100) / 100,
            cost: it.cost,
            stock: it.qty,
            min: 5,
          });
        }
      }
      setState(cur);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, received: true, stage: 3, receivedAt: new Date().toISOString() } : o)),
      );
      flash(`Pedido ${order.id.toUpperCase()} recebido · estoque atualizado${created ? `, ${created} novo(s) produto(s)` : ''}`);
    } catch (e) {
      setState(cur); // mantém o que já foi aplicado
      flash(errMsg(e));
    }
  }

  const hasDraft = Object.keys(overrides).length > 0 || Object.keys(excluded).length > 0 || manual.length > 0;

  return (
    <div className="col" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sugestão de reposição */}
      <Card flush>
        <div className="card-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h3 className="card-title tighter">Sugestão de reposição</h3>
            <span className="card-sub">
              {lowProducts.length > 0
                ? `${lowProducts.length} produto(s) abaixo do estoque mínimo`
                : 'Nenhum produto abaixo do mínimo'}
              {manualLines.length > 0 ? ` · ${manualLines.length} item(ns) adicionado(s)` : ''}
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="supplier-chip">
              <span className="dot-lg" /> Distribuidor: <strong style={{ fontWeight: 600 }}>{SUPPLIER}</strong>
            </span>
            <Button kind="secondary" size="sm" icon="plus" onClick={() => setAdding(true)}>Adicionar item</Button>
            {hasDraft && (
              <button className="btn btn-ghost btn-sm" onClick={resetSuggestions}>Limpar</button>
            )}
          </div>
        </div>

        {lines.length === 0 ? (
          <Empty
            icon="check"
            title="Estoque saudável"
            sub={
              inProgress.length > 0
                ? `Nada a repor automaticamente — ${inProgress.length} pedido(s) em andamento abaixo. Use “Adicionar item” para comprar por conta própria.`
                : 'Nenhum produto abaixo do mínimo. Use “Adicionar item” para comprar algo por conta própria.'
            }
          />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th style={{ width: 170 }}>Estoque atual</th>
                  <th className="num" style={{ width: 70 }}>Mín.</th>
                  <th style={{ width: 150 }}>Qtd. a pedir</th>
                  <th className="num" style={{ width: 100 }}>Custo un.</th>
                  <th className="num" style={{ width: 110 }}>Subtotal</th>
                  <th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const ex = line.excluded;
                  const p = line.p;
                  return (
                    <tr key={line.key} style={{ opacity: ex ? 0.45 : 1 }}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{line.name}</span>
                          {line.isFree ? (
                            <span className="mono" style={{ color: 'var(--text-subtle)' }}>item avulso · entra no catálogo ao receber</span>
                          ) : (
                            <span className="mono" style={{ color: 'var(--text-subtle)' }}>
                              {p ? `${p.sku} · ${p.cat}` : ''}{line.kind === 'man' ? ' · adicionado' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {p ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <StockBar stock={p.stock} min={p.min} />
                            <span className="tabular">{p.stock}</span>
                            {p.stock === 0 ? <Badge tone="danger">Esgotado</Badge> : p.stock <= p.min ? <Badge tone="warning">Baixo</Badge> : null}
                          </div>
                        ) : (
                          <span className="subtle" style={{ fontSize: 12 }}>novo item</span>
                        )}
                      </td>
                      <td className="num tabular muted">{p ? p.min : '—'}</td>
                      <td>
                        {ex ? (
                          <span className="subtle" style={{ fontSize: 12 }}>fora do pedido</span>
                        ) : (
                          <div className="qty-stepper lg">
                            <button onClick={() => onBump(line, -1)} aria-label="Diminuir">−</button>
                            <input type="number" value={line.qty} onChange={(e) => onQty(line, e.target.value)} />
                            <button onClick={() => onBump(line, 1)} aria-label="Aumentar">+</button>
                          </div>
                        )}
                      </td>
                      <td className="num tabular muted">{BRL(line.cost)}</td>
                      <td className="num tabular" style={{ fontWeight: ex ? 400 : 600 }}>{ex ? '—' : BRL(line.cost * line.qty)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          title={line.kind === 'sug' ? (ex ? 'Incluir no pedido' : 'Remover do pedido') : 'Remover do pedido'}
                          onClick={() => onRemove(line)}
                        >
                          <Icon name={line.kind === 'sug' && ex ? 'plus' : 'x'} size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="order-bar">
              <div className="ob-tot">
                <div className="muted" style={{ fontSize: 12 }}>{included.length} item(ns) · {totalItems} unidade(s)</div>
                <div className="v">{BRL(totalCost)}</div>
              </div>
              <div style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 12, maxWidth: 230, textAlign: 'right' }}>
                O pedido vai para “Em andamento” e o estoque entra quando você receber.
              </span>
              <Button kind="primary" size="lg" icon="truck" onClick={confirmOrder} disabled={included.length === 0 || confirming}>
                {confirming ? 'Enviando…' : `Confirmar pedido · ${BRL(totalCost)}`}
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* Em andamento */}
      {inProgress.length > 0 ? (
        <div className="col" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="truck" size={16} className="" />
              Em andamento
            </div>
            <span className="muted" style={{ fontSize: 12 }}>{inProgress.length} pedido(s) a caminho</span>
          </div>
          {inProgress.map((o) => (
            <ActiveOrder key={o.id} order={o} products={state.products} onMove={moveStage} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <Empty
            icon="truck"
            title="Nenhum pedido ainda"
            sub="Confirme a sugestão acima para criar um pedido — ou gere um exemplo para ver o fluxo de logística da Eurofarma."
            action={
              <Button kind="secondary" icon="sparkle" onClick={() => setOrders(buildExampleOrders(state.products))}>
                Gerar pedidos de exemplo
              </Button>
            }
          />
        </Card>
      ) : null}

      {/* Pedidos anteriores */}
      <Card title="Pedidos anteriores" sub={`${past.length} pedido(s) recebido(s)`} flush>
        {past.length === 0 ? (
          <Empty icon="check" title="Nenhum pedido recebido ainda" sub="Pedidos concluídos aparecem aqui depois que você recebe os produtos." />
        ) : (
          <div className="list">
            {past.map((o) => {
              const open = expanded === o.id;
              return (
                <div key={o.id}>
                  <div
                    className="list-item"
                    style={{ cursor: 'pointer', gridTemplateColumns: '1fr auto' }}
                    onClick={() => setExpanded(open ? null : o.id)}
                  >
                    <div>
                      <div className="nm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="mono" style={{ color: 'var(--text-muted)' }}>{o.id.toUpperCase()}</span>
                        <span>{o.supplier}</span>
                      </div>
                      <div className="sub">
                        {fmtOrderDate(o.placedAt)} · {o.items.length} item(ns) · {o.items.reduce((a, it) => a + it.qty, 0)} un.
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <Badge tone="success" dot>Recebido</Badge>
                      <span className="tabular" style={{ fontWeight: 600, minWidth: 92, textAlign: 'right' }}>{BRL(o.total)}</span>
                      <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} className="" />
                    </div>
                  </div>
                  {open && (
                    <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '16px 20px' }}>
                      <OrderStepper idx={3} />
                      <div className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 14 }}>
                        Recebido{o.receivedAt ? ` ${agoLabel(o.receivedAt)}` : ''} · pedido feito {agoLabel(o.placedAt)}
                      </div>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        {o.items.map((it, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                            <span>{it.name} <span className="muted">× {it.qty}</span></span>
                            <span className="tabular">{BRL(it.qty * it.cost)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0 0', marginTop: 6, borderTop: '1px solid var(--border)', fontWeight: 600 }}>
                          <span>Total do pedido</span>
                          <span className="tabular">{BRL(o.total)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {adding && (
        <AddItemModal
          products={state.products}
          inOrderPids={inOrderPids}
          onAddExisting={addExisting}
          onAddCustom={addCustom}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

/* --- Modal: adicionar um produto ao pedido (catálogo ou avulso) --- */
function AddItemModal({
  products,
  inOrderPids,
  onAddExisting,
  onAddCustom,
  onClose,
}: {
  products: Product[];
  inOrderPids: Set<string>;
  onAddExisting: (p: Product) => void;
  onAddCustom: (name: string, cost: string, qty: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'catalogo' | 'avulso'>('catalogo');
  const [search, setSearch] = useState('');
  const [custom, setCustom] = useState({ name: '', cost: '', qty: '1' });
  const matches = products
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search))
    .slice(0, 40);
  return (
    <Modal open onClose={onClose} title="Adicionar item ao pedido" footer={<Button kind="ghost" onClick={onClose}>Concluir</Button>}>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[{ value: 'catalogo', label: 'Do catálogo' }, { value: 'avulso', label: 'Item avulso' }]}
      />

      {tab === 'catalogo' ? (
        <>
          <div className="search" style={{ maxWidth: 'none', position: 'relative' }}>
            <Icon name="search" size={14} className="icon" />
            <input
              className="input"
              style={{ paddingLeft: 30 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar remédio no catálogo…"
              autoFocus
            />
          </div>
          <div className="picker" style={{ maxHeight: 320, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            {matches.length === 0 ? (
              <Empty icon="search" title="Nenhum produto encontrado" />
            ) : (
              matches.map((p) => {
                const added = inOrderPids.has(p.id);
                return (
                  <div className="picker-row" key={p.id} onClick={() => onAddExisting(p)} style={{ cursor: 'pointer' }}>
                    <div>
                      <div className="nm">{p.name}</div>
                      <div className="sku">{p.sku} · {p.cat}</div>
                    </div>
                    <div className="stock">{p.stock} em estoque</div>
                    <div className="px">
                      {added ? (
                        <Badge tone="success">no pedido</Badge>
                      ) : (
                        <span className="row" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 500 }}>
                          <Icon name="plus" size={13} className="icon" />Adicionar
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>Clique para adicionar. A quantidade sugerida pode ser ajustada na tabela.</div>
        </>
      ) : (
        <>
          <Field label="Nome do remédio">
            <Input value={custom.name} onChange={(v) => setCustom({ ...custom, name: v })} autoFocus placeholder="Ex: Pomada cicatrizante 30g" />
          </Field>
          <div className="cols-2">
            <Field label="Custo unitário (R$)">
              <Input type="number" value={custom.cost} onChange={(v) => setCustom({ ...custom, cost: v })} placeholder="0,00" />
            </Field>
            <Field label="Quantidade">
              <Input type="number" value={custom.qty} onChange={(v) => setCustom({ ...custom, qty: v })} />
            </Field>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Itens avulsos não existem no catálogo ainda — serão cadastrados automaticamente quando o pedido for recebido.
          </div>
          <Button
            kind="primary"
            icon="plus"
            disabled={!custom.name.trim()}
            onClick={() => {
              onAddCustom(custom.name, custom.cost, custom.qty);
              setCustom({ name: '', cost: '', qty: '1' });
            }}
          >
            Adicionar ao pedido
          </Button>
        </>
      )}
    </Modal>
  );
}
