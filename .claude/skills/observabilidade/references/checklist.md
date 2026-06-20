# Checklist de observabilidade (PR de feature nova)

Cole este bloco na descrição da PR e marque cada item. Detalhes de como aplicar
cada regra estão no `SKILL.md` da skill `observabilidade`.

## As 10 regras

- [ ] **1. Request-ID** — o handler usa `req.id` (do middleware `requestId`/`requestContext`); não gera ID próprio; volta no header `x-request-id`.
- [ ] **2. Erro com stack + contexto** — erros sobem para `middleware/error.ts` (via `asyncHandler`/`AppError`) e são logados com `err.stack` + `requestId`/`userId`/rota, **sem segredos**.
- [ ] **3. Logs JSON** — eventos via `logger` de `lib/logger.ts` (objeto JSON); **nenhum** `console.log` em código novo.
- [ ] **4. Health check** — dependência nova (cache/serviço externo) aparece no payload de `routes/health.ts`; retorna `503` se dependência crítica cair.
- [ ] **5. Query timing** — acessos ao Mongo passam pela instrumentação de `db/mongoose.ts`; query lenta vira `warn`.
- [ ] **6. Cache hit/miss** — se usa cache, usa `services/cache.ts` (hit/miss medido); sem cache ad-hoc com `Map` solto.
- [ ] **7. Métricas de performance** — latência da rota entra em `lib/metrics.ts` (middleware de métricas ativo); memória/CPU coletadas.
- [ ] **8. Testes de regressão** — caso novo em `smoke.mjs` cobrindo caminho feliz + ao menos um erro (401/400).
- [ ] **9. Alertas configuráveis** — condição de risco dispara `lib/alerts.ts` com limiar lido de `config/env.ts` (sem número mágico).
- [ ] **10. Deploy com rollback** — `render.yaml` com `healthCheckPath: /api/health` e rollback automático; env nova exigida no boot declarada no `render.yaml`.

## Como verificar localmente

```bash
npm --prefix backend run typecheck   # tsc --noEmit (tipos do backend)
npm --prefix backend run smoke       # smoke E2E com Mongo in-memory (NÃO precisa de Mongo rodando)
npm --prefix frontend run build      # tsc -b && vite build (typecheck + build do front)
```

Os três precisam passar antes de pedir review.
