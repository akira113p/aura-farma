import type { SeriesPoint } from '../types';
import { BRL } from '../lib/format';

interface LineChartProps {
  data: SeriesPoint[];
  height?: number;
  unit?: 'BRL' | 'count';
}

export function LineChart({ data, height = 200, unit = 'BRL' }: LineChartProps) {
  const W = 800;
  const H = height;
  const padL = 44;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  if (!data || data.length === 0) {
    return (
      <div className="empty" style={{ padding: 24 }}>
        Sem dados no período
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const allZero = total === 0;
  const pts = data.map((d, i) => ({
    x: padL + (data.length <= 1 ? innerW / 2 : i * (innerW / (data.length - 1))),
    y: padT + innerH - (d.value / max) * innerH,
    d,
  }));
  const linePts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    `M ${pts[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} ` +
    `L ${pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' L ')} ` +
    `L ${pts[pts.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  const ticks = 4;
  const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const fmtY = (v: number) => (unit === 'BRL' ? 'R$ ' + compact.format(v) : compact.format(v));
  const xStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
      {/* y-grid */}
      {Array(ticks + 1)
        .fill(0)
        .map((_, i) => {
          const y = padT + innerH * (i / ticks);
          const v = max * (1 - i / ticks);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeDasharray={i === ticks ? '0' : '2 4'} />
              {i < ticks && (
                <text x={padL - 6} y={y + 3} fontSize="9" textAnchor="end" fill="var(--text-subtle)" fontFamily="var(--font-mono)">
                  {fmtY(v)}
                </text>
              )}
            </g>
          );
        })}
      {/* area + line */}
      {!allZero && (
        <>
          <path d={areaPath} fill="var(--accent)" opacity="0.08" />
          <polyline points={linePts} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="2.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.6" />
              <title>
                {p.d.label}: {BRL(p.d.value)}
              </title>
            </g>
          ))}
        </>
      )}
      {/* x labels */}
      {data.map(
        (d, i) =>
          (i % xStep === 0 || i === data.length - 1) && (
            <text key={i} x={pts[i].x} y={H - 8} fontSize="9" textAnchor="middle" fill="var(--text-subtle)" fontFamily="var(--font-mono)">
              {d.label}
            </text>
          ),
      )}
    </svg>
  );
}
