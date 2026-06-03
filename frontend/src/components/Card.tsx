import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  flush?: boolean;
}

export function Card({ title, sub, action, children, flush }: CardProps) {
  return (
    <div className="card">
      {(title || action) && (
        <div className="card-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {title && <h3 className="card-title">{title}</h3>}
            {sub && <span className="card-sub">{sub}</span>}
          </div>
          <div style={{ marginLeft: 'auto' }}>{action}</div>
        </div>
      )}
      <div className={'card-body' + (flush ? ' flush' : '')}>{children}</div>
    </div>
  );
}
