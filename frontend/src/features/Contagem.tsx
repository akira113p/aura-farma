import { useState } from 'react';
import type { AppState, CountAdjustment } from '../types';
import { Badge, Button, Card, Empty, Icon } from '../components';

interface ScreenProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  flash: (msg: string) => void;
}

interface CountLine {
  pid: string;
  expected: number;
  counted: string;
}
interface CountSession {
  products: CountLine[];
}

export function Contagem({ state, setState, flash }: ScreenProps) {
  const [session, setSession] = useState<CountSession | null>(null);
  const [filter, setFilter] = useState('');

  function start() {
    setSession({
      products: state.products.map((p) => ({ pid: p.id, expected: p.stock, counted: '' })),
    });
  }

  function setCounted(pid: string, v: string) {
    setSession((s) =>
      s ? { ...s, products: s.products.map((x) => (x.pid === pid ? { ...x, counted: v } : x)) } : s,
    );
  }

  function apply() {
    if (!session) return;
    const adjustments: CountAdjustment[] = session.products
      .filter((x) => x.counted !== '' && !isNaN(parseInt(x.counted)))
      .map((x) => ({ pid: x.pid, newStock: parseInt(x.counted), diff: parseInt(x.counted) - x.expected }));
    const adjMap = Object.fromEntries(adjustments.map((a) => [a.pid, a.newStock]));
    const products = state.products.map((p) => (adjMap[p.id] !== undefined ? { ...p, stock: adjMap[p.id] } : p));
    const totalDiff = adjustments.reduce((a, x) => a + x.diff, 0);
    setState({
      ...state,
      products,
      counts: [{ id: 'c' + Date.now(), ts: new Date().toISOString(), adjustments, total: adjustments.length }, ...state.counts],
      activity: [
        {
          id: 'a' + Date.now(),
          kind: 'count',
          text: `Contagem aplicada — ${adjustments.length} ajuste(s), diferença ${totalDiff > 0 ? '+' : ''}${totalDiff}`,
          ts: new Date().toISOString(),
        },
        ...state.activity,
      ].slice(0, 50),
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
              <div className="muted" style={{ fontSize: 13 }}>
                Percorra a farmácia e registre o estoque físico de cada produto. Ao final, aplique os ajustes para alinhar o sistema com a
                realidade.
              </div>
            </div>
            <Button kind="primary" icon="list" onClick={start}>
              Começar contagem
            </Button>
          </div>
        </Card>

        <Card title="Contagens anteriores" sub={state.counts.length + ' realizada(s)'} flush>
          {state.counts.length === 0 ? (
            <Empty icon="list" title="Nenhuma contagem ainda" />
          ) : (
            <div className="list">
              {state.counts.slice(0, 10).map((c) => {
                const totalDiff = c.adjustments.reduce((a, x) => a + x.diff, 0);
                return (
                  <div className="list-item" key={c.id}>
                    <div>
                      <div className="nm">{new Date(c.ts).toLocaleString('pt-BR')}</div>
                      <div className="sub">{c.adjustments.length} ajuste(s) aplicado(s)</div>
                    </div>
                    <Badge tone={totalDiff === 0 ? 'success' : totalDiff > 0 ? 'info' : 'warning'}>
                      Diferença {totalDiff > 0 ? '+' : ''}
                      {totalDiff}
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

  const filtered = session.products.filter((x) => {
    const p = state.products.find((p) => p.id === x.pid);
    return !filter || (p && p.name.toLowerCase().includes(filter.toLowerCase()));
  });
  const counted = session.products.filter((x) => x.counted !== '' && !isNaN(parseInt(x.counted)));

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={14} />
          <input className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar produto…" />
        </div>
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 13 }}>
          {counted.length} de {session.products.length} contados
        </span>
        <Button kind="ghost" onClick={() => setSession(null)}>
          Cancelar
        </Button>
        <Button kind="primary" onClick={apply} disabled={counted.length === 0} icon="check">
          Aplicar ajustes ({counted.length})
        </Button>
      </div>

      <Card flush>
        <table className="table">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="num" style={{ width: 110 }}>
                Sistema
              </th>
              <th className="num" style={{ width: 140 }}>
                Contado
              </th>
              <th className="num" style={{ width: 110 }}>
                Diferença
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((x) => {
              const p = state.products.find((p) => p.id === x.pid);
              if (!p) return null;
              const cv = parseInt(x.counted);
              const diff = !isNaN(cv) ? cv - x.expected : null;
              return (
                <tr key={x.pid}>
                  <td>
                    <div>{p.name}</div>
                    <div className="mono" style={{ color: 'var(--text-subtle)' }}>
                      {p.sku}
                    </div>
                  </td>
                  <td className="num tabular muted">{x.expected}</td>
                  <td className="num">
                    <input
                      className="input"
                      style={{ width: 100, textAlign: 'right', marginLeft: 'auto' }}
                      type="number"
                      value={x.counted}
                      onChange={(e) => setCounted(x.pid, e.target.value)}
                      placeholder="—"
                    />
                  </td>
                  <td className="num tabular">
                    {diff === null ? (
                      <span className="subtle">—</span>
                    ) : diff === 0 ? (
                      <Badge tone="success">igual</Badge>
                    ) : (
                      <Badge tone={diff > 0 ? 'info' : 'warning'}>
                        {diff > 0 ? '+' : ''}
                        {diff}
                      </Badge>
                    )}
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
