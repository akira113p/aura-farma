---
titulo: auraFarma - Monitoramento (intermediario)
tipo: guia de uso
relacionado: "[[auraFarma - Mapa Mental.md]]"
---

# Monitoramento do auraFarma - guia intermediario

Para quem ja mexe um pouco com tecnologia (sabe abrir um terminal, ler um JSON),
mas nao e especialista. Explica **como usar** a camada de observabilidade no dia
a dia: ler logs, checar a saude, entender alertas e fazer um deploy seguro.

Versao simples: [[auraFarma - Monitoramento (leigos).md]].
Visao tecnica completa: secao 8.3 de [[auraFarma - Mapa Mental.md]].

---

## 1. Os 10 sinais que o sistema oferece

| # | Sinal | Onde |
| --- | --- | --- |
| 1 | Request-ID unico por requisicao | cabecalho `X-Request-Id` |
| 2 | Erros com stack trace + contexto | logs (nivel `error`) |
| 3 | Logs estruturados em JSON | saida do servidor (stdout/stderr) |
| 4 | Health check detalhado | `GET /api/health` |
| 5 | Tempo de cada query de banco | logs (`src: "db"`) |
| 6 | Cache com hit/miss | logs (`src: "cache"`) |
| 7 | Metricas de performance | `getMetrics()` / health |
| 8 | Testes de regressao | `npm --prefix backend run smoke` |
| 9 | Alertas configuraveis | logs (nivel `warn`, `alert`) |
| 10 | Deploy com rollback | painel do Render |

---

## 2. Checar a saude

```bash
curl https://SEU-ENDERECO/api/health
```

Resposta (resumida):

```json
{
  "ok": true,
  "status": "saudavel",
  "versao": "1.0.0",
  "timestamp": "2026-06-20T03:58:00.000Z",
  "uptimeSegundos": 86400,
  "banco": { "conectado": true, "estado": "conectado" },
  "memoria": { "rssMb": 120, "heapUsadoMb": 80 }
}
```

- `ok`/`status`: resumo. `status` vira `degradado` se o banco cai (`ok: false`).
- `banco.estado`: `conectado` / `conectando` / `desconectado`.
- Essa rota e **publica** (o Render a usa como health check), por isso **nao**
  expoe trafego/taxa de erro - essas metricas existem so internamente.

---

## 3. Ler os logs (o ponto mais util)

Cada linha de log e um **JSON independente**. Exemplo de uma requisicao:

```json
{"ts":"2026-06-20T03:58:24Z","level":"info","msg":"requisicao concluida",
 "requestId":"ca09351b-...","method":"GET","path":"/api/estado","status":200,"ms":54.5}
```

Campos uteis: `level` (info/warn/error), `requestId`, `path`, `status`, `ms`
(tempo em milissegundos).

### Filtrar com `jq`

Como e JSON, da pra filtrar facil. Se os logs estao num arquivo `app.log`:

```bash
# So os erros
grep '"level":"error"' app.log | jq .

# Tudo de um pedido especifico (rastreia ponta a ponta pelo request-ID)
grep '"requestId":"ca09351b' app.log | jq .

# Requisicoes lentas (acima de 1000 ms)
jq 'select(.ms > 1000)' app.log
```

No **Render**, os logs aparecem na aba *Logs* do servico - da pra buscar pelo
`requestId` ali tambem.

### Niveis e onde saem

- `info` -> stdout (rotina). `warn`/`error` -> stderr.
- O nivel minimo e controlado por `LOG_LEVEL` (`debug`/`info`/`warn`/`error`).
- Em desenvolvimento, `LOG_PRETTY=true` imprime legivel em vez de JSON.
- Campos sensiveis (senha, token, cookie) sao **redigidos** automaticamente.

---

## 4. Logs de banco e de cache

- **Banco** (`src:"db"`): cada query loga `{ collection, op, ms, slow }`.
  Uma query e marcada `slow:true` acima de `DB_SLOW_QUERY_MS` (padrao 100 ms).
  Controle: `DB_QUERY_LOG=true|false|slow` (em producao, `slow` loga so as lentas).
- **Cache** (`src:"cache"`): cada `hit`/`miss` vira uma linha. Serve para saber
  se o cache de busca de catalogo esta ajudando (muitos `hit` = bom).

---

## 5. Alertas automaticos

Quando uma metrica cruza um limite, o sistema emite um log `warn` assim:

```json
{"level":"warn","msg":"alerta de anomalia","alert":"requisicao_lenta","value":1500,"threshold":1000}
```

Limites (todos por variavel de ambiente, com valor padrao):

| Variavel | Alerta | Padrao |
| --- | --- | --- |
| `ALERT_SLOW_MS` | `requisicao_lenta` (resposta acima de X ms) | 1000 |
| `ALERT_MEM_MB` | `memoria_alta` (RSS acima de X MB) | 512 |
| `ALERT_ERROR_RATE` | `taxa_erro_alta` (fracao de erros 0..1) | 0.5 |
| `ALERT_ERROR_MIN_SAMPLES` | minimo de amostras antes de avaliar o erro | 20 |
| `ALERT_COOLDOWN_MS` | intervalo minimo entre repeticoes do mesmo alerta | 30000 |

Notas:
- A **taxa de erro** usa uma **janela recente** (ultimas requisicoes), nao o
  acumulado de toda a vida do processo - assim uma falha nova realmente dispara.
- O `cooldown` evita spam: o mesmo alerta nao se repete antes do intervalo.
- Para monitorar de verdade, aponte um agregador de logs para os `level:"warn"`
  com `msg:"alerta de anomalia"`.

---

## 6. Rodar os testes de regressao

Antes de subir qualquer mudanca, rode o smoke (sobe um Mongo em memoria, **nao
precisa de banco real**):

```bash
npm --prefix backend run typecheck   # confere os tipos
npm --prefix backend run smoke       # E2E dos fluxos criticos
```

O smoke cobre auth, venda baixando estoque, contagem, solicitados e seed/reset.
Se ele passar (saida `... passaram, 0 falharam`), os caminhos principais estao
intactos.

---

## 7. Deploy seguro e rollback (Render)

- O deploy e **health-gated**: apos publicar, o Render chama `/api/health`.
  Se falhar, **a versao anterior continua no ar** - a nova nao entra.
- **Rollback manual:** painel do Render -> servico -> aba *Deploys* ->
  num deploy bom anterior, *Rollback to this deploy*.
- Passos de um deploy tranquilo:
  1. `smoke` verde localmente;
  2. push (o Render faz deploy automatico);
  3. acompanhe os *Logs* e o `/api/health` por alguns minutos;
  4. se piorar (erros/lentidao), faca rollback.
- Detalhes em `docs/observabilidade-deploy.md`.

---

## 8. Onde isso mora no codigo

Util se voce for abrir o projeto:

| Arquivo | Papel |
| --- | --- |
| `backend/src/lib/logger.ts` | logger JSON estruturado |
| `backend/src/middleware/requestContext.ts` | request-ID + tempo + log por requisicao |
| `backend/src/lib/metrics.ts` | tempo/memoria/CPU/contadores |
| `backend/src/lib/alerts.ts` | thresholds e disparo de alertas |
| `backend/src/routes/health.ts` | `/api/health` |
| `backend/src/db/mongoose.ts` | log de query com tempo |
| `backend/src/services/cache.ts` | cache TTL com hit/miss |
| `backend/smoke.mjs` | testes de regressao E2E |
| `render.yaml` | deploy health-gated |

Para **criar features novas ja monitoraveis**, use a skill `observabilidade`
(`.claude/skills/observabilidade/`) - ela tem o checklist das 10 regras.

---

_Veja tambem: [[auraFarma - Monitoramento (leigos).md]] e
[[auraFarma - Mapa Mental.md]]._
