import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useChatIA } from '../hooks/useChatIA';
import { askAI, chatWithAI, type ChatMsg } from '../services/ai';

/**
 * Chat com a IA sobre a farmácia, com histórico de conversas (EXPERIMENTAL).
 *
 * Autocontido: recebe um `contexto` (snapshot já calculado) e cuida de tudo —
 * múltiplas conversas em localStorage (via useChatIA), envio, loading, erro e a
 * lista de conversas antigas. Fácil de remover: tirar os mounts + apagar os
 * arquivos de chat.
 */
interface ChatIAProps {
  /**
   * Estratégia de dados:
   * - 'ask'  → backend decide e busca os dados (2 estágios, mais barato). Não usa `contexto`.
   * - 'chat' → manda o `contexto` completo de uma vez.
   */
  mode?: 'ask' | 'chat';
  /** Snapshot da farmácia (só no mode 'chat'; ver buildPharmaciaContexto). */
  contexto?: unknown;
  title?: string;
}

const SUGESTOES = [
  'Como está a saúde da minha farmácia?',
  'O que eu devo repor com urgência?',
  'Onde estou perdendo margem?',
];

const fmtData = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function ChatIA({ mode = 'chat', contexto, title = 'Converse com a IA' }: ChatIAProps) {
  // Define como falar com a IA: 'ask' (backend busca os dados) ou 'chat' (contexto completo).
  const sender = useCallback(
    (msgs: ChatMsg[]) => (mode === 'ask' ? askAI(msgs) : chatWithAI(msgs, contexto)),
    [mode, contexto],
  );
  const { conversations, active, loading, error, send, newConversation, selectConversation, deleteConversation } =
    useChatIA(sender);
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const messages = active?.messages ?? [];

  // Rola para a última mensagem quando a conversa cresce ou enquanto carrega.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, loading]);

  function submit() {
    const text = input;
    setInput('');
    void send(text);
  }

  return (
    <div className="chat-ia">
      <div className="chat-ia-head">
        <div className="ai-spark">
          <Icon name="sparkle" size={11} />
        </div>
        <span className="ai-title">{title}</span>
        <span className="ai-tag">IA · em teste</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            className={'btn btn-ghost btn-sm' + (showHistory ? ' active' : '')}
            onClick={() => setShowHistory((v) => !v)}
            title="Conversas anteriores"
          >
            <Icon name="history" size={13} />
            Histórico{conversations.length > 0 ? ` (${conversations.length})` : ''}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              newConversation();
              setShowHistory(false);
            }}
            title="Começar uma nova conversa"
          >
            <Icon name="plus" size={13} />
            Nova
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="chat-history">
          {conversations.length === 0 ? (
            <div className="muted" style={{ padding: '12px 16px', fontSize: 12 }}>
              Nenhuma conversa salva ainda. Suas conversas ficam só neste navegador.
            </div>
          ) : (
            conversations.map((c) => {
              const perguntas = c.messages.filter((m) => m.role === 'user').length;
              return (
                <div
                  key={c.id}
                  className={'chat-history-item' + (c.id === active?.id ? ' active' : '')}
                  onClick={() => {
                    selectConversation(c.id);
                    setShowHistory(false);
                  }}
                >
                  <div className="chat-history-main">
                    <div className="chat-history-title">{c.title}</div>
                    <div className="chat-history-date">
                      {fmtData(c.updatedAt)} · {perguntas} pergunta{perguntas === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Apagar esta conversa"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(c.id);
                    }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="chat-ia-body" ref={bodyRef}>
        {messages.length === 0 ? (
          <div className="chat-ia-empty">
            <p className="muted" style={{ marginTop: 0 }}>
              {active
                ? 'Conversa nova. Pergunte algo sobre a farmácia.'
                : 'Pergunte sobre o desempenho, estoque e margens da sua farmácia. A IA usa os seus dados atuais.'}
            </p>
            <div className="chat-ia-suggest">
              {SUGESTOES.map((s) => (
                <button key={s} className="chat-chip" onClick={() => void send(s)} disabled={loading}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={'chat-msg ' + m.role}>
              {m.content.split(/\n\n+/).map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          ))
        )}
        {loading && (
          <div className="chat-msg assistant">
            <span className="chat-typing">
              <span /> <span /> <span />
            </span>
          </div>
        )}
      </div>

      {error && <div className="chat-ia-error">{error}</div>}

      <form
        className="chat-ia-input"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo sobre a farmácia…"
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()}>
          {loading ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="sparkle" size={14} />}
          Enviar
        </button>
      </form>
    </div>
  );
}
