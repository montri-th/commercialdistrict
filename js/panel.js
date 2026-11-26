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
import {DEMOS, demoUrl} from './shell/datasets.js';
import {demoHref} from './shell/header.js';
import {PILLARS, PILLAR_SERIES, num, one, rai, km2Text, provinceName, dsName, dsUnit, dsUnitN} from './model.js';
import {cueMarkup} from './cues.js';
import {actionBar} from './ask.js';
import {logoPlate} from './logos.js';
import {glanceTiles, aroundGroups, venuesOf, sharedBy, LEVEL_WORDS, pctFill, RING_INDEX} from './around.js';
import {lowLocated} from './model.js';
import {cellsOf} from './levels.js';
import {dsPic, fingerprint, matrix, matrixAnswer, matrixHead, matrixLegend, levelScopeLine, axisCards, axisKey, axisFoldIntro, compareDots, shapeMark, areaWords, provinceWords} from './visual.js';

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
/** Two dates of one month as one span (25–26 พ.ย. 2569); otherwise both in full, joined by “ and ” / “ และ ”. */
export function thaiDates(list) {
  const ds = (list || []).filter(Boolean);
  if (ds.length < 2) return thaiDate(ds[0]);
  const [a, b] = [ds[0], ds[ds.length - 1]];
  if (a.slice(0, 7) === b.slice(0, 7)) return `${Number(a.slice(8, 10))}–${thaiDate(b)}`;
  return `${thaiDate(a)}${L(' และ ', ' and ')}${thaiDate(b)}`;
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
  // (0.6.0, §4.7) the share against the neighbourhoods' share of the area as two bars, so the concentration reads at a
  // glance; the next datasets as bars in their pillar's colour; the numerator and denominator stay in words (INV-03)
  const bar = (share, fill) => `<span class="ov-bar" aria-hidden="true"><i style="width:${share > 0 ? `max(2px, ${(share * 100).toFixed(3)}%)` : '0'}${fill ? `;background:${fill}` : ''}"></i></span>`;
  const seriesFill = ds => `var(--series-${PILLAR_SERIES[ds.group] || 9}-fill)`;
  const shareRow = (s, big = false) => `<li class="ov-row${big ? ' big' : ''}" title="${esc(L(`${num(s.inside)} จาก ${num(s.located)} ${s.ds.unitTh}ที่มีพิกัด${placeWord(o.province)}`, `${num(s.inside)} of ${num(s.located)} ${s.ds.unitEn} with a location${placeWord(o.province)}`))}">${dsPic(s.ds)}<span class="ov-name">${esc(dsName(s.ds))}</span>${bar(s.share, seriesFill(s.ds))}<b class="data-number">${sharePct(s.share)}</b><span class="sr-only">${esc(L(`${num(s.inside)} จาก ${num(s.located)}`, `${num(s.inside)} of ${num(s.located)}`))}</span></li>`;
  const areaRow = `<li class="ov-row big is-area">${pic('area')}<span class="ov-name">${esc(L('พื้นที่ของย่าน', 'Neighbourhood area'))}</span>${bar(o.areaShare)}<b class="data-number">${sharePct(o.areaShare)}</b><span class="sr-only">${esc(L(`ของพื้นที่${o.province ? 'จังหวัด' : 'ประเทศ'}`, `of ${o.province ? 'the province' : 'the country'}`))}</span></li>`;
  const others = o.next.map(s => shareRow(s)).join('');
  return `<section class="aha is-auto" aria-label="${L('ข้อค้นพบ', 'Finding')}"><p class="eyebrow">${L('ข้อค้นพบ', 'Finding')}</p>
    <h2><span class="aha-number data-number">${sharePct(lead.share)}</span><span class="aha-headline">${esc(L(`ของ${lead.ds.nameTh}ที่มีพิกัด${placeWord(o.province)} อยู่ในย่าน ${num(o.count)} แห่ง ที่กินพื้นที่ ${sharePct(o.areaShare)} ของ${o.province ? 'จังหวัด' : 'ประเทศ'}`, `of the ${dsName(lead.ds)} records with a location${placeWord(o.province)} lie in ${num(o.count)} neighbourhoods covering ${sharePct(o.areaShare)} of ${o.province ? 'the province' : 'the country'}`))}</span></h2>
    <ul class="ov-vs" aria-label="${esc(L(`${dsName(lead.ds)} เทียบพื้นที่ของย่าน`, `${dsName(lead.ds)} against the neighbourhoods' area`))}">${shareRow(lead, true)}${areaRow}</ul>
    <p class="aha-copy">${nw(`<strong class="data-number">${num(lead.inside)}</strong> ${L('จาก', 'of')} ${num(lead.located)} ${esc(dsUnit(lead.ds))}`)} · ${L('ย่านรวม', 'neighbourhoods total')} ${nw(`${one(o.km2)} ${L('ตร.กม.', 'km²')}`)} ${L('จาก', 'of')} ${nw(`${num(Math.round(o.baseKm2))} ${L('ตร.กม.', 'km²')}`)}</p>
    ${others ? `<p class="pillar-label">${L('ชุดอื่นที่กระจุกในย่าน', 'Other datasets concentrated in the neighbourhoods')}</p><ul class="ov-vs">${others}</ul>` : ''}
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
  .map(ds => `<span class="hl-chip">${dsPic(ds)}${dsLabel(ds)}</span>`).join('');
/** The datasets a row stands out for (D-V2: datasets with points for at least 90 % of their records). */
const hlSet = r => new Set((r.hl || []).map(h => h.d));
const kindSmall = r => [r.kind === 'lodging' ? L('ย่านที่พัก', 'lodging area') : r.kind === 'screen' ? L('ผลคัดย่านการค้า', 'commercial screen') : '', r.added ? L('ใหม่', 'new') : ''].filter(Boolean).map(esc).join(' · ');

function multiSection(o, model, around) {
  if (!o.multi.length) return '';
  const rows = o.multi.map((r, i) => ({row: r, hl: hlSet(r), head: matrixHead(r, {rank: i + 1, small: o.province ? '' : provinceWords(r)})}));
  const sub = x => {
    const top = (x.row.hl || []).filter(h => h.p >= 0.9).map(h => model.dsById.get(h.d)).filter(Boolean);
    return top.length ? `<span class="mx-chips"><span class="hint">${esc(L('กลุ่มบนสุด 10%:', 'Top tenth:'))}</span> ${top.map(ds => nw(`${dsPic(ds)}${esc(dsName(ds))}`)).join(' · ')}</span>` : '';
  };
  const caption = L(`ย่านที่เด่นหลายด้าน${placeWord(o.province)} กับ 16 ชุดข้อมูล`, `Neighbourhoods that stand out on several fronts${placeWord(o.province)}, by the 16 datasets`);
  return section('rank', L('ย่านที่เด่นหลายด้าน', 'Neighbourhoods that stand out on several fronts'), esc(L('ติดกลุ่มบนสุด 10%', 'top tenth')),
    `${matrix(model, around, rows, {caption, sub})}${matrixLegend(model)}<p class="hint">${esc(levelScopeLine())}</p>`, 'mx-section');
}

function pairsSection(o) {
  if (!o.pairs.length) return '';
  const star = ds => (lowLocated(ds) ? `<sup aria-hidden="true">*</sup><span class="sr-only">${esc(L('ชุดที่มีพิกัดไม่ถึง 90% ของรายการ', 'a dataset with points for under 90% of its records'))}</span>` : '');
  const starred = o.pairs.some(p => lowLocated(p.A) || lowLocated(p.B));
  const rows = o.pairs.map(p => {
    const ex = p.rows.slice(0, 3).map(r => nbButton(r)).join(' · ');
    return `<li class="pair-row"><span class="pair-names">${dsLabel(p.A)}${star(p.A)}<span class="pair-plus" aria-hidden="true">+</span>${dsLabel(p.B)}${star(p.B)}</span>
      <span class="pair-strength" title="${esc(L(`สหสัมพันธ์อันดับของความหนาแน่น ρ ${p.rho} จาก ${num(p.n)} ย่านที่มีข้อมูลทั้งสองชุด · มีทั้งสองอย่าง ${num(p.both)} ย่าน`, `Rank correlation of density ρ ${p.rho} across ${num(p.n)} neighbourhoods with both datasets · ${num(p.both)} hold both`))}"><span class="mix-track" aria-hidden="true"><span class="mix-fill pair-fill" style="width:${Math.round(p.rho * 100)}%"></span></span><span class="data-number">ρ ${esc(p.rho.toFixed(2))}</span></span>
      ${ex ? `<span class="pair-examples hint">${L('เด่นทั้งคู่', 'Both stand out')}: ${ex}${p.rows.length > 3 ? ` ${L(`และอีก ${num(p.rows.length - 3)}`, `and ${num(p.rows.length - 3)} more`)}` : ''}</span>` : ''}</li>`;
  }).join('');
  return section('compare', L('อะไรมาด้วยกัน', 'What comes together'), esc(L('ทั่วประเทศ', 'nationwide')),
    `<p class="section-lead">${esc(L('ย่านที่มีอย่างหนึ่งแน่น มักมีอีกอย่างแน่นด้วย', 'Where one is dense, the other tends to be dense too'))}</p><ul class="pair-list">${rows}</ul>${starred ? `<p class="hint">${esc(L('* = ชุดที่มีพิกัดไม่ถึง 90% ของรายการ: คู่ยังแสดง แต่ไม่เป็นจุดเด่นของย่าน', '* = a dataset with points for under 90% of its records: the pair stays, but it is never a neighbourhood’s highlight'))}</p>` : ''}`);
}

function provincesSection(o) {
  if (o.province || o.provinces.length < 2) return '';
  const row = p => `<li><button type="button" class="rank-row province-pick" data-action="select-province" data-id="${esc(p.code)}" aria-label="${esc(`${provinceName(p.code)} ${num(p.n)} ${L('ย่าน', 'neighbourhoods')}`)}"><span class="rank-name">${esc(provinceName(p.code))}</span><span class="rank-value data-number">${num(p.n)}</span></button></li>`;
  const shown = o.provinces.slice(0, 8), rest = o.provinces.slice(8);
  return section('province', L('จังหวัดที่มีย่านมากที่สุด', 'Provinces with the most neighbourhoods'), esc(L(`${num(o.provinces.length)} จังหวัด`, `${num(o.provinces.length)} provinces`)),
    `<ul class="rank-list two-col">${shown.map(row).join('')}</ul>${rest.length ? `<details class="more-provinces"><summary>${L(`อีก ${num(rest.length)} จังหวัด`, `${num(rest.length)} more provinces`)}</summary><ul class="rank-list two-col">${rest.map(row).join('')}</ul></details>` : ''}`);
}

/** The kind and novelty of a row in a list or the table, as small words. */
const kindWords = r => [r.kind === 'lodging' ? L('ย่านที่พัก', 'lodging area') : r.kind === 'screen' ? L('ผลคัดย่านการค้า', 'commercial screen') : '', r.added ? L('ใหม่', 'new') : ''].filter(Boolean).map(w => ` <small class="kind-word">${esc(w)}</small>`).join('');

/** All neighbourhoods of a province (or of a search), the most distinctive first. */
function listSection(o, model, around) {
  if (!o.province && !o.searching) return '';
  const rows = [...o.rows].sort((a, b) => b.strong - a.strong || (b.hl?.length || 0) - (a.hl?.length || 0) || a.name.localeCompare(b.name, 'th'));
  const item = r => `<li><button type="button" class="nb-item" data-action="select-nb" data-id="${esc(r.id)}"><span class="nb-name">${esc(r.name)}${o.province ? '' : ` <small>${esc(provinceName(r.province))}</small>`}${kindWords(r)}</span><span class="nb-meta">${nw(`${rai(r.areaM2)} ${L('ไร่', 'rai')}`)}</span><span class="hl-chips">${highlightChips(r, model, 3) || `<span class="hint">${L('ยังไม่มีอะไรเด่นเกินเกณฑ์', 'Nothing above the threshold')}</span>`}</span></button></li>`;
  const shown = rows.slice(0, 30), rest = rows.slice(30);
  const small = r => [o.province ? '' : provinceWords(r), areaWords(r), kindSmall(r)].filter(Boolean).join(' · ');
  const caption = o.province ? L(`ย่านใน${provinceName(o.province)} กับ 16 ชุดข้อมูล`, `Neighbourhoods in ${provinceName(o.province)}, by the 16 datasets`) : L('ย่านที่ตรงคำค้น กับ 16 ชุดข้อมูล', 'Matching neighbourhoods, by the 16 datasets');
  const table = matrix(model, around, shown.map(r => ({row: r, hl: hlSet(r), head: matrixHead(r, {small: small(r)})})), {caption});
  return section('maps', o.province ? L(`ย่านใน${provinceName(o.province)}`, `Neighbourhoods in ${provinceName(o.province)}`) : L('ย่านที่ตรงคำค้น', 'Matching neighbourhoods'), esc(L(`${num(rows.length)} ย่าน`, `${num(rows.length)}`)),
    `${table}${matrixLegend(model)}<p class="hint">${esc(levelScopeLine())}</p>${rest.length ? `<details><summary>${L(`อีก ${num(rest.length)} ย่าน`, `${num(rest.length)} more`)}</summary><ul class="nb-list">${rest.map(item).join('')}</ul></details>` : ''}`, 'mx-section');
}

/**
 * Names with no outline on the map: the registry's held codes and collection names, and (0.2.0) the new lodging areas
 * of its lodging screen that have no review draft (held central codes of the registry since 0.2.1). Searchable, never
 * counted.
 */
function pendingSection(o, model) {
  if (!o.pending.length) return '';
  const admitted = Boolean(model.meta.lodging?.admitted);
  const word = p => (p.status === 'collection' ? L('ชื่อรวมหลายย่าน', 'a name for several neighbourhoods')
    : p.screen === 'lodging' || p.status === 'lodging' ? `${admitted ? L('รหัสกลางจากผลคัดย่านที่พัก ยังพักการปิดขอบ', 'central code from the lodging screen, outline held') : L('ย่านที่พักจากผลคัด ยังไม่มีขอบร่าง', 'lodging area of the screen, no draft outline yet')} · ${lodgingStatus(p.lodging, model)?.label || ''}`
      : p.screen === 'commercial' ? (p.wait === 'review'
        ? L('รหัสกลางจากผลคัดย่านการค้า ขอบที่วาดไกลจากจุดอ้างอิงเกิน 1 กม. รอเจ้าของตรวจ', 'central code from the commercial screen; the drawn outline reaches over 1 km from its reference point and awaits the owner\'s check')
        : L('รหัสกลางจากผลคัดย่านการค้า ยังไม่มีขอบ', 'central code from the commercial screen, no outline yet'))
      : L('ยังไม่มีขอบปิด', 'no closed outline yet'));
  return section('history', L('ชื่อที่ยังไม่มีขอบบนแผนที่', 'Names with no outline on the map yet'), esc(L(`${num(o.pending.length)} ชื่อ`, `${num(o.pending.length)}`)),
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
  const t = model.meta.totals || {}, lm = model.meta.lodging, adm = lm?.admitted ? lm : null;
  return `<details class="scope-details"><summary>${L('ข้อมูลที่ใช้เทียบ และขอบเขตของแต่ละชุด', 'The datasets compared and how far each reaches')}</summary>
    <p class="hint">${esc(L(`ทะเบียนย่านกลาง ${num(t.codes)} รหัส: ขอบปิดฉบับร่าง ${num(t.closed)} ย่าน${adm ? ` · ขอบร่างจากผลคัดย่านที่พัก ${num(t.lodgingDrawn)}` : ''}${t.screenDrawn != null ? ` · ขอบร่างจากผลคัดย่านการค้า ${num(t.screenDrawn)}` : ''} · รอขอบ ${num(t.held)} · ชื่อรวมหลายย่าน ${num(t.collections)}${t.screenHeld ? ` · พักไว้รอเจ้าของตัดสิน ${num(t.screenHeld)}` : ''}`, `Central registry ${num(t.codes)} codes: ${num(t.closed)} closed draft outlines${adm ? ` · ${num(t.lodgingDrawn)} draft outlines from the lodging screen` : ''}${t.screenDrawn != null ? ` · ${num(t.screenDrawn)} draft outlines from the commercial screen` : ''} · ${num(t.held)} held · ${num(t.collections)} collection names${t.screenHeld ? ` · ${num(t.screenHeld)} awaiting the owner's decision` : ''}`))}${lm ? esc(L(` · ผลคัดย่านที่พัก ${num(lm.proposals)} ข้อเสนอ: ผูกกับย่านเดิม ${num(lm.onRegistry)} · บริเวณใหม่ ${num(lm.newAreas)} (มีขอบร่าง ${num(lm.newAreasDrawn)})${adm ? ` รับเป็นรหัสกลาง ${thaiDate(adm.admittedOn)}` : ''}`, ` · lodging screen ${num(lm.proposals)} proposals: ${num(lm.onRegistry)} on existing neighbourhoods · ${num(lm.newAreas)} new areas (${num(lm.newAreasDrawn)} with a draft outline)${adm ? `, central codes since ${thaiDate(adm.admittedOn)}` : ''}`)) : ''}${esc(L(` — นับ ${num(t.outlined ?? t.closed)} ย่านที่มีขอบ`, ` — the ${num(t.outlined ?? t.closed)} outlined neighbourhoods are counted`))}</p>
    <div class="table-scroll"><table class="scope-table"><thead><tr><th scope="col">${L('ชุดข้อมูล', 'Dataset')}</th><th scope="col" class="num">${L('มีพิกัด/ทั้งหมด', 'Located/all')}</th><th scope="col" class="num">${L('จังหวัด', 'Provinces')}</th><th scope="col">${L('ข้อมูล ณ', 'As of')}</th><th scope="col">${L('นับอะไร', 'What is counted')}</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}

/**
 * The overview of Thailand or of one province. o = js/profile.js#buildOverview (+ searching); fillOf(row) = the map's
 * ramp colour of a row under the lens.
 */
export function renderOverview(o, model, {fillOf = () => '', ctx = {}, around = null} = {}) {
  const metrics = o.count ? `<section class="metrics compact" aria-label="${L('ตัวเลขรวม', 'Totals')}">
    ${metricTile(o.count, L('ย่าน', 'neighbourhoods'), 'maps', model.meta.screen ? L('ย่านที่มีขอบในทะเบียนย่านกลาง: ขอบปิดตามหลักเกณฑ์ทะเบียน ขอบร่างจากผลคัดย่านที่พัก และขอบร่างจากผลคัดย่านการค้า', 'Outlined neighbourhoods of the central registry: outlines closed by its rules and the draft outlines of the lodging and commercial screens') : L('ย่านที่มีขอบในทะเบียนย่านกลาง: ขอบปิดตามหลักเกณฑ์ทะเบียน และขอบร่างจากผลคัดย่านที่พัก', 'Outlined neighbourhoods of the central registry: outlines closed by its rules and the lodging screen\'s draft outlines'))}
    ${metricTile(one(o.km2), L('ตร.กม.', 'km²'), 'area', L(`พื้นที่รวมของขอบย่าน = ${sharePct(o.areaShare)} ของ${o.province ? 'จังหวัด' : 'ประเทศ'}`, `Outline area = ${sharePct(o.areaShare)} of ${o.province ? 'the province' : 'the country'}`))}
    ${metricTile(model.datasets.length, L('ชุดข้อมูล', 'datasets'), 'dataset', 'Land · Location · Living')}
    ${o.province ? metricTile(sharePct(o.areaShare), L('ของพื้นที่จังหวัด', 'of the province'), 'province') : metricTile(o.provinces.length, L('จังหวัด', 'provinces'), 'province')}
  </section>` : '';
  const lensFirst = o.lens ? lensSection(o, fillOf) : '';
  const place = o.province ? provinceName(o.province) : L('ประเทศไทย', 'Thailand');
  return `${ahaOverview(o)}${metrics}${lensFirst}${o.lens ? '' : addedSection(o, model)}${o.count ? `${o.lens ? '' : multiSection(o, model, around)}${sharesSection(o)}${outOfScopeLine(model, o)}${pairsSection(o)}${listSection(o, model, around)}${provincesSection(o)}` : ''}${pendingSection(o, model)}
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
export function highlightWords(h, ds, row, minCount = 3, shared = 1) {
  const n = row.c?.[ds.id] || 0, unit = dsUnit(ds), name = dsName(ds);
  const count = `${num(n)} ${dsUnitN(ds, n)}`;
  // (0.4.0, NL-06) equal values share one rank (scripts/build-data.py#share_rank): say how many share it
  const tie = shared > 1 ? L(` ร่วม ${num(shared)} ย่าน`, `, shared by ${num(shared)} neighbourhoods`) : '';
  if (h.k === 'share') return {head: `${name} ${count}`, value: sharePct(h.v), detail: L(`ของ${ds.nameTh}ที่มีพิกัดทั้งประเทศ (${num(n)} จาก ${num(ds.located)})`, `of the ${name} records with a location nationwide (${num(n)} of ${num(ds.located)})`)};
  if (h.k === 'count') return {head: `${name} ${count}`, value: (h.v === 1 ? L('มากที่สุด', 'Most') : L(`มากอันดับ ${num(h.v)}`, `Rank ${num(h.v)}`)) + tie, detail: L(`จาก ${num(h.of)} ย่านในจังหวัดที่ชุดนี้มีข้อมูล`, `of ${num(h.of)} neighbourhoods in provinces this dataset covers`)};
  if (h.k === 'density') return {head: `${name} ${dens(row.density?.[ds.id])} ${unit} ${perKm2}`, value: (h.v === 1 ? L('แน่นที่สุด', 'Densest') : L(`แน่นอันดับ ${num(h.v)}`, `Density rank ${num(h.v)}`)) + tie, detail: L(`จาก ${num(h.of)} ย่านที่มีตั้งแต่ ${num(minCount)} ${unit}`, `of ${num(h.of)} neighbourhoods holding at least ${num(minCount)}`)};
  if (h.k === 'rare') return {head: `${name} ${count}`, value: L(`1 ใน ${num(h.v)} ย่าน`, `1 of ${num(h.v)}`), detail: L(`ที่มี${ds.nameTh} จาก ${num(h.of)} ย่านในจังหวัดที่ชุดนี้มีข้อมูล`, `neighbourhoods holding any, of ${num(h.of)} in provinces this dataset covers`)};
  return {head: name, value: '', detail: ''};
}
const highlightWordsL = (x, row) => highlightWords(x.h, x.ds, row, 3, x.shared || 1);

/**
 * (0.6.0, §4.2) A highlight in its short words: the comparison with its universe and number in one line — “19% ของทั้ง
 * ประเทศ (64 จาก 345)”, “มากอันดับ 4 จาก 395 ย่าน (ร่วม 5 ย่าน)” (INV-03, INV-04, NL-06).
 */
export function highlightShort(h, ds, row, shared = 1) {
  const n = row.c?.[ds.id] || 0;
  const tie = shared > 1 ? L(` (ร่วม ${num(shared)} ย่าน)`, ` (shared by ${num(shared)})`) : '';
  if (h.k === 'share') return L(`${sharePct(h.v)} ของทั้งประเทศ (${num(n)} จาก ${num(ds.located)})`, `${sharePct(h.v)} of the national total (${num(n)} of ${num(ds.located)})`);
  if (h.k === 'count') return L(`${h.v === 1 ? 'มากที่สุด' : `มากอันดับ ${num(h.v)}`} จาก ${num(h.of)} ย่าน${tie}`, `${h.v === 1 ? 'Most' : `Count rank ${num(h.v)}`} of ${num(h.of)} neighbourhoods${tie}`);
  if (h.k === 'density') return L(`${h.v === 1 ? 'แน่นที่สุด' : `แน่นอันดับ ${num(h.v)}`} จาก ${num(h.of)} ย่าน${tie}`, `${h.v === 1 ? 'Densest' : `Density rank ${num(h.v)}`} of ${num(h.of)} neighbourhoods${tie}`);
  if (h.k === 'rare') return L(`1 ใน ${num(h.v)} ย่านที่มี${ds.nameTh} จาก ${num(h.of)} ย่าน`, `1 of the ${num(h.v)} neighbourhoods holding any, of ${num(h.of)}`);
  return '';
}

/** (0.6.0, §4.2) One card per highlight; the whole card sets the map's lens (what «เทียบทุกย่าน» did). */
function highlightsSection(d) {
  if (!d.highlights.length) return '';
  const cards = d.highlights.map(x => {
    const w = highlightWordsL(x, d.row), n = d.row.c?.[x.ds.id] || 0;
    const full = `${w.head} — ${w.value} ${w.detail}`;
    return `<li><button type="button" class="hl-card" data-action="set-lens" data-value="${esc(x.ds.id)}" title="${esc(L(`${full} · กดเพื่อระบายสีทุกย่านตาม${x.ds.nameTh}`, `${full} · colour every neighbourhood by ${dsName(x.ds)}`))}">
      ${dsPic(x.ds, 'hl-card-icon')}<span class="hl-card-name">${cueMarkup(PILLAR_SERIES[x.ds.group] || 9)}<span>${esc(dsName(x.ds))}</span></span>
      <span class="hl-card-fig">${nw(`<b class="data-number">${num(n)}</b> <span class="hl-card-unit">${esc(dsUnitN(x.ds, n))}</span>`)}</span>
      <span class="hl-card-rank">${esc(highlightShort(x.h, x.ds, d.row, x.shared || 1))}</span><span class="sr-only">${esc(w.detail)}</span></button></li>`;
  }).join('');
  return section('rank', L('จุดเด่น', 'Highlights'), esc(L('เทียบกับย่านอื่น', 'against other neighbourhoods')), `<ul class="hl-cards">${cards}</ul>`);
}

function togetherSection(d) {
  const parts = [];
  if (d.pairs.length) {
    const named = ds => nw(`${dsPic(ds)}${esc(dsName(ds))}`);
    parts.push(`<ul class="pr-list">${d.pairs.map(p => `<li class="pr-row" title="${esc(L(`เด่นทั้งคู่ที่นี่ และทั่วประเทศมักมาด้วยกัน: ρ ${p.rho.toFixed(2)} จาก ${num(p.n)} ย่านที่มีข้อมูลทั้งสองชุด`, `Both stand out here, and they tend to come together nationwide: ρ ${p.rho.toFixed(2)} across ${num(p.n)} neighbourhoods with both datasets`))}">
      <span class="pr-names">${named(p.A)}<b class="pr-plus" aria-hidden="true">+</b>${named(p.B)}</span><span class="pr-bar" aria-hidden="true"><i style="width:${Math.round(p.rho * 100)}%"></i></span>
      <span class="pr-val data-number">${nw(`ρ ${esc(p.rho.toFixed(2))} · ${num(p.n)} ${L('ย่าน', 'neighbourhoods')}`)}</span></li>`).join('')}</ul>`);
  }
  // ✓ the data agrees (a highlight speaks to the role) · ○ not in the data yet; the words of the mark for screen readers
  const roleRow = r => {
    const on = r.evidence.length > 0;
    const seen = r.observed.filter(x => x.c.state !== 'out_of_scope').map(x => `${dsName(x.ds)} ${cellText(x.c, x.ds)}`).join(' · ');
    const why = on ? `${L('เด่นจาก', 'from')} ${r.evidenceDs.map(dsName).join(' · ')}` : seen || L('ไม่มีชุดข้อมูลของบทบาทนี้ในจังหวัด', 'no dataset of this role in the province');
    const ev = on ? r.evidenceDs.map(ds => nw(`${dsPic(ds)}${esc(dsName(ds))}`)).join(' · ') : esc(why);
    return `<li class="rl-row${on ? ' is-on' : ''}"><b class="rl-mark" aria-hidden="true">${on ? '✓' : '○'}</b><span class="sr-only">${esc(on ? L('ข้อมูลชี้ตรง:', 'Data agrees:') : L('ข้อมูลยังไม่ชี้:', 'Not in the data yet:'))}</span><span class="rl-name">${esc(EN ? r.en : r.th)}</span><span class="rl-ev">${ev}</span>${r.proposed ? '' : `<small class="role-new">${esc(L('ข้อมูลชี้เพิ่ม', 'the data adds'))}</small>`}</li>`;
  };
  const roles = [...d.proposed, ...d.extra];
  const roleKey = d.proposed.length ? L('บทบาทที่ทะเบียนเสนอ: ✓ ข้อมูลชี้ตรง · ○ ยังไม่ชี้', 'Roles the registry proposes: ✓ the data agrees · ○ not yet') : L('บทบาทที่ข้อมูลชี้ ✓', 'Roles the data points to ✓');
  if (roles.length) parts.push(`<p class="pillar-label">${esc(roleKey)}</p><ul class="rl-list">${roles.map(roleRow).join('')}</ul>`);
  if (!parts.length) return '';
  return section('compare', L('อะไรมาด้วยกัน', 'What comes together'), esc(L('ทั่วประเทศ · ρ = สหสัมพันธ์อันดับ', 'nationwide · ρ = rank correlation')), parts.join(''));
}

/* ---------- 0.4.0: the glance «ในย่านนี้» and the section «ขอบเดินถึง» (js/around.js, DATA_METHOD.md §12) ---------- */

/** The words of a distance: in · ขอบเดินถึง 400 ม. / Inside · Walkable edge 400 m (0.4.1, D-10; 0.4.0 said รอบย่าน). */
export const distanceWords = (d, {short = false} = {}) => (d === 'in' ? L('ในย่าน', 'Inside')
  : short ? L(`ขอบ ${num(+d)} ม.`, `${num(+d)} m edge`) : L(`ขอบเดินถึง ${num(+d)} ม.`, `Walkable edge ${num(+d)} m`));
/** Kinds of evidence as the page says them (handoff/around/contracts.json evidenceClasses). */
const EVIDENCE_WORDS = {derived_count: ['นับ', 'counted'], publisher_listed: ['แหล่งรายงาน', 'source-listed'], modelled_estimate: ['แบบจำลอง', 'modelled']};
const evidenceTag = id => (EVIDENCE_WORDS[id] ? `<span class="glance-tag">${esc(L(...EVIDENCE_WORDS[id]))}</span>` : '');
const GLANCE_ICON = {residents: 'building', students: 'school', rooms: 'classroom', centers: 'province'};
const GLANCE_LABEL = {residents: ['คนอยู่', 'Living here'], students: ['นักเรียน', 'Students'], rooms: ['ห้องพัก', 'Rooms'], centers: ['ศูนย์และตลาด', 'Centers and markets']};
const STAR_NOTE = () => L('พิกัดไม่ถึง 90% ของรายการ จึงไม่จัดระดับ', 'points for under 90% of the records, so no level');
/** The keys of the star, written as keys (a symbol and what it marks), as «รอบศูนย์นี้» keys its meter. */
const STAR_KEY = kind => (kind === 'level'
  ? L('* = ชุดที่มีพิกัดไม่ถึง 90% ของรายการ: แสดงค่า ไม่จัดระดับ', '* = a dataset with points for under 90% of its records: value shown, no level')
  : L('* = ชุดที่มีพิกัดไม่ถึง 90% ของรายการ: แสดงจำนวน ไม่จัดอันดับ', '* = a dataset with points for under 90% of its records: count shown, no rank'));

/**
 * Five bars from low to high (as «รอบศูนย์นี้»): the filled ones take the LDS `count` sample of the rank (pctFill, the
 * same HEX on both themes) and every bar has an outline, so the level reads without the colour.
 */
export function levelMeter(level, p = null) {
  const fill = p == null ? '' : ` style="background:${pctFill(p)}"`;
  return `<span class="level-meter" data-level="${level}" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i${i <= level ? ` class="on"${fill}` : ''}></i>`).join('')}</span>`;
}

/** “8–16 พ.ย. 2569” / “8–16 Nov 2026”: a span of days, the month and year said once where both ends share them. */
export function daySpan(a, b) {
  if (!a || !b || a === b) return thaiDate(a || b);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${+a.slice(8, 10)}–${thaiDate(b)}`;
  // the same year: “31 ต.ค. – 8 พ.ย. 2569” (the year once)
  if (a.slice(0, 4) === b.slice(0, 4)) return `${thaiDate(a).replace(/ \d{4}$/, '')} – ${thaiDate(b)}`;
  return `${thaiDate(a)} – ${thaiDate(b)}`;
}

/** The glance «ในย่านนี้»: four tiles of one dataset each, a meter key, one short provenance line (NL-04). */
function glanceSection(r, model, around) {
  const tiles = glanceTiles(r, model, around);
  const n = around?.meta.referenceSet?.n;
  const uni = id => around?.meta.glance?.universe?.[id]?.n ?? n;
  const tile = t => {
    const [th, en] = GLANCE_LABEL[t.id];
    const label = `<span class="glance-label">${esc(L(th, en))} ${evidenceTag(t.evidence)}</span>`;
    const icon = pic(GLANCE_ICON[t.id]);
    if (t.state === 'not_yet') {
      return `<li><div class="glance-tile is-not_yet">${icon}${label}<span class="glance-wait">${esc(L('ยังไม่ถึงรอบข้อมูล', 'Not yet in this release'))}</span><small class="glance-sub">${esc(L('รอรุ่นแบบจำลองผู้อยู่อาศัย (รอบ 2)', 'awaiting the residents model (round 2)'))}</small></div></li>`;
    }
    const ds = t.ds, unitDs = n_ => `${num(n_)} ${dsUnitN(ds, n_)}`;
    let figure, sub = '';
    if (t.state === 'out_of_scope') {
      figure = `<span class="glance-fig is-state">— ${esc(L('นอกขอบเขตข้อมูล', 'Out of scope'))}</span>`;
      sub = L(`${ds.nameTh}ไม่มีข้อมูลในจังหวัดนี้`, `no ${dsName(ds)} data in this province`);
    } else if (t.state === 'measured_zero') {
      figure = `<span class="glance-fig is-state">${esc(L('ไม่พบ', 'None found'))}</span>`;
      sub = L(`${ds.nameTh} 0 ${dsUnit(ds)}`, `0 ${dsUnit(ds)}`);
    } else if (t.state === 'no_data') {
      figure = `<span class="glance-fig is-state">— ${esc(L('ไม่มีข้อมูล', 'No data'))}</span>`;
      sub = L(`${ds.nameTh} ${unitDs(t.records)} ไม่มีตัวเลข`, `${unitDs(t.records)}, no figure`);
    } else {
      const star = t.star ? `<sup aria-hidden="true">*</sup><span class="sr-only">${esc(STAR_NOTE())}</span>` : '';
      figure = `<span class="glance-fig">${nw(`<b class="data-number">${num(t.value)}</b>&nbsp;<span class="glance-unit">${esc(L(...t.unit))}${star}</span>`)}</span>`;
      if (t.figure !== 'count') sub = t.known < t.records ? L(`${ds.nameTh} ${unitDs(t.records)} · มีตัวเลข ${unitDs(t.known)}`, `${unitDs(t.records)} · ${unitDs(t.known)} with a figure`) : L(`${ds.nameTh} ${unitDs(t.records)}`, unitDs(t.records));
    }
    const meter = t.level == null ? '' : `${levelMeter(t.level, t.value > 0 ? t.p : null)}<span class="sr-only">${esc(L(`${LEVEL_WORDS[t.level][0]} ระดับ ${num(t.level)} จาก 5 เทียบ ${num(uni(t.id))} ย่าน`, `${LEVEL_WORDS[t.level][1]}, level ${num(t.level)} of 5 among ${num(uni(t.id))} neighbourhoods`))}</span>`;
    const title = L(`${th}: ${ds.nameTh} · กดเพื่อไปที่แถวของชุดนี้ในแกน อยู่ · เที่ยว · ค้าขาย`, `${en}: ${dsName(ds)} · go to its row on the axes below`);
    return `<li><button type="button" class="glance-tile is-${t.state}" data-action="around-jump" data-value="${esc(ds.id)}" title="${esc(title)}">${icon}${label}${figure}${sub ? `<small class="glance-sub">${esc(sub)}</small>` : ''}${meter}</button></li>`;
  };
  const starred = tiles.some(t => t.star && t.state === 'measured');
  const ready = tiles.filter(t => t.ds && t.state !== 'out_of_scope');
  const dates = ready.map(t => dsDate(t.ds)).filter(Boolean).sort();
  // the key names the peers of every level shown, by their number (rooms are levelled among the 394 with a figure)
  const levelled = tiles.filter(t => t.ds && t.level != null), unis = [...new Set(levelled.map(t => uni(t.id)))];
  // each peer group and the direction kept whole on a line (a number and its unit never split)
  const among = (unis.length === 1 ? [nw(esc(L(`ระดับเทียบ ${num(unis[0])} ย่าน`, `Level among ${num(unis[0])} neighbourhoods`)))]
    : [esc(L('ระดับเทียบย่านที่มีค่า:', 'Level among the neighbourhoods with a value:')), ...levelled.map(t => nw(esc(L(`${GLANCE_LABEL[t.id][0]} ${num(uni(t.id))} ย่าน`, `${GLANCE_LABEL[t.id][1].toLowerCase()} ${num(uni(t.id))} neighbourhoods`))))])
    .concat(nw(esc(L('น้อย → มาก', 'low → high')))).join(' · ').replace(': · ', ': ');
  const key = n && (levelled.length || starred) ? `<p class="hint glance-key">${levelled.length ? `${levelMeter(3)}<span>${among}</span>` : ''}${starred ? `<span>${esc(STAR_KEY('level'))}</span>` : ''}</p>` : '';
  const source = `<p class="hint glance-source">${esc(L(`ชุดข้อมูล CityMETER ${dates.length ? daySpan(dates[0], dates.at(-1)) : ''} · ในขอบร่างของย่าน`, `CityMETER datasets, ${dates.length ? daySpan(dates[0], dates.at(-1)) : ''} · inside the draft outline`))}</p>`;
  return `<section class="panel-section nb-glance" aria-labelledby="nb-glance-title"><div class="section-heading">${heading('area', L('ในย่านนี้', 'Inside this neighbourhood'), 'nb-glance-title')}</div>
    <ul class="glance-grid" aria-labelledby="nb-glance-title">${tiles.map(tile).join('')}</ul>${key}${source}</section>`;
}

/** A centre's «รอบศูนย์นี้» in the Shopping Center demo (`?e=venue:<id>`, citymeter-shell grammar). */
function venueHref(id) {
  const demo = DEMOS.find(x => x.path === 'shoppingcenter');
  if (!demo) return '';
  return `${demoUrl(demo)}?e=venue:${encodeURIComponent(id)}${EN && demo.en ? '&lang=en' : ''}`;
}

/** The surroundings section's own provenance line: dataset · source · date · boundary, then the method (INV-09). */
function aroundProvenance(r, model, around, distance) {
  const meta = around?.meta;
  const reach = distance === 'in' ? Math.max(...(meta?.ringsM || [800])) : +distance;
  // the date is the data's (the datasets of the neighbourhood's province), as the glance's line
  const dates = model.datasets.filter(ds => ds.id in (r.c || {})).map(dsDate).filter(Boolean).sort();
  const when = dates.length ? daySpan(dates[0], dates.at(-1)) : '';
  const dataset = meta ? L(`CityMETER Commercial District · ขอบเดินถึง รุ่น ${meta.release}`, `CityMETER Commercial District · walkable edge ${meta.release}`) : 'CityMETER Commercial District';
  const boundary = meta ? L(`${r.name} · ขอบร่าง ${rai(r.areaM2)} ไร่ และนอกขอบไม่เกิน ${num(reach)} ม. วัดเส้นตรง`, `${r.name} · draft outline ${rai(r.areaM2)} rai and up to ${num(reach)} m beyond it, straight line`)
    : L(`${r.name} · ขอบร่าง ${rai(r.areaM2)} ไร่`, `${r.name} · draft outline ${rai(r.areaM2)} rai`);
  return `<p class="hint panel-foot provenance"><span class="prov-part" data-prov="dataset">${pic('dataset')}<span class="sr-only">${L('ชุดข้อมูล ', 'Dataset ')}</span>${esc(dataset)}</span> <span class="prov-part" data-prov="source"><span class="sr-only">${L('แหล่ง', 'Source')}</span>${esc(L(`จาก ${num(model.datasets.length)} ชุดข้อมูล CityMETER ตามรุ่นที่ตรึง`, `from ${num(model.datasets.length)} CityMETER datasets at pinned versions`))}</span><span class="prov-part" data-prov="date">${pic('date')}<span class="sr-only">${L('ข้อมูล ', 'Data ')}</span>${esc(when)}</span><span class="prov-part" data-prov="boundary">${pic('area')}<span class="sr-only">${L('ขอบเขต ', 'Boundary ')}</span>${esc(boundary)}</span><span class="prov-part prov-method"><a href="${METHOD_URL}#12" target="_blank" rel="noopener">${L('วิธีนับ', 'Method')}</a></span></p>`;
}

/**
 * The table of 0.4.0 (NL-04, NL-05), folded under the axes since 0.6.0 (D-V5): every dataset of the neighbourhood —
 * inside, within 400 m and within 800 m around, each in the dataset's own unit, never a total — with the switch of the
 * distance the map draws. A starred dataset (points for under 90 % of its records, D-4) shows its count and density,
 * never a rank.
 */
function aroundTable(d, model, around, {distance = 'in', fillOf = () => ''} = {}) {
  const r = d.row, groups = aroundGroups(r, model, around);
  const items = groups.flatMap(g => g.items);
  const scope = items.filter(x => x.c.state !== 'out_of_scope').length, present = items.filter(x => x.c.state === 'measured').length;
  // without the surroundings file the table keeps the inside column alone (the page says what did not load)
  const loaded = Boolean(around), cols = loaded ? ['in', '400', '800'] : ['in'];
  const switcher = loaded ? `<div class="around-switch" role="group" aria-label="${esc(L('อ่านตารางและแผนที่ที่ระยะ', 'Read the table and the map at'))}">${cols.map(v => `<button type="button" class="seg" data-action="set-around" data-value="${v}" aria-pressed="${distance === v}">${esc(distanceWords(v))}</button>`).join('')}</div>` : '';
  const ringCell = (x, k) => {
    if (!x.ring) return `<td class="num col-${k} is-none">—<span class="sr-only">${esc(L('ไม่มีตัวเลขขอบเดินถึง', 'no figure for the edge'))}</span></td>`;
    const v = x.ring[RING_INDEX[k]];
    return `<td class="num col-${k} data-number${v ? '' : ' is-zero'}">${num(v)}</td>`;
  };
  // a rank names its peers with their number, and how many neighbourhoods share it (equal values share one rank, NL-06)
  const rankOf = (ds, c) => {
    const words = (k, rank, of) => {
      const t = sharedBy(model, r, {k, d: ds.id});
      const head = k === 'density' ? L(`แน่นอันดับ ${num(rank)} จาก ${num(of)} ย่าน`, `density rank ${num(rank)} of ${num(of)} neighbourhoods`)
        : L(`มากอันดับ ${num(rank)} จาก ${num(of)} ย่าน`, `count rank ${num(rank)} of ${num(of)} neighbourhoods`);
      return [head, t > 1 ? L(`ร่วม ${num(t)} ย่าน`, `shared by ${num(t)} neighbourhoods`) : ''].filter(Boolean);
    };
    if (c.state !== 'measured') return [];
    if (c.densityRank) return words('density', c.densityRank, c.ranked);
    if (c.countRank) return words('count', c.countRank, c.covered);
    return [];
  };
  const row = x => {
    const {ds, c, star} = x;
    // a starred dataset has no rank here, in words or by colour (D-4): no swatch of the map's density colour
    const swatch = !star && fillOf(ds) ? `<i class="ds-swatch" style="background:${esc(fillOf(ds))}" aria-hidden="true"></i>` : '';
    const starMark = star ? `<sup aria-hidden="true">*</sup><span class="sr-only">${esc(L(`มีพิกัด ${num(ds.located)} จาก ${num(ds.records)} รายการ จึงไม่จัดอันดับ`, `${num(ds.located)} of ${num(ds.records)} records have a point, so no rank`))}</span>` : '';
    const rank = star ? [] : rankOf(ds, c);
    // a figure and its unit, and a rank and its peers, never split across lines
    const sub = [esc(dsUnit(ds)), c.state === 'measured' ? nw(`${dens(c.density)} ${perKm2}`) : '', ...rank.map(w => nw(esc(w)))].filter(Boolean).join(' · ');
    const title = star ? L(`มีพิกัด ${num(ds.located)} จาก ${num(ds.records)} รายการ · ระบายสีย่านตาม${ds.nameTh}`, `${num(ds.located)} of ${num(ds.records)} records have a point · colour the neighbourhoods by ${dsName(ds)}`)
      : L(`ระบายสีย่านตาม${ds.nameTh}`, `Colour the neighbourhoods by ${dsName(ds)}`);
    const head = `<th scope="row"><button type="button" class="around-ds" id="around-${esc(ds.id)}" data-action="set-lens" data-value="${esc(ds.id)}" title="${esc(title)}"><span class="around-name">${cueMarkup(PILLAR_SERIES[ds.group] || 9)}<span>${esc(dsName(ds))}${starMark}</span></span><small class="around-sub">${swatch}<span>${c.state === 'out_of_scope' ? esc(L('ไม่มีข้อมูลในจังหวัดนี้', 'no data in this province')) : sub}</span></small></button></th>`;
    if (c.state === 'out_of_scope') return `<tr class="is-out_of_scope">${head}<td class="num is-out" colspan="${cols.length}">— ${esc(L('นอกขอบเขตข้อมูล', 'Out of scope'))}</td></tr>`;
    return `<tr class="is-${c.state}">${head}<td class="num col-in data-number${c.count ? '' : ' is-zero'}">${num(c.count)}</td>${cols.slice(1).map(k => ringCell(x, k)).join('')}</tr>`;
  };
  // one row group per pillar, so each pillar's header heads its own rows only
  const body = groups.map(g => `<tbody><tr class="pillar-row"><th scope="rowgroup" colspan="${cols.length + 1}"><span class="pillar-label eyebrow-cue">${cueMarkup(PILLAR_SERIES[g.pillar])}${esc(g.pillar.toUpperCase())}</span></th></tr>${g.items.map(row).join('')}</tbody>`).join('');
  const caption = loaded ? L('จำนวนรายการของแต่ละชุดข้อมูลในหน่วยของชุดนั้น: ในขอบย่าน และนอกขอบไม่เกิน 400 ม. และ 800 ม. วัดเส้นตรงจากขอบ · ค่า 800 ม. รวมค่า 400 ม. · ไม่รวมข้ามชุดข้อมูล',
    'Records of each dataset in its own unit: inside the outline, and outside it within 400 m and 800 m of the edge, straight line · the 800 m figure holds the 400 m one · never added across datasets')
    : L('จำนวนรายการของแต่ละชุดข้อมูลในขอบย่าน ในหน่วยของชุดนั้น · ไม่รวมข้ามชุดข้อมูล', 'Records of each dataset inside the outline, in its own unit · never added across datasets');
  const colHead = k => `<th scope="col" class="num col-${k}${distance === k ? ' is-chosen' : ''}">${esc(k === 'in' ? distanceWords('in') : distanceWords(k, {short: true}))}</th>`;
  const table = `<div class="table-scroll around-scroll"><table class="around-table" data-around="${esc(loaded ? distance : 'in')}"><caption class="sr-only">${esc(caption)}</caption>
    <thead><tr><th scope="col">${L('ชุดข้อมูล', 'Dataset')}</th>${cols.map(colHead).join('')}</tr></thead>${body}</table></div>`;
  const starred = items.some(x => x.star && x.c.state !== 'out_of_scope');
  const note = starred ? `<p class="hint">${esc(STAR_KEY('rank'))}</p>` : '';
  return {table, note, switcher, scope, present, starred, loaded};
}

/** The centres with a «รอบศูนย์นี้» page inside and near the neighbourhood (0.4.0, kept as it was). */
function aroundVenues(r, around, distance, venueLogo) {
  const vs = venuesOf(r, around, distance);
  const count = n => nw(esc(L(`${num(n)} แห่ง`, `${num(n)} ${n === 1 ? 'center' : 'centers'}`)));
  const metres = m => nw(esc(m < 1 ? L('ไม่ถึง 1 ม.', 'under 1 m') : L(`${num(m)} ม.`, `${num(m)} m`)));
  const vlink = v => `<a class="source-link" data-venue="${esc(v.id)}" href="${esc(venueHref(v.id))}" title="${esc(L(`เปิด «รอบศูนย์นี้» ของ${v.name} ในเดโม Shopping Center`, `Open “Around this center” of ${v.nameEn || v.name} in the Shopping Center demo`))}">${logoPlate(venueLogo(v.id), {height: 16, cls: 'inline-logo'})}${esc(EN && v.nameEn ? v.nameEn : v.name)}</a>`;
  const venues = vs.inside.length || vs.near.length ? `<div class="around-venues"><p class="pillar-label">${esc(L('ศูนย์การค้าที่มีหน้า «รอบศูนย์นี้»', 'Shopping centers with an “Around this center” page'))}</p><ul class="plain-list venue-links">
    ${vs.inside.length ? `<li><span class="hint">${esc(distanceWords('in'))} ${count(vs.inside.length)}</span> ${vs.inside.map(vlink).join(' · ')}</li>` : ''}
    ${vs.near.length ? `<li><span class="hint">${esc(distanceWords(distance))} ${count(vs.near.length)}</span> ${vs.near.map(v => `${vlink(v)} <small class="hint">${metres(v.m)}</small>`).join(' · ')}</li>` : ''}
  </ul></div>` : '';
  return venues;
}

/** The dataset's own demo at the neighbourhood's province (the link of the dataset's row, §4.2). */
function demoTarget(ds, province) {
  const demo = DEMOS.find(x => x.path === ds.path);
  if (!demo) return null;
  return {href: demoHref(demo, province ? `?at=${province}` : '', LANG), title: L(`เปิดเดโม ${demo.name}${province ? ` ที่${provinceName(province)}` : ''}`, `Open the ${demo.name} demo${province ? ` at ${provinceName(province)}` : ''}`)};
}

/**
 * (0.6.0, §4.9; D-V5, D-V6, D-V7 A) อยู่ · เที่ยว · ค้าขาย: the datasets of the neighbourhood on three axes, each a row
 * with its level, count and rank, the switch of the distance the map draws (0.4.0), a key, and closed under them the way
 * to read them, the indicators each axis has no data for yet, and the table of 0.4.0 with every figure at every distance;
 * then the centres with a «รอบศูนย์นี้» page and the section's own provenance line.
 */
function aroundSection(d, model, around, {distance = 'in', fillOf = () => '', venueLogo = () => null} = {}) {
  const r = d.row, t = aroundTable(d, model, around, {distance, fillOf});
  const reading = t.loaded ? distance : 'in', hl = new Set(d.highlights.map(x => x.ds.id));
  const cells = cellsOf(model, r, around);
  const hlShown = cells.some(x => hl.has(x.ds.id) && x.kind === 'ranked');
  const star = cells.some(x => x.kind !== 'out' && lowLocated(x.ds));
  const colHead = `<p class="ax-cols" aria-hidden="true"><span>${L('ชุดข้อมูล', 'Dataset')}</span><span>${L('ระดับเทียบย่านอื่น', 'Level among the others')}</span><span>${L('จำนวน · อันดับ', 'Count · rank')}</span></p>`;
  const cards = axisCards(model, r, around, {distance: reading, hl, demoOf: ds => demoTarget(ds, r.province)});
  const fold = `<details class="scope-details around-fold"><summary>${L('วิธีอ่าน แหล่งที่ตรวจไว้ และตัวเลขทุกระยะ (16 ชุด)', 'How to read, sources looked at, and every figure (16 datasets)')}</summary>${axisFoldIntro(model)}${t.table}${t.note}</details>`;
  const hint = L(`${num(model.datasets.length)} ชุดข้อมูล`, `${num(model.datasets.length)} datasets`);
  return `<section class="panel-section around-section axes-section" id="nb-around" aria-labelledby="nb-around-title"><div class="section-heading">${heading('dataset', L('อยู่ · เที่ยว · ค้าขาย', 'Live · Visit · Trade'), 'nb-around-title')}<span class="hint">${esc(hint)}</span></div>
    ${t.switcher}${colHead}${cards}${axisKey({distance: reading, hl: hlShown, star})}${fold}${aroundVenues(r, around, distance, venueLogo)}${aroundProvenance(r, model, around, reading)}</section>`;
}

function similarSection(d, model, around) {
  if (!d.similar.length) return '';
  const sim = x => `<span class="data-number" title="${esc(L(`ความคล้ายของส่วนผสม (cosine) จาก ${num(x.shared)} ชุดข้อมูลที่มีในทั้งสองย่าน`, `Mix similarity (cosine) over ${num(x.shared)} datasets both neighbourhoods have`))}">${esc(L(`คล้าย ${num(Math.round(x.sim * 100))}%`, `${num(Math.round(x.sim * 100))}% alike`))}</span>`;
  const rows = [{row: d.row, self: true, hl: hlSet(d.row), head: matrixHead(d.row, {self: true, small: esc(L('ย่านนี้', 'this one'))})},
    ...d.similar.map(x => ({row: x.row, hl: hlSet(x.row), head: matrixHead(x.row, {small: `${provinceWords(x.row)} · ${sim(x)}`})}))];
  // (the neighbourhood's name between separators: an English page keeps Thai names, never Thai sentences)
  const caption = L(`16 ชุดข้อมูลของ${d.row.name} และ ${num(d.similar.length)} ย่านที่ส่วนผสมคล้ายที่สุด`, `${d.row.name} · the 16 datasets, with the ${num(d.similar.length)} neighbourhoods of the closest mix`);
  return section('compare', L('ย่านที่ส่วนผสมคล้ายกัน', 'Neighbourhoods with a similar mix'), esc(L('ทั่วประเทศ', 'nationwide')),
    // the column key stays out here: the axes above name every dataset beside its pictogram (LDS ICON-01)
    `${matrix(model, around, rows, {caption, answer: matrixAnswer(model, around, rows.map(x => x.row))})}${matrixLegend(model, {columns: false})}<p class="hint">${esc(levelScopeLine())}</p>
    <div class="aha-actions"><button type="button" class="btn quiet" data-action="cmp-similar" data-id="${esc(d.row.id)}">${L('เทียบกับย่านเหล่านี้', 'Compare with these')}</button></div>`, 'mx-section');
}

/* ---------- 0.2.0: kinds of neighbourhood, what is new, the lodging screen ---------- */

/** The lodging screen's reading of a neighbourhood: status label (the registry's own words in Thai), held or not. */
export function lodgingStatus(x, model) {
  if (!x) return null;
  const st = model.meta.lodging?.statuses?.[x.st];
  return {code: x.st, held: String(x.st).startsWith('H'), label: st ? (EN ? st.en : st.th) : x.st};
}

/** Small words under the name: a lodging area of the screen, first drawn in this release. */
export function kindBadges(r) {
  const out = [];
  if (r.kind === 'lodging') out.push(`<span class="kind-badge is-lodging">${esc(L('ย่านที่พัก · ขอบร่างจากผลคัด', 'Lodging area · draft outline from the screen'))}</span>`);
  if (r.kind === 'screen') out.push(`<span class="kind-badge is-lodging">${esc(L('ผลคัดย่านการค้า · ขอบร่างตามหลักของเจ้าของ', 'Commercial screen · draft outline by the owner\'s rule'))}</span>`);
  if (r.added) out.push(`<span class="kind-badge is-added">${esc(L('ใหม่ในรุ่นนี้', 'New in this release'))}</span>`);
  return out.length ? `<p class="kind-badges">${out.join('')}</p>` : '';
}

/** What this data release adds (the national view): the registry's newly closed outlines and the lodging areas. */
function addedSection(o, model) {
  const t = model.meta.totals || {};
  if (o.province || o.searching || !t.added) return '';
  const added = model.rows.filter(r => r.added);
  const reg = added.filter(r => r.kind === 'registry' || !r.kind), lod = added.filter(r => r.kind === 'lodging'), scr = added.filter(r => r.kind === 'screen');
  const names = list => list.slice(0, 6).map(r => nbButton(r)).join(' · ') + (list.length > 6 ? ` <span class="hint">${esc(L(`และอีก ${num(list.length - 6)}`, `and ${num(list.length - 6)} more`))}</span>` : '');
  const since = EN ? model.meta.added?.sinceEn : model.meta.added?.since;
  return section('history', L('ย่านใหม่ในข้อมูลรุ่นนี้', 'New neighbourhoods in this release'), esc(L(`${num(added.length)} ย่าน`, `${num(added.length)}`)),
    `<ul class="plain-list added-list">
      ${reg.length ? `<li><strong>${esc(L(`ขอบปิดใหม่ในทะเบียน ${num(reg.length)} ย่าน`, `${num(reg.length)} newly closed registry outlines`))}</strong>${since ? ` <span class="hint">${esc(L(`เทียบ${since}`, `against ${since}`))}</span>` : ''}<br>${names(reg)}</li>` : ''}
      ${lod.length ? `<li><strong>${esc(model.meta.lodging?.admitted ? L(`ย่านที่พักรับเข้าทะเบียน ${num(lod.length)} ย่าน`, `${num(lod.length)} lodging areas admitted to the registry`) : L(`ย่านที่พักจากผลคัด ${num(lod.length)} ย่าน`, `${num(lod.length)} lodging areas of the screen`))}</strong>${model.meta.lodging?.admitted ? ` <span class="hint">${esc(L(`ขอบร่างจากผลคัด รับเป็นรหัสกลาง ${thaiDate(model.meta.lodging.admittedOn)}`, `draft outlines from the screen, central codes since ${thaiDate(model.meta.lodging.admittedOn)}`))}</span>` : ''}<br>${names(lod)}</li>` : ''}
      ${scr.length ? `<li><strong>${esc(L(`ย่านจากผลคัดย่านการค้า ${num(scr.length)} ย่าน`, `${num(scr.length)} neighbourhoods of the commercial screen`))}</strong> <span class="hint">${esc(L(`รหัสกลางที่ทะเบียนรับ ${thaiDates(model.meta.screen?.admittedOn)} ขอบวาดตามหลักของเจ้าของ ${thaiDate(model.meta.screen?.outlinedOn)}`, `central codes admitted on ${thaiDates(model.meta.screen?.admittedOn)}, outlines drawn by the owner's rule on ${thaiDate(model.meta.screen?.outlinedOn)}`))}</span><br>${names(scr)}</li>` : ''}
    </ul><div class="aha-actions"><button type="button" class="btn quiet" data-action="set-kind" data-value="added">${L('ดูย่านใหม่บนแผนที่', 'Show the new ones on the map')}</button>${scr.length ? `<button type="button" class="btn quiet" data-action="set-kind" data-value="screen">${L('ดูเฉพาะผลคัดย่านการค้า', 'Commercial screen only')}</button>` : ''}${lod.length ? `<button type="button" class="btn quiet" data-action="set-kind" data-value="lodging">${L('ดูเฉพาะย่านที่พัก', 'Lodging areas only')}</button>` : ''}</div>`);
}

/**
 * The registry's lodging screen for this neighbourhood (0.2.0): its status, the lodging places and the reported
 * rooms/units reached on foot, the services reached, the state of its draft outline. A blank figure is unknown, never 0.
 */
function lodgingSection(r, model) {
  const x = r.lodging, lm = model.meta.lodging;
  if (!x || !lm) return '';
  const st = lodgingStatus(x, model);
  const fig = v => (v == null ? `<span class="hint">${L('ยังไม่ทราบ', 'unknown')}</span>` : `<strong class="data-number">${num(v)}</strong>`);
  const svc = codes => (codes?.length ? codes.map(c => esc(EN ? lm.services?.[c]?.en || c : lm.services?.[c]?.th || c)).join(' · ') : `<span class="hint">${L('ยังไม่พบที่เดินถึง', 'none reached yet')}</span>`);
  const bd = x.bd != null ? (EN ? lm.boundariesEn?.[x.bd] : lm.boundaries?.[x.bd]) : '';
  const [w4, w8] = lm.walkM || [400, 800];
  return section('rank', L('ผลคัดย่านที่พักของทะเบียน', 'The registry\'s lodging screen'), esc(L('แบบจำลองเดินเท้า', 'walking model')),
    `<p class="lodging-status${st.held ? ' is-held' : ''}">${esc(st.label)}</p>
    <dl class="lodging-figures">
      <div><dt>${L('ที่พักที่เดินถึงใน', 'Lodging places reached within')} ${nw(esc(L(`${num(w4)} ม.`, `${num(w4)} m`)))}</dt><dd>${fig(x.h4)} <small>${L('แห่ง', 'places')}</small></dd></div>
      <div><dt>${L('ที่พักที่เดินถึงใน', 'Lodging places reached within')} ${nw(esc(L(`${num(w8)} ม.`, `${num(w8)} m`)))}</dt><dd>${fig(x.h8)} <small>${L('แห่ง', 'places')}</small></dd></div>
      <div><dt>${L('ห้อง/ยูนิตที่แหล่งรายงาน ใน', 'Rooms/units the sources report within')} ${nw(esc(L(`${num(w8)} ม.`, `${num(w8)} m`)))}</dt><dd>${fig(x.ru)}${x.rx ? ` <small>${esc(L(`+ ไม่ทราบจำนวนห้อง ${num(x.rx)} แห่ง`, `+ ${num(x.rx)} places with no room figure`))}</small>` : ''}</dd></div>
    </dl>
    <p class="lodging-services"><span class="hint">${esc(L(`บริการที่เดินถึงใน ${num(w4)} ม.`, `Services reached within ${num(w4)} m`))}</span> ${svc(x.sv4)}</p>
    ${bd ? `<p class="lodging-services"><span class="hint">${esc(L('ขอบของข้อเสนอ', 'Outline of the proposal'))}</span> ${esc(bd)}</p>` : ''}
    <p class="hint panel-foot provenance"><span class="prov-part" data-prov="dataset">${pic('dataset')}<span class="sr-only">${L('ชุดข้อมูล ', 'Dataset ')}</span>${esc(L(`${lm.title} ${num(lm.proposals)} ข้อเสนอ`, `${lm.titleEn}, ${num(lm.proposals)} proposals`))}</span> <span class="prov-part" data-prov="source"><span class="sr-only">${L('แหล่ง', 'Source')}</span>${esc(L(`จาก ทะเบียนย่านกลาง CityMETER · ทะเบียนที่พัก ${num(lm.sourceRecords)} รายการ`, `from the CityMETER central registry · ${num(lm.sourceRecords)} lodging records`))}</span><span class="prov-part" data-prov="date">${pic('date')}<span class="sr-only">${L('อ่าน ', 'Read ')}</span>${esc(thaiDate(lm.readOn))}</span><span class="prov-part" data-prov="boundary">${pic('area')}<span class="sr-only">${L('ขอบเขต ', 'Boundary ')}</span>${esc(EN ? lm.boundaryEn : lm.boundaryTh)}</span><span class="prov-part prov-method"><a href="${METHOD_URL}#2a" target="_blank" rel="noopener">${L('วิธีนับ', 'Method')}</a></span></p>`,
    'lodging-screen');
}

/** (0.2.4) The owner's amendment of a registry outline this row carries, if any (meta.amendments; DATA_METHOD.md §2b). */
export function amendmentOf(r, model) {
  return r?.amended ? (model?.meta?.amendments?.items || []).find(x => x.id === r.id) || null : null;
}
/** “A B และC” / “A, B and C”: the places an amended outline takes in, by the names OpenStreetMap gives them. */
export function placeList(names) {
  if (names.length < 2) return names.join('');
  return EN ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : `${names.slice(0, -1).join(' ')} และ${names.at(-1)}`;
}
function amendedOutlineWords(am) {
  // (0.3.0) redrawn by the owner's rule from the basemap (DATA_METHOD.md §2c): no named places, the rule in its words
  if (am.rule) {
    // industrial land is light ground for every place, and some places keep within limits the owner set (§2c, 18:1x)
    const ind = (am.rule.lightLanduse || []).includes('industrial'), lim = (am.rule.limits || []).length > 0;
    return L(`ฉบับร่าง ปรับเพิ่ม ${thaiDate(am.on)} ให้คลุมกลุ่มอาคารที่ต่อจากขอบเดิม ภายในพื้นที่ที่แผนที่ฐานไม่ได้ระบุเป็น${ind ? 'ป่า ทุ่ง น้ำ หรือพื้นที่อุตสาหกรรม' : 'ป่า ทุ่ง หรือน้ำ'}${lim ? ' และตามขอบที่เจ้าของกำหนด' : ''}${am.rule.shared ? ' แบ่งกับย่านข้างเคียงที่ครึ่งทาง' : ''} รอทะเบียนรับในรุ่นถัดไป ยังไม่ตรวจภาคสนาม`,
      `draft, extended on ${thaiDate(am.on)} to the buildings that run on from the old outline, within ground the basemap does not mark as ${ind ? 'forest, field, water or industrial land' : 'forest, field or water'}${lim ? ' and within limits the owner set' : ''}${am.rule.shared ? ', shared halfway with the neighbouring neighbourhoods' : ''}; awaiting the registry's next release; not yet walked`);
  }
  return L(`ฉบับร่าง ปรับเพิ่ม ${thaiDate(am.on)} ให้รวม${placeList(am.includes.map(x => x.th))} ตามหลักเกณฑ์ขอบย่าน รอทะเบียนรับในรุ่นถัดไป ยังไม่ตรวจภาคสนาม`,
    `draft, extended on ${thaiDate(am.on)} to take in ${placeList(am.includes.map(x => x.en || x.th))} under the registry's outline rules; awaiting the registry's next release; not yet walked`);
}

function registryDetails(d, model) {
  const r = d.row, am = amendmentOf(r, model);
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
      <dt>${L('ขอบ', 'Outline')}</dt><dd>${esc(am ? amendedOutlineWords(am) : r.kind === 'lodging' ? (model.meta.lodging?.admitted
    ? L(`ขอบร่างจากผลคัดย่านที่พัก รับเป็นรหัสกลาง ${thaiDate(model.meta.lodging.admittedOn)} รอตรวจตามหลักเกณฑ์ขอบย่าน ยังไม่ตรวจภาคสนาม`, `draft outline of the lodging screen; a central code since ${thaiDate(model.meta.lodging.admittedOn)}; awaiting the registry's outline rules; not yet walked`)
    : L('ขอบร่างจากผลคัดย่านที่พัก ทะเบียนยังไม่ออกรหัสกลาง ยังไม่ตรวจภาคสนาม', 'draft outline of the lodging screen; the registry has issued no central code; not yet walked'))
    : r.kind === 'screen' ? L(`ขอบร่างตามหลักที่เจ้าของกำหนด วาดจากจุดอ้างอิงของผลคัดย่านการค้า ${thaiDate(r.screen?.on)} ทะเบียนยังไม่รับขอบนี้ ยังไม่ตรวจภาคสนาม`, `draft outline drawn by the owner's rule from the commercial screen's reference point on ${thaiDate(r.screen?.on)}; not yet taken by the registry; not yet walked`)
    : r.fieldVerified ? L('ตรวจภาคสนามแล้ว', 'field-checked') : L('ฉบับร่าง ยังไม่ตรวจภาคสนาม', 'draft, not yet walked'))}</dd>
      ${r.aliases?.length ? `<dt>${L('ชื่ออื่น', 'Also called')}</dt><dd>${esc(r.aliases.join(' · '))}</dd>` : ''}
      ${r.roles?.length ? `<dt>${L('บทบาทที่ทะเบียนเสนอ', 'Proposed roles')}</dt><dd>${esc(r.roles.map(id => { const x = model.roles.find(y => y.id === id); return x ? (EN ? x.en : x.th) : id; }).join(' · '))}</dd>` : ''}
    </dl>${measures ? `<ul class="plain-list">${measures}</ul>` : ''}</details>`;
}

/**
 * d = js/profile.js#buildNeighborhood. inCompare: the row is in the compare set. around: decoded data/around.json (null
 * while it loads or when it did not load); distance: the reading of «ขอบเดินถึง» (`f.around`: in · 400 · 800).
 */
export function renderNeighborhood(d, model, {inCompare = false, compareFull = false, fillOf = () => '', ctx = {}, recordsHTML = '', around = null, distance = 'in', venueLogo = () => null} = {}) {
  const r = d.row, province = provinceName(r.province), am = amendmentOf(r, model);
  const top = d.highlights[0];
  const names = d.highlights.map(x => `<span class="hl-chip">${dsPic(x.ds)}${dsLabel(x.ds)}</span>`).join('');
  const cmp = inCompare
    ? `<button type="button" class="btn" data-action="cmp-remove" data-id="${esc(r.id)}" aria-pressed="true">${L('อยู่ในการเปรียบเทียบ', 'In the comparison')}</button>`
    : `<button type="button" class="btn primary" data-action="cmp-add" data-id="${esc(r.id)}"${compareFull ? ' disabled' : ''}>${L('เพิ่มในการเปรียบเทียบ', 'Add to the comparison')}</button>`;
  const aha = `<section class="aha is-auto detail-head" aria-label="${L('ข้อค้นพบ', 'Finding')}"><p class="eyebrow">${esc(r.kind === 'lodging' ? L(`ย่านที่พัก · ${province}`, `Lodging area · ${province}`) : r.kind === 'screen' ? L(`ย่านจากผลคัดย่านการค้า · ${province}`, `Commercial screen · ${province}`) : L(`ย่าน · ${province}`, `Neighbourhood · ${province}`))}</p>
    <h2 class="nb-title" tabindex="-1">${esc(r.name)}</h2>${kindBadges(r)}
    ${top ? `<p class="aha-lead">${L('เด่นเรื่อง', 'Stands out for')}</p><p class="hl-chips is-large">${names}</p>` : ''}
    ${fingerprint(model, r, around, {hl: new Set(d.highlights.map(x => x.ds.id))})}
    <div class="aha-actions">${cmp}</div></section>`;
  const metrics = `<section class="metrics compact" aria-label="${L('ตัวเลขของย่าน', 'Neighbourhood figures')}">
    ${metricTile(rai(r.areaM2), L('ไร่', 'rai'), 'area', r.kind === 'lodging' && !am ? L(`${km2Text(r.km2)} ตร.กม. ตามขอบร่างของผลคัดย่านที่พัก`, `${km2Text(r.km2)} km² per the lodging screen's draft outline`) : r.kind === 'screen' ? L(`${km2Text(r.km2)} ตร.กม. ตามขอบร่างที่วาดตามหลักของเจ้าของ`, `${km2Text(r.km2)} km² per the draft outline drawn by the owner's rule`) : am ? L(`${km2Text(r.km2)} ตร.กม. ตามขอบที่ปรับเพิ่ม ${thaiDate(am.on)}`, `${km2Text(r.km2)} km² per the outline extended on ${thaiDate(am.on)}`) : L(`${km2Text(r.km2)} ตร.กม. ตามทะเบียน`, `${km2Text(r.km2)} km² per the registry`))}
    ${metricTile(d.highlights.length, L('จุดเด่น', 'highlights'), 'rank')}
    ${metricTile(Object.values(r.c || {}).filter(n => n > 0).length, L('ชุดที่มีในย่าน', 'datasets present'), 'dataset', L(`จาก ${num(Object.keys(r.c || {}).length)} ชุดที่มีข้อมูลในจังหวัด`, `of ${num(Object.keys(r.c || {}).length)} with data in the province`))}
    ${metricTile(d.inProvince, L(`ย่านใน${province}`, `in ${province}`), 'province')}
  </section>`;
  const lodging = lodgingSection(r, model);
  // (0.4.0, D-5) the glance follows the neighbourhood's figures; «ขอบเดินถึง» takes the place of the dataset list
  return `${aha}${metrics}${glanceSection(r, model, around)}${r.kind === 'lodging' ? lodging : ''}${highlightsSection(d)}${togetherSection(d)}${r.kind === 'lodging' ? '' : lodging}${aroundSection(d, model, around, {distance, fillOf, venueLogo})}${recordsHTML}${similarSection(d, model, around)}
    ${actionBar({kind: 'neighborhood', name: r.name, province, point: {lat: r.ref[1], lon: r.ref[0]}})}
    ${registryDetails(d, model)}
    ${provenance(ctx, {boundary: r.kind === 'lodging' && !am ? L(`${r.name} · ขอบร่างของผลคัดย่านที่พัก ${rai(r.areaM2)} ไร่`, `${r.name} · draft outline of the lodging screen ${rai(r.areaM2)} rai`) : r.kind === 'screen' ? L(`${r.name} · ขอบร่างตามหลักของเจ้าของ ${thaiDate(r.screen?.on)} จาก OpenStreetMap ${rai(r.areaM2)} ไร่`, `${r.name} · draft outline by the owner's rule, ${thaiDate(r.screen?.on)}, from OpenStreetMap ${rai(r.areaM2)} rai`) : am ? L(`${r.name} · ขอบย่านฉบับร่าง ปรับเพิ่ม ${thaiDate(am.on)} จาก OpenStreetMap ${rai(r.areaM2)} ไร่`, `${r.name} · draft outline extended on ${thaiDate(am.on)} from OpenStreetMap ${rai(r.areaM2)} rai`) : L(`${r.name} · ขอบย่านฉบับร่าง ${rai(r.areaM2)} ไร่`, `${r.name} · draft outline ${rai(r.areaM2)} rai`)})}`;
}

/* ---------- compare ---------- */

/**
 * The compare matrix for the tray: datasets by pillar × neighbourhoods; a bar per cell (density against the densest of
 * the row), the densest cell marked in words for screen readers and with a ring.
 */
export function renderCompare(c, model, {max = 4, around = null} = {}) {
  if (!c.rows.length) {
    return `<div class="compare-empty"><p>${esc(L('เลือกย่านแล้วกด “เพิ่มในการเปรียบเทียบ” เพื่อวางเทียบกันได้ถึง 4 ย่าน', 'Open a neighbourhood and choose “Add to the comparison” to set up to 4 side by side'))}</p>
      <div class="aha-actions"><button type="button" class="btn quiet" data-action="cmp-top">${L('เทียบ 3 ย่านที่เด่นหลายด้าน', 'Compare the 3 most distinctive')}</button></div></div>`;
  }
  const head = c.rows.map(r => `<th scope="col" class="cmp-col"><button type="button" class="link-button" data-action="select-nb" data-id="${esc(r.id)}">${esc(r.name)}</button><small>${esc(provinceName(r.province))} · ${nw(`${rai(r.areaM2)} ${L('ไร่', 'rai')}`)}</small><button type="button" class="cmp-remove" data-action="cmp-remove" data-id="${esc(r.id)}" aria-label="${esc(`${L('เอาออกจากการเปรียบเทียบ', 'Remove from the comparison')} · ${r.name}`)}">×</button></th>`).join('');
  const hlRow = `<tr class="cmp-hl"><th scope="row">${L('จุดเด่น', 'Highlights')}</th>${c.rows.map(r => `<td>${highlightChips(r, model) || '<span class="hint">—</span>'}</td>`).join('')}</tr>`;
  const body = c.groups.map(g => `<tr class="cmp-group"><th scope="rowgroup" colspan="${c.rows.length + 1}"><span class="eyebrow-cue">${cueMarkup(PILLAR_SERIES[g.pillar])}${esc(g.pillar.toUpperCase())}</span></th></tr>${g.items.map(x => `<tr><th scope="row">${dsLabel(x.ds)}<small>${esc(dsUnit(x.ds))} · ${perKm2}</small></th>${x.cells.map((cell, i) => {
    if (cell.state === 'out_of_scope') return `<td class="is-out" title="${esc(L('ไม่มีข้อมูลชุดนี้ในจังหวัด', 'No data of this dataset in the province'))}"><span class="hint">—</span></td>`;
    const best = i === x.best;
    const w = x.max > 0 && cell.state === 'measured' ? Math.max(4, Math.round((cell.density / x.max) * 100)) : 0;
    return `<td class="${best ? 'is-best' : ''}${cell.state === 'measured_zero' ? ' is-zero' : ''}"><span class="cmp-count data-number">${num(cell.count)}</span><span class="cmp-density data-number">${cell.state === 'measured' ? dens(cell.density) : '0'}</span><span class="cmp-bar" aria-hidden="true"><span class="category-${PILLAR_SERIES[x.ds.group]}" style="width:${w}%"></span></span>${best && c.rows.length > 1 ? `<span class="sr-only">${L('แน่นที่สุดในกลุ่มที่เทียบ', 'densest of the compared')}</span>` : ''}</td>`;
  }).join('')}</tr>`).join('')}`).join('');
  const table = `<div class="table-scroll compare-scroll"><table class="compare-table"><caption class="sr-only">${L('เปรียบเทียบย่าน: จำนวนและความหนาแน่นต่อ ตร.กม. ของแต่ละชุดข้อมูล', 'Neighbourhood comparison: count and density per km² of each dataset')}</caption>
    <thead><tr><th scope="col" class="cmp-corner">${L('ชุดข้อมูล', 'Dataset')}<small>${L('จำนวน · ต่อ ตร.กม.', 'count · per km²')}</small></th>${head}</tr></thead>
    <tbody>${hlRow}${body}</tbody></table></div>
    <p class="hint">${esc(L('วงกรอบ = แน่นที่สุดในกลุ่มที่เทียบ', 'Ringed = densest of the compared'))}</p>`;
  // (0.6.0, §4.6) each neighbourhood keeps one shape: on its chip (which also takes it out), its row and its dots
  const chips = c.rows.map((r, k) => `<button type="button" class="cmp-chip" data-action="cmp-remove" data-id="${esc(r.id)}" aria-label="${esc(`${L('เอาออกจากการเปรียบเทียบ', 'Remove from the comparison')} · ${r.name}`)}">${shapeMark(k)}${esc(r.name)}<i aria-hidden="true">×</i></button>`).join('');
  const rows = c.rows.map((r, k) => ({row: r, hl: new Set((r.hl || []).map(h => h.d)), head: matrixHead(r, {small: `${provinceWords(r)} · ${areaWords(r)}`}).replace('<span class="mx-th">', `<span class="mx-th">${shapeMark(k)}`)}));
  const caption = L(`16 ชุดข้อมูลของ ${c.rows.map(r => r.name).join(' · ')}`, `${c.rows.map(r => r.name).join(' · ')} · the 16 datasets`);
  return `<div class="cmp-chips">${chips}</div>
    <div class="cmp-visual"><div class="cmp-matrix">${matrix(model, around, rows, {caption, answer: matrixAnswer(model, around, c.rows)})}${matrixLegend(model)}<p class="hint">${esc(levelScopeLine())}</p></div>${compareDots(model, c.rows)}</div>
    <details class="scope-details cmp-fold"><summary>${L('ตารางจำนวนและต่อ ตร.กม.', 'Counts and per km²')}</summary>${table}</details>
    ${c.rows.length < max ? `<p class="hint">${esc(L(`เพิ่มได้อีก ${num(max - c.rows.length)} ย่าน`, `${num(max - c.rows.length)} more can be added`))}</p>` : ''}
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
  return `<tr><th scope="row"><button type="button" class="row-name" data-action="select-nb" data-id="${esc(r.id)}">${esc(r.name)}</button>${kindWords(r)}</th><td>${esc(provinceName(r.province))}</td><td class="num data-number">${esc(rai(r.areaM2))}</td><td class="num data-number">${num(r.hl?.length || 0)}</td>${cells}</tr>`;
}
export function tableHeadHTML(model, lensId = '') {
  return `<tr><th scope="col">${L('ย่าน', 'Neighbourhood')}</th><th scope="col">${L('จังหวัด', 'Province')}</th><th scope="col" class="num">${L('พื้นที่ (ไร่)', 'Area (rai)')}</th><th scope="col" class="num">${L('จุดเด่น', 'Highlights')}</th>${model.datasets.map(ds => `<th scope="col" class="num${ds.id === lensId ? ' is-lens' : ''}" title="${esc(`${ds.group} · ${dsUnit(ds)}`)}"><span class="th-ds">${cueMarkup(PILLAR_SERIES[ds.group] || 9)}${esc(dsName(ds))}</span></th>`).join('')}</tr>`;
}

export function renderFilterChips(chips) {
  if (!chips.length) return '';
  return `<ul class="filter-chips" aria-label="${L('ตัวกรองที่ใช้', 'Active filters')}">${chips.map(c => `<li><button type="button" class="filter-chip" data-action="${esc(c.action)}"${c.id ? ` data-id="${esc(c.id)}"` : ''} aria-label="${esc(L(`ล้าง ${c.label}`, `Clear ${c.label}`))}">${esc(c.label)}<i aria-hidden="true">×</i></button></li>`).join('')}</ul>`;
}
