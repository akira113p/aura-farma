# Monitoramento do auraFarma — guia para quem não é da área de tecnologia

Este guia foi escrito para o dono ou gestor da farmácia acompanhar a **saúde do sistema** sem precisar entender de programação. Sempre que aparecer um termo técnico, ele vem explicado em seguida.

A ideia é simples: o sistema tem uma "tela de saúde", deixa "registros" do que acontece e **avisa sozinho** quando algo sai do normal. Você não precisa decorar nada — basta saber **onde olhar** e **quando chamar o suporte**.

> **Semáforo do guia:** usamos as cores de um semáforo para facilitar.
> 🟢 = está tudo bem, pode seguir. 🟡 = atenção, fique de olho. 🔴 = problema, hora de agir.

---

## 1. Como saber se o sistema está bem agora

O sistema tem uma página especial que funciona como um **check-up rápido**: a chamada **tela de saúde**.

**Onde fica:** no endereço do sistema, acrescente `/api/health` no final.
Exemplo: se o sistema fica em `https://minhafarmacia.com`, a tela de saúde fica em
`https://minhafarmacia.com/api/health`.

> *O que é isso?* É um endereço de internet (uma "página") que, em vez de mostrar telas bonitas, devolve um **textinho com o estado atual do sistema**. É feito para ser lido rápido, inclusive por outros programas.

### Passo a passo
1. Abra o navegador (Chrome, Edge, etc.).
2. Digite o endereço do sistema seguido de `/api/health` e aperte Enter.
3. Vai aparecer um texto parecido com este:

```json
{
  "ok": true,
  "status": "saudavel",
  "banco": "conectado",
  "uptime": 86400,
  "memoria": { "usadaMb": 180, "totalMb": 512 },
  "versao": "1.4.2",
  "timestamp": "2026-06-20T14:30:00.000Z"
}
```

4. Olhe principalmente os campos **`ok`** e **`status`**. Eles resumem tudo.

### O que cada campo significa

| Campo | Em português simples | 🟢 Saudável | 🟡 Degradado | 🔴 Fora do ar |
|---|---|---|---|---|
| **`ok`** | "Está tudo certo?" (sim/não) | `true` (sim) | `true`, mas o `status` diz "degradado" | `false`, ou a página não abre |
| **`status`** | Resumo da saúde em uma palavra | `"saudavel"` | `"degradado"` (funciona, mas mal) | a página não responde / dá erro |
| **`banco`** | O "arquivo central" onde ficam estoque, vendas e cadastros está acessível? | `"conectado"` | — | `"desconectado"` ou página não abre |
| **`uptime`** | Há quanto tempo o sistema está ligado, em **segundos** (86400 = 1 dia) | número grande e crescente | número que **zera toda hora** (o sistema fica reiniciando) | a página não abre |
| **`memoria`** | Quanta "memória" o sistema está usando, em **MB** (`usadaMb` de `totalMb`) | usada bem abaixo do total | usada perto do total | a página não abre |
| **`versao`** | Qual versão do sistema está no ar | qualquer valor | qualquer valor | — |
| **`timestamp`** | Data e hora exatas dessa medição (no fuso universal, UTC) | data/hora de agora | — | — |

> *O que é "o banco"?* É onde o sistema guarda **tudo**: produtos, estoque, vendas, cadastros. Se o banco está "desconectado", o sistema não consegue ler nem salvar dados — é o problema mais sério.

> *O que é "memória"?* É o espaço de trabalho temporário do sistema, como uma bancada. Se a bancada lota (memória `usadaMb` perto da `totalMb`), tudo fica lento.

### O que fazer em cada caso

| Situação | O que significa | O que fazer |
|---|---|---|
| 🟢 `ok: true` e `status: "saudavel"` | Tudo funcionando | Nada. Pode trabalhar tranquilo. |
| 🟡 `status: "degradado"` | O sistema está de pé, mas com algum problema (banco lento, memória alta, etc.) | Avise o suporte técnico **sem urgência**. Continue usando, mas anote se ficar lento. |
| 🔴 `ok: false`, ou a página `/api/health` **não abre** | O sistema está com falha grave ou totalmente fora do ar | Chame o suporte técnico **agora** (veja a seção 5). |

---

## 2. O que é um request-ID e por que ele ajuda

Toda vez que alguém usa o sistema (registra uma venda, abre o estoque, etc.), o sistema gera um **número de protocolo** para aquele pedido. Esse número se chama **request-ID** (em português: "identificador do pedido").

> *Pense assim:* é igual ao **número de protocolo** de um atendimento no banco ou numa loja. Quando você liga reclamando, dão um número; com ele, a equipe acha exatamente o seu caso. O request-ID faz o mesmo dentro do sistema.

**Por que isso importa para você?**
Quando algo dá errado, em vez de dizer "deu um erro qualquer", você consegue passar **um número exato** para o suporte. Com esse número, o técnico encontra **em segundos** o que aconteceu naquele momento específico, sem precisar adivinhar.

### Onde encontrar o request-ID
- Quando uma tela mostra uma **mensagem de erro**, muitas vezes o número aparece junto. **Anote-o** (ou tire uma foto da tela).
- Tecnicamente, ele também vem em uma "etiqueta" da resposta do sistema chamada **`X-Request-Id`**. O suporte sabe onde olhar isso; você não precisa.
- Esse mesmo número aparece nos **registros** do sistema (a próxima seção), o que permite cruzar "o erro que você viu" com "o que o sistema anotou".

> **Dica de ouro:** ao relatar qualquer problema, sempre informe o request-ID se ele estiver visível. Isso economiza muito tempo.

---

## 3. Onde ficam os registros (logs) e como ler

O sistema mantém um **diário de bordo**: a cada coisa importante que acontece, ele escreve uma linha. Esse diário é chamado de **logs** (registros).

> *O que são "logs"?* É só uma palavra técnica para "registros" ou "histórico de eventos". Cada evento vira **uma linha**.

Cada linha é escrita em um formato chamado **JSON** — basicamente um texto com `"etiqueta": valor`, entre chaves `{ }`. Não precisa decorar; o importante é reconhecer **três etiquetas**:

- **`level`** → o "tipo" do registro (a gravidade).
- **`message`** (ou `msg`) → a descrição do que aconteceu, em texto.
- **`requestId`** → o número de protocolo (da seção 2), para cruzar com um erro que você viu.

### Os níveis (a gravidade de cada linha)

| `level` | Em português | Significa | Preocupa? |
|---|---|---|---|
| `info` | informação | Coisa normal do dia a dia (ex.: "venda registrada") | 🟢 Não |
| `warn` | aviso | Algo fora do comum, mas o sistema contornou | 🟡 Fique de olho |
| `error` | erro | Algo **falhou** de verdade | 🔴 Sim |

**Como reconhecer um problema rapidamente:** procure por linhas que contenham **`"level":"error"`**. São essas que indicam falha.

### Exemplos de linha de log, comentados

Uma linha **normal** (informação), nada a fazer:

```json
{"level":"info","message":"venda registrada","requestId":"a1b2c3","tempoMs":42}
```
- `"level":"info"` → 🟢 evento normal.
- `"message":"venda registrada"` → uma venda foi salva com sucesso.
- `"tempoMs":42` → demorou 42 milésimos de segundo (rápido).

Uma linha de **erro**, que merece atenção:

```json
{"level":"error","message":"falha ao salvar venda","requestId":"x9y8z7","erro":"banco indisponivel"}
```
- `"level":"error"` → 🔴 algo falhou.
- `"message":"falha ao salvar venda"` → uma venda **não** foi salva.
- `"requestId":"x9y8z7"` → é este número que você passa ao suporte.
- `"erro":"banco indisponivel"` → a causa: o banco (seção 1) estava fora.

> **Onde os logs ficam guardados?** No servidor onde o sistema roda (ou no painel do serviço de hospedagem). O suporte técnico tem acesso a eles. Você normalmente **não precisa** abri-los manualmente — esta seção é só para você entender o que o técnico está olhando quando pedir o request-ID.

---

## 4. Sinais de alerta automáticos

O sistema **vigia a si mesmo**. Quando algo sai do normal, ele **avisa sozinho** (por e-mail, mensagem ou no painel do serviço), sem você precisar ficar checando. Cada alerta tem um nome técnico, mas todos querem dizer algo simples:

| Alerta (o que você pode ler) | O que quer dizer, em português simples | Cor |
|---|---|---|
| **Sistema lento / "tempo de resposta alto"** | Os pedidos estão demorando mais que o normal para responder. Pode estar travando para os funcionários. | 🟡 |
| **Memória alta** | A "bancada de trabalho" do sistema está quase cheia (veja seção 1). Se lotar, pode travar. | 🟡 |
| **Uso de CPU alto** | O "motor" do sistema está sobrecarregado, processando demais. Costuma deixar tudo lento. | 🟡 |
| **Muitos erros** | Em pouco tempo, várias operações falharam (muitas linhas `"level":"error"`). | 🔴 |
| **Banco indisponível / fora do ar** | O sistema não está conseguindo falar com o banco. Vendas e cadastros podem não salvar. | 🔴 |
| **Sistema reiniciando / "uptime baixo"** | O sistema está ligando e desligando sozinho (o `uptime` da seção 1 fica zerando). | 🔴 |

> *O que é "CPU"?* É o "motor" que faz as contas do sistema. CPU alta = motor a todo vapor; se passar do limite por muito tempo, tudo fica lento.

**Regra prática:** alertas 🟡 (amarelos) pedem **atenção** — avise o suporte sem pânico. Alertas 🔴 (vermelhos) pedem **ação imediata** — chame o suporte na hora.

---

## 5. Quando chamar o suporte técnico

Use este guia rápido de decisão. A coluna da direita diz o que fazer.

| Se você observar... | Então... |
|---|---|
| 🟢 `/api/health` mostra `ok: true` e `status: "saudavel"`, e ninguém reclamou | Não faça nada. Está tudo bem. |
| 🟡 `status: "degradado"`, ou o sistema está **lento** mas funcionando | **Avise o suporte sem urgência.** Anote o horário e, se houver, o request-ID. Continue trabalhando. |
| 🟡 Chegou um alerta automático **amarelo** (lentidão, memória ou CPU alta) | **Avise o suporte** e diga qual alerta chegou. Não é emergência, mas não ignore. |
| 🔴 A página `/api/health` **não abre**, ou mostra `ok: false` | **Chame o suporte agora.** O sistema pode estar fora do ar. |
| 🔴 `banco` aparece como **desconectado**, ou vendas/cadastros **não salvam** | **Chame o suporte agora.** Pare de tentar salvar para não perder dados. |
| 🔴 Chegou um alerta automático **vermelho** (muitos erros, banco fora, sistema reiniciando) | **Chame o suporte agora.** |
| Apareceu uma **tela de erro** para um funcionário | Tire uma foto da tela. Se houver um **request-ID** (número de protocolo), anote-o e passe ao suporte. |

### O que informar ao suporte (deixe à mão)
Para o atendimento ser rápido, tenha em mãos:
1. **O que aconteceu** (ex.: "não consigo registrar venda").
2. **O horário** em que aconteceu.
3. **O `status`** que aparece em `/api/health` (saudavel / degradado / não abre).
4. **O request-ID** (número de protocolo), se ele apareceu na tela de erro.

> Com essas quatro informações, o suporte resolve muito mais rápido — especialmente com o request-ID, que aponta exatamente o registro da falha.

---

## Resumo de bolso

- 🩺 **Check-up rápido:** abra `/api/health`. Olhe `ok` e `status`.
- 🟢 saudável → trabalhe tranquilo. 🟡 degradado → avise o suporte. 🔴 não abre / `ok:false` → chame o suporte na hora.
- 🧾 **Deu erro?** Anote o **request-ID** (número de protocolo) e passe ao suporte.
- 📓 **Logs** são o diário do sistema; o que preocupa é `"level":"error"`.
- 🔔 **Alertas** chegam sozinhos: amarelos = atenção, vermelhos = ação imediata.
