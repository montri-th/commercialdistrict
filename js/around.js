/**
 * CityMETER · Commercial District — «ขอบเดินถึง» and the glance «ในย่านนี้» (0.4.0; pure: no DOM, no map).
 *
 * Owner 2026-11-25 08:15, VERBATIM: “พี่ช่วยปรับ web demo ตามที่แนะนำเลยครับ” — the recommended options D-1 … D-9 of the
 * proposal in handoff/around/ (plan.json, contracts.json).
 *
 * data/around.json (scripts/build-around.py, DATA_METHOD.md §12): per neighbourhood, for every dataset in scope, the
 * located records outside its outline within 400 m and within 800 m of the edge, straight line — [r400, r800], the 800 m
 * figure holding the 400 m one. A record the data build counted inside is never around. Figures are never added: not
 * the inside to the around, not two datasets, not two neighbourhoods (one record can be around several of them).
 *
 * The glance reads four things in the order of «รอบศูนย์นี้» (montri-th/shoppingcenter), one dataset each:
 *   residents  คนอยู่ — registered residents, modelled: round 2, so not yet (EVID-05 not_yet)
 *   students   นักเรียน — students the school dataset records for its schools inside (source-listed)
 *   rooms      ห้องพัก — rooms the lodging dataset records for its places inside (source-listed)
 *   centers    ศูนย์และตลาด — records of the Shopping Center dataset inside (counted)
 * Each with the five-step level of «รอบศูนย์นี้» (levelOf, LEVEL_WORDS: verbatim) from its mid-rank percentile among
 * the frozen reference set (D-8). A dataset with points for under 90 % of its records is starred and has no level or
 * rank in this layer (D-4): its count is shown, never ranked.
 */
import {PILLARS, cell, lowLocated} from './model.js';
import {COUNT_SCALE} from './scales.js';
// D-4: the rule lives with the model since 0.6.0 (the highlights read it too, D-V2); re-exported for this layer's callers
export {LOW_LOCATED, lowLocated} from './model.js';

/** The readings of the section: inside the outline, or around it within 400 m or 800 m (`f.around`; '' = in). */
export const DISTANCES = Object.freeze(['in', '400', '800']);
export const RING_INDEX = Object.freeze({400: 0, 800: 1});
export const aroundDistance = value => (DISTANCES.includes(String(value)) ? String(value) : 'in');

// Verbatim from montri-th/shoppingcenter js/venue-locale.js @ dfcc6cd (handoff/around/contracts.json glance.levelRule).
export const levelOf = (p, count = 1) => (count > 0 && p != null ? Math.min(5, Math.floor(p / 20) + 1) : 0);
export const LEVEL_WORDS = Object.freeze([['ไม่พบ', 'none found'], ['น้อยมาก', 'very low'], ['น้อย', 'low'], ['ปานกลาง', 'middle'], ['มาก', 'high'], ['มากที่สุด', 'very high']]);
/** Colour of a percentile on the LDS count LUT (41 samples; index round(p × 40 / 100)), as «รอบศูนย์นี้». */
export const pctFill = p => COUNT_SCALE.lut[Math.max(0, Math.min(40, Math.round((Number(p) || 0) * 40 / 100)))];

/** Decode data/around.json; throws on a file of another schema. */
export function decodeAround(json) {
  const meta = json?.meta;
  if (meta?.schema !== 'citymeter-commercialdistrict-around/1' || !json.rows || String(meta.ringsM) !== '400,800') throw new Error('Invalid surroundings data');
  return {meta, rows: new Map(Object.entries(json.rows)), venues: json.venues || {}, byVenue: json.byVenue || {}};
}

/** The surroundings belong to the data of the page: one row per neighbourhood of data/neighborhoods.json, no other. */
export const aroundMatches = (around, model) => Boolean(around && model) && around.rows.size === model.rows.length && model.rows.every(r => around.rows.has(r.id));

/**
 * One reading of the glance inside the outline, by its EVID-05 state: out_of_scope (the dataset has no located record in
 * the province) · measured_zero (none inside) · no_data (records inside, none with a figure) · measured. `records`:
 * the dataset's records inside; `known`: those with the figure.
 */
export function readingOf(row, ds, figure) {
  if (!ds || !(ds.id in (row.c || {}))) return {state: 'out_of_scope', records: null, known: null, value: null};
  const records = row.c[ds.id];
  if (!records) return {state: 'measured_zero', records: 0, known: 0, value: 0};
  if (figure === 'count') return {state: 'measured', records, known: records, value: records};
  const m = row.m?.[ds.id];
  return m ? {state: 'measured', records, known: m[1], value: m[0]} : {state: 'no_data', records, known: 0, value: null};
}

/** The four tiles of the glance (around: decoded data/around.json, or null while it loads or when it did not load). */
export function glanceTiles(row, model, around) {
  const g = around?.rows.get(row.id)?.g || {};
  const tile = (id, dsId, figure, unit, evidence) => {
    const ds = model.dsById.get(dsId) || null, x = readingOf(row, ds, figure), star = lowLocated(ds);
    const p = !star && x.state !== 'out_of_scope' && x.state !== 'no_data' ? g[id] ?? null : null;
    const level = star || !around ? null : x.state === 'measured' && p != null ? levelOf(p, x.value) : x.state === 'measured_zero' ? 0 : null;
    return {id, ds, figure, unit, evidence, star, p, level, ...x};
  };
  return [
    {id: 'residents', ds: null, state: 'not_yet', evidence: 'modelled_estimate', star: false, p: null, level: null, value: null},
    tile('students', 'school', 'students', ['คน', 'people'], 'publisher_listed'),
    tile('rooms', 'hotel', 'rooms', ['ห้อง', 'rooms'], 'publisher_listed'),
    tile('centers', 'shoppingcenter', 'count', ['แห่ง', 'places'], 'derived_count'),
  ];
}

/**
 * Every dataset of a neighbourhood by pillar, for the table of «ขอบเดินถึง»: its inside cell (js/model.js#cell), its
 * figures around ([r400, r800]; null out of scope; undefined while the file loads or when it did not load) and the star.
 */
export function aroundGroups(row, model, around) {
  const a = around ? around.rows.get(row.id)?.a || {} : null;
  return PILLARS.map(pillar => ({pillar, items: model.datasets.filter(d => d.group === pillar).map(ds => {
    const c = cell(row, ds);
    return {ds, c, ring: c.state === 'out_of_scope' ? null : a ? a[ds.id] ?? null : undefined, star: lowLocated(ds)};
  })}));
}

/** The centres with a «รอบศูนย์นี้» page inside the outline, and those outside within the distance (nearest first). */
export function venuesOf(row, around, distance = 'in') {
  const v = around?.rows.get(row.id)?.v;
  if (!v) return {inside: [], near: []};
  const named = id => ({id, name: around.venues[id]?.[0] || id, nameEn: around.venues[id]?.[1] || ''});
  const limit = distance === 'in' ? -1 : Number(distance);
  return {inside: v.in.map(named), near: v.near.filter(([, m]) => m <= limit).map(([id, m]) => ({...named(id), m}))};
}

/**
 * How many neighbourhoods share a highlight's value in its peer group (NL-06): the build gives equal values one rank
 * (scripts/build-data.py#share_rank: 1, 2, 2, 4), so “rank k” alone hides that t neighbourhoods hold it.
 *   count    the neighbourhoods of the provinces the dataset covers with the same count
 *   density  those holding at least minCount with the same density
 */
export function sharedBy(model, row, h) {
  if (h.k === 'count') {
    const n = row.c?.[h.d];
    return model.rows.filter(r => h.d in (r.c || {}) && r.c[h.d] === n).length;
  }
  if (h.k === 'density') {
    const min = model.meta.rules?.minCount ?? 3, dv = row.density?.[h.d];
    return model.rows.filter(r => (r.c?.[h.d] || 0) >= min && r.density[h.d] === dv).length;
  }
  return 1;
}
