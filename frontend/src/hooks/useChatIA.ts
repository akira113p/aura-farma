import { useCallback, useState } from 'react';
import { chatWithAI, type ChatMsg } from '../services/ai';
import { ApiError } from '../lib/apiClient';

/**
 * Estado do chat com a IA (experimental). O histórico fica SÓ no navegador
 * (localStorage) — não vai para o banco. Para remover a feature: apagar este
 * hook + o componente ChatIA e os mounts no Dashboard/Relatórios.
 */
const STORAGE_KEY = 'aurafarma.chat.v1';
const MAX_KEEP = 40;

function load(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ChatMsg[];
  } catch {
    /* ignore */
  }
  return [];
}

function save(messages: ChatMsg[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_KEEP)));
  } catch {
    /* ignore */
  }
}

export function useChatIA() {
  const [messages, setMessages] = useState<ChatMsg[]>(() => load());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (text: string, contexto: unknown) => {
      const clean = text.trim();
      if (!clean || loading) return;
      setError(null);

      const outgoing: ChatMsg[] = [...messages, { role: 'user', content: clean }];
      setMessages(outgoing);
      save(outgoing);
      setLoading(true);
      try {
        const reply = await chatWithAI(outgoing, contexto);
        const withReply: ChatMsg[] = [...outgoing, { role: 'assistant', content: reply }];
        setMessages(withReply);
        save(withReply);
      } catch (e) {
        // Mantém a mensagem do usuário para permitir tentar de novo.
        setError(e instanceof ApiError ? e.message : 'A IA não respondeu. Tente novamente.');
      } finally {
        setLoading(false);
      }
    },
    [messages, loading],
  );

  const clear = useCallback(() => {
    setMessages([]);
    save([]);
    setError(null);
  }, []);

  return { messages, loading, error, send, clear };
}
