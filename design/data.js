// auraFarma — seed data + helpers + state store (plain JS, no react)

const BRL = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const fmtInt = (n) => new Intl.NumberFormat("pt-BR").format(n);
const todayISO = () => new Date().toISOString().slice(0, 10);

const CATEGORIES = ["Analgésicos", "Antibióticos", "Vitaminas", "Higiene", "Dermocosméticos", "Infantil", "Genéricos", "Primeiros socorros"];

const SEED_PRODUCTS = [
  { id: "p1",  sku: "7891000100103", name: "Dipirona 500mg c/10",       cat: "Analgésicos",      price: 8.90,  cost: 4.20,  stock: 42, min: 15 },
  { id: "p2",  sku: "7891000201205", name: "Paracetamol 750mg c/20",    cat: "Analgésicos",      price: 12.50, cost: 6.30,  stock: 8,  min: 12 },
  { id: "p3",  sku: "7891000302307", name: "Ibuprofeno 600mg c/10",     cat: "Analgésicos",      price: 18.40, cost: 9.10,  stock: 19, min: 10 },
  { id: "p4",  sku: "7891000403409", name: "Amoxicilina 500mg c/15",    cat: "Antibióticos",     price: 32.00, cost: 18.00, stock: 6,  min: 8 },
  { id: "p5",  sku: "7891000504501", name: "Azitromicina 500mg c/5",    cat: "Antibióticos",     price: 28.70, cost: 16.40, stock: 4,  min: 6 },
  { id: "p6",  sku: "7891000605603", name: "Vitamina C 1g efervescente",cat: "Vitaminas",        price: 14.90, cost: 7.50,  stock: 28, min: 10 },
  { id: "p7",  sku: "7891000706705", name: "Vitamina D3 2.000UI c/30",  cat: "Vitaminas",        price: 39.90, cost: 21.00, stock: 11, min: 8 },
  { id: "p8",  sku: "7891000807807", name: "Complexo B c/60",           cat: "Vitaminas",        price: 22.40, cost: 11.20, stock: 14, min: 8 },
  { id: "p9",  sku: "7891000908909", name: "Álcool gel 70% 500ml",      cat: "Higiene",          price: 11.20, cost: 5.40,  stock: 56, min: 20 },
  { id: "p10", sku: "7891001000005", name: "Sabonete líquido neutro",   cat: "Higiene",          price: 9.80,  cost: 4.80,  stock: 33, min: 15 },
  { id: "p11", sku: "7891001100109", name: "Protetor solar FPS 50",     cat: "Dermocosméticos",  price: 64.90, cost: 36.00, stock: 9,  min: 6 },
  { id: "p12", sku: "7891001200201", name: "Hidratante facial 60g",     cat: "Dermocosméticos",  price: 48.50, cost: 26.00, stock: 7,  min: 5 },
  { id: "p13", sku: "7891001300303", name: "Fralda infantil M c/30",    cat: "Infantil",         price: 49.90, cost: 28.00, stock: 21, min: 10 },
  { id: "p14", sku: "7891001400405", name: "Lenço umedecido c/100",     cat: "Infantil",         price: 17.30, cost: 8.40,  stock: 3,  min: 10 },
  { id: "p15", sku: "7891001500507", name: "Omeprazol 20mg c/14",       cat: "Genéricos",        price: 14.20, cost: 6.10,  stock: 25, min: 12 },
  { id: "p16", sku: "7891001600609", name: "Losartana 50mg c/30",       cat: "Genéricos",        price: 17.80, cost: 7.30,  stock: 18, min: 10 },
  { id: "p17", sku: "7891001700701", name: "Atenolol 25mg c/30",        cat: "Genéricos",        price: 12.60, cost: 5.20,  stock: 12, min: 10 },
  { id: "p18", sku: "7891001800803", name: "Curativo adesivo c/40",     cat: "Primeiros socorros", price: 7.40, cost: 3.10, stock: 31, min: 15 },
  { id: "p19", sku: "7891001900905", name: "Soro fisiológico 500ml",    cat: "Primeiros socorros", price: 6.30, cost: 2.80, stock: 44, min: 20 },
  { id: "p20", sku: "7891002001007", name: "Termômetro digital",        cat: "Primeiros socorros", price: 34.50, cost: 18.00, stock: 5, min: 4 },
];

// Sale history — generate a believable rolling 35 days
function buildSeedSales() {
  const sales = [];
  const now = new Date();
  let id = 1;
  // base pattern: weekends busier, occasional spikes
  for (let d = 34; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const numSales = weekend ? rand(8, 14) : rand(4, 10);
    for (let s = 0; s < numSales; s++) {
      const itemsCount = rand(1, 4);
      const items = [];
      const seen = new Set();
      for (let i = 0; i < itemsCount; i++) {
        let p;
        do { p = SEED_PRODUCTS[rand(0, SEED_PRODUCTS.length - 1)]; } while (seen.has(p.id));
        seen.add(p.id);
        const qty = rand(1, 3);
        items.push({ pid: p.id, name: p.name, qty, price: p.price });
      }
      const hour = rand(8, 20);
      const minute = rand(0, 59);
      const ts = new Date(day);
      ts.setHours(hour, minute, 0, 0);
      sales.push({
        id: "s" + id++,
        ts: ts.toISOString(),
        items,
        total: items.reduce((a, it) => a + it.qty * it.price, 0),
        payment: ["pix", "cartão", "dinheiro"][rand(0, 2)],
      });
    }
  }
  return sales.sort((a, b) => a.ts.localeCompare(b.ts));
}

const SEED_REQUESTS = [
  { id: "r1", name: "Pomada cicatrizante Bepantol", note: "Cliente perguntou ontem à tarde", count: 3, date: relDays(-2) },
  { id: "r2", name: "Insulina NPH refrigerada",     note: "Idoso passa toda semana",        count: 5, date: relDays(-5) },
  { id: "r3", name: "Fralda geriátrica G",          note: "Filha cuida da mãe acamada",     count: 2, date: relDays(-1) },
  { id: "r4", name: "Glicosímetro fitas",            note: "Diabéticos pedem constantemente",count: 4, date: relDays(-3) },
];

function relDays(delta) {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// --- Store ---
const STORAGE_KEY = "aurafarma.v1";

function emptyState() {
  return {
    populated: false,
    products: [],
    sales: [],
    requests: [],
    counts: [], // contagens realizadas
    activity: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* noop */ }
  return emptyState();
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
}

function seedState() {
  const s = emptyState();
  s.populated = true;
  s.products = SEED_PRODUCTS.map((p) => ({ ...p }));
  s.sales = buildSeedSales();
  s.requests = SEED_REQUESTS.map((r) => ({ ...r }));
  s.activity = [
    { id: "a1", kind: "import", text: "Catálogo populado com 20 produtos de exemplo", ts: new Date().toISOString() },
  ];
  return s;
}

function clearState() {
  return emptyState();
}

// --- Aggregations ---
function summarize(state) {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevWeek = new Date(startOfWeek); startOfPrevWeek.setDate(startOfWeek.getDate() - 7);

  const todaySales = state.sales.filter(s => new Date(s.ts) >= startOfDay);
  const weekSales = state.sales.filter(s => new Date(s.ts) >= startOfWeek);
  const prevWeekSales = state.sales.filter(s => {
    const d = new Date(s.ts);
    return d >= startOfPrevWeek && d < startOfWeek;
  });
  const monthSales = state.sales.filter(s => new Date(s.ts) >= startOfMonth);

  const revenue = (arr) => arr.reduce((a, s) => a + s.total, 0);
  const itemsCount = (arr) => arr.reduce((a, s) => a + s.items.reduce((b, it) => b + it.qty, 0), 0);
  const cost = (arr) => {
    let c = 0;
    for (const s of arr) {
      for (const it of s.items) {
        const p = state.products.find(p => p.id === it.pid);
        if (p) c += p.cost * it.qty;
      }
    }
    return c;
  };

  const weekRev = revenue(weekSales);
  const prevWeekRev = revenue(prevWeekSales);
  const weekDelta = prevWeekRev > 0 ? ((weekRev - prevWeekRev) / prevWeekRev) * 100 : 0;

  // Top products (last 7 days)
  const productSales = {};
  for (const s of weekSales) {
    for (const it of s.items) {
      productSales[it.pid] = (productSales[it.pid] || 0) + it.qty;
    }
  }
  const topProducts = Object.entries(productSales)
    .map(([pid, qty]) => ({ pid, qty, p: state.products.find(p => p.id === pid) }))
    .filter(x => x.p)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Low stock
  const lowStock = state.products
    .filter(p => p.stock <= p.min)
    .sort((a, b) => (a.stock / a.min) - (b.stock / b.min))
    .slice(0, 6);

  return {
    day: { revenue: revenue(todaySales), items: itemsCount(todaySales), cost: cost(todaySales), sales: todaySales.length },
    week: { revenue: weekRev, items: itemsCount(weekSales), cost: cost(weekSales), sales: weekSales.length, delta: weekDelta },
    month: { revenue: revenue(monthSales), items: itemsCount(monthSales), cost: cost(monthSales), sales: monthSales.length },
    topProducts,
    lowStock,
  };
}

function applySale(state, cart, payment) {
  // cart: [{ pid, qty }]
  const items = cart.map(({ pid, qty }) => {
    const p = state.products.find(p => p.id === pid);
    return { pid, name: p.name, qty, price: p.price };
  });
  const total = items.reduce((a, it) => a + it.qty * it.price, 0);
  const sale = {
    id: "s" + Date.now(),
    ts: new Date().toISOString(),
    items,
    total,
    payment,
  };
  // decrement stock
  const products = state.products.map(p => {
    const item = items.find(it => it.pid === p.id);
    if (!item) return p;
    return { ...p, stock: Math.max(0, p.stock - item.qty) };
  });
  return {
    ...state,
    products,
    sales: [...state.sales, sale],
    activity: [{ id: "a" + Date.now(), kind: "sale", text: `Venda finalizada — ${items.length} item(ns), ${BRL(total)}`, ts: sale.ts }, ...state.activity].slice(0, 50),
  };
}

// expose globally for Babel scripts
Object.assign(window, {
  BRL, fmtInt, todayISO, CATEGORIES,
  loadState, saveState, seedState, clearState,
  summarize, applySale, rand,
});
