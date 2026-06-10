import { AsyncLocalStorage } from 'node:async_hooks';

/** Dados propagados implicitamente pela request via AsyncLocalStorage. */
export interface RequestContext {
  requestId: string;
  userId?: string;
}

/** Store que carrega o contexto da request atual ao longo da cadeia async. */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Roda `fn` com o contexto `ctx` ativo para toda a cadeia async dentro dela. */
export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContext.run(ctx, fn);
}

/** Id da request atual, ou `undefined` fora de um contexto de request. */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
