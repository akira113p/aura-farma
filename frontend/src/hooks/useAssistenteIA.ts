import { useCallback, useState } from 'react';
import { perguntarIA } from '../services/ai';
import { ApiError } from '../lib/apiClient';

/**
 * Perguntas avulsas à IA (1 por vez, SEM histórico de conversa) + um histórico
 * de respostas anteriores para reabrir. Cada entrada tem um título gerado por
 * IA. Tudo fica só no navegador (localStorage); nada vai para o banco.
 */
export interface AskEntry {
  id: string;
  titulo: string;
  pergunta: string;
  resposta: string;
  consultou: string[];
  createdAt: string;
  /** Escopo escolhido no momento da pergunta. */
  scope?: string;
  scopeLabel?: string;
}

const STORAGE_KEY = 'aurafarma.ia.v1';
const MAX = 50;

function load(): AskEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AskEntry[];
  } catch {
    /* ignore */
  }
  return [];
}

function save(entries: AskEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

const newId = (): string => 'q' + Date.now() + Math.floor(Math.random() * 1000);

export function useAssistenteIA() {
  const [entries, setEntries] = useState<AskEntry[]>(() => load());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = entries.find((e) => e.id === activeId) ?? null;

  const ask = useCallback(
    async (pergunta: string, escopo?: string, escopoLabel?: string, pedidos?: unknown) => {
      const clean = pergunta.trim();
      if (!clean || loading) return;
      setError(null);
      setLoading(true);
      try {
        const { reply, titulo, consultou } = await perguntarIA(clean, escopo, pedidos);
        const entry: AskEntry = {
          id: newId(),
          titulo: titulo || clean.slice(0, 48),
          pergunta: clean,
          resposta: reply,
          consultou: consultou ?? [],
          createdAt: new Date().toISOString(),
          scope: escopo,
          scopeLabel: escopoLabel,
        };
        setEntries((prev) => {
          const next = [entry, ...prev].slice(0, MAX);
          save(next);
          return next;
        });
        setActiveId(entry.id);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'A IA não respondeu. Tente novamente.');
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  const select = useCallback((id: string) => setActiveId(id), []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      save(next);
      return next;
    });
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const nova = useCallback(() => {
    setActiveId(null);
    setError(null);
  }, []);

  return { entries, active, loading, error, ask, select, remove, nova };
}
