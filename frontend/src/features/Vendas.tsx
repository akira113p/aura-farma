import { useRef, useState } from 'react';
import type { AppState, Payment, Product } from '../types';
import { Badge, Button, Card, Empty, Icon } from '../components';
import { applySale, seedState } from '../services/store';
import { BRL } from '../lib/format';

interface ScreenProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  flash: (msg: string) => void;
}

interface CartLine {
  pid: string;
  qty: number;
}

export function Vendas({ state, setState, flash }: ScreenProps) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [payment, setPayment] = useState<Payment>('pix');
  const [finishing, setFinishing] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const products = state.products;
  const matches = products
    .filter((p) => (!search ? true : p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)))
    .slice(0, 30);

  function addToCart(p: Product) {
    if (p.stock <= 0) return;
    setCart((c) => {
      const existing = c.find((x) => x.pid === p.id);
      if (existing) {
        if (existing.qty >= p.stock) return c;
        return c.map((x) => (x.pid === p.id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...c, { pid: p.id, qty: 1 }];
    });
  }
  function setQty(pid: string, qty: number) {
    const p = products.find((p) => p.id === pid);
    const max = p ? p.stock : 99;
    if (qty <= 0) setCart((c) => c.filter((x) => x.pid !== pid));
    else setCart((c) => c.map((x) => (x.pid === pid ? { ...x, qty: Math.min(qty, max) } : x)));
  }
  function removeFromCart(pid: string) {
    setCart((c) => c.filter((x) => x.pid !== pid));
  }

  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const term = scanInput.trim();
    if (!term) return;
    const p = products.find((p) => p.sku === term || p.name.toLowerCase() === term.toLowerCase());
    if (p) {
      addToCart(p);
      setScanInput('');
      if (scanRef.current) {
        scanRef.current.style.borderColor = 'var(--success)';
        setTimeout(() => {
          if (scanRef.current) scanRef.current.style.borderColor = '';
        }, 250);
      }
    } else if (scanRef.current) {
      scanRef.current.style.borderColor = 'var(--danger)';
      setTimeout(() => {
        if (scanRef.current) scanRef.current.style.borderColor = '';
      }, 600);
    }
  }

  const items = cart
    .map((c) => ({ ...c, p: products.find((p) => p.id === c.pid) }))
    .filter((x): x is CartLine & { p: Product } => Boolean(x.p));
  const subtotal = items.reduce((a, it) => a + it.qty * it.p.price, 0);

  function finalize() {
    if (items.length === 0) return;
    setFinishing(true);
    setTimeout(() => {
      setState(applySale(state, cart, payment));
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
          action={
            <Button kind="primary" icon="sparkle" onClick={() => setState(seedState())}>
              Popular com dados de exemplo
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="pdv-grid">
      <Card flush>
        <div className="card-head">
          <h3 className="card-title tighter">Adicionar ao carrinho</h3>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            Escaneie o código ou clique no produto
          </div>
        </div>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <form onSubmit={handleScan} style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }}>
                <Icon name="barcode" size={14} />
              </div>
              <input
                ref={scanRef}
                className="input"
                style={{ paddingLeft: 32, fontFamily: 'var(--font-mono)' }}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Código de barras ou nome…"
                autoFocus
              />
            </div>
            <Button kind="primary" type="submit">
              Adicionar
            </Button>
          </form>
          <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
            <div className="search" style={{ maxWidth: 240 }}>
              <Icon name="search" size={14} />
              <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar produtos…" />
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{matches.length} produto(s)</div>
          </div>
        </div>

        <div className="picker">
          {matches.length === 0 ? (
            <Empty icon="search" title="Nenhum produto encontrado" />
          ) : (
            matches.map((p) => (
              <div
                className="picker-row"
                key={p.id}
                onClick={() => addToCart(p)}
                style={{ opacity: p.stock === 0 ? 0.4 : 1, cursor: p.stock === 0 ? 'not-allowed' : 'pointer' }}
              >
                <div>
                  <div className="nm">{p.name}</div>
                  <div className="sku">
                    {p.sku} · {p.cat}
                  </div>
                </div>
                <div className="stock">
                  {p.stock === 0 ? (
                    <Badge tone="danger">Sem estoque</Badge>
                  ) : p.stock <= p.min ? (
                    <Badge tone="warning">{p.stock} restantes</Badge>
                  ) : (
                    <span>{p.stock} em estoque</span>
                  )}
                </div>
                <div className="px tabular">{BRL(p.price)}</div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card flush>
        <div className="card-head">
          <h3 className="card-title tighter">Carrinho</h3>
          {items.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setCart([])}>
              Limpar
            </button>
          )}
        </div>
        <div className="cart-list">
          {items.length === 0 ? (
            <Empty icon="cart" title="Carrinho vazio" sub="Adicione produtos para iniciar a venda." />
          ) : (
            items.map((it) => (
              <div className="cart-row" key={it.pid}>
                <div>
                  <div className="nm">{it.p.name}</div>
                  <div className="meta tabular">
                    {BRL(it.p.price)} × {it.qty} = <strong>{BRL(it.p.price * it.qty)}</strong>
                  </div>
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
            ))
          )}
        </div>

        <div className="totals">
          <div className="tot-row">
            <span>Itens</span>
            <span>{items.reduce((a, x) => a + x.qty, 0)}</span>
          </div>
          <div className="tot-row">
            <span>Subtotal</span>
            <span>{BRL(subtotal)}</span>
          </div>
          <div className="tot-row grand">
            <span>Total</span>
            <span>{BRL(subtotal)}</span>
          </div>
        </div>

        <div style={{ padding: '0 16px 14px' }}>
          <div className="field" style={{ marginBottom: 10 }}>
            <label className="field-label">Forma de pagamento</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(
                [
                  ['pix', 'PIX'],
                  ['cartão', 'Cartão'],
                  ['dinheiro', 'Dinheiro'],
                ] as [Payment, string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  className={'btn ' + (payment === v ? 'btn-primary' : 'btn-secondary')}
                  style={{ flex: 1, height: 34 }}
                  onClick={() => setPayment(v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <Button kind="primary" size="lg" block onClick={finalize} disabled={items.length === 0 || finishing}>
            {finishing ? 'Processando…' : `Finalizar venda · ${BRL(subtotal)}`}
          </Button>
          <div className="sub muted" style={{ textAlign: 'center', marginTop: 8, fontSize: 11 }}>
            Ao finalizar, o estoque é descontado automaticamente.
          </div>
        </div>
      </Card>
    </div>
  );
}
