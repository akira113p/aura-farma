---
name: observabilidade
description: Garante que toda feature do auraFarma nasça monitorável e debugável aplicando as 10 regras de observabilidade (request-ID, stack trace com contexto, logs JSON, health check, query timing, cache hit/miss, métricas de performance, testes de regressão, alertas e deploy com rollback). USE SEMPRE que implementar ou alterar um endpoint, serviço, acesso a banco, cache ou fluxo de deploy no backend (`backend/src/`) ou no `render.yaml`. NÃO use para edições triviais (correção de typo, refactor sem mudança de comportamento, ajuste de estilo).
metadata:
  author: auraFarma team
  version: "1.0"
---

# Observabilidade no auraFarma

Toda feature precisa **nascer monitorável e debugável**. Quando você cria ou
altera um endpoint, serviço, acesso a banco, cache ou o fluxo de deploy, aplique
as **10 regras** abaixo. Não é burocracia: é o que permite descobrir, em minutos
(não horas), o que quebrou em produção e por quê.

> Esta skill é **orientação** (documentação). Os utilitários citados
> (`lib/logger.ts`, `lib/metrics.ts`, etc.) são o **padrão-alvo** do projeto.
> Reuse-os sempre que existirem; não recrie logger/métrica próprios por endpoint.

## As 10 regras (resumo)

| # | Regra | Onde aplicar (arquivo/utilitário) |
| --- | --- | --- |
| 1 | Request-ID único por requisição | middleware `requestId` / `requestContext` |
| 2 | Erro com stack trace completo + contexto | `middleware/error.ts` + `lib/logger.ts` |
| 3 | Logs estruturados em JSON | `backend/src/lib/logger.ts` |
| 4 | Health check detalhado | `backend/src/routes/health.ts` |
| 5 | Query logging com tempo | `backend/src/db/mongoose.ts` |
| 6 | Cache hit/miss | `backend/src/services/cache.ts` |
| 7 | Métricas de performance (tempo/memória/CPU) | `backend/src/lib/metrics.ts` |
| 8 | Testes de regressão | `backend/src/smoke.mjs` |
| 9 | Alertas configuráveis | `backend/src/lib/alerts.ts` |
| 10 | Deploy com rollback automático | `render.yaml` |

---

## 1. Request-ID único por requisição

**O que fazer:** todo request entra com um ID único (gerado ou vindo do header
`x-request-id`). Esse ID acompanha **todo log** daquela requisição e volta na
resposta no header `x-request-id`.

**Use:** o middleware `requestId`/`requestContext` (montado cedo em
`backend/src/index.ts`, antes das rotas). Ele guarda o ID no contexto da request
para o logger anexar automaticamente.

```ts
// backend/src/index.ts — bem no topo da cadeia de middleware
app.use(requestId());      // gera/propaga x-request-id
app.use(requestContext()); // expõe req.id para logger e handlers
```

Dentro do handler, **nunca** gere um ID novo: use `req.id`.

## 2. Erro com stack trace completo + contexto

**O que fazer:** quando algo falha, logue o erro com **stack trace inteiro** mais
o contexto mínimo para reproduzir: `requestId`, `userId`, rota, método e (quando
seguro) os parâmetros. Nunca logue senha, `passwordHash`, token de sessão ou
segredo.

**Use:** o handler central em `backend/src/middleware/error.ts` junto com o
`AppError`/`asyncHandler` de `lib/http.ts`. O handler deve chamar o logger
estruturado com `err.stack` e o contexto da request.

```ts
// dentro de middleware/error.ts
logger.error('request_failed', {
  requestId: req.id,
  userId: req.session?.userId,
  method: req.method,
  path: req.path,
  err: { message: err.message, stack: err.stack, status: err.status },
});
```

Em handlers, prefira `asyncHandler(...)` para que rejeições caiam no handler
central — não engula erros com `try/catch` silencioso.

## 3. Logs estruturados em JSON

**O que fazer:** logue **objetos JSON** (uma linha por evento), nunca strings
soltas com `console.log`. Cada linha tem ao menos: `level`, `msg`/`event`, `ts`,
`requestId`. Isso deixa o log filtrável por ferramenta (Render, grep, etc.).

**Use:** `backend/src/lib/logger.ts`. Importe `logger` e chame
`logger.info/warn/error(evento, dados)`. Não use `console.log` em código novo.

```ts
import { logger } from '../lib/logger.js';
logger.info('venda_registrada', { requestId: req.id, userId, total, itens: n });
```

## 4. Health check detalhado

**O que fazer:** o health check não pode responder só `200 OK`. Ele reporta o
estado das dependências (Mongo conectado? versão? uptime?) para o monitor do
Render e para você. Retorne `503` se uma dependência crítica estiver fora.

**Use:** `backend/src/routes/health.ts` (montado como `/api/health` em
`index.ts`). Ao adicionar uma dependência nova (cache, serviço externo), inclua o
status dela no payload.

```jsonc
// GET /api/health → 200
{ "status": "ok", "uptime": 1234, "mongo": "connected", "version": "1.0.0" }
```

## 5. Query logging com tempo

**O que fazer:** toda query ao Mongo registra **quanto tempo levou**. Queries
lentas (acima de um limiar, ex. 300ms) viram log `warn` para você caçar gargalo e
faltas de índice.

**Use:** o hook de timing em `backend/src/db/mongoose.ts` (plugin/instrumentação
no nível da conexão). Não meça tempo manualmente em cada serviço — o hook central
cobre todas as operações.

```ts
// db/mongoose.ts — log automático por operação
logger.debug('mongo_query', { coll, op, ms, requestId });
if (ms > SLOW_MS) logger.warn('mongo_query_slow', { coll, op, ms });
```

## 6. Cache hit/miss

**O que fazer:** todo acesso a cache registra se foi **hit** (achou) ou **miss**
(buscou na fonte). Sem isso é impossível saber se o cache está ajudando.

**Use:** `backend/src/services/cache.ts`. Use o wrapper dele (ex.
`cache.wrap(chave, fn)`); ele já emite a métrica/log de hit/miss. Não implemente
cache ad-hoc com `Map` solto no serviço.

```ts
import { cache } from './cache.js';
const catalogo = await cache.wrap(`catalogo:${q}`, () => buscarCatalogo(q));
// emite cache_hit ou cache_miss + atualiza métrica
```

## 7. Métricas de performance (tempo/memória/CPU)

**O que fazer:** cada endpoint registra **latência** (tempo de resposta) e o
processo expõe **memória/CPU**. Isso alimenta dashboards e os alertas (regra 9).

**Use:** `backend/src/lib/metrics.ts`. Para latência por rota, use o middleware de
métricas que ele exporta; para memória/CPU, o coletor periódico do próprio módulo.

```ts
// index.ts
app.use(metrics.httpTimer()); // mede duração de cada request, por rota e status
// metrics.ts coleta process.memoryUsage()/cpuUsage() em intervalo
```

## 8. Testes de regressão

**O que fazer:** comportamento novo ganha um teste que **falha se quebrar depois**.
No backend, isso vive no smoke E2E (roda com Mongo in-memory, não precisa de banco
externo).

**Use:** `backend/src/smoke.mjs` (`npm --prefix backend run smoke`). Ao adicionar
um endpoint, acrescente um caso cobrindo o caminho feliz e ao menos um erro
(ex. 401/400). No frontend, o `build` (`tsc -b`) já é a rede de regressão de tipos.

## 9. Alertas configuráveis

**O que fazer:** condições ruins (taxa de erro alta, query muito lenta,
health `503`) **disparam alerta**. Os limiares são configuráveis por env var, não
hard-coded.

**Use:** `backend/src/lib/alerts.ts`. Dispare alerta a partir do logger/métricas
quando um limiar é cruzado. Leia limiares de `config/env.ts` (ex.
`ALERT_ERROR_RATE`, `ALERT_SLOW_MS`) — nunca cole número mágico no código.

```ts
import { alerts } from '../lib/alerts.js';
if (errorRate > env.ALERT_ERROR_RATE) alerts.fire('error_rate_high', { errorRate });
```

## 10. Deploy com rollback automático

**O que fazer:** o deploy só "promove" a versão nova se ela passar no health check;
se falhar, **volta para a anterior** automaticamente. O gatilho é o `/api/health`
detalhado (regra 4).

**Use:** `render.yaml`. Garanta `healthCheckPath: /api/health` e a política de
rollback configurada. Ao adicionar env var nova exigida no boot (ex. de alertas),
declare-a no `render.yaml` para o deploy não subir quebrado.

```yaml
# render.yaml
services:
  - type: web
    healthCheckPath: /api/health
    # rollback automático se o health check falhar após o deploy
```

---

## Checklist ao adicionar um endpoint novo

- [ ] O handler usa `req.id` (request-ID) — não gera ID próprio.
- [ ] Logo eventos via `logger` (JSON), **sem** `console.log`.
- [ ] Erros sobem para `middleware/error.ts` (via `asyncHandler`/`AppError`) — sem `try/catch` mudo.
- [ ] O log de erro inclui stack + contexto (requestId, userId, rota), **sem segredos**.
- [ ] Acessos a banco passam pelo timing de `db/mongoose.ts` (sem query "crua" fora do padrão).
- [ ] Se usa cache, usa `services/cache.ts` (hit/miss medido).
- [ ] A latência da rota entra em `lib/metrics.ts` (middleware de métricas ativo).
- [ ] Se a feature tem condição de risco, há alerta em `lib/alerts.ts` com limiar via env.
- [ ] Adicionei um caso em `smoke.mjs` (caminho feliz + um erro).
- [ ] Dependência nova aparece no `/api/health` e env nova no `render.yaml`.
- [ ] Verifiquei: `npm --prefix backend run typecheck` e `npm --prefix backend run smoke` passam.

---

## Monitoramento para quem conhece pouco de programação

Você não precisa saber programar para acompanhar a saúde do sistema. Pense num
painel de carro:

- **Verde (tudo bem):** o health check em `/api/health` responde `ok`. O app está
  no ar, o banco está conectado. Nada a fazer.
- **Amarelo (atenção):** aparecem logs `warn` — por exemplo "query lenta" ou
  "cache não está ajudando". Ainda funciona, mas pode piorar. Vale avisar quem
  cuida do sistema.
- **Vermelho (problema):** logs `error`, alertas disparando, ou `/api/health`
  respondendo `503`. Algo quebrou e usuários podem estar sendo afetados.

**O que é um request-ID?** É um número/código único que cada clique/ação gera (ex.
quando alguém registra uma venda). Ele aparece em **todos** os registros daquela
ação. Se um usuário diz "deu erro às 14h ao salvar a venda", você pega o
request-ID daquele erro e segue **só** os registros com aquele código — como
rastrear uma encomenda pelo código de rastreio, em vez de ler todo o histórico.

**Onde olhar quando algo quebra:**
1. Abra os **logs** (no Render, a aba "Logs" do serviço backend).
2. Procure linhas com `"level":"error"` — elas dizem **o que** falhou e trazem o
   `requestId`.
3. Copie esse `requestId` e filtre por ele para ver a história completa daquela
   ação (qual rota, qual usuário, o que veio antes).
4. Cheque `/api/health`: se estiver `ok`, o problema é pontual; se estiver `503`,
   é uma dependência fora (geralmente o banco).
5. Se um deploy recente causou o problema, o **rollback automático** (regra 10)
   tende a voltar para a versão anterior sozinho — confirme nos logs de deploy.
