import { Icon } from './Icon';

interface StatProps {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
}

export function Stat({ label, value, sub, delta }: StatProps) {
  const hasDelta = delta !== null && delta !== undefined;
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value tighter">{value}</div>
      {(sub || hasDelta) && (
        <div className="stat-delta">
          {hasDelta && (
            <span className={delta > 0.5 ? 'delta-up' : delta < -0.5 ? 'delta-down' : 'delta-flat'}>
              <Icon name={delta > 0.5 ? 'arrowUp' : delta < -0.5 ? 'arrowDown' : 'check'} size={11} />
              {Math.abs(delta).toFixed(1)}% vs semana anterior
            </span>
          )}
          {sub && !hasDelta && <span className="muted">{sub}</span>}
        </div>
      )}
    </div>
  );
}
