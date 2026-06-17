# Euro Farma — Protótipo

Protótipo da interface do projeto **auraFarma**.

## Estado atual

| Item | Status |
| --- | --- |
| Front end React + TypeScript (Vite) | ✅ em `frontend/` |
| Implementação das 7 telas do design | ✅ portadas para TSX (build + lint limpos) |
| Arquitetura preparada para MongoDB | ✅ camada de dados desacoplada (mock → API) |
| Back end + banco de dados | ⏳ ainda não — planejado: Node + **MongoDB** |
| Skills do Claude ativadas | ✅ instaladas em `.claude/skills/` |
| Design `auraFarma.html` | ✅ salvo em `design/` e implementado |

## Estrutura

```
prototipo/
  .claude/skills/            # skills ativadas para este projeto
    emil-design-eng/         #   polimento de UI / design engineering
    vibe-security/           #   auditoria de segurança
  frontend/                  # app React + TypeScript (Vite)
  skill/                     # repositório-fonte da skill de design (referência)
  vibe-security-skill/       # repositório-fonte da skill de segurança (referência)
```

## Skills ativadas

As duas skills foram copiadas para `.claude/skills/`, que é onde o Claude Code
descobre skills no nível do projeto. Elas ficam disponíveis automaticamente ao
iniciar uma nova sessão neste diretório:

- **emil-design-eng** — filosofia de design engineering (animações, polimento de
  UI, micro-interações). É a skill "para melhorar o projeto".
- **vibe-security** — auditoria de vulnerabilidades comuns em apps gerados por IA.

> Os diretórios originais `skill/` e `vibe-security-skill/` foram mantidos como
> referência (são repositórios git). As cópias ativas vivem em `.claude/skills/`.

## Design

O link original do design retornava **HTTP 404** (autenticado por sessão / sem
credenciais minhas). Os arquivos foram salvos manualmente em `design/`
(`auraFarma.html` + `app.jsx`, `components.jsx`, `screens-*.jsx`, `data.js`,
`styles.css`) e portados para React + TypeScript em `frontend/`.

O protótipo original era React 18 via Babel standalone com um único store em
`localStorage`. No port:

- JSX → **TSX tipado**, dividido em `components/`, `features/`, `services/`, `lib/`, `hooks/`.
- `styles.css` foi para `frontend/src/index.css` (tokens de tema/densidade preservados).
- O store virou `services/store.ts` — **o ponto único a trocar por API/MongoDB**.
- O painel de "tweaks" (ferramenta de design) não foi portado; o toggle de tema
  permanece na barra superior.
