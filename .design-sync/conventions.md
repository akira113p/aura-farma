# auraFarma — conventions for the design agent

## Wrapping and setup

No provider required. Import components directly:

```jsx
import { Button, Card, Modal, Tabs, Input, Field } from 'frontend';
```

All components render styled out of the box — the design system ships its CSS in
`styles.css` (which `@import`s `_ds_bundle.css`). Load `styles.css` once at the
app root.

## Styling idiom — CSS custom properties + class names

auraFarma uses CSS custom properties for all design tokens and BEM-style class
names baked into each component. **Never apply Tailwind or inline styles for
design-system concerns** — use the token variables instead.

### Token families

| Token | Values | Used for |
|---|---|---|
| `--bg`, `--surface`, `--surface-2` | page / card / elevated background |
| `--border`, `--border-strong` | dividers, input borders |
| `--text`, `--text-muted`, `--text-subtle` | body / secondary / disabled text |
| `--accent`, `--accent-fg`, `--accent-hover` | primary actions |
| `--success`, `--success-bg` | positive states |
| `--warning`, `--warning-bg` | caution states |
| `--danger`, `--danger-bg` | destructive / error states |
| `--info`, `--info-bg` | informational states |
| `--pad-x`, `--pad-y`, `--gap` | spacing — never hardcode px |
| `--radius`, `--radius-sm` | border radius |
| `--font-sm`, `--font-md`, `--font-lg` | font sizes |
| `--font-sans`, `--font-mono` | type families |

Dark mode: set `data-theme="dark"` on `<html>`. Compact density:
`data-density="compact"` on `<html>`.

## Key components and their API

- **Button** — `kind`: `primary | secondary | ghost | danger`; `size`: `sm | lg`;
  `icon`: any `IconName`; `loading`, `disabled`, `block`.
- **Card** — `title`, `sub`, `action` (slot for button/badge top-right), `flush`
  (removes body padding).
- **Modal** — needs `open: boolean`, `onClose`, `title`, `children`, optional
  `footer`. Always wrap in a positioned parent when shown in a preview.
- **Tabs** — `tabs: {key, label}[]`, `active: string`, `onChange`.
- **Input** — controlled: `value`, `onChange(value: string)`.
- **Field** — label wrapper: `<Field label="..."><Input .../></Field>`.
- **Badge** — `tone`: `neutral | success | warning | danger | info`.
- **Stat** — `label`, `value`, `delta?: number` (positive = up, negative = down).
- **Icon** — `name: IconName` (see gallery in the DS pane); `size?: number`.
- **StockBar** — `value: number`, `min: number` (shows stock level bar).
- **LineChart** — `data: {label, value}[]`, `color?: string`.
- **Empty** — empty-state placeholder with icon slot.
- **Sidebar** — navigation sidebar (uses `AppState` context — prefer standalone components in designs).
- **AIBlock** — AI summary card; `text: string`.

## Idiomatic snippet

```jsx
<Card title="Estoque baixo" action={<Badge tone="warning">3 itens</Badge>}>
  <Stat label="Paracetamol 750mg" value="4 unidades" delta={-42} />
</Card>
```

For layout glue between DS components, use `var(--gap)` / `var(--pad-x)` and
`display: flex` — never fixed pixel values for spacing.

## Where the truth lives

- Token definitions: `_ds_bundle.css` (all `:root` CSS vars)
- Component styles: same file
- Component APIs: each `<Name>.d.ts` in `components/general/<Name>/`
- Usage reference: each `<Name>.prompt.md`
