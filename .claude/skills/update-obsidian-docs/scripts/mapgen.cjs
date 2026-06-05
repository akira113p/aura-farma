// Generates the two Obsidian mind-map .canvas files from nested trees.
// Run from the repo root:  node ".claude/skills/update-obsidian-docs/scripts/mapgen.cjs"
// Edit the `full` (technical) and `easy` (non-technical) trees below, then re-run.
// Layout is computed automatically (left-to-right tree, no overlaps). NO emojis.
const fs = require('fs');

const ROW_H = 104;
const X = [0, 540, 980, 1440, 1900];
const W = [420, 340, 360, 380, 380];
const H_ROOT = 180;
const H = 92;

let idc = 0;
const nid = () => (BigInt('0xa1f0c2d3e4b00000') + BigInt(idc++)).toString(16);

function build(node, depth) {
  node.id = nid();
  node.depth = depth;
  const childColor = depth === 0 ? null : node.color;
  node.w = W[Math.min(depth, W.length - 1)];
  node.h = depth === 0 ? H_ROOT : H;
  (node.children || []).forEach((c) => {
    if (depth >= 1 && !c.color) c.color = childColor;
    build(c, depth + 1);
  });
}

let row = 0;
function place(node) {
  if (node.children && node.children.length) {
    node.children.forEach(place);
    node.cy = (node.children[0].cy + node.children[node.children.length - 1].cy) / 2;
  } else {
    node.cy = row * ROW_H;
    row += 1;
  }
  node.x = X[Math.min(node.depth, X.length - 1)];
  node.y = Math.round(node.cy - node.h / 2);
}

function emit(node, nodes, edges) {
  const n = { id: node.id, type: 'text', x: node.x, y: node.y, width: node.w, height: node.h, text: node.text };
  if (node.color) n.color = node.color;
  nodes.push(n);
  for (const c of node.children || []) {
    emit(c, nodes, edges);
    const e = { id: nid(), fromNode: node.id, fromSide: 'right', toNode: c.id, toSide: 'left' };
    if (c.color) e.color = c.color;
    edges.push(e);
  }
}

function makeCanvas(root, file) {
  build(root, 0);
  row = 0;
  place(root);
  const nodes = [], edges = [];
  emit(root, nodes, edges);
  fs.writeFileSync(file, JSON.stringify({ nodes, edges }, null, 2) + '\n');
  const byCol = {};
  for (const n of nodes) (byCol[n.x] = byCol[n.x] || []).push(n);
  let overlaps = 0;
  for (const col of Object.values(byCol)) {
    col.sort((a, b) => a.y - b.y);
    for (let i = 1; i < col.length; i++) if (col[i].y < col[i - 1].y + col[i - 1].height) overlaps++;
  }
  console.log(file, '-> nos', nodes.length, 'arestas', edges.length, 'overlaps', overlaps);
}

// =================== MAPA A: visao completa do projeto (tecnico) ===================
const full = {
  text: '# farmaDimin\n\nGestao + compliance para farmacias pequenas\ncom a Eurofarma integrada como fornecedor',
  children: [
    { text: '**Objetivo & Negocio**', color: '6', children: [
      { text: 'Resolve burocracia + desorganizacao de farmacias pequenas' },
      { text: 'Modelo SaaS: mensalidade por farmacia' },
      { text: 'Clientes: farmacias pequenas' },
      { text: 'Eurofarma (parceria escolar)', children: [
        { text: 'fornecedor integrado na plataforma' },
        { text: 'ganha canal de venda digital' },
        { text: 'farmacia nao troca fornecedor; e opcao a mais' },
      ]},
      { text: 'Outros fornecedores no futuro' },
    ]},
    { text: '**Arquitetura**', color: '4', children: [
      { text: 'Frontend: React + TS + Vite' },
      { text: 'Backend: Node + Express' },
      { text: 'Banco: MongoDB (Atlas)' },
      { text: 'Auth: cookie httpOnly + bcrypt + Google' },
      { text: 'Busca: em memoria no Node + Fuse.js' },
      { text: 'Dados (estoque/vendas/...): 1 doc por produto no Mongo, campos curtos (alias)' },
      { text: 'Carga: GET /api/estado (1 chamada) + rate-limit por usuario' },
      { text: 'Decisoes', children: [
        { text: 'CSV ANVISA em memoria (nao sobe pro Mongo)' },
        { text: 'estoque/vendas no Mongo; front fala pela API' },
        { text: 'segredos so no .env (VITE_ nunca recebe segredo)' },
        { text: 'cookie httpOnly + Secure + SameSite' },
      ]},
    ]},
    { text: '**Estado atual**', color: '5', children: [
      { text: 'Pronto', children: [
        { text: '7 telas (React/Vite)' },
        { text: 'Login / registro / logout + Google OAuth' },
        { text: 'bcrypt + sessao cookie httpOnly' },
        { text: 'MongoDB conectado' },
        { text: 'Base ANVISA 11.7k + busca fuzzy (Fuse.js)' },
        { text: 'Estoque/vendas/solicitados/contagem no MongoDB (por usuario)' },
      ]},
      { text: 'Em andamento', children: [
        { text: 'Alertas de validade (campo ja existe no produto)' },
      ]},
      { text: 'Planejado', children: [
        { text: 'SNGPC' },
        { text: 'Importacao CSV / NF-e' },
        { text: 'Integracao Eurofarma' },
        { text: 'Sistema de pagamento' },
      ]},
    ]},
    { text: '**Funcionalidades**', color: '2', children: [
      { text: 'MVP escolar (prioridade)', children: [
        { text: 'Conectar frontend ao backend (feito)' },
        { text: 'Busca inteligente no estoque (feito)' },
        { text: 'Controle de estoque no Mongo (feito)' },
        { text: 'SNGPC: controlados -> ANVISA' },
        { text: 'Controle de validade com alertas' },
        { text: 'Pedido pra Eurofarma (pode ser simulado)' },
      ]},
      { text: 'Produto real (pos-banca)', children: [
        { text: 'API real com Eurofarma' },
        { text: 'Importar estoque via CSV' },
        { text: 'Importar NF-e (XML)' },
        { text: 'Outros fornecedores' },
        { text: 'Pagamento integrado' },
        { text: 'Rastreabilidade de psicotropicos por lote' },
        { text: 'Painel de alvaras e licencas' },
        { text: 'Relatorios para o CRF' },
      ]},
    ]},
    { text: '**Compliance (burocracia resolvida)**', color: '1', children: [
      { text: 'SNGPC', children: [ { text: 'envio automatico de controlados; evita multa por atraso' } ]},
      { text: 'Controle de validade', children: [ { text: 'alertas de vencimento; vencido na prateleira e infracao grave' } ]},
      { text: 'NF-e XML', children: [ { text: 'entrada automatica de mercadoria por nota fiscal' } ]},
      { text: 'Alvaras e licencas', children: [ { text: 'painel de vencimento (sanitario, CRF, funcionamento)' } ]},
      { text: 'Relatorios CRF', children: [ { text: 'geracao automatica para o Conselho' } ]},
      { text: 'Rastreabilidade por lote', children: [ { text: 'facilita recall de psicotropicos' } ]},
    ]},
    { text: '**Base de medicamentos**', color: '3', children: [
      { text: 'Fonte: ANVISA (dados abertos)' },
      { text: '11.759 medicamentos (catalogo de busca)' },
      { text: 'Campos: nome, principio ativo, classe, empresa' },
      { text: 'Em memoria no Node (nao no Mongo)' },
      { text: 'Busca fuzzy via Fuse.js (tolera erro de digitacao)' },
      { text: 'Atualizacao: job semanal baixando CSV (planejado)' },
    ]},
    { text: '**Roadmap & Banca**', color: '6', children: [
      { text: 'Mes 1-2: fechar MVP escolar' },
      { text: 'Mes 3-4: validar com donos de farmacias reais' },
      { text: 'Mes 5-6: Eurofarma (se validado) ou MVP pra banca' },
      { text: 'Banca (~6 meses): mostrar que a ideia funciona' },
      { text: 'Diferenciais', children: [
        { text: 'autenticacao nivel profissional' },
        { text: 'base real da ANVISA' },
        { text: 'compliance burocratico' },
        { text: 'parceria Eurofarma' },
      ]},
    ]},
  ],
};

// =================== MAPA B: como funciona (nao-tecnico) ===================
const easy = {
  text: '# farmaDimin\n\nSistema para farmacias pequenas\ncuidarem do estoque, das vendas e da burocracia',
  children: [
    { text: '**O que e e pra quem**', color: '6', children: [
      { text: 'Para farmacias pequenas' },
      { text: 'Resolve a burocracia e a desorganizacao' },
      { text: 'E alugado por mensalidade (SaaS)' },
      { text: 'Eurofarma entra como fornecedor dentro do sistema' },
    ]},
    { text: '**O que ja funciona hoje**', color: '4', children: [
      { text: '7 telas prontas' },
      { text: 'Entrar com usuario/senha ou com o Google' },
      { text: 'Senha guardada de forma segura' },
      { text: 'Estoque e vendas ficam salvos no servidor (banco), por farmacia' },
      { text: 'Busca em 11.7k remedios reais' },
    ]},
    { text: '**As telas**', color: '5', children: [
      { text: 'Dashboard', children: [ { text: 'visao geral do dia: resumos e grafico' } ]},
      { text: 'Estoque', children: [ { text: 'lista de remedios: buscar, adicionar, editar' } ]},
      { text: 'Nova venda (caixa)', children: [ { text: 'monta o carrinho; o estoque baixa sozinho' } ]},
      { text: 'Solicitados', children: [ { text: 'remedios que clientes pediram e faltam' } ]},
      { text: 'Historico', children: [ { text: 'todas as vendas ja feitas' } ]},
      { text: 'Contagem', children: [ { text: 'conferir a prateleira vs o sistema' } ]},
      { text: 'Relatorios', children: [ { text: 'analises do periodo' } ]},
    ]},
    { text: '**Busca inteligente de remedios**', color: '3', children: [
      { text: 'Catalogo real da ANVISA (11.7k remedios)' },
      { text: 'Aceita erro de digitacao', children: [ { text: "digitar 'amoxalina' acha 'AMOXICILINA'" } ]},
      { text: 'Acha por nome, principio ativo e categoria' },
      { text: 'Preenche o cadastro sozinho ao escolher' },
    ]},
    { text: '**Onde os dados ficam**', color: '2', children: [
      { text: 'Agora: no servidor (banco de dados), por farmacia' },
      { text: 'Carregam rapido numa unica chamada' },
      { text: 'Antes ficavam so no navegador' },
      { text: 'Cada conta enxerga so os seus dados' },
    ]},
    { text: '**A burocracia que vai resolver**', color: '1', children: [
      { text: 'SNGPC: avisa a ANVISA sobre controlados automaticamente' },
      { text: 'Validade: avisa antes do remedio vencer' },
      { text: 'NF-e: lanca a mercadoria pela nota fiscal' },
      { text: 'Alvaras: avisa quando licencas vao vencer' },
      { text: 'Relatorios para o Conselho de Farmacia' },
    ]},
    { text: '**Login e seguranca**', color: '6', children: [
      { text: 'Cadastro: usuario, farmacia, e-mail e senha' },
      { text: 'Senha embaralhada (ninguem le a original)' },
      { text: 'Cracha seguro mantem voce logado' },
      { text: 'Opcao de entrar com o Google' },
    ]},
  ],
};

makeCanvas(full, 'obsidian/farmaDimin - Mapa Mental.canvas');
idc = 0;
makeCanvas(easy, 'obsidian/farmaDimin - Como Funciona (mapa mental).canvas');
