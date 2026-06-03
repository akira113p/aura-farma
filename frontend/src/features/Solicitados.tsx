import { useState } from 'react';
import type { AppState, ProductRequest } from '../types';
import { Badge, Button, Card, Empty, Field, Icon, Input, Modal } from '../components';
import { CATEGORIES } from '../data/seed';
import { todayISO } from '../lib/format';

interface ScreenProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function Solicitados({ state, setState }: ScreenProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', note: '' });

  function addRequest() {
    if (!form.name.trim()) return;
    const existing = state.requests.find((r) => r.name.toLowerCase() === form.name.trim().toLowerCase());
    if (existing) {
      setState({
        ...state,
        requests: state.requests.map((r) =>
          r.id === existing.id ? { ...r, count: r.count + 1, date: todayISO() } : r,
        ),
      });
    } else {
      const r: ProductRequest = {
        id: 'r' + Date.now(),
        name: form.name.trim(),
        note: form.note.trim(),
        count: 1,
        date: todayISO(),
      };
      setState({ ...state, requests: [r, ...state.requests] });
    }
    setForm({ name: '', note: '' });
    setAdding(false);
  }
  function bump(id: string) {
    setState({
      ...state,
      requests: state.requests.map((r) => (r.id === id ? { ...r, count: r.count + 1, date: todayISO() } : r)),
    });
  }
  function remove(id: string) {
    setState({ ...state, requests: state.requests.filter((r) => r.id !== id) });
  }
  function promote(req: ProductRequest) {
    const id = 'p' + Date.now();
    const p = { id, sku: 'novo-' + id.slice(-4), name: req.name, cat: CATEGORIES[0], price: 0, cost: 0, stock: 0, min: 3 };
    setState({
      ...state,
      products: [...state.products, p],
      requests: state.requests.filter((r) => r.id !== req.id),
      activity: [
        { id: 'a' + Date.now(), kind: 'promote', text: `Solicitado adicionado ao catálogo: ${req.name}`, ts: new Date().toISOString() },
        ...state.activity,
      ].slice(0, 50),
    });
  }

  const sorted = [...state.requests].sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="toolbar">
        <div className="muted">{state.requests.length} produto(s) solicitado(s) por clientes</div>
        <div style={{ flex: 1 }} />
        <Button kind="primary" icon="plus" onClick={() => setAdding(true)}>
          Registrar solicitação
        </Button>
      </div>

      <Card flush>
        {sorted.length === 0 ? (
          <Empty
            icon="bookmark"
            title="Nenhuma solicitação ainda"
            sub="Sempre que um cliente pedir algo que você não tem, registre aqui."
            action={
              <Button kind="primary" icon="plus" onClick={() => setAdding(true)}>
                Registrar solicitação
              </Button>
            }
          />
        ) : (
          <div className="list">
            {sorted.map((r) => (
              <div className="list-item" key={r.id} style={{ gridTemplateColumns: '1fr auto auto' }}>
                <div>
                  <div className="nm">{r.name}</div>
                  {r.note && <div className="sub">{r.note}</div>}
                  <div className="sub" style={{ marginTop: 4 }}>
                    Último pedido em {new Date(r.date).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Badge tone={r.count >= 5 ? 'warning' : r.count >= 3 ? 'info' : 'neutral'}>{r.count} pedido(s)</Badge>
                  <button className="btn btn-ghost btn-sm" title="Mais um pedido" onClick={() => bump(r.id)}>
                    <Icon name="plus" size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button kind="secondary" size="sm" onClick={() => promote(r)}>
                    Adicionar ao catálogo
                  </Button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(r.id)} title="Remover">
                    <Icon name="trash" size={13} />
                  </button>
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
            <Button kind="ghost" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button kind="primary" onClick={addRequest} disabled={!form.name.trim()}>
              Registrar
            </Button>
          </>
        }
      >
        <Field label="O que o cliente pediu?">
          <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoFocus placeholder="Ex: Pomada para queimadura" />
        </Field>
        <Field label="Observação (opcional)">
          <textarea
            className="textarea"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Detalhes do pedido, perfil do cliente, etc."
          />
        </Field>
      </Modal>
    </>
  );
}
