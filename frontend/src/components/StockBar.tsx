interface StockBarProps {
  stock: number;
  min: number;
}

export function StockBar({ stock, min }: StockBarProps) {
  const pct = Math.max(0, Math.min(100, (stock / Math.max(min * 2, 1)) * 100));
  const tone = stock === 0 ? 'crit' : stock <= min ? 'warn' : 'ok';
  return (
    <div className="bar" data-tone={tone} title={`Estoque: ${stock} / mín: ${min}`}>
      <span style={{ width: pct + '%' }} className={tone}></span>
    </div>
  );
}
