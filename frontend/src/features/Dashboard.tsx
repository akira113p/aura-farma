import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppState, ChartPeriod, SummaryPeriod } from '../types';
import { AIBlock, Badge, Button, Card, Empty, LineChart, Stat, Tabs } from '../components';
import { summarize } from '../services/store';
import { seedData } from '../services/dados';
import { generateAISummary, buildPharmaciaContexto } from '../services/ai';
import { ChatIA } from '../components/ChatIA';
import { buildSeries } from '../lib/series';
import { BRL, fmtInt } from '../lib/format';

interface ScreenProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function Dashboard({ state, setState }: ScreenProps) {
  const summary = useMemo(() => summarize(state), [state]);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [period, setPeriod] = useState<SummaryPeriod>('day');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('month');
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

  useEffect(() => {
    // Regenerating the AI summary is an intentional async side effect keyed on
    // the period / underlying data; the loading flag it sets is expected here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.populated) regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, state.populated]);

  if (!state.populated) {
    return (
      <Card>
        <Empty
          icon="db"
          title="Nenhum dado ainda"
          sub="Popule o sistema com produtos e vendas de exemplo para ver o dashboard em ação."
          action={
            <Button
              kind="primary"
              icon="sparkle"
              onClick={async () => {
                try {
                  setState(await seedData());
                } catch {
                  /* backend unavailable */
                }
              }}
            >
              Popular com dados de exemplo
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <AIBlock
        title={`Resumo ${period === 'day' ? 'do dia' : period === 'week' ? 'da semana' : 'do mês'}`}
        subtitle="Gerado por IA com base nos seus dados"
        loading={aiLoading}
        body={aiText ? aiText.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>) : null}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tabs
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'day', label: 'Dia' },
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mês' },
              ]}
            />
            <Button kind="ghost" size="sm" icon="sparkle" onClick={regenerate} loading={aiLoading}>
              Regerar
            </Button>
          </div>
        }
      />

      <div className="stat-grid">
        <Stat label="Receita" value={BRL(stats.revenue)} delta={period === 'week' ? summary.week.delta : null} sub={`${stats.sales} vendas`} />
        <Stat label="Lucro estimado" value={BRL(stats.revenue - stats.cost)} sub={`Custo ${BRL(stats.cost)}`} />
        <Stat label="Itens vendidos" value={fmtInt(stats.items)} sub={period === 'day' ? 'hoje' : period === 'week' ? 'últimos 7 dias' : 'no mês'} />
        <Stat label="Ticket médio" value={BRL(stats.sales > 0 ? stats.revenue / stats.sales : 0)} sub="por venda" />
      </div>

      <Card
        title="Receita ao longo do tempo"
        sub={chartPeriod === 'day' ? 'Hoje, por hora' : chartPeriod === 'week' ? 'Últimos 7 dias' : chartPeriod === 'month' ? 'Últimos 30 dias' : 'Últimos 12 meses'}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="tabular" style={{ fontWeight: 600, fontSize: 13 }}>
              {BRL(chartTotal)}
            </span>
            <Tabs
              value={chartPeriod}
              onChange={setChartPeriod}
              options={[
                { value: 'day', label: 'Dia' },
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mês' },
                { value: 'year', label: 'Ano' },
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
                    <div className="sub">
                      {p.cat} · {BRL(p.price)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="tabular" style={{ fontWeight: 600 }}>
                      {qty}
                    </div>
                    <div className="sub">unidades</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Repor com urgência"
          sub={summary.lowStock.length + ' produto(s)'}
          action={summary.lowStock.length > 0 && <Badge tone="warning" dot>Baixo</Badge>}
        >
          {summary.lowStock.length === 0 ? (
            <Empty icon="check" title="Tudo em ordem" sub="Nenhum produto abaixo do mínimo." />
          ) : (
            <div className="list" style={{ margin: -16 }}>
              {summary.lowStock.map((p) => (
                <div className="list-item" key={p.id}>
                  <div>
                    <div className="nm">{p.name}</div>
                    <div className="sub">
                      Mín. {p.min} · {p.cat}
                    </div>
                  </div>
                  <Badge tone={p.stock === 0 ? 'danger' : 'warning'}>
                    {p.stock} restante{p.stock !== 1 ? 's' : ''}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ChatIA contexto={buildPharmaciaContexto(state, summary)} title="Converse com a IA sobre a farmácia" />
    </div>
  );
}
