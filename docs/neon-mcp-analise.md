# Análise: devemos usar o MCP do Neon?

Decisão de ferramentas para o auraFarma. Avalia o **MCP (Model Context Protocol)
do Neon** — o servidor que permite a um assistente de IA (Claude Code, Cursor…)
gerenciar o banco PostgreSQL do Neon por linguagem natural.

**TL;DR — recomendação:** usar o MCP do Neon **apenas em desenvolvimento/testes,
contra branches com dados fictícios, em escopo somente-leitura (OAuth)**.
**Não habilitar contra produção** nem contra qualquer banco com dados reais de
controlados (CPF/RG, receita, CRM). Para a fase atual (protótipo, sem dados
reais) vale a pena pela produtividade do branching; defina uma estratégia de
saída antes de entrar dado sensível.

---

## O que é o MCP do Neon

- Pacote oficial: `@neondatabase/mcp-server-neon`; há também um **MCP hospedado**
  em `https://mcp.neon.tech/mcp`.
- Docs: https://neon.com/docs/ai/neon-mcp-server
- Traduz pedidos em linguagem natural do agente em chamadas à API do Neon.

### Capacidades expostas ao agente (30+ ferramentas)
- **Projetos/branches:** `create_project`, `create_branch`, `delete_branch`,
  `reset_from_parent`, `compare_database_schema`…
- **SQL:** `run_sql`, `run_sql_transaction`, `get_database_tables`,
  `describe_table_schema`, `get_connection_string`.
- **Migrations:** `prepare_database_migration`, `complete_database_migration`.
- **Performance:** `list_slow_queries`, `explain_sql_statement`, tuning.
- **Auth/Data API e documentação.**

Ou seja: o agente pode **ler e modificar** estrutura e dados, rodar migrations e
pegar connection strings.

### Autenticação
- **OAuth** (recomendado, no MCP hospedado): fluxo pelo navegador, permite
  escolher **escopo somente-leitura**.
- **API key** (MCP local): chave no header; se vazar, dá acesso amplo.

---

## Riscos (com o nosso caso em mente)

O auraFarma vai guardar, no futuro, **dados sensíveis de medicamentos controlados**
(SNGPC): CPF/RG do comprador, número de receita, CRM do médico. Isso muda o cálculo
de risco:

1. **Operações destrutivas sem revisão de código.** O MCP pode `DROP`/`DELETE`/
   alterar schema mediante apenas a confirmação no chat — não passa por PR/review.
2. **Erro do LLM ou prompt adversário** pode modificar/apagar registros sensíveis.
3. **Conformidade.** Dados pessoais/de saúde têm exigências legais (LGPD); expor
   esse banco a um agente de IA aumenta a superfície de risco e auditoria.
4. **Exfiltração de credencial.** Uma API key exposta a um MCP malicioso vaza o
   banco inteiro.

O **próprio Neon recomenda**: usar o MCP **só em dev/test, não em produção**,
**sempre revisar** as ações pedidas pelo LLM, **restringir a usuários confiáveis**
e **não expor dados de produção**.

---

## Prós e contras para um protótipo escolar

**A favor de habilitar (agora):**
- Iteração rápida de schema/SQL por linguagem natural.
- **Branching do Neon** fica trivial: criar/resetar bancos de teste efêmeros — ótimo
  para CI e para experimentar migrations do SNGPC sem risco.
- Com **OAuth somente-leitura**, limita-se a consultas e inspeção (sem escrita).

**Contra (ou cuidado):**
- Assim que entrar **dado real de controlados**, o risco supera o ganho.
- Sem disciplina de revisão, uma ação do LLM pode quebrar o banco.

---

## Recomendação operacional

1. **Agora (protótipo, dados fictícios):** pode habilitar via `npx neonctl@latest init`,
   preferindo o **MCP hospedado com OAuth em escopo read-only**. Use-o sobre
   **branches de dev** (`dev/...`), nunca sobre o branch que vira produção.
2. **Antes de qualquer dado real de controlado:**
   - **Desabilitar o MCP** em produção (e em qualquer branch com dado real).
   - Migrations **versionadas e revisadas** (ex.: Drizzle + drizzle-kit), não via agente.
   - **Role de menor privilégio** para o app (não `neondb_owner`); chave de admin separada.
   - **RLS** (Row-Level Security) e **audit log** no Postgres.
3. **Sempre:** revisar toda ação de escrita sugerida pelo agente antes de confirmar.

---

## Alternativa sem MCP (suficiente hoje)

Para o que precisamos agora, **`neonctl` + a connection string** já bastam:
gerenciar branches, pegar strings e rodar `psql` pelo terminal — sem dar a um
agente acesso direto ao banco. Veja o tutorial em
`obsidian/auraFarma - Neon (tutorial).md`.

---

## Fontes
- Neon MCP Server — https://neon.com/docs/ai/neon-mcp-server
- Repositório — https://github.com/neondatabase/mcp-server-neon
- Segurança do Neon — https://neon.tech/docs/security/
- neonctl CLI — https://neon.com/docs/reference/neon-cli
