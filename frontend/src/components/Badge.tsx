import type { ReactNode } from 'react';

interface BadgeProps {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  children: ReactNode;
  dot?: boolean;
}

export function Badge({ tone = 'neutral', children, dot }: BadgeProps) {
  const cls = 'badge' + (tone !== 'neutral' ? ` badge-${tone}` : '');
  return (
    <span className={cls}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}
