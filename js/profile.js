/**
 * View models of CityMETER · Commercial District (pure: no DOM, no map) — what each panel view says, built from the decoded
 * data (js/model.js#decodeData). The words are js/panel.js; the map's reading is js/app.js.
 *
 * Readings, in the order the panel tells them (DATA_METHOD.md §5):
 *   measured     counts of each dataset's located records inside the outline, and their density per km² of the
 *                registry's area
 *   benchmark    where a neighbourhood stands among its peers — the neighbourhoods of the provinces the dataset covers
 *                (count rank), those holding at least `minCount` records (density rank), or the dataset's located
 *                records nationwide (share); the peers are always named with their number
 *   inference    the roles a neighbourhood's highlights speak to (the registry's taxonomy, mapped to datasets by this
 *                demo), the pairs of datasets that rise together across the neighbourhoods (Spearman's ρ on density),
 *                and the neighbourhoods with a similar mix — never a claim about people, footfall or sales
 */
import {PILLARS, cell, provinceByCode, rolesOf, pairsOf, multiStrong, datasetRanking} from './model.js';
import {sharedBy} from './around.js';

/** The pairs of datasets that rise together across the neighbourhoods (ρ ≥ the build's rule), strongest first. */
export function strongPairs(model) {
  const min = model.meta.rules?.pairMinRho ?? 0.35;
  return model.pairs.filter(p => p.rho >= min).map(p => ({...p, A: model.dsById.get(p.a), B: model.dsById.get(p.b)})).filter(p => p.A && p.B);
}

/** Located records of a dataset in a province (or nationwide). */
export const locatedIn = (ds, province = '') => (province ? ds.byProvince?.[province] || 0 : ds.located);
/** Does the dataset reach the province (≥ 1 located record there)? Nationwide: always. */
export const covers = (ds, province = '') => !province || locatedIn(ds, province) > 0;

/**
 * Share of each dataset's located records that lie inside the rows (a province's neighbourhoods, or every one),
 * against the rows' share of the area. Datasets that do not reach the scope are left out.
 */
export function sharesOf(model, rows, province = '') {
  return model.datasets.filter(ds => covers(ds, province) && locatedIn(ds, province) > 0).map(ds => {
    let inside = 0, withAny = 0;
    for (const r of rows) { const n = r.c?.[ds.id] || 0; inside += n; if (n) withAny++; }
    const located = locatedIn(ds, province);
    return {ds, inside, located, share: located ? inside / located : 0, withAny};
  });
}

/** Overview of Thailand or of one province (rows = the neighbourhoods in scope, after the search). */
export function buildOverview(model, {rows, province = '', ds = null, pending = []}) {
  const p = provinceByCode(province);
  const km2 = rows.reduce((s, r) => s + r.km2, 0);
  const baseKm2 = province ? (p?.areaSqm || 0) / 1e6 : model.meta.totals?.thailandKm2 || 0;
  const shares = sharesOf(model, rows, province);
  const ranked = shares.filter(s => s.inside > 0).sort((a, b) => b.share - a.share || b.inside - a.inside);
  const pairs = strongPairs(model).map(pair => ({...pair, rows: rows.filter(r => (r.pairs || []).some(([a, b]) => (a === pair.a && b === pair.b) || (a === pair.b && b === pair.a)))}));
  const lens = ds ? buildLens(model, rows, ds, province) : null;
  const byProvince = new Map();
  for (const r of rows) byProvince.set(r.province, (byProvince.get(r.province) || 0) + 1);
  return {
    province, place: p, rows, pending, count: rows.length, km2, baseKm2, areaShare: baseKm2 ? km2 / baseKm2 : 0,
    shares, ranked, lead: ranked[0] || null, next: ranked.slice(1, 4),
    multi: multiStrong(rows, province ? 12 : 8), pairs,
    provinces: [...byProvince].map(([code, n]) => ({code, n})).sort((a, b) => b.n - a.n || a.code.localeCompare(b.code)),
    lens,
  };
}

/** One dataset over the rows: its share inside, how many neighbourhoods hold it, the densest ones. */
export function buildLens(model, rows, ds, province = '') {
  const located = locatedIn(ds, province);
  let inside = 0, withAny = 0, zero = 0, out = 0;
  for (const r of rows) {
    const c = cell(r, ds);
    if (c.state === 'out_of_scope') out++;
    else if (c.state === 'measured_zero') zero++;
    else { inside += c.count; withAny++; }
  }
  return {ds, located, inside, share: located ? inside / located : 0, withAny, zero, out, covered: withAny + zero,
    ranking: datasetRanking(rows, ds, 12), min: model.meta.rules?.minCount ?? 3};
}

/** Mean of log(1 + density) of each dataset over the neighbourhoods it covers (cached on the model). */
function centres(model) {
  if (model._centres) return model._centres;
  const out = {};
  for (const ds of model.datasets) {
    let sum = 0, n = 0;
    for (const r of model.rows) if (ds.id in (r.c || {})) { sum += Math.log1p(r.density[ds.id] || 0); n++; }
    out[ds.id] = n ? sum / n : 0;
  }
  model._centres = out;
  return out;
}

/**
 * Neighbourhoods whose mix is closest to `row` (Inference): the cosine of log(1 + density) centred on each dataset's
 * mean over the neighbourhoods it covers — a correlation across datasets, 1 = the same shape of mix — over the datasets
 * in scope for both (at least `minShared`, three of them with records in both).
 */
export function similarRows(model, row, {limit = 3, minShared = 8} = {}) {
  const mean = centres(model);
  const vec = r => Object.fromEntries(Object.keys(r.c || {}).map(id => [id, Math.log1p(r.density[id] || 0) - mean[id]]));
  const a = vec(row);
  const out = [];
  for (const r of model.rows) {
    if (r.id === row.id) continue;
    const shared = Object.keys(a).filter(id => id in (r.c || {}));
    if (shared.length < minShared) continue;
    const b = vec(r);
    let dot = 0, na = 0, nb = 0, both = 0;
    for (const id of shared) { dot += a[id] * b[id]; na += a[id] ** 2; nb += b[id] ** 2; if (row.c[id] > 0 && r.c[id] > 0) both++; }
    if (!na || !nb || both < 3) continue;
    out.push({row: r, sim: dot / Math.sqrt(na * nb), shared: shared.length, both});
  }
  return out.filter(x => x.sim > 0).sort((x, y) => y.sim - x.sim || x.row.name.localeCompare(y.row.name, 'th')).slice(0, limit);
}

/** Every dataset of a neighbourhood, grouped by pillar, with its state and comparison. */
export function datasetGroups(model, row) {
  return PILLARS.map(pillar => ({pillar, items: model.datasets.filter(d => d.group === pillar).map(ds => ({ds, c: cell(row, ds)}))}));
}

/** The neighbourhood view. */
export function buildNeighborhood(model, row) {
  // (0.4.0, NL-06) `shared`: the neighbourhoods holding the same value in the highlight's peer group (one rank for all)
  const highlights = (row.hl || []).map(h => ({h, ds: model.dsById.get(h.d), shared: sharedBy(model, row, h)})).filter(x => x.ds);
  const pairs = pairsOf(row, model).map(p => ({...p, A: model.dsById.get(p.a), B: model.dsById.get(p.b)})).filter(p => p.A && p.B);
  const roles = rolesOf(row, model).map(r => ({...r, evidenceDs: r.evidence.map(id => model.dsById.get(id)).filter(Boolean),
    observed: r.datasets.map(id => model.dsById.get(id)).filter(Boolean).map(ds => ({ds, c: cell(row, ds)}))}));
  const proposed = roles.filter(r => r.proposed), extra = roles.filter(r => !r.proposed && r.evidence.length);
  const inProvince = model.rows.filter(r => r.province === row.province).length;
  return {row, place: provinceByCode(row.province), highlights, pairs, proposed, extra, groups: datasetGroups(model, row),
    similar: similarRows(model, row), inProvince};
}

/** The compare matrix: rows = datasets by pillar, columns = neighbourhoods; the densest cell of each dataset marked. */
export function buildCompare(model, rows) {
  const groups = PILLARS.map(pillar => ({pillar, items: model.datasets.filter(d => d.group === pillar).map(ds => {
    const cells = rows.map(r => cell(r, ds));
    const max = Math.max(0, ...cells.map(c => (c.state === 'measured' ? c.density : 0)));
    const any = cells.some(c => c.state !== 'out_of_scope');
    return {ds, cells, max, any, best: max > 0 ? cells.findIndex(c => c.state === 'measured' && c.density === max) : -1};
  }).filter(x => x.any)}));
  return {rows, groups};
}
