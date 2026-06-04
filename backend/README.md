# farmaDimin — Backend (API de autenticação)

Node.js + Express + **MongoDB** (Mongoose), em TypeScript. Por enquanto cobre
apenas **autenticação**: registro, login, logout e login com Google.

## Stack e decisões de segurança

- **Sessão + cookie httpOnly** (não JWT no localStorage). Sessões persistidas no
  MongoDB (`connect-mongo`); logout destrói a sessão de verdade.
- Cookie `httpOnly` + `SameSite=Lax` + `Secure` em produção.
- Senhas com **bcrypt** (`bcryptjs`, custo 12). Política: mín. 8 caracteres com
  letra + número + símbolo (validada no servidor).
- `username` único (case-insensitive) e `email` único; `passwordHash` nunca sai
  para o cliente (removido no `toJSON` e em `toSafeUser`).
- **Rate limit** nas rotas de auth (`express-rate-limit`).
- `helmet` para cabeçalhos de segurança; CORS restrito à origem do frontend com
  `credentials`.
- Login com Google via **verificação do ID token** (`google-auth-library`,
  equivalente a `jwt.verify` — checa assinatura, audience e expiração).
- Segredos só em `.env` (no `.gitignore`); o `Client ID` do Google é público.

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste:

```bash
cd backend
cp .env.example .env
# gere um SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Precisa de um MongoDB acessível (local `mongod` ou MongoDB Atlas) em `MONGODB_URI`.
O login com Google só ativa quando `GOOGLE_CLIENT_ID` estiver preenchido.

## Rodar

```bash
cd backend
npm install
npm run dev        # http://localhost:4000 (tsx watch)
npm run typecheck  # tsc --noEmit
```

## Endpoints (`/api/auth`)

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/register` | cria conta (`username`, `pharmacyName`, `email`, `password`) e inicia sessão |
| POST | `/login` | `identifier` (e-mail **ou** usuário) + `password` |
| POST | `/logout` | destrói a sessão |
| GET | `/me` | usuário autenticado atual (ou 401) |
| GET | `/google/config` | `{ enabled, clientId }` para o frontend inicializar o botão |
| POST | `/google` | verifica o ID token; loga se a conta existe, senão `{ needsProfile: true }` |
| POST | `/google/complete` | cria a conta Google com `username` + `pharmacyName` coletados |

## Pendente (planejado)

- 2FA por e-mail (após a conta existir).
- Cancelamento de plano integrado ao pagamento.
- Migrar o store de dados de estoque do frontend (`localStorage`) para coleções
  reais aqui.
