import { Icon } from 'frontend';

const style = { display: 'flex', flexWrap: 'wrap' as const, gap: 20, padding: 20, alignItems: 'center' };
const cell = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6, width: 56 };
const label = { fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' as const };

export const NavIcons = () => (
  <div style={style}>
    {(['dashboard','box','cart','history','chart','list','bookmark','truck'] as const).map(n => (
      <div key={n} style={cell}>
        <Icon name={n} size={20} />
        <span style={label}>{n}</span>
      </div>
    ))}
  </div>
);

export const ActionIcons = () => (
  <div style={style}>
    {(['plus','x','check','trash','edit','search','settings','send'] as const).map(n => (
      <div key={n} style={cell}>
        <Icon name={n} size={20} />
        <span style={label}>{n}</span>
      </div>
    ))}
  </div>
);

export const StatusIcons = () => (
  <div style={style}>
    {(['sparkle','alert','arrowUp','arrowDown','mic','moon','sun','barcode'] as const).map(n => (
      <div key={n} style={cell}>
        <Icon name={n} size={20} />
        <span style={label}>{n}</span>
      </div>
    ))}
  </div>
);
