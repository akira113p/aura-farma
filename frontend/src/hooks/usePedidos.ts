import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Order } from '../types';
import { loadOrders, saveOrders } from '../services/pedidos';

/**
 * Pedidos de reposição, persistidos no localStorage (camada de exemplo,
 * fora do AppState do backend). A API casa com `useState`: `setOrders` aceita
 * um array novo ou um updater, e grava a cada mudança.
 */
export function usePedidos(): [Order[], Dispatch<SetStateAction<Order[]>>] {
  const [orders, setOrdersState] = useState<Order[]>(() => loadOrders());

  const setOrders = useCallback<Dispatch<SetStateAction<Order[]>>>((updater) => {
    setOrdersState((prev) => {
      const next = updater instanceof Function ? updater(prev) : updater;
      saveOrders(next);
      return next;
    });
  }, []);

  return [orders, setOrders];
}
