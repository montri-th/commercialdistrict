/**
 * CityMETER · Commercial District — the data model (pure: no DOM, no map).
 *
 * data/neighborhoods.json (scripts/build-data.py) holds the closed draft neighbourhoods of the central registry
 * (ทะเบียนย่านกลาง, canonical codes CMN-TH-…) with, per demo dataset, the records whose point lies inside the outline.
 * Grains are never mixed (DATA_METHOD.md §3): each dataset keeps its own unit, counts of two datasets are never
 * added, and a neighbourhood in a province a dataset does not reach has no value for it (out of scope), never 0.
 *
 * Value states (LDS 0.9.7 EVID-05):
 *   measured        records found inside the outline (count ≥ 1)
 *   measured_zero   the dataset reaches the province, no located record of it lies inside the outline
 *   out_of_scope    the dataset has no located record in the neighbourhood's province
 */
import {LANG} from './shell/i18n.js';

export const PILLARS = Object.freeze(['Land', 'Location', 'Living']);
/** Land · Location · Living → the series the CityMETER catalog gives each pillar (handoff-tokens.css). */
export const PILLAR_SERIES = Object.freeze({Land: 4, Location: 7, Living: 1});
export const PILLAR_TH = Object.freeze({Land: 'Land', Location: 'Location', Living: 'Living'});

const NUMBER = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 0});
const ONE = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 1});
export const num = n => (Number.isFinite(n) ? NUMBER.format(n) : '—');
export const one = n => (Number.isFinite(n) ? ONE.format(n) : '—');
/** Whole-number share; a non-zero part never prints as 0% ("<1%"). */
export const pct = (part, whole) => (!whole ? '—' : part && Math.round((part / whole) * 100) === 0 ? '<1%' : `${NUMBER.format(Math.round((part / whole) * 100))}%`);
/** Area of a neighbourhood: hectares ("31 ไร่" would need a second unit; the registry speaks m² and the team ha). */
export const hectares = m2 => (m2 / 1e4 >= 10 ? NUMBER.format(m2 / 1e4) : ONE.format(m2 / 1e4));

let PROVINCES = Object.freeze([]);
let BY_CODE = new Map();
/** Province frames (data/provinces.geojson: id = production code, code = DOPA code, name, nameEn, label, bbox). */
export function setProvinces(geojson) {
  PROVINCES = Object.freeze((geojson?.features || []).map(f => Object.freeze({
    code: String(f.properties.id), dopa: String(f.properties.code), th: f.properties.name, en: f.properties.nameEn,
    label: f.properties.label, bbox: f.properties.bbox, areaSqm: f.properties.areaSqm,
  })));
  BY_CODE = new Map(PROVINCES.map(p => [p.code, p]));
}
export const provinces = () => PROVINCES;
export const provinceByCode = code => BY_CODE.get(String(code || '').toUpperCase()) || null;
export const provinceName = code => (LANG === 'en' ? provinceByCode(code)?.en : provinceByCode(code)?.th) || code || '';
export const provinceCodeFrom = value => {
  const v = String(value || '').trim();
  if (!v) return '';
  return provinceByCode(v)?.code || PROVINCES.find(p => p.th === v || p.en?.toLowerCase() === v.toLowerCase() || p.dopa === v)?.code || '';
};

const lower = s => String(s || '').toLocaleLowerCase('th');

/**
 * Decode data/neighborhoods.json. Adds per row: area in km², the density of each dataset, the strongest highlight's
 * pillar (the map's default colour) and a search haystack.
 */
export function decodeData(json) {
  if (!json?.rows || !Array.isArray(json.datasets)) throw new Error('Invalid neighbourhood data');
  const datasets = json.datasets.map((d, index) => ({...d, index, series: PILLAR_SERIES[d.group] || 9}));
  const dsById = new Map(datasets.map(d => [d.id, d]));
  const rows = json.rows.map((r, index) => {
    const km2 = r.areaM2 / 1e6;
    const density = {};
    for (const [id, c] of Object.entries(r.c || {})) density[id] = c / km2;
    const top = (r.hl || [])[0];
    const pillar = top ? dsById.get(top.d)?.group || '' : '';
    const strong = (r.hl || []).filter(h => h.p >= 0.9).length;
    const p = provinceByCode(r.province);
    return {...r, index, km2, density, pillar, strong,
      haystack: lower([r.name, ...(r.aliases || []), p?.th, p?.en, r.id].filter(Boolean).join(' '))};
  });
  const byId = new Map(rows.map(r => [r.id, r]));
  const pending = (json.pending || []).map(p => ({...p, haystack: lower([p.name, provinceByCode(p.province)?.th, p.id].join(' '))}));
  const pendingById = new Map(pending.map(p => [p.id, p]));
  const roles = (json.roles || []).map(r => ({...r}));
  return {meta: json.meta || {}, datasets, dsById, rows, byId, pending, pendingById, roles, pairs: json.pairs || [], stations: json.stations || []};
}

/** Columnar points of data/points.json → per neighbourhood index: [[dataset index, lon, lat, subgroup]…]. */
export function decodePoints(json, rowCount) {
  const by = Array.from({length: rowCount}, () => []);
  for (const [d, n, lon, lat, s] of json?.rows || []) if (by[n]) by[n].push([d, lon, lat, s]);
  return by;
}

/** The value of one dataset in one neighbourhood (EVID-05 state, count, density, ranks, measure). */
export function cell(row, ds) {
  if (!(ds.id in (row.c || {}))) return {state: 'out_of_scope'};
  const count = row.c[ds.id];
  if (!count) return {state: 'measured_zero', count: 0, density: 0};
  const r = row.r?.[ds.id] || [];
  const m = row.m?.[ds.id];
  return {state: 'measured', count, density: row.density[ds.id], countRank: r[0] || null, covered: r[1] || null,
    densityRank: r[2] || null, ranked: r[3] || null, measure: m ? {sum: m[0], known: m[1]} : null, sub: row.s?.[ds.id] || null};
}

/** Name of a dataset in the page language (menu name in English, the Thai reading name otherwise). */
export const dsName = ds => (LANG === 'en' ? ds.name : ds.nameTh);
export const dsUnit = ds => (LANG === 'en' ? ds.unitEn : ds.unitTh);
const SINGULAR = {places: 'place', estates: 'estate', records: 'record', outlets: 'outlet', registrations: 'registration', branches: 'branch', stores: 'store',
  'points of sale': 'point of sale', pharmacies: 'pharmacy', restaurants: 'restaurant', facilities: 'facility', schools: 'school', 'station-line records': 'station-line record', sites: 'site'};
/** The unit after a number: English takes the singular for one. */
export const dsUnitN = (ds, n) => (LANG === 'en' && n === 1 ? SINGULAR[ds.unitEn] || ds.unitEn : dsUnit(ds));

/** The roles a neighbourhood's highlights speak to (Inference: the registry's taxonomy, this demo's mapping). */
export function rolesOf(row, model) {
  const strong = new Set((row.hl || []).map(h => h.d));
  return model.roles.map(r => ({...r, evidence: r.datasets.filter(d => strong.has(d)), proposed: (row.roles || []).includes(r.id)}))
    .filter(r => r.evidence.length || r.proposed);
}

/** Co-location pairs the neighbourhood's highlights form (national pattern: Spearman ρ across the neighbourhoods). */
export function pairsOf(row, model) {
  const key = new Set((row.pairs || []).map(([a, b]) => `${a}|${b}`));
  return model.pairs.filter(p => key.has(`${p.a}|${p.b}`) || key.has(`${p.b}|${p.a}`));
}

/** Rows of a province (or every row) after the search. */
export function scopeRows(model, {province = '', search = ''} = {}) {
  const terms = lower(search).trim().split(/\s+/).filter(Boolean);
  return model.rows.filter(r => (!province || r.province === province) && terms.every(t => r.haystack.includes(t)));
}

/** Search the pending codes too (held or a collection name): they have no outline to compare. */
export function scopePending(model, {province = '', search = ''} = {}) {
  const terms = lower(search).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return model.pending.filter(p => (!province || p.province === province) && terms.every(t => p.haystack.includes(t)));
}

/**
 * The national reading (first finding): the share of each dataset's located records that lie inside the
 * neighbourhoods, against the neighbourhoods' share of the country's area.
 */
export function nationalShares(model) {
  const t = model.meta.totals || {};
  const list = model.datasets.filter(d => d.located > 0).map(d => ({ds: d, inside: d.inside, located: d.located, share: d.inside / d.located}))
    .sort((a, b) => b.share - a.share);
  return {areaKm2: t.areaKm2, thailandKm2: t.thailandKm2, areaShare: t.areaKm2 / t.thailandKm2, closed: t.closed, list};
}

/** Neighbourhoods per province (closed outlines), most first. */
export function provinceCounts(model) {
  const m = new Map();
  for (const r of model.rows) m.set(r.province, (m.get(r.province) || 0) + 1);
  return [...m].map(([code, n]) => ({code, n})).sort((a, b) => b.n - a.n || provinceName(a.code).localeCompare(provinceName(b.code), 'th'));
}

/** The neighbourhoods that stand out on most fronts (highlights in the top tenth), then by the strongest highlight. */
export function multiStrong(rows, limit = 10) {
  return rows.filter(r => r.strong > 0).sort((a, b) => b.strong - a.strong || (b.hl[0]?.p || 0) - (a.hl[0]?.p || 0) || a.name.localeCompare(b.name, 'th')).slice(0, limit);
}

/** Ranking of a dataset among the rows: by density among the ranked ones, then by count. */
export function datasetRanking(rows, ds, limit = 10) {
  return rows.map(r => ({row: r, c: cell(r, ds)})).filter(x => x.c.state === 'measured')
    .sort((a, b) => (b.c.count >= 3) - (a.c.count >= 3) || b.c.density - a.c.density || b.c.count - a.c.count).slice(0, limit);
}

/** Bounds [w, s, e, n] of rows (their outlines' boxes). */
export function rowsBounds(rows) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const r of rows) { const b = r.bbox; if (!b) continue; w = Math.min(w, b[0]); s = Math.min(s, b[1]); e = Math.max(e, b[2]); n = Math.max(n, b[3]); }
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

export function safeURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
}
