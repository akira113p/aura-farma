// Suíte de REGRESSÃO end-to-end dos fluxos críticos (in-memory MongoDB).
// Cobre auth, estoque CRUD, venda (baixa de estoque), solicitados e contagem.
// Cada bloco verifica invariantes claras; o processo sai com código 1 se qualquer
// assert falhar (o CI depende disso para barrar regressões).
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';

const PORT = 4099;
const BASE = `http://localhost:${PORT}/api`;
let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name} ${extra}`); fail++; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sidOf(res) {
  const arr = res.headers.getSetCookie?.() ?? (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  return arr.map((c) => c.split(';')[0]).find((c) => c.startsWith('sid='));
}
const j = (cookie, body, method = 'POST') => ({
  method,
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

// Use an external Mongo (e.g. Atlas) when SMOKE_MONGODB_URI is set; otherwise spin
// up an ephemeral in-memory instance. With an external URI, point it at a throwaway
// database (name ending in "_smoketest") — it is dropped at the end.
const EXTERNAL_URI = process.env.SMOKE_MONGODB_URI;
let mongod = null;
let uri;
if (EXTERNAL_URI) {
  uri = EXTERNAL_URI;
  console.log('[smoke] usando Mongo externo (banco de teste descartável)');
} else {
  mongod = await MongoMemoryServer.create();
  uri = mongod.getUri();
  console.log('[smoke] mongo em', uri);
}

// Spawn as a single Node process (node --import tsx) so server.kill() actually
// terminates the server — `npx tsx`/shell wrappers leave the real process orphaned.
const server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  env: { ...process.env, MONGODB_URI: uri, SESSION_SECRET: 'smoke-secret-0123456789', PORT: String(PORT), NODE_ENV: 'development', FRONTEND_ORIGIN: 'http://localhost:5173', GOOGLE_CLIENT_ID: '' },
  stdio: 'inherit',
});

try {
  // wait for health
  let up = false;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/health`); if (r.ok) { up = true; break; } } catch { /* not ready */ }
    await sleep(500);
  }
  check('servidor sobe (/health)', up);

  const cred = { username: 'farmacia.central', pharmacyName: 'Farmácia Central', email: 'dono@farma.com', password: 'Senha@123' };

  // register
  let r = await fetch(`${BASE}/auth/register`, j(null, cred));
  let cookie = sidOf(r);
  let bodyReg = await r.json();
  check('register → 201', r.status === 201, `(status ${r.status})`);
  check('register define cookie de sessão', Boolean(cookie));
  check('user retornado SEM passwordHash', bodyReg.user && !('passwordHash' in bodyReg.user), JSON.stringify(bodyReg.user));
  check('user tem pharmacyName', bodyReg.user?.pharmacyName === 'Farmácia Central');

  // me (authed)
  r = await fetch(`${BASE}/auth/me`, j(cookie, null, 'GET'));
  check('me autenticado → 200', r.status === 200, `(status ${r.status})`);

  // logout
  r = await fetch(`${BASE}/auth/logout`, j(cookie, null, 'POST'));
  check('logout → 204', r.status === 204, `(status ${r.status})`);

  // me after logout
  r = await fetch(`${BASE}/auth/me`, j(cookie, null, 'GET'));
  check('me após logout → 401', r.status === 401, `(status ${r.status})`);

  // login by email
  r = await fetch(`${BASE}/auth/login`, j(null, { identifier: 'dono@farma.com', password: 'Senha@123' }));
  check('login por e-mail → 200', r.status === 200, `(status ${r.status})`);
  // login by username
  r = await fetch(`${BASE}/auth/login`, j(null, { identifier: 'farmacia.central', password: 'Senha@123' }));
  check('login por usuário → 200', r.status === 200, `(status ${r.status})`);
  // login wrong password
  r = await fetch(`${BASE}/auth/login`, j(null, { identifier: 'dono@farma.com', password: 'errada1!' }));
  check('login senha errada → 401', r.status === 401, `(status ${r.status})`);

  // duplicate email
  r = await fetch(`${BASE}/auth/register`, j(null, { ...cred, username: 'outro.user' }));
  let dup = await r.json();
  check('register e-mail duplicado → 409', r.status === 409, `(status ${r.status})`);
  check('409 indica campo email', dup.details?.email != null, JSON.stringify(dup.details));

  // weak password
  r = await fetch(`${BASE}/auth/register`, j(null, { username: 'fraco', pharmacyName: 'F', email: 'f@f.com', password: 'abc' }));
  let weak = await r.json();
  check('senha fraca → 400', r.status === 400, `(status ${r.status})`);
  check('400 indica campo password', weak.details?.password != null, JSON.stringify(weak.details));

  // google disabled
  r = await fetch(`${BASE}/auth/google/config`, j(null, null, 'GET'));
  let gc = await r.json();
  check('google/config enabled=false', gc.enabled === false, JSON.stringify(gc));
  r = await fetch(`${BASE}/auth/google`, j(null, { credential: 'x' }));
  check('google sem client id → 503', r.status === 503, `(status ${r.status})`);

  // --- catalog search (requires auth) ---
  r = await fetch(`${BASE}/auth/login`, j(null, { identifier: 'dono@farma.com', password: 'Senha@123' }));
  const authCookie = sidOf(r);
  check('login p/ busca define cookie', Boolean(authCookie));

  r = await fetch(`${BASE}/medicamentos/busca?q=dipirona`, j(authCookie, null, 'GET'));
  const bs = await r.json();
  check('busca catálogo (dipirona) → 200', r.status === 200, `(status ${r.status})`);
  check('busca retorna resultados', Array.isArray(bs.results) && bs.results.length > 0, JSON.stringify(bs).slice(0, 120));
  check('busca acha DIPIRONA', bs.results?.some((m) => m.nome?.toUpperCase().includes('DIPIRONA')));

  r = await fetch(`${BASE}/medicamentos/busca?q=amoxalina`, j(authCookie, null, 'GET'));
  const bt = await r.json();
  check('busca tolera typo (amoxalina→amoxicilina)', bt.results?.some((m) => m.nome?.toUpperCase().includes('AMOXICILINA')), JSON.stringify(bt.results?.slice(0, 2)));

  r = await fetch(`${BASE}/medicamentos/busca?q=d`, j(authCookie, null, 'GET'));
  const bsh = await r.json();
  check('busca curta (<2 chars) → vazia', r.status === 200 && Array.isArray(bsh.results) && bsh.results.length === 0, `(status ${r.status})`);

  r = await fetch(`${BASE}/medicamentos/busca?q=dipirona`, j(null, null, 'GET'));
  check('busca sem auth → 401', r.status === 401, `(status ${r.status})`);

  // --- pharmacy data (estoque/vendas/solicitados/contagem) ---
  const A = (body, method = 'POST') => j(authCookie, body, method);

  r = await fetch(`${BASE}/estado`, A(null, 'GET'));
  let est = await r.json();
  check('estado inicial vazio (populated:false)', r.status === 200 && est.populated === false && est.products.length === 0, JSON.stringify(est).slice(0, 80));

  r = await fetch(`${BASE}/estoque`, A({ name: 'Dipirona Teste', sku: '789TST001', cat: 'Analgésicos', price: 9.9, cost: 4, stock: 10, min: 3, validade: '2027-01-31', principioAtivo: 'dipirona', tags: ['ANALGESICO'] }));
  let created = await r.json();
  const pid = created.product?.id;
  check('criar produto → 201 com id', r.status === 201 && Boolean(pid), JSON.stringify(created).slice(0, 100));
  check('produto retorna campos completos', created.product?.name === 'Dipirona Teste' && created.product?.validade === '2027-01-31', JSON.stringify(created.product));

  r = await fetch(`${BASE}/estado`, A(null, 'GET'));
  est = await r.json();
  check('estado agora populated:true com o produto', est.populated === true && est.products.length === 1 && est.products[0].id === pid);

  r = await fetch(`${BASE}/estoque/${pid}`, A({ price: 11.5 }, 'PATCH'));
  let upd = await r.json();
  check('editar produto (PATCH) → preco atualizado', r.status === 200 && upd.product?.price === 11.5, JSON.stringify(upd.product));

  // --- venda: deve DECREMENTAR o estoque pela quantidade vendida e criar atividade ---
  const stockBefore = est.products[0].stock; // 10 (criado acima)
  const QTY = 4;
  r = await fetch(`${BASE}/vendas`, A({ items: [{ pid, qty: QTY }], payment: 'pix' }));
  let venda = await r.json();
  const stockAfter = venda.updatedProducts?.find((p) => p.id === pid)?.stock;
  check('venda → 201', r.status === 201, `(status ${r.status})`);
  check('venda decrementa estoque pela qtd vendida (10-4=6)', stockAfter === stockBefore - QTY, `antes=${stockBefore} depois=${stockAfter} qtd=${QTY}`);
  check('venda registra item com a quantidade correta', venda.sale?.items?.[0]?.qty === QTY, JSON.stringify(venda.sale?.items));

  r = await fetch(`${BASE}/estado`, A(null, 'GET'));
  est = await r.json();
  check('venda persiste o estoque decrementado no estado', est.products[0].stock === stockBefore - QTY, `stock=${est.products[0]?.stock}`);
  check('venda cria atividade kind=sale', est.activity?.some((a) => a.kind === 'sale'), JSON.stringify(est.activity?.map((a) => a.kind)));

  r = await fetch(`${BASE}/vendas`, A({ items: [{ pid, qty: 999 }], payment: 'pix' }));
  check('venda sem estoque → 409', r.status === 409, `(status ${r.status})`);

  r = await fetch(`${BASE}/estado`, A(null, 'GET'));
  est = await r.json();
  check('venda recusada NÃO altera o estoque (6)', est.products[0].stock === stockBefore - QTY, `stock=${est.products[0]?.stock}`);

  r = await fetch(`${BASE}/solicitados`, A({ name: 'Insulina NPH', note: 'cliente recorrente' }));
  let sol = await r.json();
  check('criar solicitacao → 201', r.status === 201, `(status ${r.status})`);
  check('solicitacao começa com count=1', sol.request?.count === 1, JSON.stringify(sol.request));
  // mesmo nome de novo → incrementa o contador, não duplica
  r = await fetch(`${BASE}/solicitados`, A({ name: 'Insulina NPH', note: 'de novo' }));
  let sol2 = await r.json();
  check('solicitacao repetida incrementa count p/ 2', sol2.request?.count === 2, JSON.stringify(sol2.request));

  // --- contagem: ajusta o estoque para o novo valor absoluto ---
  const NEW_STOCK = 20;
  r = await fetch(`${BASE}/contagem`, A({ adjustments: [{ pid, newStock: NEW_STOCK }] }));
  let cont = await r.json();
  const counted = cont.updatedProducts?.find((p) => p.id === pid)?.stock;
  check('contagem ajusta estoque p/ o novo valor (20)', r.status === 201 && counted === NEW_STOCK, JSON.stringify(cont).slice(0, 120));

  r = await fetch(`${BASE}/estado`, A(null, 'GET'));
  est = await r.json();
  check('estado reflete venda+contagem (1 venda, 1 contagem, estoque 20)', est.sales.length === 1 && est.counts.length === 1 && est.products[0].stock === NEW_STOCK, `sales=${est.sales.length} counts=${est.counts.length} stock=${est.products[0]?.stock}`);
  check('contagem cria atividade kind=count', est.activity?.some((a) => a.kind === 'count'), JSON.stringify(est.activity?.map((a) => a.kind)));

  r = await fetch(`${BASE}/estoque/${pid}`, A(null, 'DELETE'));
  check('remover produto → 204', r.status === 204, `(status ${r.status})`);

  r = await fetch(`${BASE}/estado`, j(null, null, 'GET'));
  check('estado sem auth → 401', r.status === 401, `(status ${r.status})`);

  r = await fetch(`${BASE}/estado/seed`, A({}));
  let seeded = await r.json();
  check('seed popula 20 produtos + vendas', r.status === 201 && seeded.products.length === 20 && seeded.sales.length > 0, `prod=${seeded.products?.length} sales=${seeded.sales?.length}`);
} finally {
  server.kill();
  if (mongod) {
    await mongod.stop();
  } else {
    // Drop the throwaway test database (guarded: only if it ends with "_smoketest").
    const mongoose = (await import('mongoose')).default;
    await mongoose.connect(uri);
    if (mongoose.connection.name.endsWith('_smoketest')) {
      await mongoose.connection.dropDatabase();
      console.log('[smoke] banco de teste removido:', mongoose.connection.name);
    }
    await mongoose.disconnect();
  }
}

console.log(`\n[smoke] ${pass} passaram, ${fail} falharam`);
process.exit(fail === 0 ? 0 : 1);
