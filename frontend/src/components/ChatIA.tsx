import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useChatIA } from '../hooks/useChatIA';

/**
 * Chat com a IA sobre a farmácia (EXPERIMENTAL / em teste).
 *
 * Componente autocontido: recebe um `contexto` (snapshot já calculado) e cuida
 * de tudo (histórico em localStorage via useChatIA, envio, loading, erro).
 * Pensado para ser fácil de remover ou trocar — é montado com uma linha só no
 * Dashboard e nos Relatórios.
 */
interface ChatIAProps {
  /** Snapshot da farmácia enviado à IA a cada pergunta (ver buildPharmaciaContexto). */
  contexto: unknown;
  title?: string;
}

const SUGESTOES = [
  'Como está a saúde da minha farmácia?',
  'O que eu devo repor com urgência?',
  'Onde estou perdendo margem?',
];

export function ChatIA({ contexto, title = 'Converse com a IA' }: ChatIAProps) {
  const { messages, loading, error, send, clear } = useChatIA();
  const [input, setInput] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  // Rola para a última mensagem quando a conversa cresce ou enquanto carrega.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  function submit() {
    const text = input;
    setInput('');
    void send(text, contexto);
  }

  return (
    <div className="chat-ia">
      <div className="chat-ia-head">
        <div className="ai-spark">
          <Icon name="sparkle" size={11} />
        </div>
        <span className="ai-title">{title}</span>
        <span className="ai-tag">IA · experimental</span>
        <div style={{ marginLeft: 'auto' }}>
          {messages.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clear} title="Limpar conversa">
              <Icon name="trash" size={13} />
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="chat-ia-body" ref={bodyRef}>
        {messages.length === 0 ? (
          <div className="chat-ia-empty">
            <p className="muted" style={{ marginTop: 0 }}>
              Pergunte sobre o desempenho, estoque e margens da sua farmácia. A IA usa os seus dados atuais.
            </p>
            <div className="chat-ia-suggest">
              {SUGESTOES.map((s) => (
                <button key={s} className="chat-chip" onClick={() => void send(s, contexto)} disabled={loading}>
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
