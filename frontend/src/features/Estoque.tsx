import { useEffect, useState } from 'react';
import type { AppState, CatalogMed, Product } from '../types';
import { Badge, Button, Card, Empty, Field, Icon, Input, Modal, StockBar } from '../components';
import { createProduct, removeProduct, seedData, updateProduct } from '../services/dados';
import { medicamentosApi } from '../services/medicamentos';
import { ApiError } from '../lib/apiClient';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { CATEGORIES } from '../data/seed';
import { BRL } from '../lib/format';

interface ScreenProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  flash: (msg: string) => void;
}

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Operação falhou. Tente novamente.');

/** Either an existing product (edit) or the "new product" sentinel. */
type Editing = Product | { new: true } | null;

/** lowercase + strip accents, so "analgesico" matches "Analgésico". */
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Split a therapeutic-class string into a few clean tags. */
function tagsFromClasse(classe: string): string[] {
  return classe
    .split(/[,/]|\s-\s|-/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
}

export function Estoque({ state, setState, flash }: ScreenProps) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const [seeding, setSeeding] = useState(false);

  const products = state.products;
  const nq = norm(search);
  const filtered = products.filter(
    (p) =>
      (!cat || p.cat === cat) &&
      (!nq ||
        norm(p.name).includes(nq) ||
        p.sku.includes(search.trim()) ||
        norm(p.principioAtivo ?? '').includes(nq) ||
        (p.tags ?? []).some((t) => norm(t).includes(nq))),
  );

  async function saveProduct(p: Product) {
    try {
      setState(p.id ? await updateProduct(state, p) : await createProduct(state, p));
      setEditing(null);
    } catch (e) {
      flash(errMsg(e));
    }
  }
  async function deleteProduct(id: string) {
    try {
      setState(await removeProduct(state, id));
    } catch (e) {
      flash(errMsg(e));
    }
  }
  async function popularExemplo() {
    setSeeding(true);
    try {
      setState(await seedData());
    } catch (e) {
      flash(errMsg(e));
    } finally {
      setSeeding(false);
    }
  }

  if (!state.populated) {
    return (
      <Card>
        <Empty
          icon="box"
          title="Estoque vazio"
          sub="Busque medicamentos reais pelo nome (mesmo com erro de digitação) ou popule com dados de exemplo."
          action={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button kind="primary" icon="plus" onClick={() => setEditing({ new: true })}>
                Adicionar medicamento
              </Button>
              <Button kind="secondary" icon="sparkle" onClick={popularExemplo} loading={seeding}>
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
            placeholder="Buscar por nome, código, princípio ativo ou tag…"
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
          Adicionar medicamento
        </Button>
      </div>

      <Card flush>
        {filtered.length === 0 ? (
          <Empty
            icon="search"
            title="Nenhum resultado"
            sub="Tente outros termos de busca."
            action={
              (search || cat) && (
                <Button
                  kind="secondary"
                  onClick={() => {
                    setSearch('');
                    setCat('');
                  }}
                >
                  Limpar filtros
                </Button>
              )
            }
          />
        ) : (
          <table className="table prod-table">
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
                <tr key={p.id} className="prod-row" onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
                  <td className="cell-name">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{p.name}</span>
                      <span className="mono" style={{ color: 'var(--text-subtle)' }}>
                        {p.sku}
                      </span>
                      {(p.tags ?? []).length > 0 && (
                        <span className="prod-tags">
                          {(p.tags ?? []).slice(0, 2).map((t) => (
                            <Badge key={t}>{t}</Badge>
                          ))}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="muted" data-label="Categoria">
                    {p.cat}
                  </td>
                  <td data-label="Estoque">
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
                  <td className="num tabular muted" data-label="Mín.">
                    {p.min}
                  </td>
                  <td className="num tabular" data-label="Preço">
                    {BRL(p.price)}
                  </td>
                  <td
                    className="cell-actions"
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
    validade: existing?.validade,
    principioAtivo: existing?.principioAtivo,
    tags: existing?.tags,
  });
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim().length > 0 && f.sku.trim().length > 0;

  function pickFromCatalog(m: CatalogMed) {
    setF((p) => ({
      ...p,
      name: m.nome,
      principioAtivo: m.principioAtivo || undefined,
      tags: m.classeTerapeutica ? tagsFromClasse(m.classeTerapeutica) : p.tags,
    }));
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Adicionar medicamento' : 'Editar medicamento'}
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
      <CatalogSearch onPick={pickFromCatalog} />

      <Field label="Nome">
        <Input value={f.name} onChange={(v) => set('name', v)} placeholder="Ex: Dipirona 500mg c/10" />
      </Field>
      {(f.principioAtivo || (f.tags ?? []).length > 0) && (
        <div className="med-meta">
          {f.principioAtivo && (
            <span className="med-meta-line">
              <span className="muted">Princípio ativo:</span> {f.principioAtivo}
            </span>
          )}
          {(f.tags ?? []).length > 0 && (
            <span className="prod-tags">
              {(f.tags ?? []).map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </span>
          )}
        </div>
      )}
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
      <div className="cols-2">
        <Field label="Estoque atual">
          <Input type="number" value={f.stock} onChange={(v) => set('stock', parseInt(v) || 0)} />
        </Field>
        <Field label="Validade">
          <input
            className="input"
            type="date"
            value={f.validade ?? ''}
            onChange={(e) => set('validade', e.target.value || undefined)}
          />
        </Field>
      </div>
    </Modal>
  );
}

/** Typo-tolerant catalog typeahead that prefills the form on pick. */
function CatalogSearch({ onPick }: { onPick: (m: CatalogMed) => void }) {
  const [q, setQ] = useState('');
  const dq = useDebouncedValue(q, 250);
  const [results, setResults] = useState<CatalogMed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = dq.trim();
    let cancelled = false;
    // Debounced catalog fetch — a legitimate data-fetching effect that syncs the
    // dropdown with the backend. The set-state-in-effect rule guards against
    // cascading renders from local state; here the state mirrors an async
    // external source, so we opt out as elsewhere in this codebase.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (term.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    medicamentosApi
      .busca(term)
      .then((r) => {
        if (cancelled) return;
        setResults(r.results);
        setOpen(true);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Não foi possível buscar no catálogo — verifique se o servidor está ativo.');
        setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dq]);

  return (
    <div className="catalog-search">
      <Field label="Buscar medicamento real (catálogo ANVISA)">
        <div className="search">
          <Icon name="search" size={14} />
          <input
            className="input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            placeholder="Ex: dipirona, amoxicilina… (tolera erro de digitação)"
            autoFocus
          />
          {loading && <span className="btn-spinner" aria-label="Buscando" />}
        </div>
      </Field>
      {error && <div className="field-error">{error}</div>}
      {open && results.length > 0 && (
        <ul className="catalog-results">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="catalog-result"
                onClick={() => {
                  onPick(m);
                  setOpen(false);
                  setQ('');
                  setResults([]);
                }}
              >
                <span className="cr-name">{m.nome}</span>
                <span className="cr-sub">
                  {[m.principioAtivo, m.empresa].filter(Boolean).join(' · ') || 'Medicamento'}
                </span>
                {m.classeTerapeutica && <span className="cr-tag">{m.classeTerapeutica}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && !error && dq.trim().length >= 2 && results.length === 0 && (
        <div className="catalog-empty muted">Nenhum medicamento encontrado para “{dq.trim()}”.</div>
      )}
    </div>
  );
}
