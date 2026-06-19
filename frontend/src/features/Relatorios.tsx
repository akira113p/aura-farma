import { useEffect, useMemo, useState } from 'react';
import type { AppState, SummaryPeriod } from '../types';
import { AIBlock, Badge, Card, Empty, LineChart, Stat, Tabs } from '../components';
import { summarize } from '../services/store';
import { generateAISummary } from '../services/ai';
import { buildSeries } from '../lib/series';
import { BRL, fmtInt } from '../lib/format';

interface ScreenProps {
  state: AppState;
}

export function Relatorios({ state }: ScreenProps) {
  const [period, setPeriod] = useState<SummaryPeriod>('week');
  const summary = useMemo(() => summarize(state), [state]);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const stats = summary[period];

  useEffect(() => {
    if (!state.populated) return;
    let cancel = false;
    // Intentional async data-fetch effect: reset loading state, then resolve the
    // AI summary for the selected period. The synchronous resets are expected.
    /* eslint-disable react-hooks/set-state-in-effect */
    setAiLoading(true);
    setAiText(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    (async () => {
      const text = await generateAISummary(period, stats, summary.lowStock, summary.topProducts, state.requests.length);
      if (!cancel) {
        setAiText(text);
        setAiLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            { value: 'day', label: 'Hoje' },
            { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mês' },
          ]}
        />
        <div className="muted" style={{ fontSize: 13 }}>
          Período: {period === 'day' ? 'últimas 24h' : period === 'week' ? 'últimos 7 dias' : 'últimos 30 dias'}
        </div>
      </div>

      <AIBlock
        title={`Análise ${period === 'day' ? 'diária' : period === 'week' ? 'semanal' : 'mensal'}`}
        loading={aiLoading}
        body={aiText ? aiText.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>) : null}
      />

      <div className="stat-grid">
        <Stat label="Receita" value={BRL(stats.revenue)} sub={`${stats.sales} vendas`} />
        <Stat label="Custo das vendas" value={BRL(stats.cost)} sub="Estimado pelo cadastro" />
        <Stat
          label="Lucro estimado"
          value={BRL(stats.revenue - stats.cost)}
          sub={`Margem ${stats.revenue > 0 ? Math.round(((stats.revenue - stats.cost) / stats.revenue) * 100) : 0}%`}
        />
        <Stat label="Itens vendidos" value={fmtInt(stats.items)} sub={`Ticket médio ${BRL(stats.sales > 0 ? stats.revenue / stats.sales : 0)}`} />
      </div>

      <Card title="Receita" sub={period === 'day' ? 'Hoje, por hora' : period === 'week' ? 'Últimos 7 dias' : 'Últimos 30 dias'}>
        <LineChart data={series} />
      </Card>

      <div className="cols-2">
        <Card title="Top produtos do período" flush>
          {summary.topProducts.length === 0 ? (
            <Empty icon="chart" title="Sem dados" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="num">Qtd</th>
                  <th className="num">Receita</th>
                </tr>
              </thead>
              <tbody>
                {summary.topProducts.map(({ p, qty }) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="num tabular">{qty}</td>
                    <td className="num tabular">{BRL(qty * p.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Sugestões da IA" sub="Possíveis novos produtos" flush>
          {state.requests.length === 0 ? (
            <Empty icon="bookmark" title="Sem solicitações" />
          ) : (
            <div className="list">
              {[...state.requests]
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
                .map((r) => (
                  <div className="list-item" key={r.id}>
                    <div>
                      <div className="nm">{r.name}</div>
                      <div className="sub">Pedido por clientes {r.count}×</div>
                    </div>
                    <Badge tone={r.count >= 4 ? 'warning' : 'info'}>{r.count >= 4 ? 'Alta demanda' : 'Considerar'}</Badge>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
