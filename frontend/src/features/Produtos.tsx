import { useState } from 'react';
import type { AppState, Product } from '../types';
import { Badge, Button, Card, Empty, Field, Icon, Input, Modal, StockBar } from '../components';
import { seedState } from '../services/store';
import { CATEGORIES } from '../data/seed';
import { BRL } from '../lib/format';

interface ScreenProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

/** Either an existing product (edit) or the "new product" sentinel. */
type Editing = Product | { new: true } | null;

export function Produtos({ state, setState }: ScreenProps) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<Editing>(null);

  const products = state.products;
  const filtered = products.filter(
    (p) =>
      (!cat || p.cat === cat) &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)),
  );

  function saveProduct(p: Product) {
    if (p.id) {
      setState({ ...state, products: state.products.map((x) => (x.id === p.id ? p : x)) });
    } else {
      const id = 'p' + Date.now();
      setState({ ...state, products: [...state.products, { ...p, id }] });
    }
    setEditing(null);
  }
  function deleteProduct(id: string) {
    setState({ ...state, products: state.products.filter((p) => p.id !== id) });
  }

  if (!state.populated) {
    return (
      <Card>
        <Empty
          icon="box"
          title="Catálogo vazio"
          sub="Adicione produtos manualmente ou popule com dados de exemplo."
          action={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button kind="primary" icon="plus" onClick={() => setEditing({ new: true })}>
                Novo produto
              </Button>
              <Button kind="secondary" icon="sparkle" onClick={() => setState(seedState())}>
                Popular exemplo
              </Button>
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
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou código…"
          />
        </div>
        <select className="select" style={{ width: 'auto', minWidth: 160 }} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas categorias</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <Button kind="primary" icon="plus" onClick={() => setEditing({ new: true })}>
          Novo produto
        </Button>
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
                <th className="num" style={{ width: 80 }}>
                  Mín.
                </th>
                <th className="num" style={{ width: 100 }}>
                  Preço
                </th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{p.name}</span>
                      <span className="mono" style={{ color: 'var(--text-subtle)' }}>
                        {p.sku}
                      </span>
                    </div>
                  </td>
                  <td className="muted">{p.cat}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <StockBar stock={p.stock} min={p.min} />
                      <span className="tabular">{p.stock}</span>
                      {p.stock === 0 ? (
                        <Badge tone="danger">Sem estoque</Badge>
                      ) : p.stock <= p.min ? (
                        <Badge tone="warning">Baixo</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="num tabular muted">{p.min}</td>
                  <td className="num tabular">{BRL(p.price)}</td>
                  <td
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProduct(p.id);
                    }}
                    style={{ textAlign: 'center' }}
                  >
                    <button className="btn btn-ghost btn-sm" title="Excluir">
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <ProductModal
          product={editing}
          onClose={() => setEditing(null)}
          onSave={saveProduct}
          onDelete={(id) => {
            deleteProduct(id);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

interface ProductModalProps {
  product: Product | { new: true };
  onClose: () => void;
  onSave: (p: Product) => void;
  onDelete?: (id: string) => void;
}

function ProductModal({ product, onClose, onSave, onDelete }: ProductModalProps) {
  const existing = 'id' in product ? product : null;
  const isNew = !existing;
  const [f, setF] = useState<Product>({
    id: existing?.id ?? '',
    name: existing?.name ?? '',
    sku: existing?.sku ?? '',
    cat: existing?.cat ?? CATEGORIES[0],
    price: existing?.price ?? 0,
    cost: existing?.cost ?? 0,
    stock: existing?.stock ?? 0,
    min: existing?.min ?? 5,
  });
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim().length > 0 && f.sku.trim().length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Novo produto' : 'Editar produto'}
      footer={
        <>
          {!isNew && onDelete && (
            <Button kind="danger" onClick={() => onDelete(f.id)} icon="trash">
              Excluir
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <Button kind="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button kind="primary" onClick={() => onSave(f)} disabled={!valid}>
            Salvar
          </Button>
        </>
      }
    >
      <Field label="Nome">
        <Input value={f.name} onChange={(v) => set('name', v)} autoFocus placeholder="Ex: Dipirona 500mg c/10" />
      </Field>
      <div className="cols-2">
        <Field label="Código de barras (SKU)">
          <Input value={f.sku} onChange={(v) => set('sku', v)} placeholder="789…" />
        </Field>
        <Field label="Categoria">
          <select className="select" value={f.cat} onChange={(e) => set('cat', e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="cols-3">
        <Field label="Preço (R$)">
          <Input type="number" value={f.price} onChange={(v) => set('price', parseFloat(v) || 0)} />
        </Field>
        <Field label="Custo (R$)">
          <Input type="number" value={f.cost} onChange={(v) => set('cost', parseFloat(v) || 0)} />
        </Field>
        <Field label="Estoque mín.">
          <Input type="number" value={f.min} onChange={(v) => set('min', parseInt(v) || 0)} />
        </Field>
      </div>
      <Field label="Estoque atual">
        <Input type="number" value={f.stock} onChange={(v) => set('stock', parseInt(v) || 0)} />
      </Field>
    </Modal>
  );
}
