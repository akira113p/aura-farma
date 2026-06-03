import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface ButtonProps {
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'lg';
  block?: boolean;
  icon?: IconName;
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  kind = 'secondary',
  size,
  block,
  icon,
  children,
  onClick,
  disabled,
  type = 'button',
}: ButtonProps) {
  const cls = ['btn', `btn-${kind}`, size && `btn-${size}`, block && 'btn-block']
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}
