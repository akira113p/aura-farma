import { Fragment, useState } from 'react';
import type { AppState, Sale } from '../types';
import { Badge, Card, Empty, Icon } from '../components';
import { BRL } from '../lib/format';

interface ScreenProps {
  state: AppState;
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T12:00:00');
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const y = new Date(t);
  y.setDate(y.getDate() - 1);
  if (dt.toDateString() === t.toDateString()) return 'Hoje';
  if (dt.toDateString() === y.toDateString()) return 'Ontem';
  return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

export function Historico({ state }: ScreenProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const sorted = [...state.sales].sort((a, b) => b.ts.localeCompare(a.ts));
  const grouped = sorted.reduce<Record<string, Sale[]>>((acc, s) => {
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

  return (
    <div className="col" style={{ gap: 14 }}>
      {days.map((d) => {
        const ds = grouped[d];
        const dayTotal = ds.reduce((a, s) => a + s.total, 0);
        const dayItems = ds.reduce((a, s) => a + s.items.reduce((b, it) => b + it.qty, 0), 0);
        return (
          <Card key={d} title={fmtDate(d)} sub={`${ds.length} venda(s) · ${dayItems} item(ns) · ${BRL(dayTotal)}`} flush>
            <div className="list">
              {ds.map((s) => (
                <Fragment key={s.id}>
                  <div className="list-item" style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                    <div>
                      <div className="nm tabular">
                        {new Date(s.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {s.items.length} item(ns)
                      </div>
                      <div className="sub">
                        {s.items.slice(0, 2).map((it) => it.name).join(', ')}
                        {s.items.length > 2 && ` +${s.items.length - 2}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Badge>{s.payment}</Badge>
                      <span className="tabular" style={{ fontWeight: 600, minWidth: 88, textAlign: 'right' }}>
                        {BRL(s.total)}
                      </span>
                      <Icon name={expanded === s.id ? 'chevronUp' : 'chevronDown'} size={14} />
                    </div>
                  </div>
                  {expanded === s.id && (
                    <div style={{ background: 'var(--surface-2)', padding: '12px 24px', borderBottom: '1px solid var(--border)' }}>
                      {s.items.map((it, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                          <span>
                            {it.name} <span className="muted">× {it.qty}</span>
                          </span>
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
