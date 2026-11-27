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
/** D-4 (0.4.0): a dataset with points for under 90 % of its records is starred — counted, never ranked or levelled. */
export const LOW_LOCATED = 0.9;
export const lowLocated = ds => Boolean(ds?.records) && ds.located / ds.records < LOW_LOCATED;
/** Land · Location · Living → the series the CityMETER catalog gives each pillar (handoff-tokens.css). */
export const PILLAR_SERIES = Object.freeze({Land: 4, Location: 7, Living: 1});
export const PILLAR_TH = Object.freeze({Land: 'Land', Location: 'Location', Living: 'Living'});

const NUMBER = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 0});
const ONE = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 1});
export const num = n => (Number.isFinite(n) ? NUMBER.format(n) : '—');
export const one = n => (Number.isFinite(n) ? ONE.format(n) : '—');
/** Whole-number share; a non-zero part never prints as 0% ("<1%"). */
export const pct = (part, whole) => (!whole ? '—' : part && Math.round((part / whole) * 100) === 0 ? '<1%' : `${NUMBER.format(Math.round((part / whole) * 100))}%`);
const SIG2 = new Intl.NumberFormat('th-TH', {maximumSignificantDigits: 2});
/** 1 ไร่ = 1,600 m². */
export const RAI_M2 = 1600;
/**
 * Area of a neighbourhood in ไร่ on both pages (owner 2026-11-18: hectares mean nothing to a Thai reader; ไร่ or km²
 * fits). Two significant digits below 1 ไร่, so a small outline never prints as 0.
 */
export const rai = m2 => {
  const v = m2 / RAI_M2;
  return !Number.isFinite(v) ? '—' : v >= 10 ? NUMBER.format(v) : v >= 1 ? ONE.format(v) : SIG2.format(v);
};
/** The same area in km² — the denominator of every "ต่อ ตร.กม." — two significant digits below 1 km² (never 0). */
export const km2Text = km2 => (!Number.isFinite(km2) ? '—' : km2 >= 10 ? NUMBER.format(km2) : km2 >= 1 ? ONE.format(km2) : SIG2.format(km2));

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
 * Python's round(x, n), as scripts/build-data.py rounds a highlight: the nearest multiple of 10^-n to the double's exact
 * value, an exact tie to the even digit (0.8125 → 0.812). toFixed sends a tie up (0.813), so a tie is settled here from
 * the exact decimal value (toFixed(100) holds every digit of the shares and strengths it rounds). (0.7.7: the first tie,
 * 1 − 24/128, came with the outlines the owner ticked.)
 */
const fixed = (x, n) => {
  const exact = x.toFixed(100).replace(/0+$/, '');
  const dot = exact.indexOf('.');
  if (dot < 0 || exact.length - dot - 1 !== n + 1 || !exact.endsWith('5')) return Number(x.toFixed(n));
  const down = exact.slice(0, -1);   // the tie's lower neighbour in magnitude, n digits
  const last = Number(down[down.length - 1] === '.' ? down[down.length - 2] : down[down.length - 1]);
  if (last % 2 === 0) return Number(down);
  return Number((Math.abs(Number(down)) + 10 ** -n).toFixed(n)) * Math.sign(x);
};

/**
 * The highlights of one row by the build's own rule (scripts/build-data.py, “highlight candidates”): per dataset with
 * records inside, the strongest of four comparisons — share of the dataset's located records nationwide, count rank
 * among the neighbourhoods of the provinces it covers, density rank among those holding at least `minCount`, one of the
 * few holding any — kept when its strength reaches `strengthMin`; strongest first (equal strength: the larger national
 * share first), at most `maxHighlights`. `keep(ds)` chooses the datasets that may stand out. With every dataset kept it
 * returns the file's own `hl` (tests/visual.test.js holds the two equal for every row).
 */
export function highlightsOf(r, datasets, rules = {}, keep = () => true) {
  const MIN = rules.minCount ?? 3, NATIONAL = rules.nationalShare ?? 0.05, PEERS = rules.minPeers ?? 10;
  const RARE = rules.rareShare ?? 0.15, STRENGTH = rules.strengthMin ?? 0.75, MAX = rules.maxHighlights ?? 4;
  const out = [];
  for (const d of datasets) {
    const n = r.c?.[d.id];
    if (!n || !keep(d)) continue;
    const [ci = 0, covn = 0, rr = null, peers = 0] = r.r?.[d.id] || [];
    const share = d.located ? n / d.located : 0, withAny = d.peers?.withAny ?? 0;
    let best = null;
    const offer = c => { if (!best || c.p > best.p) best = c; };
    if (share >= NATIONAL) offer({k: 'share', v: fixed(share, 4), p: 0.95 + Math.min(share, 0.05)});
    if (n >= MIN && covn) offer({k: 'count', v: ci, of: covn, p: 1 - (ci - 1) / covn});
    if (rr != null && peers >= PEERS) offer({k: 'density', v: rr, of: peers, p: 1 - (rr - 1) / peers});
    if (covn && withAny / covn <= RARE) offer({k: 'rare', v: withAny, of: covn, p: 1 - withAny / covn});
    if (best && best.p >= STRENGTH) out.push({d: d.id, ...best, share});
  }
  out.sort((a, b) => fixed(b.p, 3) - fixed(a.p, 3) || b.share - a.share);
  return out.slice(0, MAX).map(({share, p, ...h}) => ({...h, p: fixed(p, 3)}));
}

/** The pairs a row's highlights form among the nationwide pairs at or above `pairMinRho` (the build's `pairs` of a row). */
export function togetherOf(hl, strongPairs) {
  const best = hl.map(h => h.d);
  return best.flatMap(a => best.filter(b => strongPairs.has(`${a}|${b}`)).map(b => [a, b]));
}

/**
 * Decode data/neighborhoods.json. Adds per row: area in km², the density of each dataset, the strongest highlight's
 * pillar (the map's default colour) and a search haystack.
 *
 * (0.6.0, D-V2; owner 2026-11-26 11:43) A highlight stands only on a dataset with points for at least 90 % of its records:
 * the row's highlights are drawn again by the build's rule over those datasets (`hl`), and so are the pairs they form
 * (`pairs`); the file's own lists stay as `hlBuild` and `pairsBuild`.
 */
export function decodeData(json) {
  if (!json?.rows || !Array.isArray(json.datasets)) throw new Error('Invalid neighbourhood data');
  const datasets = json.datasets.map((d, index) => ({...d, index, series: PILLAR_SERIES[d.group] || 9}));
  const dsById = new Map(datasets.map(d => [d.id, d]));
  const formerIds = json.meta?.lodging?.aliases || {};
  const former = new Map(Object.entries(formerIds).map(([old, now]) => [now, old]));
  const rules = json.meta?.rules || {};
  const strongPairs = new Set((json.pairs || []).filter(p => p.rho >= (rules.pairMinRho ?? 0.35)).map(p => `${p.a}|${p.b}`));
  const complete = d => !lowLocated(d);
  const rows = json.rows.map((r, index) => {
    const km2 = r.areaM2 / 1e6;
    const density = {};
    for (const [id, c] of Object.entries(r.c || {})) density[id] = c / km2;
    const hl = highlightsOf(r, datasets, rules, complete);
    const top = hl[0];
    const pillar = top ? dsById.get(top.d)?.group || '' : '';
    const strong = hl.filter(h => h.p >= 0.9).length;
    const p = provinceByCode(r.province);
    return {...r, hlBuild: r.hl || [], pairsBuild: r.pairs || [], hl, pairs: togetherOf(hl, strongPairs), index, km2, density, pillar, strong,
      haystack: lower([r.name, ...(r.aliases || []), p?.th, p?.en, r.id, former.get(r.id)].filter(Boolean).join(' '))};
  });
  const byId = new Map(rows.map(r => [r.id, r]));
  const pending = (json.pending || []).map(p => ({...p, haystack: lower([p.name, provinceByCode(p.province)?.th, p.id, former.get(p.id)].filter(Boolean).join(' '))}));
  const pendingById = new Map(pending.map(p => [p.id, p]));
  const roles = (json.roles || []).map(r => ({...r}));
  // (0.2.1) an id of the 0.2.0 links (LP-NEW-…) opens the central code the registry gave the same area
  const canonicalId = id => (byId.has(id) || pendingById.has(id) ? id : formerIds[id] || id);
  return {meta: json.meta || {}, datasets, dsById, rows, byId, pending, pendingById, roles, pairs: json.pairs || [], stations: json.stations || [], canonicalId};
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
/**
 * Groups of neighbourhoods (0.2.0; `f.kind`): registry = outlines closed by the registry's own rules; lodging = the draft
 * outlines of the lodging screen's new areas (owner 2026-11-18; central codes of the registry since 0.2.1); screen = the
 * outlines the owner's rule drew for the codes of the registry's commercial screen (0.5.0; owner 2026-11-26); added =
 * first drawn since the outlines of 16 Nov 2026.
 */
export const KINDS = ['registry', 'lodging', 'screen', 'added'];
export const kindMatch = (r, kind) => !kind || (kind === 'added' ? Boolean(r.added) : (r.kind || 'registry') === kind);

export function scopeRows(model, {province = '', search = '', kind = ''} = {}) {
  const terms = lower(search).trim().split(/\s+/).filter(Boolean);
  return model.rows.filter(r => (!province || r.province === province) && kindMatch(r, kind) && terms.every(t => r.haystack.includes(t)));
}

/** Search the pending codes too (held or a collection name): they have no outline to compare. */
export function scopePending(model, {province = '', search = '', kind = ''} = {}) {
  const terms = lower(search).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const fromLodging = p => p.screen === 'lodging' || p.status === 'lodging';
  const fromScreen = p => p.screen === 'commercial';
  const fits = p => !kind || (kind === 'lodging' ? fromLodging(p) : kind === 'screen' ? fromScreen(p) : kind === 'registry' ? !fromLodging(p) && !fromScreen(p) : false);
  return model.pending.filter(p => (!province || p.province === province) && fits(p) && terms.every(t => p.haystack.includes(t)));
}

/**
 * The national reading (first finding): the share of each dataset's located records that lie inside the
 * neighbourhoods, against the neighbourhoods' share of the country's area.
 */
export function nationalShares(model) {
  const t = model.meta.totals || {};
  const list = model.datasets.filter(d => d.located > 0).map(d => ({ds: d, inside: d.inside, located: d.located, share: d.inside / d.located}))
    .sort((a, b) => b.share - a.share);
  return {areaKm2: t.areaKm2, thailandKm2: t.thailandKm2, areaShare: t.areaKm2 / t.thailandKm2, closed: t.outlined ?? t.closed, list};
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
