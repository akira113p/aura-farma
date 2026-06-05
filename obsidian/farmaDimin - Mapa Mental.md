---
titulo: farmaDimin - Visao geral do projeto
tipo: documentacao
mapa: "[[farmaDimin - Mapa Mental.canvas]]"
---

# farmaDimin - Visao geral do projeto

Sistema de gestao para farmacias pequenas com foco em compliance burocratico e
integracao de compras com a Eurofarma. Versao em texto do mapa mental
[[farmaDimin - Mapa Mental.canvas]].

---

## 1. Objetivo

Resolver a burocracia pesada e a desorganizacao operacional de farmacias
pequenas, oferecendo um sistema de gestao completo com a Eurofarma integrada
como fornecedor direto.

## 2. Parceiros

- **Eurofarma** - parceria escolar; fornecedor integrado na plataforma.
- **Farmacias pequenas** - clientes finais (modelo SaaS).

## 3. Modelo de negocio

- SaaS - mensalidade por farmacia.
- Eurofarma ganha um canal de venda digital.
- Outros fornecedores podem ser adicionados no futuro.
- A farmacia nao precisa trocar o fornecedor atual: a Eurofarma entra como
  opcao a mais.

---

## 4. Estado atual

| Item | Status |
| --- | --- |
| Frontend React + TypeScript (Vite) | Pronto - 7 telas |
| Autenticacao (login, registro, logout) + Google OAuth | Pronto |
| bcrypt + sessao cookie httpOnly | Pronto |
| MongoDB conectado | Pronto |
| Base de medicamentos ANVISA (11.7k em memoria) | Pronto |
| Busca inteligente (fuzzy com Fuse.js) | Pronto |
| Estoque / vendas / solicitados / contagem no MongoDB (por usuario) | Pronto |
| Controle de validade (campo existe; alertas) | Em andamento |
| SNGPC | Planejado |
| Importacao de estoque CSV / NF-e | Planejado |
| Integracao Eurofarma | Planejado |
| Sistema de pagamento | Planejado |

---

## 5. Arquitetura

### Stack

- **Frontend** - React + TypeScript + Vite.
- **Backend** - Node.js + Express.
- **Banco de dados** - MongoDB (Atlas).
- **Autenticacao** - sessao via cookie httpOnly + bcrypt + Google OAuth.
- **Busca de medicamentos** - catalogo em memoria no Node + Fuse.js (fuzzy).
- **Dados da farmacia** - persistidos no MongoDB, escopados por usuario.
- **Pagamentos** - gateway brasileiro (planejado, fora do escopo atual).

### Decisoes arquiteturais

- O CSV da ANVISA fica em memoria no Node; nao sobe para o MongoDB.
- A busca de medicamentos roda no backend, nao no frontend.
- Estoque/vendas/solicitados/contagem ficam no MongoDB; o front fala pela API.
- Senhas com bcrypt; sessao via cookie httpOnly + Secure + SameSite.
- Segredos apenas no .env do servidor; o cliente (variaveis VITE_) nunca recebe
  segredo.

### Persistencia de dados (estoque e correlatos)

- **1 documento por produto** na colecao `products`, escopado por usuario; o
  mesmo padrao vale para vendas, solicitados, contagem e atividades.
- **Campos curtos no banco** (alias do Mongoose: `n/sku/ct/p/...`) para caber no
  cluster gratuito de 500MB; a API responde com os nomes completos.
- **Carga rapida**: `GET /api/estado` traz todo o estado numa unica chamada.
  Mutacoes: `/api/estoque` (CRUD), `/api/vendas` (baixa estoque no servidor),
  `/api/solicitados`, `/api/contagem`, `/api/estado/seed|reset`.
- **Rate-limit ("tickets")**: 120 escritas/min por usuario; leitura mais
  folgada; `maxTimeMS` como timeout de banco.
- **Tamanho medido**: 600 farmacias x 500 produtos (+ vendas) ~= 107MB sem
  compressao (~43MB com snappy), de 500MB.

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

## 6. Funcionalidades

### MVP escolar (prioridade)

- [x] Conectar o frontend ao backend (estoque/vendas/etc. via API).
- [x] Busca inteligente de medicamentos no estoque.
- [x] Controle de estoque persistido no MongoDB.
- [ ] SNGPC - envio automatico de controlados para a ANVISA.
- [ ] Controle de validade com alertas automaticos.
- [ ] Fluxo de pedido para a Eurofarma (pode ser simulado).

### Produto real (pos-banca)

- [ ] Integracao real via API com a Eurofarma.
- [ ] Importacao de estoque via CSV.
- [ ] Importacao de estoque via NF-e (XML).
- [ ] Outros fornecedores alem da Eurofarma.
- [ ] Sistema de pagamento integrado.
- [ ] Controle de psicotropicos por lote com rastreabilidade.
- [ ] Painel de vencimento de alvaras e licencas.
- [ ] Relatorios para o CRF.

---

## 7. Compliance e burocracia resolvida

- **SNGPC** - envio automatico dos controlados para a ANVISA. Elimina a
  obrigacao manual do farmaceutico e o risco de multa por atraso.
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

## 8. Base de medicamentos

- **Fonte** - ANVISA (dados abertos).
- **Total** - 11.759 medicamentos (catalogo de busca).
- **Campos** - nome do produto, principio ativo, classe terapeutica, empresa
  fabricante (a base ampla da ANVISA tambem traz situacao do registro e
  vencimento).
- **Armazenamento** - em memoria no Node.js.
- **Busca** - fuzzy via Fuse.js (tolerante a erro de digitacao), com
  re-ranking por prefixo.
- **Atualizacao** - job semanal que baixa um novo CSV da ANVISA (planejado).

---

## 9. Roadmap

- **Mes 1-2** - fechar o MVP escolar: conectar frontend ao backend (feito),
  busca de medicamentos (feito), SNGPC, controle de validade.
- **Mes 3-4** - validar com donos de farmacias reais.
- **Mes 5-6** - se validado, conversa formal com a Eurofarma sobre a API real;
  se nao, entregar um MVP excelente para a banca.

## 10. Apresentacao para a banca

- Prazo - aproximadamente 6 meses.
- O que importa - demonstrar que a ideia funciona, nao que esta em producao.
- Diferenciais - autenticacao segura de nivel profissional, base real da ANVISA,
  compliance burocratico e a parceria com a Eurofarma.

---

## 11. Referencias

- [Portal ANVISA Dados Abertos](https://www.gov.br/anvisa/pt-br/acessoainformacao/dadosabertos)
- [Consulta de Medicamentos ANVISA](https://consultas.anvisa.gov.br/#/medicamentos/)
- [Documentacao SNGPC](https://www.gov.br/anvisa/pt-br/assuntos/sngpc)
