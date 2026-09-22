# auraFarma

Sistema de gestão (SaaS) para **farmácias de pequeno porte**, com foco no
diferencial mais difícil do setor: a **compliance regulatória** (controle de
medicamentos da Portaria 344/ANVISA, validade de receitas, transmissão ao
SNGPC). Além disso cobre o dia a dia operacional — PDV, controle de estoque,
pedidos de reposição ao distribuidor e relatórios.

Projeto acadêmico do programa **FIAP x Eurofarma**. A Eurofarma entra como
parceira de credibilidade do projeto; a integração de reposição mira a
**distribuidora** (quem entrega o remédio na farmácia), não a indústria
diretamente.

> Todo o código, commits e documentação do projeto estão em **pt-BR**.

## O problema

Farmácias pequenas administram estoque, vendas e a burocracia regulatória do
setor (controlados, receitas, prazos de validade, obrigações junto à ANVISA)
em ferramentas manuais ou desconectadas entre si. O auraFarma concentra as
duas frentes num único sistema, cobrado por mensalidade (modelo SaaS),
enxergando cada farmácia como um cliente isolado (multi-tenant por usuário).

## Estado atual do projeto

Este é um protótipo em desenvolvimento ativo, não um produto pronto. O que
está descrito abaixo distingue explicitamente o que **já funciona** do que
está **planejado**, porque é importante saber a diferença antes de avaliar o
código:

| Módulo | Status |
| --- | --- |
| Frontend (9 telas, React 19 + TypeScript) | ✅ funcional |
| Autenticação (registro, login, sessão, Google) | ✅ funcional, com backend real |
| Estoque, vendas (PDV), solicitados, contagem | ✅ persistidos no MongoDB, por farmácia |
| Busca de medicamentos (catálogo ANVISA, ~11,7 mil itens) | ✅ funcional (fuzzy search) |
| Assistente de IA (resumos e perguntas sobre os dados) | ✅ funcional via OpenRouter (opcional) |
| Conexão com PostgreSQL (Neon) | ✅ implementada, mas **sem tabelas/queries ainda** |
| Compliance regulatório (SNGPC, Portaria 344, validade de receita) | ⏳ **planejado** — schema e rotas ainda não implementados |
| Controle de pedidos (reposição ao distribuidor) | ⚠️ tela funcional, mas **dívida técnica**: persiste só em `localStorage`, ainda não migrou para o banco |

## Arquitetura

Monorepo informal com dois aplicativos independentes e um `package.json`
delegador na raiz:

```
aura-farma/
├── frontend/     React 19 + TypeScript + Vite — SPA (nenhum banco de dados próprio)
├── backend/      Node + Express + TypeScript — API HTTP + sessão
├── design/       Design original (HTML/JSX) que deu origem ao frontend
├── docs/         Notas técnicas pontuais (ex.: avaliação do MCP do Neon)
├── obsidian/     Documentação viva do projeto (mapas mentais + textos), ver abaixo
└── package.json  Delega scripts para frontend/ e backend/
```

Fluxo de dados: o frontend fala com o backend por uma camada de serviços
única (`frontend/src/services/dados.ts`), que hoje aponta para a API real por
padrão (`VITE_USE_MOCK=false`) e pode cair para um mock em `localStorage`
(`VITE_USE_MOCK=true`) para trabalhar sem subir o backend.

### Dois bancos de dados, de propósito específico

- **MongoDB** — banco principal. Guarda autenticação, sessões, estoque,
  vendas, solicitados e contagens, todos escopados por usuário (farmácia).
  Os documentos usam nomes de campo curtos (`n`, `sku`, `p`, `s`...) via alias
  do Mongoose, para caber no limite do cluster gratuito (500 MB); a API
  remapeia para nomes completos nas respostas.
- **PostgreSQL (Neon)** — reservado exclusivamente para o futuro módulo de
  compliance/SNGPC. A conexão (`backend/src/db/postgres.ts`) já existe e é
  **opcional**: sem `DATABASE_URL` o backend sobe normalmente só com MongoDB;
  com a variável definida, o pool conecta e o estado aparece em
  `/api/health` (`postgres: "conectado" | "erro" | "desativado"`). Ainda não
  há tabelas nem queries — só a infraestrutura de conexão.

A decisão de separar os bancos (em vez de migrar tudo para Postgres) está
documentada em `CLAUDE.md`: o módulo de compliance precisa de um schema mais
rico do que o produto atual tem (lista da Portaria 344, lote, CRM do médico,
número da receita, CPF/RG do comprador), e isolar essa parte em Postgres custa
2-3 semanas contra 5-8 de uma migração completa.

## Stack tecnológica

**Frontend** (`frontend/`)
- React 19 + TypeScript, build e dev server via Vite
- Sem framework de UI (Tailwind/shadcn) — CSS custom com tokens de tema
  (`index.css`), suporte a tema claro/escuro
- Estrutura em `components/` (UI reutilizável), `features/` (telas), `hooks/`,
  `services/` (camada de dados), `lib/` (cliente HTTP tipado, formatação)

**Backend** (`backend/`)
- Node.js + Express, TypeScript executado diretamente via `tsx` (sem etapa de
  build)
- **MongoDB + Mongoose** — banco principal (auth, estoque, vendas, etc.)
- **PostgreSQL (`pg`, node-postgres)** — pool de conexão para o Neon, reservado
  ao módulo de compliance (ainda sem schema)
- `express-session` + `connect-mongo` — sessão persistida no Mongo, cookie
  `httpOnly` (não há JWT no client)
- `bcryptjs` (custo 12) para senhas, `zod` para validação de payloads,
  `helmet` + `cors` + `express-rate-limit` para segurança/HTTP
- `google-auth-library` — login com Google via verificação de ID token
- `fuse.js` — busca fuzzy sobre o catálogo de ~11,7 mil medicamentos
  (`backend/data/MEDICAMENTOS_BUSCA.csv`, base pública da ANVISA)
- Integração opcional com **OpenRouter** para o assistente de IA, com cadeia
  de modelos de fallback

**Infraestrutura / deploy**
- Frontend hospedado na **Vercel** (estático, ver `frontend/vercel.json`)
- Backend hospedado no **Render** (servidor Node persistente, `render.yaml`
  já configurado como Blueprint)
- Passo a passo completo de deploy em `DEPLOY.md`

## Funcionalidades principais

- **PDV (tela "Vendas")** — monta o carrinho por busca ou leitura de código de
  barras, com stepper de quantidade e forma de pagamento; ao fechar a venda o
  backend confirma estoque suficiente e faz a baixa atomicamente
  (`POST /api/vendas`), sem etapa de gateway de pagamento (o método é hoje só
  um rótulo).
- **Estoque** — catálogo com busca, filtro por categoria e barra visual de
  estoque; o cadastro de produto pode ser pré-preenchido a partir da busca
  fuzzy no catálogo real da ANVISA (`GET /api/medicamentos/busca`).
- **Solicitados** — registra pedidos de clientes por produtos em falta,
  somando contagem de demanda a cada repetição, com promoção ao catálogo.
- **Contagem** — sessão de contagem física que compara o estoque do sistema
  com a contagem real e aplica o ajuste com o total de diferença.
- **Histórico e Relatórios** — vendas agrupadas por dia e análises de período
  (KPIs, gráfico de receita, top produtos), com resumo gerado por IA quando o
  OpenRouter está configurado.
- **Controle de pedidos (reposição ao distribuidor)** — sugere quantidade de
  reposição (≈ 2× o mínimo do produto), acompanha os estágios do pedido
  (aguardando → confirmado → em separação → entregue) e, ao marcar como
  entregue, atualiza o estoque real. Hoje é uma camada client-side isolada em
  `localStorage`; migrar para o banco é dívida técnica assumida antes do beta.
- **Compliance regulatório (Portaria 344 / SNGPC)** — módulo planejado: exigirá
  estender o schema de produto com a lista da Portaria 344 (A1/A2/A3/B1/B2/C1…)
  e capturar, na venda de controlados, lote, CRM do médico, número da receita
  e dados do comprador, além de um gerador de XML e transmissão automática ao
  SNGPC. A infraestrutura de banco (PostgreSQL/Neon) já está pronta para
  receber essa implementação.
- **Assistente de IA** — responde perguntas sobre os dados da própria
  farmácia, escopadas por área (estoque, vendas, pedidos...), e gera resumos
  automáticos no Dashboard/Relatórios.

## Pré-requisitos

- Node.js (LTS recente) e npm
- Uma instância de **MongoDB** acessível (local via `mongod` ou MongoDB
  Atlas) — obrigatória para o backend subir
- Opcional: uma instância de **PostgreSQL** (ex. Neon) se quiser testar a
  conexão do módulo de compliance
- Opcional: uma chave da **OpenRouter** para habilitar o assistente de IA
- Opcional: um **Client ID OAuth do Google** para habilitar o login com Google

## Como rodar localmente

```bash
git clone https://github.com/akira113p/aura-farma.git
cd aura-farma

# 1. Instalar dependências de cada app
npm --prefix frontend install
npm --prefix backend install

# 2. Configurar o backend (MongoDB é obrigatório)
cp backend/.env.example backend/.env
# edite backend/.env: preencha MONGODB_URI e gere um SESSION_SECRET com
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Subir o backend
npm --prefix backend run dev        # tsx watch → http://localhost:4000

# 4. Em outro terminal, subir o frontend
npm --prefix frontend run dev       # Vite → http://localhost:5173
```

Também é possível rodar tudo pelo `package.json` delegador na raiz:
`npm run dev` (frontend), `npm run dev:backend`, `npm run build`, `npm run lint`.

Verificações disponíveis:

```bash
npm --prefix frontend run build     # tsc -b && vite build
npm --prefix frontend run lint      # eslint
npm --prefix backend run typecheck  # tsc --noEmit (o backend roda via tsx, sem build)
npm --prefix backend run smoke      # smoke test E2E de auth com MongoDB in-memory
```

O frontend também roda **sem** backend: com `VITE_USE_MOCK=true` (defina em
`frontend/.env.local`, a partir de `frontend/.env.example`) ele usa dados em
memória/`localStorage` no lugar da API.

### Variáveis de ambiente

**Backend** (`backend/.env`, ver `backend/.env.example` e
`backend/src/config/env.ts`):

`PORT`, `NODE_ENV`, `MONGODB_URI` (obrigatória), `DATABASE_URL` (Postgres/Neon,
opcional), `SESSION_SECRET` (obrigatória), `FRONTEND_ORIGIN`,
`GOOGLE_CLIENT_ID` (opcional), `OPENROUTER_API_KEY` (opcional),
`OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODELS`, `OPENROUTER_PLANNER_MODEL`,
`OPENROUTER_REFERER`, `OPENROUTER_TITLE`.

**Frontend** (`frontend/.env.local`, ver `frontend/.env.example`):

`VITE_API_BASE_URL`, `VITE_USE_MOCK`.

> Nenhum segredo deve entrar em variáveis `VITE_*` — o bundle do frontend é
> público. `backend/.env` é ignorado pelo Git.

## Estrutura de pastas (resumo)

```
frontend/src/
  components/   componentes de UI reutilizáveis (Button, Card, Modal, Tabs...)
  features/     as 9 telas (Dashboard, Estoque, Vendas, Solicitados, Pedidos,
                 Historico, Contagem, Relatorios, AssistenteIA) + autenticação
  services/      camada de dados (dados.ts = ponto único mock ↔ API)
  lib/          cliente HTTP tipado, formatação, séries
  hooks/        hooks reutilizáveis (estado do app, IA, pedidos, tweaks)
  context/      contexto de autenticação
  types/        modelos de domínio compartilhados

backend/src/
  routes/       auth, medicamentos, dados (estoque/vendas/solicitados/contagem), ia
  models/       schemas Mongoose (User, Product/Sale/Request/Count/Activity)
  services/     catálogo de medicamentos, OpenRouter, verificação Google, seed
  db/           conexões MongoDB e PostgreSQL
  middleware/    autenticação, rate limit, tratamento de erro
  config/       leitura e validação de variáveis de ambiente
```

## Documentação adicional

- `CLAUDE.md` — guia técnico de arquitetura e decisões de projeto (mais
  detalhado do que este README).
- `DEPLOY.md` — passo a passo completo de deploy (Vercel + Render + MongoDB
  Atlas + Neon).
- `docs/` — notas técnicas pontuais (ex.: análise sobre uso do MCP do Neon).
- `obsidian/` — documentação viva do projeto em formato de mapas mentais e
  textos explicativos, em duas perspectivas (técnica e não técnica). Consulte
  esses arquivos para entender objetivos, modelo de negócio e decisões de
  arquitetura com mais profundidade do que cabe aqui.

## Licença

Este repositório não possui uma licença definida.
