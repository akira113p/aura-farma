import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface AIBlockProps {
  title?: string;
  subtitle?: string;
  loading?: boolean;
  body?: ReactNode;
  action?: ReactNode;
}

export function AIBlock({ title = 'Resumo do dia', subtitle, loading, body, action }: AIBlockProps) {
  return (
    <div className="ai-block">
      <div className="ai-grain" />
      <div className="ai-head">
        <div className="ai-spark">
          <Icon name="sparkle" size={11} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="ai-title">{title}</span>
          {subtitle && <span className="card-sub">{subtitle}</span>}
        </div>
        <span className="ai-tag">IA</span>
        <div style={{ marginLeft: 'auto' }}>{action}</div>
      </div>
      <div className="ai-body">
        {loading ? (
          <>
            <div className="shimmer" style={{ width: '92%' }} />
            <div className="shimmer" style={{ width: '78%' }} />
            <div className="shimmer" style={{ width: '85%' }} />
            <div className="shimmer" style={{ width: '60%' }} />
          </>
        ) : (
          body
        )}
      </div>
    </div>
  );
}
