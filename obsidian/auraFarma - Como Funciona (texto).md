---
titulo: auraFarma - Como Funciona (para nao-tecnicos)
tipo: explicacao
mapa: "[[auraFarma - Como Funciona (mapa mental).canvas]]"
---

# auraFarma - Como Funciona (para nao programadores)

Explicacao em linguagem simples do que o sistema e e do que ele faz. Versao em
texto do mapa mental [[auraFarma - Como Funciona (mapa mental).canvas]].

---

## O que e e pra quem

O auraFarma e um sistema (site) para **farmacias pequenas** cuidarem do estoque,
das vendas e da burocracia. A ideia central e tirar das costas do farmaceutico a
papelada obrigatoria e a desorganizacao do dia a dia.

- E feito para **farmacias pequenas**.
- Resolve a **burocracia** e a **desorganizacao**.
- E **alugado por mensalidade** (modelo chamado SaaS).
- A **Eurofarma** entra como fornecedor dentro do proprio sistema - a farmacia
  pode comprar dela sem largar os fornecedores que ja tem.

Uma forma simples de pensar: o sistema tem uma parte que voce ve e usa (as telas)
e uma parte de bastidores (o servidor) que guarda os dados com seguranca e faz o
trabalho pesado.

---

## O que ja funciona hoje

- **9 telas** prontas.
- **Entrar** com usuario e senha, ou com a conta do **Google**.
- A **senha** e guardada de forma segura (ninguem consegue ler a original).
- O **estoque e as vendas ficam salvos no servidor** (banco de dados), separados
  por farmacia - nao ficam mais presos a um so navegador.
- Uma **busca** que ja procura entre 11.7 mil remedios reais.
- Um **assistente de IA** que responde perguntas sobre a sua farmacia.

---

## As telas (o que cada uma faz)

- **Dashboard** - a visao geral do dia: resumos de venda e um grafico.
- **Estoque** - a lista de remedios da farmacia: buscar, adicionar, editar e
  remover.
- **Nova venda (caixa)** - monta o carrinho e fecha a venda; o estoque baixa
  sozinho.
- **Solicitados** - remedios que clientes pediram e que ainda faltam.
- **Pedidos** - pedir reposicao para a Eurofarma e acompanhar a entrega.
- **Historico** - todas as vendas ja feitas, para consulta.
- **Contagem** - conferir o que esta na prateleira contra o que o sistema diz.
- **Relatorios** - analises do periodo.
- **Assistente IA** - faca uma pergunta e ele consulta seus dados para responder.

---

## A busca inteligente de remedios

E a funcionalidade mais util do dia a dia, na tela de Estoque.

- Usa um **catalogo real da ANVISA**, com 11.7 mil remedios.
- **Aceita erro de digitacao**: se voce digitar "amoxalina", ele entende e
  sugere "AMOXICILINA".
- Acha por **nome, principio ativo e categoria**.
- Ao escolher o remedio na lista, o **cadastro ja vem preenchido** - voce so
  completa preco, codigo e quantidade.

---

## Onde os dados ficam

- **Agora ficam no servidor** (um banco de dados), organizados por farmacia.
- Cada conta enxerga **somente os seus dados**.
- Eles **carregam rapido**, numa unica busca quando voce abre o sistema.
- Antes ficavam apenas no navegador do computador; agora estao guardados de
  verdade e nao se perdem ao trocar de maquina.

---

## O assistente de IA

E como ter um ajudante que conhece os numeros da sua farmacia.

- Voce **escolhe a area** (estoque, vendas, pedidos...) e faz uma pergunta.
- Ele olha **somente os seus dados daquela area** para responder - isso evita
  que ele invente coisas.
- Responde **uma pergunta por vez**, sem lembrar das anteriores.
- As respostas ficam **guardadas so no seu navegador**, num historico para
  consultar depois.
- Ele tambem escreve **sozinho um resumo** do dia, da semana ou do mes no
  Dashboard e nos Relatorios.

---

## A burocracia que o sistema vai resolver

(parte ja planejada, em linguagem simples)

- **SNGPC** - avisa a ANVISA sobre os remedios controlados automaticamente,
  evitando multa.
- **Validade** - avisa antes de um remedio vencer.
- **NF-e** - lanca a mercadoria no sistema direto pela nota fiscal.
- **Alvaras** - avisa quando alvaras e licencas estao perto de vencer.
- **Relatorios** - gera os relatorios pedidos pelo Conselho de Farmacia.

---

## Login e seguranca (em simples)

- **Cadastro** com usuario, nome da farmacia, e-mail e senha.
- A **senha e embaralhada** de um jeito que nao da pra desfazer.
- Um **cracha seguro** (cookie) mantem voce logado sem expor seus dados.
- Da pra **entrar com o Google** de forma segura.

---

_Para a versao visual, abra [[auraFarma - Como Funciona (mapa mental).canvas]]
no Obsidian. Para a visao completa e tecnica, veja [[auraFarma - Mapa Mental.md]]._
