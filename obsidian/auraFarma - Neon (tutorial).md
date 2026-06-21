---
titulo: auraFarma - Neon (tutorial)
tipo: guia de uso
relacionado: "[[auraFarma - Mapa Mental.md]]"
---

# Tutorial - PostgreSQL no Neon (passo a passo)

Guia simples para usar o **Neon** (PostgreSQL "serverless") no auraFarma. O Neon e
o banco que vamos usar para o modulo de **compliance/SNGPC** (dados que precisam
de integridade relacional e transacoes). O **MongoDB continua** sendo o banco
principal (auth, estoque, vendas). Nesta fase so ligamos a **conexao** - ainda
nao ha tabelas.

Visao tecnica do projeto: [[auraFarma - Mapa Mental.md]].

---

## 1. A duvida mais comum: a string de conexao OU o `neonctl`?

Sao **duas coisas diferentes e complementares** - nao e "uma ou outra":

| Coisa | O que e | Quem usa |
| --- | --- | --- |
| `postgresql://...` (connection string) | O endereco+senha que a **aplicacao** usa para falar com o banco | O backend, em tempo de execucao (via `backend/.env`) |
| `neonctl` / `npx neonctl@latest init` | Uma **ferramenta de linha de comando** para o desenvolvedor gerenciar o Neon (projetos, branches, roles) | Voce, no terminal |

Ou seja:
- A **connection string** vai no arquivo `backend/.env` e e o que faz o app conectar.
- O **`neonctl`** e opcional - serve para criar branches, pegar connection strings,
  abrir o `psql`, etc. Voce nao precisa dele para o app funcionar, mas ele ajuda no dia a dia.

---

## 2. Ligar o backend ao Neon (o essencial)

1. No [console do Neon](https://console.neon.tech), abra seu projeto e copie a
   **connection string**. Prefira a do endpoint **POOLED** (o host tem o sufixo
   `-pooler`, ex.: `...-pooler.sa-east-1.aws.neon.tech`). O pooler aguenta melhor
   varias conexoes.
2. Cole no arquivo `backend/.env` (que **nunca** e comitado):
   ```
   DATABASE_URL=postgresql://USUARIO:SENHA@SEU-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   - Mantenha o `?sslmode=require` (conexao criptografada obrigatoria).
   - Se deixar `DATABASE_URL` **vazio**, o Postgres fica **desativado** e o app
     sobe normalmente so com o MongoDB.
3. Suba o backend:
   ```
   npm --prefix backend run dev
   ```
   No log voce vera: `[pg] conectado ao PostgreSQL (Neon) em ...`.
4. Confira a saude:
   ```
   curl http://localhost:4000/api/health
   ```
   Resposta esperada: `{"ok":true,"postgres":"conectado"}`.
   - `desativado` = sem `DATABASE_URL`. `erro` = string errada / banco indisponivel.

> Primeira chamada lenta? Normal. No plano gratis o Neon "dorme" apos ~5 min sem
> uso e leva ~0,5-1s para acordar na primeira query.

---

## 3. `neonctl` - comandos do dia a dia (opcional)

Nao precisa instalar; rode com `npx`.

```bash
# Login (abre o navegador)
npx neonctl@latest auth

# Configura o projeto para assistentes de IA (e, se quiser, o MCP) - ver secao 5
npx neonctl@latest init

# Listar projetos
npx neonctl@latest projects list

# Pegar a connection string (cola no .env)
npx neonctl@latest connection-string
npx neonctl@latest connection-string --pooled       # versao pooled

# Abrir um psql interativo
npx neonctl@latest psql
```

---

## 4. Branches - copias do banco para testar (muito util)

O Neon cria **branches**: copias instantaneas do banco (como um "git branch", mas
do banco). Otimo para testar mudancas sem mexer no banco principal.

```bash
# Criar um branch de desenvolvimento a partir do main
npx neonctl@latest branches create --name dev/seunome --parent main

# Pegar a string desse branch (e usar no .env enquanto testa)
npx neonctl@latest connection-string dev/seunome

# Resetar o branch para ficar igual ao main de novo
npx neonctl@latest branches reset dev/seunome --parent main

# Apagar quando terminar
npx neonctl@latest branches delete dev/seunome
```

Quando o SNGPC entrar, isso vai permitir testar migrations e dados sem risco.

---

## 5. Quero usar o MCP do Neon com o Claude?

O Neon tem um **MCP** que deixa o Claude criar branches, rodar SQL, etc. Isso e
conveniente, mas tem implicacoes de seguranca (vamos guardar dados sensiveis de
controlados no futuro). **Leia a analise e a recomendacao antes de ativar:**
`docs/neon-mcp-analise.md`. Resumo: vale para **dev/testes com dados ficticios**,
em modo **somente leitura**; **nunca** em producao com dados reais.

---

## 6. Seguranca (importante)

- **Nunca comite o `.env`** (ja esta no `.gitignore`). No `.env.example` so vai
  placeholder. Nada de segredo em variaveis `VITE_*` (o frontend e publico).
- **Rotacione a senha** se ela vazar (ex.: foi colada num chat/print). No console:
  Roles -> resete a senha; depois atualize o `.env` e o painel do Render.
- **Use uma role de menor privilegio** para o app, em vez da dona do banco
  (`neondb_owner`). Quando criarmos tabelas:
  ```sql
  CREATE ROLE app_user WITH LOGIN PASSWORD 'senha-forte';
  GRANT CONNECT ON DATABASE neondb TO app_user;
  GRANT USAGE ON SCHEMA public TO app_user;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  ```
- **Queries sempre parametrizadas** (`$1, $2`...), nunca concatenando texto -
  evita SQL injection. Ex.: `pool.query('SELECT * FROM x WHERE id = $1', [id])`.
- Em producao (Render), `DATABASE_URL` fica no painel (Environment), com `sync:false`
  no `render.yaml` - nunca no repositorio.

---

## 7. Onde isso esta no codigo

- `backend/src/db/postgres.ts` - cria o pool (`pg`), valida com `SELECT 1`, faz o
  ping do health e fecha no shutdown. Loga so o host (nunca a senha).
- `backend/src/config/env.ts` - le `DATABASE_URL` (`isPostgresEnabled()`).
- `backend/src/index.ts` - conecta no boot (se habilitado), expoe no `/api/health`,
  e fecha tudo no encerramento gracioso (SIGTERM/SIGINT).

---

_Veja tambem: [[auraFarma - Mapa Mental.md]] e a analise do MCP em `docs/neon-mcp-analise.md`._
