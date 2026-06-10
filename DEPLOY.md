# Deploy — Frontend na Vercel + Backend no Render

O farmaDimin tem dois apps que vão para hosts diferentes:

- **Frontend** (`frontend/`) → **Vercel** (site estático Vite).
- **Backend** (`backend/`) → **Render** (servidor Node persistente; a Vercel é
  serverless e não combina com sessão + catálogo em memória).

Como front e back ficam em **domínios diferentes**, o cookie de sessão usa
`SameSite=None; Secure` em produção (já configurado no código). Por isso ambos
**precisam** estar em HTTPS — Vercel e Render já entregam HTTPS.

> As URLs são previsíveis pelo nome do serviço:
> - Render: `https://aura-farma-backend.onrender.com`
> - Vercel: `https://SEU-PROJETO.vercel.app`
>
> Dá para preencher as variáveis dos dois já com essas URLs e depois só ajustar
> se o nome final mudar.

---

## Passo 1 — MongoDB Atlas: liberar acesso

No Atlas → **Network Access** → **Add IP Address** → **Allow access from anywhere**
(`0.0.0.0/0`). Sem isso o Render não conecta no banco.

## Passo 2 — Backend no Render

Tem duas formas; a do Blueprint é a mais rápida porque o repo já tem `render.yaml`.

**Opção A (Blueprint — recomendada):**
1. Render → **New +** → **Blueprint** → conecte o repositório `aura-farma`.
2. Ele lê o `render.yaml` e cria o serviço `aura-farma-backend` (Root `backend`,
   `npm install` / `npm start`, health check em `/api/health`, plano free).
3. Em **Environment**, preencha as variáveis marcadas como "sync:false":

| Variável | Valor |
| --- | --- |
| `MONGODB_URI` | sua string do Atlas (a mesma do `.env` local) |
| `FRONTEND_ORIGIN` | `https://SEU-PROJETO.vercel.app` (a URL do front) |
| `GOOGLE_CLIENT_ID` | seu Client ID do Google (ou deixe vazio p/ desativar o login Google) |

> `NODE_ENV=production` e `SESSION_SECRET` (gerado forte automaticamente) já vêm
> do `render.yaml`. `PORT` o Render injeta sozinho.

**Opção B (manual):** New + → **Web Service** → repo → Root Directory `backend`,
Build `npm install`, Start `npm start`, Health Check Path `/api/health`, e
adicione as variáveis acima **+** `NODE_ENV=production` e um `SESSION_SECRET`
forte (gere com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).

Ao final, anote a URL do backend (ex.: `https://aura-farma-backend.onrender.com`).
Teste abrindo `…/api/health` → deve responder `{"ok":true}`.

## Passo 3 — Frontend na Vercel

1. Vercel → **Add New** → **Project** → importe o repo `aura-farma`.
2. **Root Directory = `frontend`** (importante: é monorepo). Framework: Vite
   (autodetectado). Build `npm run build`, Output `dist`.
3. **Environment Variables:**

| Variável | Valor |
| --- | --- |
| `VITE_API_BASE_URL` | `/api` (caminho relativo — vai pelo proxy do `frontend/vercel.json`) |
| `VITE_USE_MOCK` | `false` |

4. Deploy. Anote a URL (ex.: `https://SEU-PROJETO.vercel.app`).

> ⚠️ Variáveis `VITE_*` entram no build. Se mudar qualquer uma depois, faça
> **Redeploy** (senão o valor antigo continua embutido).

### Por que `/api` e não a URL do Render?

O `frontend/vercel.json` tem um **rewrite** que encaminha `/api/*` para o backend
no Render. Assim o navegador chama sempre o **mesmo domínio** (`SEU-PROJETO.vercel.app/api/...`),
a Vercel repassa pro Render nos bastidores, e o **cookie de sessão vira
first-party** — funciona em qualquer navegador. Se o front chamasse
`onrender.com` direto, o cookie seria de **terceiros** e Safari/Firefox/Chrome o
bloqueariam (o login nao "grudaria"). Edite o `destination` no `vercel.json` se a
URL do backend mudar.

## Passo 4 — Conferir as URLs cruzadas

- No **Render**, `FRONTEND_ORIGIN` tem que ser **exatamente** a URL da Vercel
  (com `https://`, sem barra no final).
- Na **Vercel**, `VITE_API_BASE_URL` tem que ser a URL do Render **+ `/api`**.
- Se você mudar alguma, redeploye o app correspondente.

## Passo 5 — Google (se usar login Google)

No Google Cloud Console → seu OAuth Client → **Authorized JavaScript origins**,
adicione a URL da Vercel (`https://SEU-PROJETO.vercel.app`), como foi feito com
`http://localhost:5173`.

## Passo 6 — Testar

Abra a URL da Vercel, registre/entre, adicione um produto no Estoque e recarregue
a página. Se o produto persistir, o front está falando com o Render + Atlas. 🎉

---

## Problemas comuns

- **Login não "gruda" / cai pro login ao recarregar:** cookie de terceiros
  bloqueado pelo navegador. A correção e usar o proxy: `VITE_API_BASE_URL=/api`
  na Vercel + o `frontend/vercel.json` (rewrite p/ o Render) — assim o cookie
  fica first-party. Confirme tambem `NODE_ENV=production` no backend (ativa
  `SameSite=None`+`Secure`).
- **CORS error no console:** `FRONTEND_ORIGIN` no Render não bate com a origem do
  navegador (diferença de `https`, `www`, ou barra no final).
- **Backend demora ~30s na 1ª chamada:** plano free do Render hiberna após
  inatividade; o primeiro acesso acorda o serviço e recarrega o catálogo. Normal.
- **Backend não sobe:** veja os logs no Render. Causas comuns: `MONGODB_URI`
  errada, Atlas sem `0.0.0.0/0`, ou `SESSION_SECRET`/`FRONTEND_ORIGIN` faltando
  (em produção o app falha de propósito se estiverem fracos/ausentes).

---

## Deploy monitorado + rollback

### Gate de saúde no Render

O `render.yaml` define `healthCheckPath: /api/health`. A cada deploy o Render só
**promove** a nova versão depois que o health check responde OK. Se a versão nova
não passar no health check (boot quebrado, Mongo inacessível, etc.), o Render
**mantém a versão anterior no ar** e o deploy é marcado como falho — sem downtime.

### CI antes do deploy

O workflow `.github/workflows/ci.yml` roda em todo `push`/`pull_request` para
`main`:

- **Backend:** `npm --prefix backend run typecheck` (tsc `--noEmit`) +
  `npm --prefix backend run smoke` (suíte de regressão e2e que sobe o server com
  `mongodb-memory-server` — sem serviços externos — e exercita auth, estoque CRUD,
  venda baixando estoque, solicitados e contagem). O smoke sai com código != 0 se
  qualquer assert falhar, reprovando o job.
- **Frontend:** `npm --prefix frontend run build` (typecheck + build do Vite).

Recomendado: manter `autoDeploy: true` no `render.yaml` **e** ligar
**branch protection** em `main` exigindo o CI verde antes do merge. Assim só vai
para deploy o que passou em typecheck + smoke, barrando regressões dos fluxos
críticos antes de chegar em produção.

### Rollback manual

Se um deploy passou no health check mas introduziu um bug, volte para a versão
boa:

- **Painel do Render:** serviço → aba **Events** (ou **Deploys**) → escolha um
  deploy anterior que estava saudável → **Rollback to this deploy**. O Render
  re-promove aquela build (sem rebuild).
- **CLI:** `render rollback` (requer o [Render CLI](https://render.com/docs/cli)
  instalado e autenticado, `render login`). Útil para automatizar/scriptar o
  rollback.

> Como o deploy é zero-downtime, prefira corrigir e dar push (o CI + health check
> protegem) em vez de rollback; o rollback é o caminho rápido quando o bug já está
> em produção e você precisa restaurar o serviço imediatamente.
