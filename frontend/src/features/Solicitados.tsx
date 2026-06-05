import { useState } from 'react';
import type { AppState, ProductRequest } from '../types';
import { Badge, Button, Card, Empty, Field, Icon, Input, Modal } from '../components';
import { addRequest, bumpRequest, promoteRequest, removeRequest } from '../services/dados';
import { ApiError } from '../lib/apiClient';

interface ScreenProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  flash: (msg: string) => void;
}

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Operação falhou. Tente novamente.');

export function Solicitados({ state, setState, flash }: ScreenProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', note: '' });

  async function handleAdd() {
    if (!form.name.trim()) return;
    try {
      setState(await addRequest(state, form.name, form.note));
      setForm({ name: '', note: '' });
      setAdding(false);
    } catch (e) {
      flash(errMsg(e));
    }
  }
  async function handleBump(id: string) {
    try {
      setState(await bumpRequest(state, id));
    } catch (e) {
      flash(errMsg(e));
    }
  }
  async function handleRemove(id: string) {
    try {
      setState(await removeRequest(state, id));
    } catch (e) {
      flash(errMsg(e));
    }
  }
  async function handlePromote(req: ProductRequest) {
    try {
      setState(await promoteRequest(state, req));
      flash(`"${req.name}" adicionado ao catálogo`);
    } catch (e) {
      flash(errMsg(e));
    }
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
                  <button className="btn btn-ghost btn-sm" title="Mais um pedido" onClick={() => handleBump(r.id)}>
                    <Icon name="plus" size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button kind="secondary" size="sm" onClick={() => handlePromote(r)}>
                    Adicionar ao catálogo
                  </Button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRemove(r.id)} title="Remover">
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
            <Button kind="primary" onClick={handleAdd} disabled={!form.name.trim()}>
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
