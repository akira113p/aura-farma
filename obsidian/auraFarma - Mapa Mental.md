---
titulo: auraFarma - Visao geral do projeto
tipo: documentacao
mapa: "[[auraFarma - Mapa Mental.canvas]]"
---

# auraFarma - Visao geral do projeto

Sistema de gestao para farmacias pequenas com foco em compliance burocratico e
integracao de compras com distribuidoras. Versao em texto do mapa mental
[[auraFarma - Mapa Mental.canvas]].

---

## 1. Objetivo

Resolver a burocracia pesada e a desorganizacao operacional de farmacias
pequenas, oferecendo um sistema de gestao completo com integracao de pedidos
diretamente com a distribuidora.

## 2. Parceiros e modelo de negocio

- **Distribuidoras** - alvo da integracao de pedidos; ganham canal de venda
  digital e visibilidade da demanda das farmacias que atendem.
- **Farmacias pequenas** - clientes finais; foco em genericos, onde a margem
  importa mais. Modelo SaaS: mensalidade por farmacia.
- **Eurofarma** - parceria escolar que da credibilidade ao projeto; papel tecnico
  secundario (a integracao mira a distribuidora, nao a industria diretamente).

### Modelo de dois lados

- Farmacia ganha: gestao completa + compra facil integrada.
- Distribuidora ganha: canal de venda digital + visibilidade da demanda.

---

## 3. Estado atual

| Item | Status |
| --- | --- |
| Frontend React + TypeScript (Vite) | Pronto - 9 telas |
| Autenticacao (login, registro, logout) + Google OAuth | Pronto |
| bcrypt + sessao cookie httpOnly | Pronto |
| MongoDB conectado | Pronto |
| Base de medicamentos ANVISA (11.7k em memoria) | Pronto |
| Busca inteligente (fuzzy com Fuse.js) | Pronto |
| Estoque / vendas / solicitados / contagem no MongoDB (por usuario) | Pronto |
| Assistente IA (OpenRouter) + resumo automatico (Dashboard/Relatorios) | Pronto |
| Observabilidade de producao (logs JSON, request-ID, health, metricas, alertas) | Pronto |
| Pedidos - demo de logistica com distribuidora | Divida tecnica (so em localStorage) |
| Controle de validade com alertas | Em andamento |
| SNGPC (PostgreSQL Neon) | Planejado |
| Importacao de estoque CSV / NF-e | Planejado |
| Integracao distribuidora (API real) | Planejado |
| Sistema de pagamento | Planejado |

---

## 4. Arquitetura

### Stack

- **Frontend** - React + TypeScript + Vite.
- **Backend** - Node.js + Express.
- **Banco principal** - MongoDB Atlas (auth, estoque, vendas, solicitados, contagem).
- **Banco de compliance** - PostgreSQL Neon (SNGPC, controlados, lotes, receitas).
- **Autenticacao** - sessao via cookie httpOnly + bcrypt + Google OAuth.
- **Busca de medicamentos** - catalogo em memoria no Node + Fuse.js (fuzzy).
- **IA** - OpenRouter, com a chave guardada apenas no backend; fluxo de 2
  estagios e seletor de escopo (ver secao 7).
- **Pagamentos** - gateway brasileiro (planejado, fora do escopo atual).

### Por que dois bancos

- Migrar tudo para PostgreSQL custaria 5-8 semanas reescrevendo o que ja funciona.
- Adicionar Postgres so para o modulo de compliance custa 2-3 semanas sem risco.
- MongoDB permanece para o que ja esta testado; PostgreSQL entra apenas para
  SNGPC, que precisa de integridade relacional e transacoes ACID.
- Multiplos bancos de proposito especifico e padrao da industria, nao gambiarra.

### Decisoes arquiteturais

- O CSV da ANVISA fica em memoria no Node; nao sobe para o MongoDB.
- A busca de medicamentos roda no backend, nao no frontend.
- Estoque/vendas/solicitados/contagem ficam no MongoDB; o front fala pela API.
- Compliance (SNGPC) vai para PostgreSQL Neon quando implementado.
- Senhas com bcrypt; sessao via cookie httpOnly + Secure + SameSite.
- Segredos apenas no .env do servidor; o cliente (variaveis VITE_) nunca recebe
  segredo - inclusive a chave da IA (OpenRouter) so existe no backend.
- IA em 2 estagios: uma IA pequena planeja quais dados buscar, o backend roda as
  consultas escopadas por usuario, e a IA principal responde.

### Persistencia de dados (estoque e correlatos)

- **1 documento por produto** na colecao `products`, escopado por usuario; o
  mesmo padrao vale para vendas, solicitados, contagem e atividades.
- **Campos curtos no banco** (alias do Mongoose: `n/sku/ct/p/...`) para caber no
  cluster gratuito de 500MB; a API responde com os nomes completos.
- **Carga rapida**: `GET /api/estado` traz todo o estado numa unica chamada.
  Mutacoes: `/api/estoque` (CRUD), `/api/vendas` (baixa estoque no servidor),
  `/api/solicitados`, `/api/contagem`, `/api/estado/seed|reset`.
- **Rate-limit**: 120 escritas/min por usuario; leitura mais folgada;
  `maxTimeMS` como timeout de banco.

### Estrutura de pastas (resumo)

```
prototipo/
  frontend/                 app React (Vite)
  backend/                  API Node/Express
    data/MEDICAMENTOS_BUSCA.csv   catalogo de busca (11.759 itens)
  obsidian/                 estes mapas e textos
  .claude/skills/           skills (vibe-security, emil-design-eng, update-obsidian-docs...)
  CLAUDE.md                 guia do projeto
```

---

## 5. Funcionalidades

### MVP escolar (prioridade)

- [x] Conectar o frontend ao backend (estoque/vendas/etc. via API).
- [x] Busca inteligente de medicamentos no estoque.
- [x] Controle de estoque persistido no MongoDB.
- [x] Demo de pedido para distribuidora (tela Pedidos, so no navegador).
- [x] Assistente IA sobre os dados da farmacia + resumo automatico.
- [ ] Controle de validade com alertas automaticos.
- [ ] SNGPC - envio automatico de controlados para a ANVISA.

### Divida tecnica (antes do beta)

- [ ] Persistir Pedidos no banco (hoje so em localStorage).

### Produto real (pos-banca)

- [ ] Integracao real via API com distribuidora.
- [ ] Importacao de estoque via CSV.
- [ ] Importacao de estoque via NF-e (XML).
- [ ] Outros fornecedores alem da distribuidora principal.
- [ ] Sistema de pagamento integrado.
- [ ] Controle de psicotropicos por lote com rastreabilidade.
- [ ] Painel de vencimento de alvaras e licencas.
- [ ] Relatorios para o CRF.

---

## 6. Compliance e burocracia

### SNGPC (planejado - PostgreSQL)

Nao e uma API de tempo real. A farmacia gera um arquivo XML no formato exigido
pela ANVISA com as movimentacoes do periodo e envia periodicamente.

- **Campo `listaPortaria344`** no produto (A1/A2/A3/B1/B2/C1...) determina o
  fluxo de venda e o tipo de relatorio. Nao basta `controlado: boolean` - cada
  lista tem regras de receita distintas.
- **Venda de controlado** precisa capturar: numero do lote, CRM do medico,
  numero da receita, CPF/RG do comprador, endereco do comprador.
- **Implementacao em 3 camadas:**
  1. Formularios de entrada/saida coletando os dados obrigatorios (Postgres).
  2. Gerador de XML no formato ANVISA.
  3. Envio automatico (por ultimo; processo de homologacao e burocrático).
- Venda normal continua como esta; venda de controlado ganha documento separado.

### Outros itens de compliance

- **Controle de validade** - alertas de medicamentos proximos do vencimento.
  Produto vencido na prateleira e infracao grave.
- **NF-e XML** - entrada automatica de mercadoria pela nota fiscal; concilia o
  que entrou do fornecedor com o que esta no sistema.
- **Alvaras e licencas** - painel de vencimento do alvara sanitario, do CRF e da
  licenca de funcionamento.
- **Relatorios CRF** - geracao automatica de relatorios para o Conselho Regional
  de Farmacia.
- **Rastreabilidade por lote** - controle de psicotropicos por lote, facilitando
  recall de fabricante.

---

## 7. Base de medicamentos

- **Fonte** - ANVISA (dados abertos).
- **Total** - 11.759 medicamentos ativos (catalogo de busca).
- **Campos** - nome do produto, principio ativo, classe terapeutica, empresa
  fabricante.
- **Armazenamento** - em memoria no Node.js (nao no MongoDB).
- **Busca** - fuzzy via Fuse.js (tolerante a erro de digitacao), com
  re-ranking por prefixo.
- **Atualizacao** - job semanal que baixa um novo CSV da ANVISA (planejado).

---

## 8. Assistente IA (OpenRouter)

- **Provedor** - OpenRouter, com a chave guardada **apenas no backend**
  (`OPENROUTER_API_KEY`); o frontend nunca a ve. Tudo passa por `/api/ia/*`.
- **Resumo automatico** - o "texto pronto" do Dashboard e dos Relatorios e
  gerado por IA; em qualquer falha, cai num resumo deterministico.
- **Tela Assistente** - uma pergunta por vez, **sem contexto das anteriores**;
  o historico das respostas fica **so no navegador** (localStorage).
- **Fluxo de 2 estagios** (para gastar pouco):
  1. uma IA pequena (planejador) decide quais consultas de dados fazer;
  2. o backend roda essas consultas **escopadas por usuario**;
  3. a IA principal responde com os dados certos.
- **Seletor de escopo** - limita onde a IA pode "enxergar" (estoque, vendas,
  pedidos, etc.), reduzindo a chance de erro/alucinacao.
- **Fallback de modelos** - se um modelo falha, tenta o proximo da lista.

---

## 9. Pedidos (logistica distribuidora)

- **Demo** de reposicao com distribuidora - exemplo de como funcionaria a
  logistica usando uma API real.
- Sugere a quantidade a repor a partir do estoque minimo de cada produto.
- Acompanha os estagios do pedido: aguardando, confirmado, em separacao, entregue.
- **DIVIDA TECNICA:** vive **so no navegador** (localStorage, `aurafarma.pedidos.v1`);
  precisa persistir no banco antes do beta.

---

## 10. Observabilidade e monitoramento (producao)

- **Request-ID unico** - cada requisicao recebe um ID no cabecalho `X-Request-Id`,
  propagado do frontend ao backend.
- **Logs estruturados em JSON** - uma linha JSON por evento; nivel controlado por
  `LOG_LEVEL`. Campos sensiveis sao redigidos.
- **Erros com contexto** - stack trace completo + contexto no log; a resposta HTTP
  nunca expoe a stack.
- **Health check detalhado** - `GET /api/health`: `ok`, `status`, `banco`,
  `uptime`, `memoria`, `versao`.
- **Metricas de performance** - tempo de resposta (media e p95), memoria, CPU,
  contadores por faixa de status.
- **Query logging** - cada consulta ao Mongoose loga colecao, operacao e tempo.
- **Cache com hit/miss** - catalogo de busca e (opcional) OpenRouter.
- **Alertas configuraveis** - thresholds por env com cooldown.
- **Deploy health-gated** no Render com rollback documentado.

---

## 11. Roadmap

- **Imediato** - controle de validade com alertas.
- **Seguinte** - SNGPC (PostgreSQL Neon; maior trabalho).
- **Antes do beta** - persistir Pedidos no banco.
- **Meses 3-4** - validar com donos de farmacias reais (pagariam? quanto?).
- **Meses 5-6** - se validado, iniciar conversa formal com distribuidora sobre
  API real; se nao, entregar MVP excelente para a banca.

## 12. Apresentacao para a banca

- Prazo - aproximadamente 6 meses.
- O que importa - demonstrar que a ideia funciona, nao que esta em producao.
- Diferenciais - autenticacao segura de nivel profissional, base real da ANVISA,
  compliance burocratico (SNGPC), integracao com distribuidora, parceria Eurofarma.
- Quantificar a pesquisa em numeros inteiros ("8 de 10 farmacias" em vez de "80%").

---

## 13. Referencias

- [Portal ANVISA Dados Abertos](https://www.gov.br/anvisa/pt-br/acessoainformacao/dadosabertos)
- [Consulta de Medicamentos ANVISA](https://consultas.anvisa.gov.br/#/medicamentos/)
- [Documentacao SNGPC](https://www.gov.br/anvisa/pt-br/assuntos/sngpc)
