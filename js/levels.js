/**
 * CityMETER · Commercial District — the level of a dataset in a neighbourhood and the state of its cell (0.6.0; pure: no
 * DOM, no map).
 *
 * Owner 2026-11-26 (proposal 02-CityMETER__commercialdistrict-visual-first-panel-proposal__v1__2026-11-26, handoff/visual/):
 *   D-V1 = D (10:26, VERBATIM “ดูดีนะ  ลุยเลยครับ ตามที่พี่แนะนำ”): a dot or a cell stands at the mean of two levels in
 *          one peer group — the count level and the density level, each the mid-rank percentile 0–100 among the
 *          neighbourhoods holding at least `minCount` records of the dataset, nationwide (the peers of “แน่นอันดับ k/N”).
 *   D-V1c (10:26): the same value everywhere in the panel — the fingerprint, the matrix, the axis rows, the comparison.
 *   D-V1d (11:26, VERBATIM “ใช้ A ใน V1 แล้วทำ C ใน LDS รุ่นถัดไป”): its colour is the LDS 0.9.7 `count` LUT (41 samples),
 *          an exception to DATAVIZ-02 for these dots and cells only, until the next LDS release has a scale for a level
 *          within a declared group; the map keeps `density.area` among the neighbourhoods in view (D-V1b).
 * A dataset with points for under 90 % of its records (D-4) has no level, dot or colour: its count is shown, starred.
 * The level is the demo's own index (an Inference, DATA_METHOD.md §14): equal weights, no unit, never a total.
 */
import {cell, lowLocated} from './model.js';
import {COUNT_SCALE} from './scales.js';

/** Mid-rank percentile of `v` in `values`: 100 × (below + ½ equal) / n. */
export const midPct = (v, values) => {
  let below = 0, equal = 0;
  for (const x of values) { if (x < v) below++; else if (x === v) equal++; }
  return values.length ? (100 * (below + equal / 2)) / values.length : null;
};

/** The colour of a level on the LDS `count` LUT (41 samples; index round(level × 40 / 100)), the same HEX on both themes. */
export const levelFill = level => COUNT_SCALE.lut[Math.max(0, Math.min(40, Math.round((Number(level) || 0) * 40 / 100)))];

/**
 * Levels of every dataset (cached on the model): per dataset, the peers (n) and per peer row its count level, density
 * level, their mean (`level`), the rank of the mean among the peers (1 = highest, equal means share a rank) and the build's
 * count and density ranks. A starred dataset maps to null.
 */
export function levelModel(model) {
  if (model._levels) return model._levels;
  const min = model.meta.rules?.minCount ?? 3;
  const out = new Map();
  for (const ds of model.datasets) {
    if (lowLocated(ds)) { out.set(ds.id, null); continue; }
    const peers = model.rows.map(r => ({r, c: cell(r, ds)})).filter(x => x.c.state === 'measured' && x.c.count >= min);
    const counts = peers.map(x => x.c.count), dens = peers.map(x => x.c.density);
    const rows = new Map();
    for (const {r, c} of peers) {
      const countLevel = midPct(c.count, counts), densityLevel = midPct(c.density, dens);
      rows.set(r.id, {countLevel, densityLevel, level: (countLevel + densityLevel) / 2, countRank: c.countRank, densityRank: c.densityRank, n: peers.length});
    }
    const means = [...rows.values()].map(x => x.level);
    for (const x of rows.values()) x.rank = 1 + means.filter(m => m > x.level + 1e-9).length;
    out.set(ds.id, {n: peers.length, rows});
  }
  Object.defineProperty(model, '_levels', {value: out, enumerable: false, configurable: true});
  return out;
}

/**
 * Cell kinds, one per state of a dataset in a neighbourhood (proposal §4.1; EVID-05 states kept apart):
 *   ranked   at least `minCount` records of a dataset with points for ≥ 90 % — placed and coloured by its level
 *   few      1 or 2 records — counted, no level
 *   starred  records of a dataset with points for under 90 % (D-4) — counted, no level
 *   edge     none inside, some outside within 800 m of the edge (only when the surroundings file is read)
 *   zero     none inside (and, with the surroundings file, none within 800 m either: `edgeKnown`)
 *   out      the dataset has no located record in the neighbourhood's province (out of scope: never 0)
 */
export const CELL_KINDS = Object.freeze(['ranked', 'few', 'starred', 'edge', 'zero', 'out']);

/** The cell of one dataset in one neighbourhood. `around`: decoded data/around.json, or null. */
export function cellOf(model, row, ds, around = null) {
  const c = cell(row, ds), min = model.meta.rules?.minCount ?? 3;
  if (c.state === 'out_of_scope') return {kind: 'out', ds, c};
  const ring = around ? around.rows.get(row.id)?.a?.[ds.id] ?? null : null;
  const r400 = ring ? ring[0] : null, r800 = ring ? ring[1] : null;
  if (c.state === 'measured_zero') return {kind: r800 > 0 ? 'edge' : 'zero', ds, c, r400, r800, edgeKnown: Boolean(ring)};
  if (lowLocated(ds)) return {kind: 'starred', ds, c, r400, r800};
  if (c.count < min) return {kind: 'few', ds, c, r400, r800};
  const L = levelModel(model).get(ds.id)?.rows.get(row.id);
  return {kind: 'ranked', ds, c, r400, r800, ...L};
}

/** Every dataset of a neighbourhood, in the order of the datasets (Land · Location · Living). */
export const cellsOf = (model, row, around = null) => model.datasets.map(ds => cellOf(model, row, ds, around));

/** How many datasets stand in each state of the fingerprint's key: inside · only beyond the edge · none · no data. */
export function cellCounts(cells) {
  const n = {in: 0, edge: 0, zero: 0, out: 0};
  for (const x of cells) n[x.kind === 'ranked' || x.kind === 'few' || x.kind === 'starred' ? 'in' : x.kind]++;
  return n;
}
