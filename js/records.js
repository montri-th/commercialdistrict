/**
 * The records of the open neighbourhood and the condominium display points (0.1.3): decoding, one pin per spot, the
 * dataset bar of the map, the names beside the chosen set's pins, and the HTML of the hover tip, the record card and
 * the panel's list of names. Pure: no DOM access, no map.
 *
 * Owner 2026-11-16: “จุดในย่าน ตอนนี้คลิกไม่ได้ ช่วยทำให้ click ดูรายละเอียดที่เกี่ยวข้องได้หน่อย และควรแสดงจุด
 * Condominium ด้วย / icon หมุดต่างๆตอนนี้ดูยากมาก … / หรือ mouse hover ที่หมุดก็ควรมี popup ให้รู้ว่ามันคืออะไร /
 * เอา condo จาก dataset ใน registry ไง”, then “icon ใน symbol ที่ทำอยู่ไม่ช่วยเท่าไรนะครับ” and the choice
 * “เลือกดูทีละชุด”: a bar on the map names the sets in the neighbourhood; the chosen set's pins grow and carry their
 * names, the others turn into small neutral dots that still answer the pointer. Colours and shapes stay the pillars'
 * (LDS DATAVIZ-05): one set stands out at a time, so no two sets need telling apart by colour.
 *
 *  - A record is one row of a demo dataset whose point lies inside the open neighbourhood's outline
 *    (data/records/<id>.json): its key in its own demo, the names the demo publishes, its subgroup and its figure.
 *  - A spot is the records of one dataset at one exact point: one pin. A pin with more than one record shows a second
 *    outline behind it; the card lists them. No total is ever shown: two datasets' counts are never added
 *    (DATA_METHOD.md §3), so tips and lists name the records instead of counting them.
 *  - Condominium points (data/condo/) are the points the CityMETER condominium appraisal map draws (registry dataset
 *    group Land). They are a set of the bar of their own, drawn round the open neighbourhood when chosen, and never
 *    counted in it: the dataset's own spatial policy says a display point does not make an area membership.
 *
 * Every card that shows a figure ends with dataset · source · date · boundary. Names stay as the source writes them
 * (`translate="no"`); the English page uses a record's English name when its demo has one.
 */
import {LANG} from './shell/i18n.js';
import {DEMOS, demoUrl} from './shell/datasets.js';
import {PILLARS, PILLAR_SERIES, num, dsName} from './model.js';
import {L, esc, thaiDate, dsDate} from './panel.js';
import {cueMarkup} from './cues.js';
import {mapsSearchURL, streetViewURL} from './ask.js';

const EN = LANG === 'en';
export const CONDO = 'condo';
/** The bar's “ทั้งหมด” (`f.show=all`): every set alike, chosen by the reader (0.1.4). */
export const ALL = 'all';
/** Names a tip shows per set before “and more” (the card lists them all). */
export const TIP_NAMES = 3;

/* ---------- decode ---------- */

/** data/records/<id>.json → records (dataset objects from the model). */
export function decodeRecords(json, model) {
  const F = Object.fromEntries((json?.fields || []).map((f, i) => [f, i]));
  if (!('dataset' in F) || !Array.isArray(json.rows)) return [];
  const out = [];
  json.rows.forEach((r, i) => {
    const ds = model?.datasets?.[r[F.dataset]];
    if (!ds || !Number.isFinite(r[F.lon]) || !Number.isFinite(r[F.lat])) return;
    const [lineTh = '', lineEn = ''] = String(r[F.sub] || '').split('|');
    out.push(Object.freeze({i, kind: 'record', ds, lon: r[F.lon], lat: r[F.lat], sub: r[F.subgroup], key: String(r[F.key] ?? ''),
      name: r[F.name] || '', nameEn: r[F.nameEn] || '', measure: Number.isFinite(r[F.measure]) ? r[F.measure] : null,
      line: EN ? lineEn || lineTh : lineTh}));
  });
  return out;
}

/** The condominium set (never in model.datasets: it is never counted). */
export function condoDataset(meta) {
  if (!meta) return null;
  return Object.freeze({id: CONDO, name: meta.name || 'Condominium', nameTh: meta.nameTh || 'คอนโดมิเนียม', group: meta.group || 'Land',
    unitTh: meta.unitTh || 'รายการ', unitEn: meta.unitEn || 'records', meta});
}

/** data/condo/<cell>.json → condominium points. */
export function decodeCondo(json, ds) {
  const F = Object.fromEntries((json?.fields || []).map((f, i) => [f, i]));
  if (!ds || !('lon' in F) || !Array.isArray(json.rows)) return [];
  const n = v => (Number.isFinite(v) ? v : null);
  return json.rows.filter(r => Number.isFinite(r[F.lon]) && Number.isFinite(r[F.lat])).map((r, i) => Object.freeze({
    i, kind: CONDO, ds, cell: json.cell || '', lon: r[F.lon], lat: r[F.lat], name: r[F.name] || '', nameEn: '',
    buildings: n(r[F.buildings]), floors: n(r[F.floors]), p25: n(r[F.p25]), p50: n(r[F.p50]), p75: n(r[F.p75]),
    area: r[F.area] || '', province: r[F.province] || '',
  }));
}

/** The 0.1° cells (keys `floor(lon*10)_floor(lat*10)`) a box [w, s, e, n] touches, among those that exist. */
export function cellsIn(box, cell = 0.1, existing = null) {
  const [w, s, e, n] = box, out = [];
  const x0 = Math.floor(w / cell), x1 = Math.floor(e / cell), y0 = Math.floor(s / cell), y1 = Math.floor(n / cell);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 400) return out; // a view this wide never draws condominium points
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const key = `${x}_${y}`;
    if (!existing || existing.has(key)) out.push(key);
  }
  return out;
}

/** A box [w, s, e, n] grown by `m` metres each way. */
export function growBox([w, s, e, n], m) {
  const lat = (s + n) / 2, dy = m / 110574, dx = m / (111320 * Math.cos((lat * Math.PI) / 180));
  return [w - dx, s - dy, e + dx, n + dy];
}

/* ---------- spots ---------- */

/** One pin per dataset and exact point; records keep their order (the shard is sorted by dataset, then name). */
export function spotsOf(records) {
  const by = new Map();
  for (const r of records || []) {
    const k = `${r.ds.id}|${r.lon}|${r.lat}`;
    let g = by.get(k);
    if (!g) by.set(k, g = {ds: r.ds, lon: r.lon, lat: r.lat, items: []});
    g.items.push(r);
  }
  return [...by.values()];
}

/* ---------- words ---------- */

export const seriesOfDs = ds => PILLAR_SERIES[ds?.group] || 9;
/** A set's cue: its pillar's shape and series colour (dashed for the condominium points). Decorative. */
export const dsCue = ds => cueMarkup(seriesOfDs(ds), {className: ds?.id === CONDO ? 'is-dashed' : ''});
export const recordName = r => (EN ? r.nameEn || r.name : r.name || r.nameEn) || '';
const nameOrNone = r => recordName(r) || L('ไม่มีชื่อในแหล่ง', 'No name in the source');
export function subgroupLabel(r) {
  if (r.kind === CONDO) return L('จุดตามแหล่ง', 'source point');
  const g = r.ds.subgroups?.[r.sub];
  return g ? (EN ? g.en || g.th : g.th) : '';
}
/** The figure's exact name, from the dataset's own note (the clause before “ไม่ใช่” / “, not”), else the measure. */
export function measureLabel(m) {
  if (!m) return '';
  const note = EN ? m.noteEn || '' : m.noteTh || '';
  const head = EN ? note.split(/,\s*not\b/)[0] : note.split(/\s+ไม่ใช่/)[0];
  return (note && head !== note ? head : EN ? m.en : m.th).trim();
}

/** The record in its own demo: `<demo>/?e=<kind>:<key>` (citymeter-shell grammar), in English when the demo has it. */
export function recordHref(r) {
  if (r?.kind !== 'record' || !r.key || !r.ds?.item) return '';
  const demo = DEMOS.find(d => d.path === r.ds.path);
  if (!demo) return '';
  const ref = encodeURIComponent(`${r.ds.item}:${r.key}`).replace(/%3A/gi, ':').replace(/%2F/gi, '/');
  return `${demoUrl(demo)}?e=${ref}${EN && demo.en ? '&lang=en' : ''}`;
}
const demoOf = r => DEMOS.find(d => d.path === r?.ds?.path) || null;

/* ---------- the dataset bar ---------- */

/**
 * The sets of the open neighbourhood in the bar's order: its highlights first (their order), then the others in the
 * pillar order of the registry (Land · Location · Living); the condominium set last when it has points near.
 */
export function barSets(records, {highlights = [], condo = null} = {}) {
  const present = [];
  for (const r of records || []) if (!present.includes(r.ds)) present.push(r.ds);
  const rank = ds => {
    const h = highlights.indexOf(ds.id);
    return h >= 0 ? h : 100 + PILLARS.indexOf(ds.group) * 100 + (ds.index ?? 0);
  };
  const out = present.sort((a, b) => rank(a) - rank(b));
  if (condo) out.push(condo);
  return out;
}

/**
 * The set the open neighbourhood shows (0.1.4; owner 2026-11-16 23:27, VERBATIM: “เวลาคลิกย่าน ควรจะเห็น venue ที่
 * highlighted ก่อนมั้ย”): the reader's own pick when the neighbourhood has it; “ทั้งหมด” (ALL) → none, every set alike;
 * otherwise the dataset the map is read by (`m`) when the neighbourhood has it, else its first highlight with records.
 */
export function resolveChosen(focus, {records = [], highlights = [], lens = '', condo = false} = {}) {
  if (focus === ALL) return '';
  if (focus === CONDO && condo) return CONDO;
  const has = id => !!id && id !== CONDO && (records || []).some(r => r.ds.id === id);
  if (has(focus)) return focus;
  if (has(lens)) return lens;
  return (highlights || []).find(has) || '';
}

/** The bar: “ทั้งหมด” and one button per set (cue + name, no number), the chosen one pressed (none chosen → ทั้งหมด). */
export function barHTML(sets, chosen = '') {
  if (!sets.length) return '';
  const button = (id, inner, title) => `<button type="button" class="focus-chip${id === CONDO ? ' is-condo' : ''}" data-focus="${esc(id)}" aria-pressed="${String(id === ALL ? !chosen : id === chosen)}"${title ? ` title="${esc(title)}"` : ''}>${inner}</button>`;
  return [
    button(ALL, `<span>${esc(L('ทั้งหมด', 'All'))}</span>`, L('ทุกชุดข้อมูลในย่าน ขนาดเท่ากัน', 'Every dataset in the neighbourhood, alike')),
    ...sets.map(ds => button(ds.id, `${dsCue(ds)}<span>${esc(dsName(ds))}</span>${ds.id === CONDO ? `<small>${esc(L('จุดตามแหล่ง', 'source points'))}</small>` : ''}`,
      ds.id === CONDO ? L('คอนโดมิเนียมรอบย่าน: จุดที่แผนที่ราคาประเมินของ CityMETER วาด ยังไม่ยืนยันตำแหน่งรายโครงการ ไม่นับในตัวเลขของย่าน', 'Condominiums round the neighbourhood: the points the CityMETER appraisal map draws, not confirmed project locations, never counted in a neighbourhood')
        : L(`ดู${dsName(ds)}ในย่านพร้อมชื่อ`, `Show ${dsName(ds)} in the neighbourhood with names`))),
  ].join('');
}

/** The chosen set's names beside its pins: [{id: spot index, name, title, center}] in display priority. */
export function labelItems(spots, chosen) {
  const out = [];
  (spots || []).forEach((g, i) => {
    if (!chosen || g.ds.id !== chosen) return;
    const first = nameOrNone(g.items[0]);
    const name = g.items.length > 1 ? `${first} ${L('ฯลฯ', '& more')}` : first;
    out.push({id: i, name, title: `${dsName(g.ds)} · ${g.items.map(nameOrNone).slice(0, 6).join(' · ')}`, center: [g.lon, g.lat],
      rank: (g.items[0].measure || 0) + (g.items.length > 1 ? 1e6 : 0)});
  });
  return out.sort((a, b) => b.rank - a.rank);
}

/* ---------- hover tip ---------- */

/** Spots under the pointer (nearest first) → the tip: one record named, else the names by dataset (no counts). */
export function tipHTML(spots) {
  const list = (spots || []).filter(s => s?.items?.length);
  if (!list.length) return '';
  if (list.length === 1 && list[0].items.length === 1) {
    const r = list[0].items[0];
    const meta = [dsName(r.ds), subgroupLabel(r)].filter(Boolean).join(' · ');
    return `<div class="poi-tip-row">${dsCue(r.ds)}<span class="poi-tip-text"><strong translate="no">${esc(nameOrNone(r))}</strong><small>${esc(meta)}</small></span></div>`;
  }
  const groups = byDataset(list.flatMap(s => s.items));
  const rows = groups.slice(0, 4).map(({ds, items}) => {
    const names = items.slice(0, TIP_NAMES).map(nameOrNone);
    const more = items.length > TIP_NAMES ? L(' และอื่น ๆ', ' and more') : '';
    return `<div class="poi-tip-row">${dsCue(ds)}<span class="poi-tip-text"><strong>${esc(dsName(ds))}</strong><small><span translate="no">${esc(names.join(' · '))}</span>${esc(more)}</small></span></div>`;
  }).join('');
  const rest = groups.length > 4 ? `<p class="poi-tip-hint">${esc(L('และชุดอื่น', 'and other datasets'))}</p>` : '';
  return `${rows}${rest}<p class="poi-tip-hint">${esc(L('กดเพื่อดูรายชื่อ', 'Click for the list'))}</p>`;
}

/* ---------- card ---------- */

/** parts: [[key, text | {html}]…]; names inside a part stay as written (`keep`). */
function provenanceLine(parts) {
  return `<p class="hint poi-prov">${parts.filter(([, v]) => v).map(([k, v]) => `<span class="prov-part" data-prov="${k}">${typeof v === 'object' ? v.html : esc(v)}</span>`).join('')}</p>`;
}
const keep = text => `<span translate="no">${esc(text)}</span>`;
/** “inside the outline of <neighbourhood> (draft)” with the name kept as the registry writes it. */
const insideOutline = row => (row ? {html: L(`ในขอบย่าน${keep(row.name)} (ฉบับร่าง)`, `inside the ${keep(row.name)} outline (draft)`)} : '');

/** dataset · source · date · boundary of one record (the open neighbourhood's outline, or the source's search area). */
export function recordProvenance(r, {row = null} = {}) {
  if (r.kind === CONDO) {
    const m = r.ds.meta || {};
    const area = [r.area, r.province].filter(Boolean).join(', ');
    return provenanceLine([
      ['dataset', dsName(r.ds)],
      ['source', L('ฐานวิจัยคอนโดมิเนียม CityMETER · จุดจากแผนที่ราคาประเมิน', 'CityMETER condominium research · appraisal-map points')],
      ['date', L(`ตรวจแหล่ง ${thaiDate(m.checkedOn)}`, `source checked ${thaiDate(m.checkedOn)}`)],
      ['boundary', {html: L(`พื้นที่ค้นตามแหล่ง ${keep(area)} · ไม่นับในตัวเลขของย่าน`, `source search area ${keep(area)} · not counted in any neighbourhood`)}],
    ]);
  }
  const date = dsDate(r.ds);
  return provenanceLine([
    ['dataset', dsName(r.ds)],
    ['source', `CityMETER ${r.ds.name}`],
    ['date', date ? L(`ข้อมูล ${thaiDate(date)}`, `data of ${thaiDate(date)}`) : ''],
    ['boundary', insideOutline(row)],
  ]);
}

function factsOf(r) {
  const facts = [];
  if (r.kind === CONDO) {
    const size = [r.buildings != null ? L(`${num(r.buildings)} อาคาร`, `${num(r.buildings)} ${r.buildings === 1 ? 'building' : 'buildings'}`) : '',
      r.floors != null ? L(`${num(r.floors)} ชั้น`, `${num(r.floors)} ${r.floors === 1 ? 'floor' : 'floors'}`) : ''].filter(Boolean).join(' · ');
    if (size) facts.push([L('ตามแหล่ง', 'Per the source'), size]);
    if (r.p50 != null) facts.push([L('ราคาประเมินห้องชุด ค่ากลาง', 'Unit appraisal, median'), L(`${num(r.p50)} บาท/ตร.ม.`, `${num(r.p50)} baht/m²`)]);
    if (r.p25 != null && r.p75 != null) facts.push([L('ช่วงกลางของราคาประเมิน (P25–P75)', 'Middle range of the appraisal (P25–P75)'), L(`${num(r.p25)}–${num(r.p75)} บาท/ตร.ม.`, `${num(r.p25)}–${num(r.p75)} baht/m²`)]);
    return facts;
  }
  const m = r.ds.measure;
  if (m && r.measure != null) facts.push([measureLabel(m), `${num(r.measure)} ${EN ? m.en : m.th}`]);
  return facts;
}

function actionsOf(r) {
  const links = [];
  const href = recordHref(r), demo = demoOf(r);
  if (href && demo) links.push(`<a class="ask-link poi-open" href="${esc(href)}">${esc(L(`เปิดในเดโม ${demo.name}`, `Open in the ${demo.name} demo`))}</a>`);
  const name = recordName(r);
  if (name) links.push(`<a class="ask-link poi-maps" href="${esc(mapsSearchURL([name, r.kind === CONDO ? r.province : ''].filter(Boolean).join(' ')))}" target="_blank" rel="noopener noreferrer"><i class="pictogram pic-maps" aria-hidden="true"></i><span>Google Maps</span></a>`);
  const sv = streetViewURL(r.lat, r.lon);
  if (sv) links.push(`<a class="ask-link poi-streetview" href="${esc(sv)}" target="_blank" rel="noopener noreferrer"><i class="pictogram pic-streetview" aria-hidden="true"></i><span>Street View</span></a>`);
  return links.length ? `<div class="poi-actions" role="group" aria-label="${esc(L('ดูต่อ', 'Look further'))}">${links.join('')}</div>` : '';
}

/** One record. `back`: the card came from a list (a button returns to it). */
export function detailHTML(r, {row = null, back = false} = {}) {
  const meta = [dsName(r.ds), subgroupLabel(r)].filter(Boolean).join(' · ');
  const facts = factsOf(r);
  return `<article class="poi-card" data-kind="${r.kind}" data-dataset="${esc(r.ds.id)}">
    ${back ? `<button type="button" class="btn quiet back poi-back" data-poi="list">${esc(L('ทั้งหมดที่จุดนี้', 'Everything here'))}</button>` : ''}
    <div class="poi-head">${dsCue(r.ds)}<div class="poi-title"><p class="poi-eyebrow">${esc(meta)}</p><h3 translate="no">${esc(nameOrNone(r))}</h3>${r.line ? `<p class="poi-line" translate="no">${esc(r.line)}</p>` : ''}</div></div>
    ${facts.length ? `<dl class="poi-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="data-number">${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${actionsOf(r)}
    ${recordProvenance(r, {row})}
  </article>`;
}

/** Records grouped by dataset in the pillar order (Land · Location · Living), condominium points last. */
export function byDataset(records) {
  const order = ds => (ds.id === CONDO ? 1e4 : PILLARS.indexOf(ds.group) * 100 + (ds.index ?? 0));
  const groups = new Map();
  for (const r of records) {
    if (!groups.has(r.ds.id)) groups.set(r.ds.id, {ds: r.ds, items: []});
    groups.get(r.ds.id).items.push(r);
  }
  return [...groups.values()].sort((a, b) => order(a.ds) - order(b.ds));
}

/** Several records at one point (or under one click): their names by dataset; each opens its card. */
export function listHTML(records, {row = null} = {}) {
  const groups = byDataset(records);
  const body = groups.map(({ds, items}) => `<section class="poi-group"><h3>${dsCue(ds)}<span>${esc(dsName(ds))}</span></h3>
    <ul>${items.map(r => `<li><button type="button" class="poi-item" data-poi="${records.indexOf(r)}"><span translate="no">${esc(nameOrNone(r))}</span>${subgroupLabel(r) ? `<small>${esc(subgroupLabel(r))}</small>` : ''}</button></li>`).join('')}</ul></section>`).join('');
  const dates = groups.map(({ds}) => (ds.id === CONDO ? `${dsName(ds)} ${L('ตรวจแหล่ง', 'checked')} ${thaiDate(ds.meta?.checkedOn)}` : `${dsName(ds)} ${thaiDate(dsDate(ds))}`)).join(' · ');
  return `<article class="poi-card" data-kind="list">
    <p class="poi-eyebrow">${esc(L('ที่จุดนี้', 'At this point'))}</p>
    ${body}
    ${provenanceLine([['source', `CityMETER · ${dates}`], ['boundary', insideOutline(row)]])}
  </article>`;
}

/* ---------- the panel's list ---------- */

/**
 * The names inside the open neighbourhood, by dataset, as buttons that open each record's card on the map (the
 * reading without the map, LDS MAP-01). `records` null: still loading. No counts (the dataset rows above have them).
 */
export function panelListHTML(records, {open = false} = {}) {
  const summary = `<summary>${esc(L('รายชื่อในย่าน', 'Names in this neighbourhood'))}</summary>`;
  if (records == null) return `<details class="scope-details records-details" data-records="loading"${open ? ' open' : ''}>${summary}<p class="hint">${esc(L('กำลังโหลดรายชื่อ', 'Loading the names'))}</p></details>`;
  if (!records.length) return '';
  const groups = byDataset(records).map(({ds, items}) => `<section class="records-group"><h4>${dsCue(ds)}<span>${esc(dsName(ds))}</span></h4>
    <ul>${items.map(r => `<li><button type="button" class="link-button" data-action="open-record" data-value="${r.i}"><span translate="no">${esc(nameOrNone(r))}</span></button>${subgroupLabel(r) ? ` <span class="hint">${esc(subgroupLabel(r))}</span>` : ''}</li>`).join('')}</ul></section>`).join('');
  return `<details class="scope-details records-details" data-records="ready"${open ? ' open' : ''}>${summary}<p class="hint">${esc(L('กดชื่อเพื่อดูบนแผนที่', 'Choose a name to see it on the map'))}</p>${groups}</details>`;
}
