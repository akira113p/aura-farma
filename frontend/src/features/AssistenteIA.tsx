import { useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../components';
import { useAssistenteIA } from '../hooks/useAssistenteIA';
import { usePedidos } from '../hooks/usePedidos';
import { ORDER_STAGES } from '../services/pedidos';
import type { Order } from '../types';

/**
 * Tela "Assistente IA" — composer estilo Gemini sobre os dados da farmácia
 * (portado do Claude Design). Pergunta avulsa (1 por vez, sem contexto das
 * anteriores) pelo fluxo de 2 estágios do backend (/api/ia/ask). Um SELETOR DE
 * ESCOPO define onde a IA pode "enxergar" (menos chance de erro). Histórico das
 * respostas no navegador; título de cada pergunta gerado por IA.
 */
interface Scope {
  key: string;
  label: string;
  icon: IconName;
  suggestions: string[];
}

// Escopos do design, SEM o "Tudo" (removido por enquanto).
const SCOPES: Scope[] = [
  {
    key: 'estoque',
    label: 'Estoque',
    icon: 'box',
    suggestions: ['O que está abaixo do estoque mínimo?', 'Quantos produtos tenho cadastrados?', 'O que devo repor com urgência?'],
  },
  {
    key: 'vendas',
    label: 'Vendas',
    icon: 'cart',
    suggestions: ['Quanto faturei hoje?', 'Qual produto mais vendeu?', 'Qual produto menos vendeu?'],
  },
  {
    key: 'pedidos',
    label: 'Pedidos',
    icon: 'truck',
    suggestions: ['Quais pedidos estão em andamento?', 'Quanto gastei em reposição?', 'Algum pedido foi entregue?'],
  },
  {
    key: 'solicitacoes',
    label: 'Solicitações',
    icon: 'bookmark',
    suggestions: ['O que os clientes andaram pedindo?', 'Vale a pena cadastrar algum item solicitado?'],
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    suggestions: ['Como foi o desempenho da semana?', 'Qual a margem de lucro do mês?', 'Resuma a saúde da farmácia.'],
  },
  {
    key: 'historico',
    label: 'Histórico',
    icon: 'history',
    suggestions: ['Quantas vendas foram registradas?', 'Qual foi o ticket médio?', 'Quando foi a última venda?'],
  },
  {
    key: 'contagem',
    label: 'Contagem',
    icon: 'list',
    suggestions: ['Quando foi a última contagem?', 'Houve divergência no último inventário?'],
  },
  {
    key: 'relatorios',
    label: 'Relatórios',
    icon: 'chart',
    suggestions: ['Qual foi a receita e o lucro do mês?', 'Quais categorias vendem mais?', 'O que destacar no relatório do mês?'],
  },
];
const getScope = (key: string): Scope => SCOPES.find((s) => s.key === key) ?? SCOPES[0];

const asstTime = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');

/** Pedidos vivem no navegador — enviados ao backend só no escopo "pedidos". */
function buildPedidosPayload(orders: Order[]) {
  return orders.map((o) => ({
    id: o.id.toUpperCase(),
    fornecedor: o.supplier,
    estagio: o.received ? 'Recebido' : ORDER_STAGES[o.stage]?.label ?? 'Em andamento',
    recebido: o.received,
    itens: o.items.length,
    total: o.total,
  }));
}

/* ---- mini-markdown: **negrito**, • listas, | tabelas |, # títulos ---- */
function renderInline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyBase}-${i}`}>{p}</span>
    ),
  );
}

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; level: number; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'table'; header: string[]; bodyRows: string[][] };

function AnswerMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'p', text: para.join(' ') });
      para = [];
    }
  };
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (isRow(line)) {
      flushPara();
      const rows: string[] = [];
      while (i < lines.length && isRow(lines[i])) {
        rows.push(lines[i]);
        i++;
      }
      const cells = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const header = cells(rows[0]);
      const bodyRows = rows.slice(1).filter((r) => !/^[\s|:-]+$/.test(r)).map(cells);
      blocks.push({ type: 'table', header, bodyRows });
      continue;
    }
    if (line.trim() === '') {
      flushPara();
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }
    if (/^\s*[•\-*]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*[•\-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[•\-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flushPara();

  return (
    <>
      {blocks.map((b, bi) => {
        if (b.type === 'p') return <p key={bi}>{renderInline(b.text, `p${bi}`)}</p>;
        if (b.type === 'h') {
          const lvl = Math.min(b.level, 4);
          return (
            <div key={bi} className={`asst-md-h asst-md-h${lvl}`}>
              {renderInline(b.text, `h${bi}`)}
            </div>
          );
        }
        if (b.type === 'ul')
          return (
            <ul key={bi} style={{ margin: '0 0 10px', paddingLeft: 18, lineHeight: 1.6 }}>
              {b.items.map((it, ii) => (
                <li key={ii}>{renderInline(it, `li${bi}${ii}`)}</li>
              ))}
            </ul>
          );
        return (
          <table className="asst-md-table" key={bi}>
            <thead>
              <tr>
                {b.header.map((h, hi) => (
                  <th key={hi}>{renderInline(h, `th${bi}${hi}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.bodyRows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{renderInline(c, `td${bi}${ri}${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </>
  );
}

export function AssistenteIA() {
  const { entries, active, loading, error, ask, select, remove, nova } = useAssistenteIA();
  const [orders] = usePedidos();
  const [draft, setDraft] = useState('');
  const [scope, setScope] = useState('estoque');
  const [pending, setPending] = useState<{ q: string; scopeLabel: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentScope = getScope(scope);
  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());

  async function submit(text?: string) {
    const q = (text ?? draft).trim();
    if (!q || loading) return;
    setDraft('');
    const sc = getScope(scope);
    setPending({ q, scopeLabel: sc.label });
    const pedidosPayload = sc.key === 'pedidos' ? buildPedidosPayload(orders) : undefined;
    await ask(q, sc.key, sc.label, pedidosPayload);
    setPending(null);
  }

  function newQuestion() {
    nova();
    setDraft('');
    setPending(null);
    focusInput();
  }

  // Pergunta/escopo a exibir na conversa: a pendente (enquanto carrega) ou a ativa.
  const showConvo = loading ? !!pending : !!active;
  const convoQ = loading ? pending?.q : active?.pergunta;
  const convoScopeLabel = loading ? pending?.scopeLabel : active?.scope ? active?.scopeLabel : undefined;

  const composer = (
    <div className="asst-composer">
      <div className="asst-scopes" role="tablist" aria-label="Sobre o que perguntar">
        {SCOPES.map((sc) => (
          <button
            key={sc.key}
            className={'asst-scope' + (sc.key === scope ? ' active' : '')}
            onClick={() => {
              setScope(sc.key);
              focusInput();
            }}
            aria-pressed={sc.key === scope}
          >
            <Icon name={sc.icon} size={14} className="" />
            {sc.label}
          </button>
        ))}
      </div>
      <div className="asst-pill">
        <button className="asst-iconbtn is-plus" title="Nova pergunta" onClick={newQuestion}>
          <Icon name="plus" size={18} className="" />
        </button>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          placeholder={`Pergunte sobre ${currentScope.label.toLowerCase()}…`}
          disabled={loading}
        />
        <button className="asst-iconbtn" title="Falar" tabIndex={-1} type="button">
          <Icon name="mic" size={18} className="" />
        </button>
        <button className="asst-send" onClick={() => void submit()} disabled={loading || !draft.trim()} title="Perguntar">
          <Icon name="send" size={17} className="" />
        </button>
      </div>
      <div className="asst-help">
        A IA vai consultar apenas os dados de <strong>{currentScope.label}</strong>. Cada pergunta é respondida sozinha. As
        respostas ficam no histórico, só neste navegador.
      </div>
    </div>
  );

  return (
    <div className="asst">
      <div className="asst-main">
        <div className="asst-glow" />

        {showConvo ? (
          <>
            <div className="asst-convo">
              <div className="asst-q-wrap">
                {convoScopeLabel && (
                  <span className="asst-q-scope">
                    <Icon name={getScope(loading ? scope : active?.scope ?? scope).icon} size={12} className="" />
                    {convoScopeLabel}
                  </span>
                )}
                <div className="asst-q">{convoQ}</div>
              </div>
              <div className="asst-a">
                <span className="asst-avatar">
                  <Icon name="sparkle" size={16} className="" />
                </span>
                <div className="asst-a-body">
                  {loading ? (
                    <div className="asst-typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : (
                    <AnswerMarkdown text={active?.resposta ?? ''} />
                  )}
                  {!loading && active && (
                    <div className="asst-answer-actions">
                      <button className="btn btn-ghost btn-sm" onClick={newQuestion}>
                        <Icon name="edit" size={13} />
                        Nova pergunta
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {composer}
          </>
        ) : (
          <div className="asst-hero">
            <div>
              <h2 className="asst-greet">Em que posso ajudar na farmácia?</h2>
              <p className="asst-greet-sub">
                Escolha uma área e pergunte — eu consulto seus dados para responder.
              </p>
            </div>
            {composer}
            {error && (
              <div className="chat-ia-error" style={{ borderTop: 'none', borderRadius: 'var(--radius-sm)' }}>
                {error}
              </div>
            )}
            <div className="asst-chips">
              {currentScope.suggestions.map((s) => (
                <button className="asst-chip" key={s} onClick={() => void submit(s)}>
                  <Icon name="sparkle" size={14} className="" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {showConvo && error && (
          <div className="chat-ia-error" style={{ borderRadius: 'var(--radius-sm)' }}>
            {error}
          </div>
        )}
      </div>

      <aside className="asst-history">
        <div className="asst-history-head">
          <div className="t">Histórico</div>
          <div className="c">{entries.length} pergunta(s)</div>
        </div>
        {entries.length === 0 ? (
          <div className="asst-history-empty">Suas perguntas aparecem aqui.</div>
        ) : (
          <div className="asst-history-list">
            {entries.map((h) => (
              <div
                key={h.id}
                className={'asst-hist-item' + (h.id === active?.id && !loading ? ' active' : '')}
                onClick={() => {
                  select(h.id);
                  focusInput();
                }}
              >
                <div className="hi-main">
                  <div className="hi-title">{h.titulo}</div>
                  <div className="hi-time">{asstTime(h.createdAt)}</div>
                </div>
                <button
                  className="asst-hist-del"
                  title="Excluir"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(h.id);
                  }}
                >
                  <Icon name="trash" size={14} className="" />
                </button>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
