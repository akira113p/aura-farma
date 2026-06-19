import { useState } from 'react';
import { AIBlock, Button, Card, Empty, Icon } from '../components';
import { useAssistenteIA } from '../hooks/useAssistenteIA';

/**
 * Tela "Assistente IA": perguntas avulsas sobre a aplicação (1 por vez, sem
 * histórico de conversa). Cada resposta vira uma entrada no histórico (título
 * gerado por IA) que pode ser reaberta. Usa o fluxo de 2 estágios do backend
 * (/api/ia/ask): IA pequena decide os dados → backend busca (escopado no
 * usuário) → IA principal responde.
 */
const SUGESTOES = [
  'Qual produto menos vendeu hoje?',
  'O que devo repor com urgência?',
  'Em qual categoria estou perdendo margem?',
  'Qual foi meu ticket médio na semana?',
];

const fmtData = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function AssistenteIA() {
  const { entries, active, loading, error, ask, select, remove, nova } = useAssistenteIA();
  const [input, setInput] = useState('');

  function submit() {
    const text = input;
    setInput('');
    void ask(text);
  }

  return (
    <div className="ia-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <Card>
          <form
            style={{ display: 'flex', gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              className="input"
              style={{ flex: 1 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte algo sobre a farmácia… ex: qual produto menos vendeu hoje?"
              disabled={loading}
              autoFocus
            />
            <Button kind="primary" icon="sparkle" type="submit" loading={loading} disabled={loading || !input.trim()}>
              Perguntar
            </Button>
          </form>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Cada pergunta é respondida sozinha (sem contexto das anteriores). A IA consulta os dados da sua conta para
            responder. As respostas ficam no histórico, só neste navegador.
          </div>
          {!active && !loading && (
            <div className="chat-ia-suggest" style={{ marginTop: 12 }}>
              {SUGESTOES.map((s) => (
                <button key={s} className="chat-chip" onClick={() => void ask(s)} disabled={loading}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {error && (
            <div className="chat-ia-error" style={{ borderTop: 'none', marginTop: 12, borderRadius: 'var(--radius-sm)' }}>
              {error}
            </div>
          )}
        </Card>

        {loading ? (
          <AIBlock title="Pensando…" subtitle="Consultando seus dados e analisando" loading />
        ) : active ? (
          <AIBlock
            title={active.titulo}
            subtitle={active.pergunta}
            body={active.resposta.split(/\n\n+/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            action={
              <Button kind="ghost" size="sm" icon="plus" onClick={nova}>
                Nova
              </Button>
            }
          />
        ) : (
          <Card>
            <Empty
              icon="sparkle"
              title="Pergunte algo à IA"
              sub="Faça uma pergunta sobre vendas, estoque, margens ou reposição. A resposta aparece aqui e fica salva no histórico."
            />
          </Card>
        )}
      </div>

      <aside style={{ minWidth: 0 }}>
        <Card title="Histórico" sub={`${entries.length} pergunta(s)`} flush>
          {entries.length === 0 ? (
            <Empty icon="history" title="Sem perguntas ainda" sub="Suas perguntas anteriores aparecem aqui." />
          ) : (
            <div className="chat-history" style={{ maxHeight: 'none', borderBottom: 'none', background: 'transparent' }}>
              {entries.map((e) => (
                <div
                  key={e.id}
                  className={'chat-history-item' + (e.id === active?.id ? ' active' : '')}
                  onClick={() => select(e.id)}
                >
                  <div className="chat-history-main">
                    <div className="chat-history-title">{e.titulo}</div>
                    <div className="chat-history-date">{fmtData(e.createdAt)}</div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Apagar"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      remove(e.id);
                    }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </aside>
    </div>
  );
}
