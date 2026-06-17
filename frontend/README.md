# Euro Farma — Protótipo (Frontend)

Interface em **React + TypeScript** (Vite). Por enquanto **sem back end e sem banco de dados**,
mas a arquitetura já está preparada para um back end **Node + MongoDB** no futuro.

## Stack

- **React 19 + TypeScript**
- **Vite** (dev server e build)
- Camada de dados desacoplada (`mock` agora → API real depois)

## Estrutura de pastas

```
src/
  components/   # componentes de UI reutilizáveis
  features/     # telas / fluxos de negócio (compõem components)
  hooks/        # hooks React reutilizáveis
  lib/          # utilitários (apiClient = wrapper de fetch tipado)
  services/     # camada de acesso a dados (mock hoje, API/MongoDB depois)
  types/        # modelos de domínio compartilhados
  config.ts     # configuração lida de variáveis VITE_*
```

## Preparado para MongoDB

- `src/lib/apiClient.ts` é um cliente HTTP tipado já apontando para `VITE_API_BASE_URL`.
- `src/config.ts` expõe `useMock`: enquanto `VITE_USE_MOCK=true`, a UI roda com dados
  em memória e **não precisa de back end**. Ao subir o back end (`backend/` ao lado deste
  `frontend/`), basta definir `VITE_USE_MOCK=false`.
- `src/types` espelha o formato dos documentos das futuras coleções MongoDB
  (`Entity.id` ↔ `_id`).

## Telas implementadas

Porte completo do design `auraFarma.html` para React + TypeScript:

- **Dashboard** — resumo por IA, KPIs (receita, lucro, ticket médio), gráfico de
  receita e listas de mais vendidos / repor com urgência.
- **Produtos** — catálogo com busca, filtro por categoria, barra de estoque e
  modal de criar/editar/excluir.
- **Vendas (PDV)** — leitor de código de barras, busca, carrinho com stepper de
  quantidade, formas de pagamento e baixa automática de estoque.
- **Solicitados** — pedidos de clientes, contagem de demanda e promoção ao catálogo.
- **Histórico** — vendas agrupadas por dia, expansíveis por item.
- **Contagem** — sessão de contagem física com cálculo de diferença e ajuste.
- **Relatórios** — análise por IA, KPIs, gráfico e top produtos / sugestões.

Tema claro/escuro e densidade vêm dos tokens CSS do design (`useTweaks`); o toggle
de tema fica na barra superior. O painel de "tweaks" do protótipo era ferramenta
de design e não foi portado.

> Componentes em `src/components`, telas em `src/features`, lógica de dados em
> `src/services` + `src/lib`. A persistência atual é `localStorage`
> (`services/store.ts`) — o ponto exato a trocar por chamadas de API/MongoDB.

## Como rodar

```bash
cd frontend
npm install        # já executado
cp .env.example .env.local   # opcional; defaults já funcionam com mock
npm run dev        # http://localhost:5173
npm run build      # type-check (tsc) + build de produção
npm run lint
```
