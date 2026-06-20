# Observabilidade do deploy: monitoramento + rollback

Este documento explica, em linguagem simples, como o backend do **auraFarma**
sobe em producao (Render), como ele se monitora sozinho, e como reverter
(rollback) quando algo dá errado. É escrito para quem tem pouca experiência de
DevOps — basta seguir os passos numerados.

> O backend roda no **Render** (serviço `aura-farma-backend`, definido em
> [`render.yaml`](../render.yaml) na raiz do repo). O frontend roda no **Vercel**.
> Este guia trata do **backend no Render**, que é onde mora o estado (MongoDB,
> sessões, auth, estoque).

---

## 1. Como o deploy roda (passo a passo)

Cada deploy do backend segue sempre a mesma sequência:

1. **Push** — você faz `git push` na branch conectada ao Render (normalmente
   `main`).
2. **autoDeploy** — como `autoDeploy: true` está no `render.yaml`, o Render
   detecta o push e **inicia um deploy automaticamente**. Você não precisa
   clicar em nada.
3. **Build** — o Render roda `npm install` dentro de `backend/` (a chave
   `rootDir: backend` + `buildCommand: npm install`). Se o build falhar, o
   deploy para aqui e a versão antiga continua no ar.
4. **Health check** — depois do build, o Render sobe a versão nova e chama o
   endpoint `GET /api/health`. Esse endpoint responde `{ "ok": true }`
   (ver `backend/src/index.ts`). O caminho está fixado no `render.yaml` como
   `healthCheckPath: /api/health`.
5. **Vai ao ar (ou não)** — o trecho-chave:
   - Se o health check **passar**, o Render direciona o tráfego para a versão
     nova. Deploy concluído com sucesso.
   - Se o health check **falhar** (timeout, erro, app não sobe), o Render marca
     o deploy como **failed** e **mantém a versão antiga no ar**. Produção não
     cai.

Resumo visual:

```
push -> autoDeploy -> build (npm install) -> health check (/api/health)
                                                  |
                                  passou? --------+--------- falhou?
                                     |                          |
                            versão nova vai ao ar      versão antiga
                                                       continua no ar
```

---

## 2. Rollback automático (health-gated)

O Render faz **deploy health-gated**: a versão nova só recebe tráfego **depois**
de passar no health check de `/api/health`. Isso é o rollback automático na
prática:

- Se o build quebra, ou o app não sobe, ou `/api/health` não responde OK dentro
  do tempo limite, o Render **não promove** a versão nova.
- A versão anterior (que já estava saudável) **continua atendendo** os usuários.
- Você vê o deploy como **failed** no dashboard e pode investigar com calma —
  sem pressão, porque produção não foi afetada.

Por isso o `healthCheckPath` é a peça mais importante para o rollback
automático. Se ele for removido ou apontar para um caminho errado, o Render
deixa de proteger produção e pode promover uma versão quebrada.

> **Importante:** o health check só verifica se o app **sobe e responde**. Ele
> **não** detecta bugs funcionais (ex.: uma venda que grava errado, uma resposta
> 500 só em certas rotas, latência alta). Para esses casos, use o **rollback
> manual** (seção 3).

---

## 3. Rollback manual (passo a passo no dashboard do Render)

Use quando a versão nova **subiu saudável** no health check, mas está se
comportando mal (erros, lentidão, bug funcional que o health check não pega).

1. Entre no [dashboard do Render](https://dashboard.render.com/) e abra o
   serviço **`aura-farma-backend`**.
2. Abra a aba **"Events"** (em alguns layouts aparece como **"Deploys"**). Ali
   está o histórico de todos os deploys, com data/hora e o commit de cada um.
3. Encontre um deploy **anterior** que estava bom (um que você sabe que
   funcionava — geralmente o de antes do problema começar).
4. Clique nas opções desse deploy e escolha **"Rollback to this deploy"**.
5. Confirme. O Render **reativa aquele build imediatamente**, sem precisar
   rebuildar (é rápido).
6. Acompanhe o status até ficar **"Live"** e refaça a verificação da seção 4
   (health + uma ação real no app) para confirmar que voltou ao normal.

> Depois de um rollback manual, lembre-se: o código no repositório ainda tem o
> commit problemático. Corrija o bug (ou faça `git revert`) antes do próximo
> push, senão o `autoDeploy` vai subir a versão ruim de novo.

---

## 4. O que monitorar depois de um deploy

Logo após um deploy (automático ou manual), confira estes pontos:

### 4.1 Status do deploy e do health
- No dashboard do serviço, o status deve estar **"Live"** (verde). Se estiver
  **"Deploy failed"**, a versão antiga é que está no ar — abra os logs e
  investigue (seção 4.2).
- Teste o health você mesmo no navegador ou no terminal:
  ```bash
  curl https://<sua-url>.onrender.com/api/health
  # esperado: {"ok":true}
  ```

### 4.2 Logs
- No serviço, abra a aba **"Logs"**. Procure por:
  - Erros (`Error`, stack traces) logo após o boot.
  - As mensagens de boot do app (ex.: `[api] auraFarma ouvindo em ...`,
    `[api] CORS liberado para: ...`) — confirmam que subiu.
- O frontend está no Vercel; logs de função/build dele ficam no dashboard do
  Vercel, não no Render.

### 4.3 Latência e erros
- Na aba **"Metrics"** do serviço no Render dá pra ver uso de CPU/memória e
  tempo de resposta. Picos de memória no plano free podem reiniciar o serviço.
- Fique de olho em respostas **5xx** (erro do servidor) após o deploy — é o
  sinal mais comum de que a versão nova introduziu um problema que o health
  check não pegou. Se aparecerem, considere o rollback manual (seção 3).

### 4.4 Cuidado com o plano free
- No **plano `free`** o serviço **hiberna** após um período sem tráfego. A
  primeira requisição depois disso (incluindo um health check) pode demorar
  alguns segundos (cold start). Não confunda essa lentidão inicial com um deploy
  com problema.

---

## 5. Checklist de "deploy seguro"

Antes e depois de cada deploy, siga esta lista:

**Antes de dar push:**
1. [ ] Rodar o smoke localmente — não precisa de Mongo rodando (usa Mongo
   in-memory):
   ```bash
   npm --prefix backend run smoke
   ```
2. [ ] Rodar o typecheck do backend:
   ```bash
   npm --prefix backend run typecheck
   ```
3. [ ] Conferir que nenhuma env var nova obrigatória ficou faltando no painel do
   Render (ex.: se você adicionou uma variável obrigatória no código, ela
   precisa existir lá com `sync: false` ou valor preenchido — senão o boot
   falha e o health check reprova).

**Depois do push (deploy automático):**
4. [ ] Acompanhar o deploy no dashboard até ficar **"Live"**.
5. [ ] Testar `GET /api/health` (deve voltar `{"ok":true}`).
6. [ ] Fazer **uma ação real** no app (login + abrir o estoque, por exemplo)
   para garantir que não há bug funcional que o health check não detecta.
7. [ ] Dar uma olhada nos **Logs** e **Metrics** por alguns minutos.

**Se algo piorar:**
8. [ ] Se o health check reprovou → o Render já manteve a versão antiga
   (rollback automático). Investigue os logs e corrija antes do próximo push.
9. [ ] Se subiu mas está com erros/lentidão → faça o **rollback manual**
   (seção 3): Events > deploy bom anterior > "Rollback to this deploy".
10. [ ] Corrija o código (ou `git revert`) antes do próximo push, para o
   `autoDeploy` não reintroduzir o problema.

---

## Referências rápidas

| Item | Onde |
| --- | --- |
| Definição do serviço/deploy | [`render.yaml`](../render.yaml) (raiz do repo) |
| Endpoint de health | `GET /api/health` → `{ ok: true }` (`backend/src/index.ts`) |
| Smoke local (sem Mongo) | `npm --prefix backend run smoke` |
| Typecheck do backend | `npm --prefix backend run typecheck` |
| Dashboard de deploys/rollback | Render > `aura-farma-backend` > aba **Events** |
| Logs e métricas | Render > `aura-farma-backend` > abas **Logs** / **Metrics** |
