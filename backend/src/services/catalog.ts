import Fuse from 'fuse.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * In-memory catalog of real medicines (ANVISA open data).
 *
 * The CSV (`backend/data/MEDICAMENTOS_BUSCA.csv`, ~11.7k rows, `;`-separated)
 * is parsed once at boot and indexed with Fuse for typo-tolerant fuzzy search.
 * Nothing is written to MongoDB — the catalog is a read-only reference the
 * pharmacist searches to add real medicines to their own stock.
 */

export interface CatalogMed {
  id: string;
  nome: string;
  principioAtivo: string;
  classeTerapeutica: string;
  empresa: string;
}

/** Catalog record plus normalized mirror fields used for matching. */
interface IndexedMed extends CatalogMed {
  _nome: string;
  _principio: string;
  _classe: string;
  _empresa: string;
}

const CSV_URL = new URL('../../data/MEDICAMENTOS_BUSCA.csv', import.meta.url);

let fuse: Fuse<IndexedMed> | null = null;
let count = 0;

/** lowercase, strip accents/diacritics, collapse whitespace. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCsv(text: string): IndexedMed[] {
  const lines = text.split(/\r?\n/);
  const out: IndexedMed[] = [];
  // line 0 is the header (NOME_PRODUTO;PRINCIPIO_ATIVO;CLASSE_TERAPEUTICA;EMPRESA…)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(';');
    const nome = (cols[0] ?? '').trim();
    if (!nome) continue;
    const principioAtivo = (cols[1] ?? '').trim();
    const classeTerapeutica = (cols[2] ?? '').trim();
    const empresa = (cols[3] ?? '').trim();
    out.push({
      id: 'm' + i,
      nome,
      principioAtivo,
      classeTerapeutica,
      empresa,
      _nome: normalize(nome),
      _principio: normalize(principioAtivo),
      _classe: normalize(classeTerapeutica),
      _empresa: normalize(empresa),
    });
  }
  return out;
}

/** Parse + index the catalog once (idempotent). Safe to call at boot. */
export function loadCatalog(): number {
  if (fuse) return count;
  const text = readFileSync(fileURLToPath(CSV_URL), 'utf8');
  const meds = parseCsv(text);
  fuse = new Fuse(meds, {
    // Weight the name highest, then active ingredient, class (tags), company.
    keys: [
      { name: '_nome', weight: 0.6 },
      { name: '_principio', weight: 0.25 },
      { name: '_classe', weight: 0.1 },
      { name: '_empresa', weight: 0.05 },
    ],
    threshold: 0.4, // tolerant enough for typos, tight enough to stay relevant
    ignoreLocation: true,
    minMatchCharLength: 2,
    includeScore: true,
  });
  count = meds.length;
  return count;
}

export function catalogSize(): number {
  return count;
}

const toPublic = (m: IndexedMed): CatalogMed => ({
  id: m.id,
  nome: m.nome,
  principioAtivo: m.principioAtivo,
  classeTerapeutica: m.classeTerapeutica,
  empresa: m.empresa,
});

/** Length of the shared leading run between two strings. */
function commonPrefixLen(a: string, b: string): number {
  let n = 0;
  const m = Math.min(a.length, b.length);
  while (n < m && a[n] === b[n]) n++;
  return n;
}

/**
 * Typo-tolerant search across name / active ingredient / class / company.
 * Returns up to `limit` matches ordered by relevance. Queries shorter than
 * 2 (normalized) chars return nothing.
 *
 * Fuse alone ranks substring hits too high for hard typos (e.g. "amoxalina"
 * surfaced "rivaroxabana" before "amoxicilina"). We pull a wider candidate set
 * and re-rank with a shared-prefix + containment bonus, which pushes the
 * intended medicine to the top for the common "first letters right, rest
 * fuzzy" mistype pattern.
 */
export function searchCatalog(q: string, limit = 12): CatalogMed[] {
  if (!fuse) loadCatalog();
  const nq = normalize(q);
  if (nq.length < 2) return [];
  return fuse!
    .search(nq, { limit: Math.max(limit * 4, 40) })
    .map((r) => {
      const prefix = commonPrefixLen(nq, r.item._nome) / Math.max(nq.length, 1);
      const contains = r.item._nome.includes(nq) || r.item._principio.includes(nq) ? 0.15 : 0;
      // Fuse score: lower is better, so subtract the bonuses.
      return { item: r.item, score: (r.score ?? 1) - 0.5 * prefix - contains };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((x) => toPublic(x.item));
}
