# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Protótipo do **auraFarma** — SaaS de gestão de estoque + compliance para farmácias pequenas. Monorepo informal com dois apps independentes (`frontend/` e `backend/`) e um `package.json` delegador. Todo o projeto está em **pt-BR**.

## Estrutura do repositório

```
frontend/                 # React 19 + TypeScript + Vite (sem Tailwind/shadcn; CSS custom)
backend/                  # Node + Express + TypeScript (ESM via tsx) + MongoDB/Mongoose
sla mas ta aq/            # package.json raiz "delegador" (dev/build/lint/typecheck) + skills-lock
design/                   # design original (auraFarma.html + .jsx) portado para frontend/
skill/, vibe-security-skill/   # repositórios-fonte das skills (referência)
.claude/                  # skills ativadas no nível do projeto
```

> Atenção: o `package.json` delegador **não está na raiz** do repositório — está em `sla mas ta aq/`. Os comandos delegadores (`npm run dev`, `build`, `lint`, etc.) só funcionam de dentro dessa pasta. Na prática, prefira os comandos por-app abaixo, que são equivalentes e sempre funcionam.

### `frontend/src`
- `components/` — UI reutilizável tipada (Button, Card, Modal, Tabs, Icon, LineChart, StockBar…), reexportada por `components/index.ts`.
- `features/` — as 7 telas (`Dashboard`, `Produtos`, `Vendas` (PDV), `Solicitados`, `Historico`, `Contagem`, `Relatorios`) + `TopBar`; auth em `features/auth/` (`Login`, `Register`, `GoogleButton`, `AuthScreen`, `CompleteProfileModal`).
- `services/` — camada de dados. `dados.ts` (ações async de estado/estoque/vendas/solicitados/contagem — API ou mock), `store.ts` (mock localStorage + agregações `summarize`/`applySale`), `medicamentos.ts` (busca de catálogo), `auth.ts` (rotas de auth), `ai.ts`, reexport em `index.ts`.
- `lib/` — `apiClient.ts` (fetch tipado p/ o backend), `format.ts`, `series.ts`.
- `hooks/` — `useAppState.ts` (carrega/persiste o `AppState`), `useTweaks.ts`.
- `context/` — `AuthContext.tsx`.
- `types/` — `index.ts` (AppState, Product, Sale, Summary, AuthUser…).
- `data/seed.ts` — dados de exemplo. `config.ts` — config de runtime. `index.css` — estilos (tokens de tema/densidade).

### `backend/src`
- `routes/auth.ts` — todas as rotas `/api/auth` (register, login, logout, me, google, google/complete, google/config).
- `services/googleAuth.ts` — verificação do **ID token** do Google.
- `models/User.ts` — schema Mongoose; `toSafeUser` remove `passwordHash`.
- `middleware/` — `auth.ts`, `error.ts`, `rateLimit.ts`.
- `lib/` — `password.ts` (bcrypt + política de senha), `validation.ts` (schemas zod), `http.ts` (`AppError`, `asyncHandler`).
- `config/env.ts` — leitura/validação das env vars. `db/mongoose.ts` — conexão. `types/session.d.ts` — augmenta `req.session`.
- `index.ts` — monta Express (helmet, cors, session, rate limit) e sobe o servidor.

## Como rodar

Os dois apps são instalados e executados separadamente. **Ordem importa**: o backend precisa de MongoDB acessível + `.env` antes de subir.

```bash
# 1. Instalar (por app)
npm --prefix frontend install
npm --prefix backend install

# 2. Backend (requer Mongo + backend/.env — ver abaixo)
cp backend/.env.example backend/.env     # e preencher SESSION_SECRET / MONGODB_URI
npm --prefix backend run dev             # tsx watch → http://localhost:4000

# 3. Frontend (em outro terminal)
npm --prefix frontend run dev            # Vite → http://localhost:5173
```

Verificações:

```bash
npm --prefix frontend run build    # tsc -b && vite build  (typecheck + build do front)
npm --prefix frontend run lint     # eslint
npm --prefix backend run typecheck # tsc --noEmit  (o backend roda via tsx, não compila)
npm --prefix backend run smoke     # smoke E2E de auth com MongoDB in-memory (NÃO precisa de Mongo rodando)
```

Equivalentes pelo delegador (rodando de dentro de `sla mas ta aq/`): `npm run dev`, `npm run dev:backend`, `npm run build`, `npm run lint`, `npm run typecheck:backend`.

## Variáveis de ambiente

### Backend — `backend/.env` (gitignored; ver `backend/.env.example` e `backend/src/config/env.ts`)
- `PORT` — porta da API (default `4000`).
- `NODE_ENV` — `development` | `production` (em produção: cookie `Secure` + `trust proxy`).
- `MONGODB_URI` — **obrigatória**. Mongo local ou Atlas. Sem ela o backend lança erro ao iniciar.
- `SESSION_SECRET` — **obrigatória**. Segredo do cookie de sessão (gere com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
- `FRONTEND_ORIGIN` — origem(ns) permitidas no CORS, separadas por vírgula (default `http://localhost:5173`).
- `GOOGLE_CLIENT_ID` — Client ID público do Google. Vazio = login com Google desativado (backend responde 503, botão fica desabilitado).

### Frontend (`frontend/src/config.ts`)
- `VITE_USE_MOCK` — `'false'` (default) faz o app persistir no backend/Mongo; `'true'` usa o mock local em `localStorage` (dev sem backend).
- `VITE_API_BASE_URL` — base da API (default `http://localhost:4000/api`).

> Só variáveis `VITE_*` chegam ao bundle do cliente. Tudo em `frontend` é público.

## O seam principal: mock ↔ API

O frontend acessa dados pela camada de serviços, com o ponto único de troca em `services/dados.ts`:

- Componentes carregam o `AppState` via `hooks/useAppState.ts` (load assíncrono no mount) e mutam por **ações async** de `services/dados.ts` (`createProduct`, `updateProduct`, `removeProduct`, `recordSale`, `addRequest`, `applyCount`, `seedData`, `resetData`…). Cada ação retorna o próximo `AppState`.
- `services/dados.ts` ramifica em `config.useMock`: **`false` (default)** fala com o backend via `lib/apiClient.ts` (`credentials:'include'`); `true` usa o mock em `localStorage` de `services/store.ts`. As agregações (`summarize`) seguem no client sobre o `AppState` carregado.
- **Estoque, vendas, solicitados e contagem persistem no MongoDB** (escopados por usuário): `GET /api/estado` carga tudo numa chamada; CRUD em `/api/estoque`, `/api/vendas` (baixa estoque no servidor), `/api/solicitados`, `/api/contagem`, `/api/estado/seed|reset`. Auth também é real (`/api/auth/*`).
- No banco os campos vão com **nomes curtos** (alias do Mongoose: `n/sku/ct/p/...`) para caber no cluster free de 500MB; os `toApi*` em `models/pharmacy.ts` remapeiam para os nomes completos na resposta. Rotas de mutação têm `writeLimiter` (120/min por usuário); leitura tem `readLimiter`.
- **Pagamento/gateway fica fora** (o rótulo do método na venda é só texto). Importação por CSV/NF-e é planejada.

## Decisões arquiteturais não óbvias

- **Sessão + cookie httpOnly, não JWT no client.** Sessões persistidas no Mongo (`connect-mongo`); o token nunca é lido por JS. Logout destrói a sessão de fato. Cookie `httpOnly` + `SameSite=Lax` + `Secure` em produção (`backend/src/index.ts`).
- **Login com Google via ID token** (`google-auth-library` `verifyIdToken`), não authorization-code. O frontend manda o `credential` (JWT do Google Identity Services); o backend valida assinatura/audience/expiração. **O client secret do Google NÃO é usado** neste fluxo.
- **Sessão regenerada no login** (`req.session.regenerate`) para prevenir session fixation (`startSession` em `routes/auth.ts`).
- **bcrypt custo 12** (`lib/password.ts`). Login roda um `bcrypt.compare` contra um `DUMMY_HASH` mesmo quando a conta não existe (anti-enumeração / anti-timing).
- **`passwordHash` nunca sai para o client** — removido em `toSafeUser`.
- **`.env` é gitignored**; o app é ESM e roda direto via `tsx` (sem step de build no backend).

## Documentação viva (Obsidian)

A pasta `obsidian/` tem 4 arquivos (2 mapas mentais `.canvas` + 2 textos `.md`), em duas perspectivas (técnica e leiga). Sempre que entrar uma **mecânica/feature nova**, mudar o **modelo de dados/endpoints**, ou uma **decisão de arquitetura relevante**, atualize esses arquivos via a skill **`update-obsidian-docs`** (ela tem o gerador dos mapas em `scripts/mapgen.cjs`). Não para mudanças triviais.

## O que NÃO fazer

- Não commitar `backend/.env` (está no `.gitignore`).
- Não pôr segredo em `backend/.env.example` (só placeholders) nem em variáveis `VITE_*` — elas vão para o bundle público do cliente.
- Não usar o Google **client secret** neste fluxo (a verificação é por ID token; só o Client ID, público, é necessário).
- Não rodar o backend sem MongoDB acessível e sem `.env` com `MONGODB_URI` e `SESSION_SECRET` (o boot falha de propósito).
