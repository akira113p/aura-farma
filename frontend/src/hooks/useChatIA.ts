import { useCallback, useState } from 'react';
import { chatWithAI, type ChatMsg } from '../services/ai';
import { ApiError } from '../lib/apiClient';

/**
 * Chat com a IA com HISTÓRICO de conversas (experimental).
 *
 * Mantém várias conversas separadas — cada uma com seu título e mensagens — para
 * o usuário reabrir conversas antigas. Tudo fica SÓ no navegador (localStorage);
 * nada vai para o banco. Para remover a feature: apagar este hook + o componente
 * ChatIA e os mounts no Dashboard/Relatórios.
 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMsg[];
}

interface ChatStore {
  conversations: Conversation[];
  activeId: string | null;
}

const STORAGE_KEY = 'aurafarma.chat.v2';
const MAX_CONVERSATIONS = 30;
const MAX_MSGS = 40;

function load(): ChatStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as ChatStore;
      if (s && Array.isArray(s.conversations)) return { conversations: s.conversations, activeId: s.activeId ?? null };
    }
  } catch {
    /* ignore */
  }
  return { conversations: [], activeId: null };
}

function save(s: ChatStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const titleFrom = (text: string): string => {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > 42 ? t.slice(0, 42) + '…' : t || 'Nova conversa';
};
const newId = (): string => 'c' + Date.now() + Math.floor(Math.random() * 1000);

export function useChatIA() {
  const [store, setStore] = useState<ChatStore>(() => load());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback((s: ChatStore) => {
    save(s);
    setStore(s);
  }, []);

  const conversations = [...store.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = store.conversations.find((c) => c.id === store.activeId) ?? null;

  const newConversation = useCallback(() => {
    setError(null);
    persist({ ...store, activeId: null });
  }, [store, persist]);

  const selectConversation = useCallback(
    (id: string) => {
      setError(null);
      persist({ ...store, activeId: id });
    },
    [store, persist],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      persist({
        conversations: store.conversations.filter((c) => c.id !== id),
        activeId: store.activeId === id ? null : store.activeId,
      });
    },
    [store, persist],
  );

  const send = useCallback(
    async (text: string, contexto: unknown) => {
      const clean = text.trim();
      if (!clean || loading) return;
      setError(null);
      const now = new Date().toISOString();

      // Garante uma conversa ativa (cria uma nova se nenhuma estiver aberta).
      let s = store;
      let conv = s.conversations.find((c) => c.id === s.activeId);
      const isFirst = !conv || conv.messages.length === 0;
      if (!conv) {
        conv = { id: newId(), title: titleFrom(clean), createdAt: now, updatedAt: now, messages: [] };
        s = { conversations: [conv, ...s.conversations].slice(0, MAX_CONVERSATIONS), activeId: conv.id };
      }

      const userMsgs: ChatMsg[] = [...conv.messages, { role: 'user' as const, content: clean }].slice(-MAX_MSGS);
      const withUser: Conversation = {
        ...conv,
        title: isFirst ? titleFrom(clean) : conv.title,
        messages: userMsgs,
        updatedAt: now,
      };
      const afterUser: ChatStore = {
        conversations: s.conversations.map((c) => (c.id === withUser.id ? withUser : c)),
        activeId: withUser.id,
      };
      persist(afterUser);
      setLoading(true);
      try {
        const reply = await chatWithAI(userMsgs, contexto);
        const withReply: ChatMsg[] = [...userMsgs, { role: 'assistant' as const, content: reply }].slice(-MAX_MSGS);
        const done: Conversation = { ...withUser, messages: withReply, updatedAt: new Date().toISOString() };
        persist({
          conversations: afterUser.conversations.map((c) => (c.id === done.id ? done : c)),
          activeId: done.id,
        });
      } catch (e) {
        // Mantém a pergunta do usuário para permitir tentar de novo.
        setError(e instanceof ApiError ? e.message : 'A IA não respondeu. Tente novamente.');
      } finally {
        setLoading(false);
      }
    },
    [store, loading, persist],
  );

  return {
    conversations,
    active,
    loading,
    error,
    send,
    newConversation,
    selectConversation,
    deleteConversation,
  };
}
