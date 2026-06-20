# .design-sync/NOTES.md — auraFarma

## Build gotchas

- **Rodar o build a partir da RAIZ do repo** (`prototipo/`), não de `frontend/`:
  `.design-sync/previews/` é relativo ao CWD do build; de dentro de `frontend/`
  o build não encontra os arquivos de preview.
  ```
  cd prototipo/
  node .ds-sync/package-build.mjs --config .design-sync/config.json \
    --node-modules ./frontend/node_modules \
    --entry ./frontend/src/components/index.ts \
    --out ./ds-bundle
  ```

- **Types gerados em `frontend/dist/types/`** via `.tsconfig.ds.json`. O campo
  `"types": "dist/types/components/index.d.ts"` foi adicionado ao
  `frontend/package.json` para que `dts.mjs` encontre o entry point. O tsc
  precisa rodar antes de cada re-sync se os componentes mudaram:
  ```
  cd frontend/
  node node_modules/typescript/lib/tsc.js -p .tsconfig.ds.json
  ```

- **Playwright instalado em `.ds-sync/node_modules/`** (não em `frontend/`) —
  o validate importa `'playwright'` relativo ao arquivo de script.

- **`frontend/package.json` tem `playwright` e `playwright-core` como deps** —
  foram adicionados como efeito colateral do setup. Podem ser removidos quando
  não necessários.

- **tsconfig.app.json tem `allowImportingTsExtensions: true` + `noEmit: true`**,
  incompatível com emissão de declarations. O `.tsconfig.ds.json` temporário
  na raiz de `frontend/` serve só para gerar os `.d.ts`.

## Previews autorizados

- `Field.tsx`, `Icon.tsx`, `Modal.tsx`, `Stat.tsx` têm previews em `.design-sync/previews/`
- `Icon.tsx` — galeria de ícones em 3 grupos (Nav, Action, Status)
- `Modal.tsx` — `cardMode: single` aplicado (conteúdo escapa a grid)
- Demais 10 componentes estão no floor card (authorable a qualquer momento)

## Known render warns

- Modal tem `cardMode: single` — isento do check de `[GRID_OVERFLOW]` por construção

## Re-sync risks

- `tsconfig.ds.json` não é commitado; precisa ser recriado se o repositório for
  clonado em outra máquina (ver receita acima)
- Se componentes em `src/components/` mudarem props, re-rodar o tsc antes do build
- `frontend/dist/types/` é gerado localmente (gitignored via `dist/`); re-gerar no clone
- `AIBlock` e `Sidebar` importam de `../types` e `../lib` — cobertas pelo tsconfig.ds
- O tsconfig original do frontend usa `moduleResolution: bundler` com
  `allowImportingTsExtensions`; o tsconfig de emissão usa `"node16"` implícito
  via `moduleResolution` omitido — se imports quebrarem, verificar se algum
  componente usa `.tsx` extension explícita no import
