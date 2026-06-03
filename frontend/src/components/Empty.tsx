import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface EmptyProps {
  icon?: IconName;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
}

export function Empty({ icon = 'box', title, sub, action }: EmptyProps) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={18} />
      </div>
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
