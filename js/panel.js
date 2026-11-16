/**
 * Reading panel views of CityMETER · Commercial District as HTML strings. Pure: no DOM access, no map.
 *
 * Every actionable element carries data-action (+ data-id / data-value); js/app.js binds one delegated handler.
 * Actions: select-nb · select-province · leave-province · set-lens · clear-lens · cmp-add · cmp-remove · cmp-clear ·
 * cmp-top · cmp-similar · open-table · open-compare · clear-search.
 *
 * Copy (the family rule of 2026-11-01: short, natural, no caveat on screen): the words of people reading a part of a
 * city — ย่าน · จุดเด่น · มาด้วยกัน · ต่อ ตร.กม. Exactness comes from the names themselves: every share says its
 * numerator and denominator (visible, or in the title and accessible name), every rank says “จาก N” and who the N are,
 * and one provenance line per view gives dataset · source · date · boundary, then “วิธีนับ” (DATA_METHOD.md, where the
 * method and its limits live). Counts of two datasets are never added; a dataset that does not reach a province is
 * “ไม่มีข้อมูลในจังหวัดนี้”, never 0. Sources, codes and the registry's own status sit in closed <details>.
 *
 * Language: Thai is the source; an English page (citymeter-shell, ?lang=en) gets the English written here with L(th, en)
 * for the sentences built from data, and js/lang-en.js for the fixed words. Neighbourhood names stay as the registry
 * writes them.
 */
import {LANG} from './shell/i18n.js';
import {DEMOS} from './shell/datasets.js';
import {demoHref} from './shell/header.js';
import {PILLARS, PILLAR_SERIES, num, one, hectares, provinceName, dsName, dsUnit, dsUnitN} from './model.js';
import {cueMarkup} from './cues.js';
import {actionBar} from './ask.js';

const EN = LANG === 'en';
/** The sentence in the page's language. */
export const L = (th, en) => (EN ? en : th);
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
/** A number and its unit never split across lines in running text. */
const nw = html => `<span class="nowrap">${html}</span>`;
/** A decorative pictogram of the approved subset (js/navigation.js PICTOGRAM_CONTRACT); the text carries the meaning. */
const pic = (kind, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(kind)}" aria-hidden="true"></i>`;
export const METHOD_URL = 'DATA_METHOD.md';
const DEC = new Intl.NumberFormat(EN ? 'en-GB' : 'th-TH', {maximumFractionDigits: 1, minimumFractionDigits: 1});
const SIG = new Intl.NumberFormat(EN ? 'en-GB' : 'th-TH', {maximumSignificantDigits: 2});

/** A share as people read it: 69% · 4.2% · 0.016% (two significant digits under 1%), 0% only for none. */
export function sharePct(x) {
  if (!(x > 0)) return '0%';
  const v = x * 100;
  if (v >= 10) return `${num(Math.round(v))}%`;
  if (v >= 1) return `${DEC.format(v)}%`;
  return `${SIG.format(v)}%`;
}
/** Density for display: 1 decimal under 10, whole above. */
export const dens = v => (!Number.isFinite(v) ? '—' : v >= 10 ? num(Math.round(v)) : one(v));
const perKm2 = L('ต่อ ตร.กม.', 'per km²');

export function thaiDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (EN) return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
  return `${d} ${['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][m - 1]} ${y + 543}`;
}
/** The date a dataset's records were checked or published (the first it states). */
export const dsDate = ds => ds.dates?.asOf || ds.dates?.checkedOn || ds.dates?.readOn || ds.dates?.catalogCheckedOn || ds.dates?.builtOn || '';

export function metricTile(value, label, kind = '', detail = '') {
  const shown = typeof value === 'string' ? value : num(value);
  return `<div class="metric${kind ? ` metric-${kind}` : ''}"${detail ? ` title="${esc(detail)}"` : ''}>${pic(kind || 'plain', 'metric-symbol')}<strong class="data-number">${esc(shown)}</strong><span>${esc(label)}</span>${detail ? `<span class="sr-only">${esc(detail)}</span>` : ''}</div>`;
}
export const heading = (kind, text, id = '') => `<h3${id ? ` id="${esc(id)}"` : ''}>${pic(kind)}${esc(text)}</h3>`;
const section = (kind, title, hint, body, cls = '') => `<section class="panel-section${cls ? ` ${cls}` : ''}"><div class="section-heading">${heading(kind, title)}${hint ? `<span class="hint">${hint}</span>` : ''}</div>${body}</section>`;

/** A dataset's cue (its pillar's series and shape) and name. */
export const dsLabel = (ds, {short = false} = {}) => `${cueMarkup(PILLAR_SERIES[ds.group] || 9)}<span>${esc(short ? dsName(ds) : dsName(ds))}</span>`;
const nbButton = (r, {province = false} = {}) => `<button type="button" class="link-button" data-action="select-nb" data-id="${esc(r.id)}">${esc(r.name)}</button>${province ? ` <span class="hint">${esc(provinceName(r.province))}</span>` : ''}`;
const placeWord = province => (province ? L(`ใน${provinceName(province)}`, ` in ${provinceName(province)}`) : L('ทั้งประเทศ', ' nationwide'));

/** The dataset's own demo, opened at the province of the view (citymeter-shell `at`). */
export function demoLink(ds, province = '') {
  const demo = DEMOS.find(d => d.path === ds.path);
  if (!demo) return '';
  const href = demoHref(demo, province ? `?at=${province}` : '', LANG);
  return `<a class="source-link demo-link" href="${esc(href)}" title="${esc(L(`เปิดเดโม ${demo.name}${province ? ` ที่${provinceName(province)}` : ''}`, `Open the ${demo.name} demo${province ? ` at ${provinceName(province)}` : ''}`))}">${esc(demo.name)}</a>`;
}

/* ---------- provenance ---------- */

/**
 * The provenance line every view that shows numbers ends with: dataset · source · date · boundary (each part in
 * `data-prov`), then the method link. `datasets`: the datasets the view reads (one → its own date and source).
 */
export function provenance(ctx = {}, {datasets = [], boundary = ''} = {}) {
  const meta = ctx.meta || {};
  const one_ = datasets.length === 1 ? datasets[0] : null;
  const source = one_ ? `${L('ทะเบียนย่านกลาง', 'Central neighbourhood registry')} · CityMETER ${one_.name}` : `${L('ทะเบียนย่านกลาง', 'Central neighbourhood registry')} · ${L(`${num(ctx.datasetCount || 16)} ชุดข้อมูล CityMETER`, `${num(ctx.datasetCount || 16)} CityMETER datasets`)}`;
  const date = one_ ? `${thaiDate(meta.registry?.readOn)} · ${thaiDate(dsDate(one_))}` : thaiDate(meta.registry?.readOn);
  return `<p class="hint panel-foot provenance"><span class="prov-part" data-prov="dataset">${pic('dataset')}<span class="sr-only">${L('ชุดข้อมูล ', 'Dataset ')}</span>CityMETER Commercial District</span> <span class="prov-part" data-prov="source"><span class="sr-only">${L('แหล่ง', 'Source')}</span>${L('จาก ', 'from ')}${esc(source)}</span><span class="prov-part" data-prov="date">${pic('date')}<span class="sr-only">${L('อ่าน ', 'Read ')}</span>${esc(date)}</span><span class="prov-part" data-prov="boundary">${pic('area')}<span class="sr-only">${L('ขอบเขต ', 'Boundary ')}</span>${esc(boundary || L('ขอบย่านฉบับร่าง', 'Draft neighbourhood outlines'))}</span><span class="prov-part prov-method"><a href="${METHOD_URL}" target="_blank" rel="noopener">${L('วิธีนับ', 'Method')}</a></span></p>`;
}

/* ---------- overview ---------- */

function ahaOverview(o) {
  if (!o.count) {
    return `<section class="aha" aria-label="${L('ข้อค้นพบ', 'Finding')}"><p class="eyebrow">${L('ข้อค้นพบ', 'Finding')}</p><h2>${L('ไม่พบย่านตามคำค้นนี้', 'No neighbourhood matches this search')}</h2>
      <div class="aha-actions"><button type="button" class="btn" data-action="clear-search">${L('ล้างคำค้น', 'Clear the search')}</button>${o.province ? `<button type="button" class="btn quiet" data-action="leave-province">${L('ดูทั้งประเทศ', 'Whole country')}</button>` : ''}</div></section>`;
  }
  const lens = o.lens;
  if (lens) {
    const ds = lens.ds, unit = dsUnit(ds);
    const best = lens.ranking[0];
    if (!lens.inside) {
      return `<section class="aha is-auto" aria-label="${L('ข้อค้นพบ', 'Finding')}"><p class="eyebrow eyebrow-cue">${dsLabel(ds)}</p>
        <h2><span class="aha-headline">${esc(L(`ยังไม่มี${ds.nameTh}ในขอบย่าน${placeWord(o.province)}`, `No ${dsName(ds)} record lies inside the neighbourhoods${placeWord(o.province)}`))}</span></h2>
        <p class="aha-copy">${nw(`<strong class="data-number">${num(lens.located)}</strong> ${esc(unit)}`)} ${esc(L(`ที่มีพิกัด${placeWord(o.province)} อยู่นอกขอบย่านทั้งหมด`, `with a location${placeWord(o.province)} all lie outside the outlines`))}</p>
        <div class="aha-actions"><button type="button" class="btn quiet" data-action="clear-lens">${L('ดูจุดเด่นของย่าน', 'Back to highlights')}</button></div></section>`;
    }
    return `<section class="aha is-auto" aria-label="${L('ข้อค้นพบ', 'Finding')}"><p class="eyebrow eyebrow-cue">${dsLabel(ds)}</p>
      <h2><span class="aha-number data-number">${sharePct(lens.share)}</span><span class="aha-headline">${esc(L(`ของ${ds.nameTh}ที่มีพิกัด${placeWord(o.province)} อยู่ใน ${num(lens.withAny)} ย่าน`, `of the ${dsName(ds)} records with a location${placeWord(o.province)} lie in ${num(lens.withAny)} neighbourhoods`))}</span></h2>
      <p class="aha-copy">${nw(`<strong class="data-number">${num(lens.inside)}</strong> ${L('จาก', 'of')} ${num(lens.located)} ${esc(unit)}`)}${best ? `<br>${L('แน่นที่สุด', 'Densest')}: ${nbButton(best.row, {province: !o.province})} ${nw(`<strong class="data-number">${dens(best.c.density)}</strong> ${esc(unit)} ${perKm2}`)}` : ''}</p>
      <div class="aha-actions"><button type="button" class="btn quiet" data-action="cmp-top" data-value="${esc(ds.id)}">${L('เทียบ 3 ย่านที่แน่นที่สุด', 'Compare the 3 densest')}</button><button type="button" class="btn quiet" data-action="clear-lens">${L('ดูจุดเด่นของย่าน', 'Back to highlights')}</button></div></section>`;
  }
  const lead = o.lead;
  if (!lead) {
    return `<section class="aha" aria-label="${L('ข้อค้นพบ', 'Finding')}"><p class="eyebrow">${L('ข้อค้นพบ', 'Finding')}</p><h2><span class="aha-number data-number">${num(o.count)}</span><span class="aha-headline">${esc(L(`ย่าน${placeWord(o.province)}`, `neighbourhoods${placeWord(o.province)}`))}</span></h2></section>`;
  }
  const others = o.next.map(s => `<span class="aha-chip" title="${esc(L(`${num(s.inside)} จาก ${num(s.located)} ${s.ds.unitTh}ที่มีพิกัด${placeWord(o.province)}`, `${num(s.inside)} of ${num(s.located)} ${s.ds.unitEn} with a location${placeWord(o.province)}`))}">${dsLabel(s.ds)} <strong class="data-number">${sharePct(s.share)}</strong></span>`).join('');
  return `<section class="aha is-auto" aria-label="${L('ข้อค้นพบ', 'Finding')}"><p class="eyebrow">${L('ข้อค้นพบ', 'Finding')}</p>
    <h2><span class="aha-number data-number">${sharePct(lead.share)}</span><span class="aha-headline">${esc(L(`ของ${lead.ds.nameTh}ที่มีพิกัด${placeWord(o.province)} อยู่ในย่าน ${num(o.count)} แห่ง ที่กินพื้นที่ ${sharePct(o.areaShare)} ของ${o.province ? 'จังหวัด' : 'ประเทศ'}`, `of the ${dsName(lead.ds)} records with a location${placeWord(o.province)} lie in ${num(o.count)} neighbourhoods covering ${sharePct(o.areaShare)} of ${o.province ? 'the province' : 'the country'}`))}</span></h2>
    <p class="aha-copy">${nw(`<strong class="data-number">${num(lead.inside)}</strong> ${L('จาก', 'of')} ${num(lead.located)} ${esc(dsUnit(lead.ds))}`)} · ${L('ย่านรวม', 'neighbourhoods total')} ${nw(`${one(o.km2)} ${L('ตร.กม.', 'km²')}`)} ${L('จาก', 'of')} ${nw(`${num(Math.round(o.baseKm2))} ${L('ตร.กม.', 'km²')}`)}</p>
    ${others ? `<p class="aha-chips" aria-label="${L('ชุดอื่นที่กระจุกในย่าน', 'Other datasets concentrated in the neighbourhoods')}">${others}</p>` : ''}
    <div class="aha-actions"><button type="button" class="btn quiet" data-action="cmp-top">${L('เทียบ 3 ย่านที่เด่นหลายด้าน', 'Compare the 3 most distinctive')}</button><button type="button" class="btn quiet" data-action="open-table">${L('รายชื่อย่าน', 'Neighbourhood list')}</button></div></section>`;
}

/** Share of each dataset inside the neighbourhoods, by pillar: a bar per dataset on 0–100 %. */
function sharesSection(o) {
  const groups = PILLARS.map(p => {
    const items = o.shares.filter(s => s.ds.group === p).sort((a, b) => b.share - a.share || a.ds.index - b.ds.index);
    if (!items.length) return '';
    return `<div class="pillar-group"><p class="pillar-label eyebrow-cue">${cueMarkup(PILLAR_SERIES[p])}${esc(p.toUpperCase())}</p><ul class="mix-list share-list">${items.map(s => `
      <li><button type="button" class="mix-row" data-action="set-lens" data-value="${esc(s.ds.id)}" title="${esc(L(`${num(s.inside)} จาก ${num(s.located)} ${s.ds.unitTh}ที่มีพิกัด${placeWord(o.province)} · มีใน ${num(s.withAny)} ย่าน · กดเพื่อดูบนแผนที่`, `${num(s.inside)} of ${num(s.located)} ${s.ds.unitEn} with a location${placeWord(o.province)} · in ${num(s.withAny)} neighbourhoods · show on the map`))}"${o.lens?.ds.id === s.ds.id ? ' aria-pressed="true"' : ''}>
        <span class="mix-label">${dsLabel(s.ds)}</span>
        <span class="mix-track" aria-hidden="true"><span class="mix-fill category-${PILLAR_SERIES[p]}" style="width:${s.share > 0 ? Math.max(2, Math.round(s.share * 100)) : 0}%"></span></span>
        <span class="mix-value data-number">${sharePct(s.share)}</span></button></li>`).join('')}</ul></div>`;
  }).join('');
  return section('dataset', L('สิ่งที่อยู่ในย่าน', 'What lies inside the neighbourhoods'), esc(L('% ของจุดที่มีพิกัด', '% of located records')), `${groups}<p class="hint">${esc(L('กดชุดข้อมูลเพื่อระบายสีย่านตามความหนาแน่น', 'Choose a dataset to colour the neighbourhoods by its density'))}</p>`);
}

/** Datasets with no located record in the province: named once (never shown as 0). */
function outOfScopeLine(model, o) {
  if (!o.province) return '';
  const names = model.datasets.filter(d => !(d.byProvince?.[o.province] > 0)).map(dsName);
  return names.length ? `<p class="hint">${esc(L(`ไม่มีข้อมูลใน${provinceName(o.province)}: ${names.join(' · ')}`, `No data in ${provinceName(o.province)}: ${names.join(' · ')}`))}</p>` : '';
}

/** A neighbourhood's highlights as compact chips (cue + dataset name). */
export const highlightChips = (r, model, limit = 4) => (r.hl || []).slice(0, limit).map(h => model.dsById.get(h.d)).filter(Boolean)
  .map(ds => `<span class="hl-chip">${dsLabel(ds)}</span>`).join('');

function multiSection(o, model) {
  if (!o.multi.length) return '';
  const rows = o.multi.map((r, i) => `<li><button type="button" class="rank-row nb-row" data-action="select-nb" data-id="${esc(r.id)}" aria-label="${esc(`${r.name} · ${provinceName(r.province)}`)}">
    <span class="rank-index data-number" aria-hidden="true">${i + 1}</span>
    <span class="rank-name">${esc(r.name)}${o.province ? '' : `<small>${esc(provinceName(r.province))}</small>`}<span class="hl-chips">${highlightChips(r, model)}</span></span></button></li>`).join('');
  return section('rank', L('ย่านที่เด่นหลายด้าน', 'Neighbourhoods that stand out on several fronts'), esc(L('ติดกลุ่มบนสุด 10%', 'top tenth')), `<ol class="rank-list">${rows}</ol>`);
}

function pairsSection(o) {
  if (!o.pairs.length) return '';
  const rows = o.pairs.map(p => {
    const ex = p.rows.slice(0, 3).map(r => nbButton(r)).join(' · ');
    return `<li class="pair-row"><span class="pair-names">${dsLabel(p.A)}<span class="pair-plus" aria-hidden="true">+</span>${dsLabel(p.B)}</span>
      <span class="pair-strength" title="${esc(L(`สหสัมพันธ์อันดับของความหนาแน่น ρ ${p.rho} จาก ${num(p.n)} ย่านที่มีข้อมูลทั้งสองชุด · มีทั้งสองอย่าง ${num(p.both)} ย่าน`, `Rank correlation of density ρ ${p.rho} across ${num(p.n)} neighbourhoods with both datasets · ${num(p.both)} hold both`))}"><span class="mix-track" aria-hidden="true"><span class="mix-fill pair-fill" style="width:${Math.round(p.rho * 100)}%"></span></span><span class="data-number">ρ ${esc(p.rho.toFixed(2))}</span></span>
      ${ex ? `<span class="pair-examples hint">${L('เด่นทั้งคู่', 'Both stand out')}: ${ex}${p.rows.length > 3 ? ` ${L(`และอีก ${num(p.rows.length - 3)}`, `and ${num(p.rows.length - 3)} more`)}` : ''}</span>` : ''}</li>`;
  }).join('');
  return section('compare', L('อะไรมาด้วยกัน', 'What comes together'), esc(L('ทั่วประเทศ', 'nationwide')),
    `<p class="section-lead">${esc(L('ย่านที่มีอย่างหนึ่งแน่น มักมีอีกอย่างแน่นด้วย', 'Where one is dense, the other tends to be dense too'))}</p><ul class="pair-list">${rows}</ul>`);
}

function provincesSection(o) {
  if (o.province || o.provinces.length < 2) return '';
  const row = p => `<li><button type="button" class="rank-row province-pick" data-action="select-province" data-id="${esc(p.code)}" aria-label="${esc(`${provinceName(p.code)} ${num(p.n)} ${L('ย่าน', 'neighbourhoods')}`)}"><span class="rank-name">${esc(provinceName(p.code))}</span><span class="rank-value data-number">${num(p.n)}</span></button></li>`;
  const shown = o.provinces.slice(0, 8), rest = o.provinces.slice(8);
  return section('province', L('จังหวัดที่มีย่านมากที่สุด', 'Provinces with the most neighbourhoods'), esc(L(`${num(o.provinces.length)} จังหวัด`, `${num(o.provinces.length)} provinces`)),
    `<ul class="rank-list two-col">${shown.map(row).join('')}</ul>${rest.length ? `<details class="more-provinces"><summary>${L(`อีก ${num(rest.length)} จังหวัด`, `${num(rest.length)} more provinces`)}</summary><ul class="rank-list two-col">${rest.map(row).join('')}</ul></details>` : ''}`);
}

/** All neighbourhoods of a province (or of a search), the most distinctive first. */
function listSection(o, model) {
  if (!o.province && !o.searching) return '';
  const rows = [...o.rows].sort((a, b) => b.strong - a.strong || (b.hl?.length || 0) - (a.hl?.length || 0) || a.name.localeCompare(b.name, 'th'));
  const item = r => `<li><button type="button" class="nb-item" data-action="select-nb" data-id="${esc(r.id)}"><span class="nb-name">${esc(r.name)}${o.province ? '' : ` <small>${esc(provinceName(r.province))}</small>`}</span><span class="nb-meta">${nw(`${hectares(r.areaM2)} ${L('เฮกตาร์', 'ha')}`)}</span><span class="hl-chips">${highlightChips(r, model, 3) || `<span class="hint">${L('ยังไม่มีอะไรเด่นเกินเกณฑ์', 'Nothing above the threshold')}</span>`}</span></button></li>`;
  const shown = rows.slice(0, 30), rest = rows.slice(30);
  return section('maps', o.province ? L(`ย่านใน${provinceName(o.province)}`, `Neighbourhoods in ${provinceName(o.province)}`) : L('ย่านที่ตรงคำค้น', 'Matching neighbourhoods'), esc(L(`${num(rows.length)} ย่าน`, `${num(rows.length)}`)),
    `<ul class="nb-list">${shown.map(item).join('')}</ul>${rest.length ? `<details><summary>${L(`อีก ${num(rest.length)} ย่าน`, `${num(rest.length)} more`)}</summary><ul class="nb-list">${rest.map(item).join('')}</ul></details>` : ''}`);
}

/** Codes of the registry with no closed outline yet (held, or a collection name): searchable, never on the map. */
function pendingSection(o) {
  if (!o.pending.length) return '';
  const word = p => (p.status === 'collection' ? L('ชื่อรวมหลายย่าน', 'a name for several neighbourhoods') : L('ยังไม่มีขอบปิด', 'no closed outline yet'));
  return section('history', L('ชื่อในทะเบียนที่ยังไม่มีขอบ', 'Registry names with no outline yet'), esc(L(`${num(o.pending.length)} ชื่อ`, `${num(o.pending.length)}`)),
    `<ul class="plain-list">${o.pending.slice(0, 12).map(p => `<li><strong>${esc(p.name)}</strong> <span class="hint">${esc(provinceName(p.province))} · ${esc(word(p))}</span>${p.related?.length ? ` <span class="hint">${L('ดู', 'see')}</span> ${p.related.map(id => `<button type="button" class="link-button" data-action="select-nb" data-id="${esc(id)}">${esc(id)}</button>`).join(' ')}` : ''}</li>`).join('')}</ul>`);
}

/** The densest neighbourhoods of the dataset being read (bars in the map's ramp colour). */
function lensSection(o, fillOf) {
  const lens = o.lens;
  if (!lens || !lens.ranking.length) return '';
  const ds = lens.ds, unit = dsUnit(ds), max = Math.max(...lens.ranking.map(x => x.c.density));
  const rows = lens.ranking.map((x, i) => {
    const ranked = x.c.count >= lens.min;
    return `<li><button type="button" class="rank-row${ranked ? '' : ' is-unranked'}" data-action="select-nb" data-id="${esc(x.row.id)}" aria-label="${esc(`${x.row.name} · ${dens(x.c.density)} ${unit} ${perKm2} · ${num(x.c.count)} ${dsUnitN(ds, x.c.count)}`)}">
      <span class="rank-index data-number" aria-hidden="true">${ranked ? i + 1 : '·'}</span>
      <span class="rank-name">${esc(x.row.name)}<small>${esc([o.province ? '' : provinceName(x.row.province), `${num(x.c.count)} ${dsUnitN(ds, x.c.count)}`].filter(Boolean).join(' · '))}</small></span>
      <span class="rank-track" aria-hidden="true"><span class="rank-fill" style="width:${Math.max(3, Math.round((x.c.density / max) * 100))}%;background:${esc(fillOf(x.row) || 'var(--series-9-fill)')}"></span></span>
      <span class="rank-value data-number" aria-hidden="true">${dens(x.c.density)}</span></button></li>`;
  }).join('');
  return section('rank', L(`ย่านที่มี${ds.nameTh}แน่นที่สุด`, `Densest neighbourhoods for ${dsName(ds)}`), esc(`${unit} ${perKm2}`),
    `<ol class="rank-list">${rows}</ol><p class="hint">${esc(L(`จัดอันดับย่านที่มีตั้งแต่ ${num(lens.min)} ${unit} · มีใน ${num(lens.withAny)} จาก ${num(lens.covered)} ย่านที่ชุดนี้ครอบคลุม`, `Ranked when a neighbourhood holds at least ${num(lens.min)} · present in ${num(lens.withAny)} of ${num(lens.covered)} neighbourhoods the dataset covers`))}</p>`);
}

/** What each dataset counts and how far it reaches (closed: method detail, not a caveat on screen). */
function scopeDetails(model) {
  const rows = model.datasets.map(ds => `<tr><th scope="row">${dsLabel(ds)}</th><td class="num data-number">${num(ds.located)}<small>/${num(ds.records)}</small></td><td class="num data-number">${num(Object.keys(ds.byProvince || {}).length)}</td><td>${esc(thaiDate(dsDate(ds)))}</td><td>${esc(EN ? ds.scope?.en : ds.scope?.th)}</td></tr>`).join('');
  const t = model.meta.totals || {};
  return `<details class="scope-details"><summary>${L('ข้อมูลที่ใช้เทียบ และขอบเขตของแต่ละชุด', 'The datasets compared and how far each reaches')}</summary>
    <p class="hint">${esc(L(`ทะเบียนย่านกลาง ${num(t.codes)} รหัส: ขอบปิดฉบับร่าง ${num(t.closed)} ย่าน · รอขอบ ${num(t.held)} · ชื่อรวมหลายย่าน ${num(t.collections)} — นับเฉพาะ ${num(t.closed)} ย่านที่มีขอบ`, `Central registry ${num(t.codes)} codes: ${num(t.closed)} closed draft outlines · ${num(t.held)} held · ${num(t.collections)} collection names — only the ${num(t.closed)} outlined neighbourhoods are counted`))}</p>
    <div class="table-scroll"><table class="scope-table"><thead><tr><th scope="col">${L('ชุดข้อมูล', 'Dataset')}</th><th scope="col" class="num">${L('มีพิกัด/ทั้งหมด', 'Located/all')}</th><th scope="col" class="num">${L('จังหวัด', 'Provinces')}</th><th scope="col">${L('ข้อมูล ณ', 'As of')}</th><th scope="col">${L('นับอะไร', 'What is counted')}</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}

/**
 * The overview of Thailand or of one province. o = js/profile.js#buildOverview (+ searching); fillOf(row) = the map's
 * ramp colour of a row under the lens.
 */
export function renderOverview(o, model, {fillOf = () => '', ctx = {}} = {}) {
  const metrics = o.count ? `<section class="metrics compact" aria-label="${L('ตัวเลขรวม', 'Totals')}">
    ${metricTile(o.count, L('ย่าน', 'neighbourhoods'), 'maps', L('ย่านที่มีขอบปิดในทะเบียนย่านกลาง', 'Neighbourhoods with a closed outline in the central registry'))}
    ${metricTile(one(o.km2), L('ตร.กม.', 'km²'), 'area', L(`พื้นที่รวมตามทะเบียน = ${sharePct(o.areaShare)} ของ${o.province ? 'จังหวัด' : 'ประเทศ'}`, `Registry area = ${sharePct(o.areaShare)} of ${o.province ? 'the province' : 'the country'}`))}
    ${metricTile(model.datasets.length, L('ชุดข้อมูล', 'datasets'), 'dataset', 'Land · Location · Living')}
    ${o.province ? metricTile(sharePct(o.areaShare), L('ของพื้นที่จังหวัด', 'of the province'), 'province') : metricTile(o.provinces.length, L('จังหวัด', 'provinces'), 'province')}
  </section>` : '';
  const lensFirst = o.lens ? lensSection(o, fillOf) : '';
  const place = o.province ? provinceName(o.province) : L('ประเทศไทย', 'Thailand');
  return `${ahaOverview(o)}${metrics}${lensFirst}${o.count ? `${o.lens ? '' : multiSection(o, model)}${sharesSection(o)}${outOfScopeLine(model, o)}${pairsSection(o)}${listSection(o, model)}${provincesSection(o)}` : ''}${pendingSection(o)}
    ${actionBar({kind: 'overview', province: o.province ? provinceName(o.province) : ''})}
    ${scopeDetails(model)}
    ${provenance(ctx, {datasets: o.lens ? [o.lens.ds] : [], boundary: L(`${place} · ขอบย่านฉบับร่าง`, `${place} · draft neighbourhood outlines`)})}`;
}

/* ---------- neighbourhood ---------- */

/** A dataset's value in one neighbourhood as a short phrase (state first). */
export function cellText(c, ds) {
  if (c.state === 'out_of_scope') return L('ไม่มีข้อมูลในจังหวัดนี้', 'no data in this province');
  if (c.state === 'measured_zero') return `0 ${dsUnit(ds)}`;
  return `${num(c.count)} ${dsUnitN(ds, c.count)}`;
}

/**
 * A highlight as words: {head, value, detail} — the comparison that makes it one, with its universe (Benchmark
 * interpretation: the peers are named with their number). Kinds (scripts/build-data.py): share of the dataset's located
 * records nationwide · count rank among the neighbourhoods of the provinces the dataset covers · density rank among
 * those holding at least `minCount` · rare: one of the few neighbourhoods holding any.
 */
export function highlightWords(h, ds, row, minCount = 3) {
  const n = row.c?.[ds.id] || 0, unit = dsUnit(ds), name = dsName(ds);
  const count = `${num(n)} ${dsUnitN(ds, n)}`;
  if (h.k === 'share') return {head: `${name} ${count}`, value: sharePct(h.v), detail: L(`ของ${ds.nameTh}ที่มีพิกัดทั้งประเทศ (${num(n)} จาก ${num(ds.located)})`, `of the ${name} records with a location nationwide (${num(n)} of ${num(ds.located)})`)};
  if (h.k === 'count') return {head: `${name} ${count}`, value: h.v === 1 ? L('มากที่สุด', 'Most') : L(`มากอันดับ ${num(h.v)}`, `Rank ${num(h.v)}`), detail: L(`จาก ${num(h.of)} ย่านในจังหวัดที่ชุดนี้มีข้อมูล`, `of ${num(h.of)} neighbourhoods in provinces this dataset covers`)};
  if (h.k === 'density') return {head: `${name} ${dens(row.density?.[ds.id])} ${unit} ${perKm2}`, value: h.v === 1 ? L('แน่นที่สุด', 'Densest') : L(`แน่นอันดับ ${num(h.v)}`, `Density rank ${num(h.v)}`), detail: L(`จาก ${num(h.of)} ย่านที่มีตั้งแต่ ${num(minCount)} ${unit}`, `of ${num(h.of)} neighbourhoods holding at least ${num(minCount)}`)};
  if (h.k === 'rare') return {head: `${name} ${count}`, value: L(`1 ใน ${num(h.v)} ย่าน`, `1 of ${num(h.v)}`), detail: L(`ที่มี${ds.nameTh} จาก ${num(h.of)} ย่านในจังหวัดที่ชุดนี้มีข้อมูล`, `neighbourhoods holding any, of ${num(h.of)} in provinces this dataset covers`)};
  return {head: name, value: '', detail: ''};
}
const highlightWordsL = (x, row) => highlightWords(x.h, x.ds, row);

function highlightsSection(d) {
  if (!d.highlights.length) return '';
  const rows = d.highlights.map(x => {
    const w = highlightWordsL(x, d.row);
    return `<li class="hl-row"><span class="hl-head">${cueMarkup(PILLAR_SERIES[x.ds.group] || 9)}<span>${esc(w.head)}</span></span>
      <span class="hl-value data-number">${esc(w.value)}</span><span class="hl-detail hint">${esc(w.detail)}</span>
      <span class="hl-links"><button type="button" class="link-button" data-action="set-lens" data-value="${esc(x.ds.id)}">${L('เทียบทุกย่าน', 'Compare all')}</button>${demoLink(x.ds, d.row.province)}</span></li>`;
  }).join('');
  return section('rank', L('จุดเด่น', 'Highlights'), esc(L('เทียบกับย่านอื่น', 'against other neighbourhoods')), `<ul class="hl-list">${rows}</ul>`);
}

function togetherSection(d) {
  const parts = [];
  if (d.pairs.length) {
    parts.push(`<ul class="pair-list">${d.pairs.map(p => `<li class="pair-row"><span class="pair-names">${dsLabel(p.A)}<span class="pair-plus" aria-hidden="true">+</span>${dsLabel(p.B)}</span>
      <span class="pair-examples hint" title="${esc(L(`ρ ${p.rho} จาก ${num(p.n)} ย่านที่มีข้อมูลทั้งสองชุด`, `ρ ${p.rho} across ${num(p.n)} neighbourhoods with both datasets`))}">${esc(L(`เด่นทั้งคู่ที่นี่ และทั่วประเทศมักมาด้วยกัน (ρ ${p.rho.toFixed(2)} · ${num(p.n)} ย่าน)`, `Both stand out here, and they tend to come together nationwide (ρ ${p.rho.toFixed(2)} · ${num(p.n)} neighbourhoods)`))}</span></li>`).join('')}</ul>`);
  }
  const roleRow = r => {
    const ev = r.evidenceDs.map(ds => esc(dsName(ds))).join(' · ');
    const seen = r.observed.filter(x => x.c.state !== 'out_of_scope').map(x => `${esc(dsName(x.ds))} ${esc(cellText(x.c, x.ds))}`).join(' · ');
    const status = r.evidence.length
      ? `<span class="role-tag is-evidenced">${L('ข้อมูลชี้ตรง', 'Data agrees')}</span>`
      : `<span class="role-tag">${L('ข้อมูลยังไม่ชี้', 'Not in the data yet')}</span>`;
    return `<li class="role-row">${status}<strong>${esc(EN ? r.en : r.th)}</strong><span class="hint">${r.evidence.length ? `${L('เด่นจาก', 'from')} ${ev}` : seen || L('ไม่มีชุดข้อมูลของบทบาทนี้ในจังหวัด', 'no dataset of this role in the province')}</span></li>`;
  };
  if (d.proposed.length) parts.push(`<p class="section-lead">${esc(L('บทบาทที่ทะเบียนย่านเสนอ เทียบกับสิ่งที่ข้อมูลเห็น', 'Roles the registry proposes, against what the data shows'))}</p><ul class="role-list">${d.proposed.map(roleRow).join('')}</ul>`);
  if (d.extra.length) parts.push(`<p class="section-lead">${esc(L('ข้อมูลชี้บทบาทเพิ่ม', 'The data points to more'))}</p><ul class="role-list">${d.extra.map(roleRow).join('')}</ul>`);
  if (!parts.length) return '';
  return section('compare', L('จุดเด่นที่สัมพันธ์กัน', 'How the highlights relate'), '', parts.join(''));
}

function datasetsSection(d, fillOf) {
  const groups = d.groups.map(g => `<div class="pillar-group"><p class="pillar-label eyebrow-cue">${cueMarkup(PILLAR_SERIES[g.pillar])}${esc(g.pillar.toUpperCase())}</p>
    <ul class="ds-list">${g.items.map(({ds, c}) => {
      const rank = c.state === 'measured' && c.densityRank ? L(`แน่นอันดับ ${num(c.densityRank)}/${num(c.ranked)}`, `density ${num(c.densityRank)}/${num(c.ranked)}`) : c.state === 'measured' && c.countRank ? L(`มากอันดับ ${num(c.countRank)}/${num(c.covered)}`, `count ${num(c.countRank)}/${num(c.covered)}`) : '';
      const swatch = fillOf(ds) ? `<i class="ds-swatch" style="background:${esc(fillOf(ds))}" aria-hidden="true"></i>` : '';
      return `<li><button type="button" class="ds-row is-${c.state}" data-action="set-lens" data-value="${esc(ds.id)}" title="${esc(L(`ระบายสีย่านตาม${ds.nameTh}`, `Colour the neighbourhoods by ${dsName(ds)}`))}">
        <span class="ds-name">${dsLabel(ds)}</span>
        <span class="ds-count data-number">${c.state === 'out_of_scope' ? '—' : num(c.count)}<small>${esc(c.state === 'out_of_scope' ? L('ไม่มีข้อมูล', 'no data') : dsUnit(ds))}</small></span>
        <span class="ds-density data-number">${swatch}${c.state === 'measured' ? `${dens(c.density)}<small>${perKm2}</small>` : ''}</span>
        <span class="ds-rank hint">${esc(rank)}</span></button></li>`;
    }).join('')}</ul></div>`).join('');
  return section('dataset', L('ทุกชุดข้อมูลในย่านนี้', 'Every dataset in this neighbourhood'), esc(L('กดเพื่อเทียบทุกย่าน', 'choose to compare all')), groups);
}

function similarSection(d) {
  if (!d.similar.length) return '';
  const rows = d.similar.map(x => `<li><span class="sim-name">${nbButton(x.row, {province: true})}</span><span class="sim-value data-number" title="${esc(L(`ความคล้ายของส่วนผสม (cosine) จาก ${num(x.shared)} ชุดข้อมูลที่มีในทั้งสองย่าน`, `Mix similarity (cosine) over ${num(x.shared)} datasets both neighbourhoods have`))}">${num(Math.round(x.sim * 100))}%</span></li>`).join('');
  return section('compare', L('ย่านที่ส่วนผสมคล้ายกัน', 'Neighbourhoods with a similar mix'), esc(L('ทั่วประเทศ', 'nationwide')),
    `<ul class="sim-list">${rows}</ul><div class="aha-actions"><button type="button" class="btn quiet" data-action="cmp-similar" data-id="${esc(d.row.id)}">${L('เทียบกับย่านเหล่านี้', 'Compare with these')}</button></div>`);
}

function registryDetails(d, model) {
  const r = d.row;
  const status = {
    draft_pending_local_name_validation: L('ชื่อร่าง รอตรวจชื่อที่คนในพื้นที่ใช้', 'draft name, awaiting local validation'),
  }[r.nameStatus] || r.nameStatus || '';
  const measures = model.datasets.filter(ds => ds.measure && r.m?.[ds.id]).map(ds => {
    const [sum, known] = r.m[ds.id];
    return `<li>${dsLabel(ds)} ${esc(L(`${ds.measure.th} ${num(sum)} จาก ${num(known)} รายการที่มีตัวเลข`, `${ds.measure.en} ${num(sum)} from ${num(known)} records with a figure`))} <span class="hint">${esc(EN ? ds.measure.noteEn : ds.measure.noteTh)}</span></li>`;
  }).join('');
  return `<details class="scope-details"><summary>${L('ข้อมูลทะเบียนย่านและตัวเลขเพิ่มเติม', 'Registry record and more figures')}</summary>
    <dl class="registry-list">
      <dt>${L('รหัสกลาง', 'Code')}</dt><dd class="data-number">${esc(r.id)}</dd>
      <dt>${L('สถานะชื่อ', 'Name')}</dt><dd>${esc(status)}</dd>
      <dt>${L('ขอบ', 'Outline')}</dt><dd>${esc(r.fieldVerified ? L('ตรวจภาคสนามแล้ว', 'field-checked') : L('ฉบับร่าง ยังไม่ตรวจภาคสนาม', 'draft, not yet walked'))}</dd>
      ${r.aliases?.length ? `<dt>${L('ชื่ออื่น', 'Also called')}</dt><dd>${esc(r.aliases.join(' · '))}</dd>` : ''}
      ${r.roles?.length ? `<dt>${L('บทบาทที่ทะเบียนเสนอ', 'Proposed roles')}</dt><dd>${esc(r.roles.map(id => { const x = model.roles.find(y => y.id === id); return x ? (EN ? x.en : x.th) : id; }).join(' · '))}</dd>` : ''}
    </dl>${measures ? `<ul class="plain-list">${measures}</ul>` : ''}</details>`;
}

/** d = js/profile.js#buildNeighborhood. inCompare: the row is in the compare set. */
export function renderNeighborhood(d, model, {inCompare = false, compareFull = false, fillOf = () => '', ctx = {}} = {}) {
  const r = d.row, province = provinceName(r.province);
  const top = d.highlights[0];
  const tw = top ? highlightWordsL(top, r) : null;
  const names = d.highlights.map(x => `<span class="hl-chip">${dsLabel(x.ds)}</span>`).join('');
  const cmp = inCompare
    ? `<button type="button" class="btn" data-action="cmp-remove" data-id="${esc(r.id)}" aria-pressed="true">${L('อยู่ในการเปรียบเทียบ', 'In the comparison')}</button>`
    : `<button type="button" class="btn primary" data-action="cmp-add" data-id="${esc(r.id)}"${compareFull ? ' disabled' : ''}>${L('เพิ่มในการเปรียบเทียบ', 'Add to the comparison')}</button>`;
  const aha = `<section class="aha is-auto detail-head" aria-label="${L('ข้อค้นพบ', 'Finding')}"><p class="eyebrow">${esc(L(`ย่าน · ${province}`, `Neighbourhood · ${province}`))}</p>
    <h2 class="nb-title">${esc(r.name)}</h2>
    ${top ? `<p class="aha-lead">${L('เด่นเรื่อง', 'Stands out for')}</p><p class="hl-chips is-large">${names}</p>
      <p class="aha-copy"><strong>${esc(tw.head)}</strong> — ${nw(`<strong class="data-number">${esc(tw.value)}</strong>`)} ${esc(tw.detail)}</p>`
    : `<p class="aha-copy">${esc(L('ยังไม่มีชุดข้อมูลไหนเด่นเกินเกณฑ์ ดูตัวเลขทุกชุดข้างล่าง', 'No dataset stands out above the threshold; every figure is below'))}</p>`}
    <div class="aha-actions">${cmp}</div></section>`;
  const metrics = `<section class="metrics compact" aria-label="${L('ตัวเลขของย่าน', 'Neighbourhood figures')}">
    ${metricTile(hectares(r.areaM2), L('เฮกตาร์', 'ha'), 'area', L(`${one(r.km2)} ตร.กม. ตามทะเบียน`, `${one(r.km2)} km² per the registry`))}
    ${metricTile(d.highlights.length, L('จุดเด่น', 'highlights'), 'rank')}
    ${metricTile(Object.values(r.c || {}).filter(n => n > 0).length, L('ชุดที่มีในย่าน', 'datasets present'), 'dataset', L(`จาก ${num(Object.keys(r.c || {}).length)} ชุดที่มีข้อมูลในจังหวัด`, `of ${num(Object.keys(r.c || {}).length)} with data in the province`))}
    ${metricTile(d.inProvince, L(`ย่านใน${province}`, `in ${province}`), 'province')}
  </section>`;
  return `${aha}${metrics}${highlightsSection(d)}${togetherSection(d)}${datasetsSection(d, fillOf)}${similarSection(d)}
    ${actionBar({kind: 'neighborhood', name: r.name, province, point: {lat: r.ref[1], lon: r.ref[0]}})}
    ${registryDetails(d, model)}
    ${provenance(ctx, {boundary: L(`${r.name} · ขอบย่านฉบับร่าง ${hectares(r.areaM2)} เฮกตาร์`, `${r.name} · draft outline ${hectares(r.areaM2)} ha`)})}`;
}

/* ---------- compare ---------- */

/**
 * The compare matrix for the tray: datasets by pillar × neighbourhoods; a bar per cell (density against the densest of
 * the row), the densest cell marked in words for screen readers and with a ring.
 */
export function renderCompare(c, model, {max = 4} = {}) {
  if (!c.rows.length) {
    return `<div class="compare-empty"><p>${esc(L('เลือกย่านแล้วกด “เพิ่มในการเปรียบเทียบ” เพื่อวางเทียบกันได้ถึง 4 ย่าน', 'Open a neighbourhood and choose “Add to the comparison” to set up to 4 side by side'))}</p>
      <div class="aha-actions"><button type="button" class="btn quiet" data-action="cmp-top">${L('เทียบ 3 ย่านที่เด่นหลายด้าน', 'Compare the 3 most distinctive')}</button></div></div>`;
  }
  const head = c.rows.map(r => `<th scope="col" class="cmp-col"><button type="button" class="link-button" data-action="select-nb" data-id="${esc(r.id)}">${esc(r.name)}</button><small>${esc(provinceName(r.province))} · ${nw(`${hectares(r.areaM2)} ${L('เฮกตาร์', 'ha')}`)}</small><button type="button" class="cmp-remove" data-action="cmp-remove" data-id="${esc(r.id)}" aria-label="${esc(`${L('เอาออกจากการเปรียบเทียบ', 'Remove from the comparison')} · ${r.name}`)}">×</button></th>`).join('');
  const hlRow = `<tr class="cmp-hl"><th scope="row">${L('จุดเด่น', 'Highlights')}</th>${c.rows.map(r => `<td>${highlightChips(r, model) || '<span class="hint">—</span>'}</td>`).join('')}</tr>`;
  const body = c.groups.map(g => `<tr class="cmp-group"><th scope="rowgroup" colspan="${c.rows.length + 1}"><span class="eyebrow-cue">${cueMarkup(PILLAR_SERIES[g.pillar])}${esc(g.pillar.toUpperCase())}</span></th></tr>${g.items.map(x => `<tr><th scope="row">${dsLabel(x.ds)}<small>${esc(dsUnit(x.ds))} · ${perKm2}</small></th>${x.cells.map((cell, i) => {
    if (cell.state === 'out_of_scope') return `<td class="is-out" title="${esc(L('ไม่มีข้อมูลชุดนี้ในจังหวัด', 'No data of this dataset in the province'))}"><span class="hint">—</span></td>`;
    const best = i === x.best;
    const w = x.max > 0 && cell.state === 'measured' ? Math.max(4, Math.round((cell.density / x.max) * 100)) : 0;
    return `<td class="${best ? 'is-best' : ''}${cell.state === 'measured_zero' ? ' is-zero' : ''}"><span class="cmp-count data-number">${num(cell.count)}</span><span class="cmp-density data-number">${cell.state === 'measured' ? dens(cell.density) : '0'}</span><span class="cmp-bar" aria-hidden="true"><span class="category-${PILLAR_SERIES[x.ds.group]}" style="width:${w}%"></span></span>${best && c.rows.length > 1 ? `<span class="sr-only">${L('แน่นที่สุดในกลุ่มที่เทียบ', 'densest of the compared')}</span>` : ''}</td>`;
  }).join('')}</tr>`).join('')}`).join('');
  return `<div class="table-scroll compare-scroll"><table class="compare-table"><caption class="sr-only">${L('เปรียบเทียบย่าน: จำนวนและความหนาแน่นต่อ ตร.กม. ของแต่ละชุดข้อมูล', 'Neighbourhood comparison: count and density per km² of each dataset')}</caption>
    <thead><tr><th scope="col" class="cmp-corner">${L('ชุดข้อมูล', 'Dataset')}<small>${L('จำนวน · ต่อ ตร.กม.', 'count · per km²')}</small></th>${head}</tr></thead>
    <tbody>${hlRow}${body}</tbody></table></div>
    ${c.rows.length < max ? `<p class="hint">${esc(L(`เพิ่มได้อีก ${num(max - c.rows.length)} ย่าน · วงกรอบ = แน่นที่สุดในกลุ่มที่เทียบ`, `${num(max - c.rows.length)} more can be added · ringed = densest of the compared`))}</p>` : `<p class="hint">${esc(L('วงกรอบ = แน่นที่สุดในกลุ่มที่เทียบ', 'Ringed = densest of the compared'))}</p>`}
    ${actionBar({kind: 'compare', names: c.rows.map(r => r.name)})}`;
}

/* ---------- table ---------- */

/** One table row per neighbourhood: name, province, area, highlights, then each dataset's count (— out of scope). */
export function tableRowHTML(r, model) {
  const cells = model.datasets.map(ds => {
    if (!(ds.id in (r.c || {}))) return `<td class="num is-out" title="${esc(L('ไม่มีข้อมูลในจังหวัดนี้', 'No data in this province'))}">—</td>`;
    const n = r.c[ds.id];
    return `<td class="num data-number${n ? '' : ' is-zero'}">${num(n)}</td>`;
  }).join('');
  return `<tr><th scope="row"><button type="button" class="row-name" data-action="select-nb" data-id="${esc(r.id)}">${esc(r.name)}</button></th><td>${esc(provinceName(r.province))}</td><td class="num data-number">${esc(hectares(r.areaM2))}</td><td class="num data-number">${num(r.hl?.length || 0)}</td>${cells}</tr>`;
}
export function tableHeadHTML(model, lensId = '') {
  return `<tr><th scope="col">${L('ย่าน', 'Neighbourhood')}</th><th scope="col">${L('จังหวัด', 'Province')}</th><th scope="col" class="num">${L('เฮกตาร์', 'ha')}</th><th scope="col" class="num">${L('จุดเด่น', 'Highlights')}</th>${model.datasets.map(ds => `<th scope="col" class="num${ds.id === lensId ? ' is-lens' : ''}" title="${esc(`${ds.group} · ${dsUnit(ds)}`)}"><span class="th-ds">${cueMarkup(PILLAR_SERIES[ds.group] || 9)}${esc(dsName(ds))}</span></th>`).join('')}</tr>`;
}

export function renderFilterChips(chips) {
  if (!chips.length) return '';
  return `<ul class="filter-chips" aria-label="${L('ตัวกรองที่ใช้', 'Active filters')}">${chips.map(c => `<li><button type="button" class="filter-chip" data-action="${esc(c.action)}"${c.id ? ` data-id="${esc(c.id)}"` : ''} aria-label="${esc(L(`ล้าง ${c.label}`, `Clear ${c.label}`))}">${esc(c.label)}<i aria-hidden="true">×</i></button></li>`).join('')}</ul>`;
}
