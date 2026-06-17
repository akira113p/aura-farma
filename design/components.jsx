// auraFarma — shared UI components
const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;

// --- Icons (inline, simple lucide-style strokes) ---
function Icon({ name, size = 16, className = "icon" }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
    box: <><path d="M21 8 12 3 3 8v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" /></>,
    cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M3 4h2l2.6 12.6a1 1 0 0 0 1 .8h9.4a1 1 0 0 0 1-.8L21 8H6" /></>,
    bookmark: <><path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .4 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .4-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.4-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.4h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    check: <><path d="M20 6 9 17l-5-5" /></>,
    x: <><path d="M18 6 6 18M6 6l12 12" /></>,
    chevronDown: <><path d="m6 9 6 6 6-6" /></>,
    chevronUp: <><path d="m6 15 6-6 6 6" /></>,
    moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    barcode: <><path d="M3 5v14M6 5v14M9 5v14M12 5v9M12 17v2M15 5v14M18 5v14M21 5v14" /></>,
    sparkle: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>,
    pkg: <><path d="m7.5 4.27 9 5.15" /><path d="M21 8 12 3 3 8v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5" /></>,
    alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z" /></>,
    arrowUp: <><path d="M12 19V5M5 12l7-7 7 7" /></>,
    arrowDown: <><path d="M12 5v14M5 12l7 7 7-7" /></>,
    trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
    db: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5" /><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" /></>,
    pill: <><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></>
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[name] || null}
    </svg>);

}

// --- Button ---
function Button({ kind = "secondary", size, block, icon, children, onClick, disabled, type = "button" }) {
  const cls = ["btn", `btn-${kind}`, size && `btn-${size}`, block && "btn-block"].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>);

}

// --- Input ---
function Input({ value, onChange, placeholder, type = "text", autoFocus }) {
  return (
    <input
      className="input"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus} />);


}

function Field({ label, children }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
    </div>);

}

// --- Card ---
function Card({ title, sub, action, children, flush }) {
  return (
    <div className="card">
      {(title || action) &&
      <div className="card-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {title && <h3 className="card-title">{title}</h3>}
            {sub && <span className="card-sub">{sub}</span>}
          </div>
          <div style={{ marginLeft: "auto" }}>{action}</div>
        </div>
      }
      <div className={"card-body" + (flush ? " flush" : "")}>{children}</div>
    </div>);

}

// --- Badge ---
function Badge({ tone = "neutral", children, dot }) {
  const cls = "badge" + (tone !== "neutral" ? ` badge-${tone}` : "");
  return <span className={cls}>{dot && <span className="dot" />}{children}</span>;
}

// --- StockBar (low/ok status) ---
function StockBar({ stock, min }) {
  const pct = Math.max(0, Math.min(100, stock / Math.max(min * 2, 1) * 100));
  const tone = stock === 0 ? "crit" : stock <= min ? "warn" : "ok";
  return (
    <div className="bar" data-tone={tone} title={`Estoque: ${stock} / mín: ${min}`}>
      <span style={{ width: pct + "%" }} className={tone}></span>
    </div>);

}

// --- Modal ---
function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {if (e.key === "Escape") onClose();};
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => {if (e.target === e.currentTarget) onClose();}}>
      <div className="modal" role="dialog">
        <div className="modal-head">
          <span className="modal-title tighter">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>);

}

// --- Sidebar ---
function Sidebar({ route, setRoute, requestCount, lowStockCount }) {
  const items = [
  { id: "produtos", label: "Produtos", icon: "box", count: lowStockCount, countTone: "warn" },
  { id: "vendas", label: "Nova venda", icon: "cart" },
  { id: "solicitados", label: "Solicitados", icon: "bookmark", count: requestCount },
  { id: "historico", label: "Histórico", icon: "history" },
  { id: "contagem", label: "Contagem", icon: "list" },
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "relatorios", label: "Relatórios", icon: "chart" }];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">f</div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span className="brand-name tighter">auraFarma</span>
          <span className="brand-sub">controle de estoque</span>
        </div>
      </div>
      <nav className="sidebar-section">
        {items.map((it) =>
        <button
          key={it.id}
          className={"nav-item" + (route === it.id ? " active" : "")}
          onClick={() => setRoute(it.id)} style={{ justifyContent: "flex-start", alignItems: "center", fontWeight: "500" }}>
          
            <Icon name={it.icon} size={15} />
            <span>{it.label}</span>
            {it.count > 0 && <span className="count">{it.count}</span>}
          </button>
        )}
      </nav>
    </aside>);

}

// --- Empty state ---
function Empty({ icon = "box", title, sub, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={18} /></div>
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>);

}

// --- Tabs ---
function Tabs({ value, onChange, options }) {
  return (
    <div className="tabs">
      {options.map((o) =>
      <button
        key={o.value}
        className={"tab" + (value === o.value ? " active" : "")}
        onClick={() => onChange(o.value)}>
        
          {o.label}
        </button>
      )}
    </div>);

}

// --- AI block ---
function AIBlock({ title = "Resumo do dia", subtitle, loading, body, action }) {
  return (
    <div className="ai-block">
      <div className="ai-grain" />
      <div className="ai-head">
        <div className="ai-spark"><Icon name="sparkle" size={11} /></div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span className="ai-title">{title}</span>
          {subtitle && <span className="card-sub">{subtitle}</span>}
        </div>
        <span className="ai-tag">IA</span>
        <div style={{ marginLeft: "auto" }}>{action}</div>
      </div>
      <div className="ai-body">
        {loading ?
        <>
            <div className="shimmer" style={{ width: "92%" }} />
            <div className="shimmer" style={{ width: "78%" }} />
            <div className="shimmer" style={{ width: "85%" }} />
            <div className="shimmer" style={{ width: "60%" }} />
          </> :
        body}
      </div>
    </div>);

}

// Expose to other Babel script files
Object.assign(window, {
  Icon, Button, Input, Field, Card, Badge, StockBar,
  Modal, Sidebar, Empty, Tabs, AIBlock
});