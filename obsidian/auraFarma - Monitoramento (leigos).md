---
titulo: auraFarma - Monitoramento (para leigos)
tipo: guia de uso
relacionado: "[[auraFarma - Como Funciona (texto).md]]"
---

# Monitoramento do auraFarma - guia simples

Este guia ensina, sem jargao, a **acompanhar a saude do sistema** no dia a dia.
Nao precisa saber programar. Se quiser um pouco mais de detalhe tecnico, veja
[[auraFarma - Monitoramento (intermediario).md]].

Pense num **painel de carro**: ele mostra se o motor esta bem e acende uma luz
quando algo precisa de atencao. O auraFarma tem algo parecido.

---

## 1. Como saber se esta tudo bem agora

Existe um endereco chamado **tela de saude**. E so abrir no navegador:

```
https://SEU-ENDERECO/api/health
```

(troque `SEU-ENDERECO` pelo endereco do seu sistema). Vai aparecer um texto
parecido com isto:

```
{
  "ok": true,
  "status": "saudavel",
  "versao": "1.0.0",
  "banco": { "conectado": true, "estado": "conectado" },
  "uptimeSegundos": 86400,
  "memoria": { "rssMb": 120, "heapUsadoMb": 80 }
}
```

Voce nao precisa entender tudo. Olhe so o **semaforo**:

| O que voce ve | Significa | O que fazer |
| --- | --- | --- |
| `"status": "saudavel"` e `"ok": true` | Verde - tudo certo | Nada. So acompanhar. |
| `"status": "degradado"` | Amarelo - algo nao esta 100% (ex.: o banco caiu) | Avise o suporte tecnico; tire um print da tela. |
| A pagina nao abre / da erro | Vermelho - sistema fora do ar | Chame o suporte com urgencia. |

### Os campos, em portugues

| Campo | O que e |
| --- | --- |
| `ok` / `status` | O resumo da saude (verde/amarelo). |
| `banco.conectado` | Se o sistema esta falando com o banco de dados (onde ficam estoque e vendas). |
| `uptimeSegundos` | Ha quanto tempo o sistema esta ligado sem reiniciar. |
| `memoria` | Quanta memoria o sistema esta usando (como a "RAM" do computador). |
| `versao` | Qual versao do sistema esta no ar. |

---

## 2. O "numero de protocolo" (request-ID)

Toda vez que voce faz algo no sistema (abrir o estoque, registrar uma venda), o
sistema cria um **numero de protocolo** unico para aquele pedido - igual ao
protocolo que o banco te da por telefone.

- **Para que serve:** se algo der errado, esse numero permite o suporte achar
  **exatamente** o que aconteceu, no meio de milhares de registros.
- **Onde aparece:** quando uma tela mostra um erro, costuma vir um codigo desse
  tipo. Anote-o (ou tire um print) e passe ao suporte.

So isso ja torna qualquer problema **muito mais rapido de resolver**.

---

## 3. Os "registros" (logs)

Nos bastidores, o sistema **anota tudo o que faz** num caderno digital - sao os
*logs*. Voce normalmente nao precisa abrir isso; quem usa e o suporte. Mas vale
saber:

- Cada anotacao tem um **nivel**: `info` (rotina), `warn` (aviso) ou
  `error` (problema).
- Quando algo quebra, o suporte procura pelas anotacoes de **erro** e usa o seu
  numero de protocolo para chegar na causa.

---

## 4. Avisos automaticos

O sistema **avisa sozinho** quando algo foge do normal, por exemplo:

- esta **lento** (demorando demais para responder);
- esta usando **memoria demais**;
- esta dando **muitos erros** seguidos.

Esses avisos ficam nos registros para o suporte. Se voce perceber o sistema
estranho (lento, travando), e provavel que esses avisos ja tenham disparado -
mencione isso ao suporte.

---

## 5. Atualizacoes seguras

Quando o sistema recebe uma **atualizacao**, ele primeiro confere a tela de
saude. Se a versao nova nasce com defeito, ele **mantem a versao boa anterior
no ar** - ou seja, a farmacia nao fica na mao. Se preciso, o suporte pode
**voltar para a versao anterior** com poucos cliques.

---

## 6. Quando chamar o suporte

| Situacao | O que fazer |
| --- | --- |
| Tela de saude verde, mas algo parece estranho | Anote o numero de protocolo do erro e avise. |
| Tela de saude **amarela** (degradado) | Avise o suporte; mande um print. |
| Tela de saude nao abre / **vermelha** | Chame o suporte com **urgencia**. |
| Apareceu um erro com um codigo na tela | Tire um print **com o codigo** e mande. |

**Dica de ouro:** sempre que for relatar um problema, mande **(1)** o que voce
estava fazendo, **(2)** um print da tela e **(3)** o numero de protocolo, se
tiver. Isso acelera muito a solucao.

---

_Veja tambem: [[auraFarma - Monitoramento (intermediario).md]] e
[[auraFarma - Como Funciona (texto).md]]._
