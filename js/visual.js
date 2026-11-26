/**
 * CityMETER · Commercial District — the visual-first parts of the panel (0.6.0; pure: HTML strings, no DOM, no map).
 *
 * Owner 2026-11-26 11:43, VERBATIM: “ทำตามที่เสนอให้ครบทุกข้อพร้อม publish” — every recommended option of the proposal
 * 02-CityMETER__commercialdistrict-visual-first-panel-proposal__v1__2026-11-26 (handoff/visual/decisions.json):
 *   the fingerprint of 16 cells (§4.1) · highlight cards (§4.2) · what comes together in one row each (§4.3) · the axes
 *   อยู่ · เที่ยว · ค้าขาย as cards in place of the table, the table folded under them (§4.9, D-V5, D-V7 A) · one matrix of
 *   neighbourhoods × 16 datasets wherever several neighbourhoods show together (§4.5) · the comparison as a dot chart
 *   (§4.6) · the first finding as a big number and bars (§4.7).
 * Rules kept (§6): nothing is added across datasets, neighbourhoods or distances (INV-01) — a key counts datasets in a
 * state, never records; a starred dataset (points for under 90 %, D-4) has no dot, level, colour or ring; the four value
 * states look different and an unknown is never 0; every rank shown says its peers by their number (INV-04); colours
 * are the 41 samples of an LDS LUT, the same HEX on both themes, never with opacity (INV-07; D-V1d: `count` for the level,
 * js/levels.js); every state has a mark that is not colour (a dot, a dashed edge, a hatch, a thick ring, a shape); every
 * picture has a reading that is not a picture (a table, a list, words for screen readers); every pictogram stands beside
 * its words, in a title or in a column key (LDS ICON-01).
 */
import {LANG} from './shell/i18n.js';
import {PILLARS, PILLAR_SERIES, num, dsName, dsUnit, dsUnitN, provinceName, rai, lowLocated} from './model.js';
import {cellOf, cellsOf, cellCounts, levelFill, levelModel} from './levels.js';
import {AXES, dsIcon, AXIS_LEAD_MIN} from './axes.js';
import {COUNT_SCALE, inkFor} from './scales.js';
import {cueMarkup} from './cues.js';

const EN = LANG === 'en';
const L = (th, en) => (EN ? en : th);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nw = html => `<span class="nowrap">${html}</span>`;
const pic = (role, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(role)}" aria-hidden="true"></i>`;
/** A dataset's pictogram (decorative: its name stands beside it, or in the title and words of its cell). */
export const dsPic = (ds, cls = '') => pic(dsIcon(ds), cls);
const round = v => Math.round(v);

/* ---------- words of a cell ---------- */

const levelWords = x => L(`ระดับ ${num(round(x.level))}/100 เทียบ ${num(x.n)} ย่านที่มีตั้งแต่ 3 ${dsUnit(x.ds)}`, `level ${num(round(x.level))}/100 among the ${num(x.n)} neighbourhoods with at least 3`);
const rankWords = x => L(`มากอันดับ ${num(x.countRank)}/${num(x.n)} · แน่นอันดับ ${num(x.densityRank)}/${num(x.n)}`, `count rank ${num(x.countRank)}/${num(x.n)} · density rank ${num(x.densityRank)}/${num(x.n)}`);
const countText = x => `${num(x.c.count)} ${dsUnitN(x.ds, x.c.count)}`;
const reachWords = d => L(`ขอบเดินถึง ${num(+d)} ม.`, `the ${num(+d)} m walkable edge`);

/** One cell in words: dataset, state, figure; for a ranked cell its level, its peers and both ranks (D-V1: the tooltip). */
export function cellWords(x, {hl = false} = {}) {
  const name = dsName(x.ds);
  let t;
  if (x.kind === 'ranked') t = `${name} ${countText(x)} · ${levelWords(x)} · ${rankWords(x)}`;
  else if (x.kind === 'few') t = `${name} ${countText(x)} · ${L('น้อยกว่า 3 ไม่จัดอันดับ', 'fewer than 3, not ranked')}`;
  else if (x.kind === 'starred') t = `${name} ${countText(x)}* · ${L('มีพิกัดไม่ถึง 90% ของรายการ ไม่จัดอันดับ', 'points for under 90% of its records, not ranked')}`;
  else if (x.kind === 'edge') t = `${name} ${L('ไม่พบในย่าน', 'none inside')} · ${L(`นอกขอบไม่เกิน 800 ม. ${num(x.r800)} ${dsUnitN(x.ds, x.r800)}`, `${num(x.r800)} ${dsUnitN(x.ds, x.r800)} outside within 800 m`)}`;
  else if (x.kind === 'zero') t = `${name} ${x.edgeKnown ? L('ไม่พบในย่านและขอบเดินถึง 800 ม.', 'none inside or within the 800 m walkable edge') : L(`ไม่พบในย่าน (0 ${dsUnit(x.ds)})`, `none inside (0 ${dsUnit(x.ds)})`)}`;
  else t = `${name} ${L('ไม่มีข้อมูลในจังหวัดนี้', 'no data in this province')}`;
  return hl ? `${t} · ${L('จุดเด่นของย่าน', 'a highlight of this neighbourhood')}` : t;
}

/**
 * A cell in short words for a screen reader inside the matrix, where the column header names the dataset and the row
 * header the neighbourhood: the figure and the level, or the state. The full words (both ranks, the peers) are the
 * readout's, written on demand (js/app.js#matrixReadout).
 */
export function cellShort(x, {hl = false} = {}) {
  let t;
  if (x.kind === 'ranked') t = `${countText(x)} · ${L(`ระดับ ${num(round(x.level))}/100`, `level ${num(round(x.level))}/100`)}`;
  else if (x.kind === 'few') t = `${countText(x)} · ${L('ไม่จัดอันดับ', 'not ranked')}`;
  else if (x.kind === 'starred') t = `${countText(x)}* · ${L('ไม่จัดอันดับ', 'not ranked')}`;
  else if (x.kind === 'edge') t = L('เฉพาะนอกขอบ ≤800 ม.', 'only beyond the edge ≤800 m');
  else if (x.kind === 'zero') t = L('ไม่พบ', 'none');
  else t = L('ไม่มีข้อมูลในจังหวัด', 'no data in the province');
  return hl ? `${t} · ${L('จุดเด่น', 'highlight')}` : t;
}

/** A cell's state in a few words, for a list read aloud (the comparison's dots). */
export function stateWords(x) {
  if (x.kind === 'ranked') return L(`ระดับ ${num(round(x.level))}`, `level ${num(round(x.level))}`);
  if (x.kind === 'few') return `${countText(x)} ${L('ไม่จัดอันดับ', 'not ranked')}`;
  if (x.kind === 'starred') return `${countText(x)}* ${L('ไม่จัดอันดับ', 'not ranked')}`;
  if (x.kind === 'edge' || x.kind === 'zero') return L('ไม่พบในย่าน', 'none inside');
  return L('ไม่มีข้อมูลในจังหวัด', 'no data in the province');
}

/* ---------- the fingerprint (§4.1) ---------- */

function fpCell(x, {lg = false, hl = false, title = true} = {}) {
  const fill = x.kind === 'ranked' ? levelFill(x.level) : '';
  const style = fill ? ` style="background:${fill}${lg ? `;color:${inkFor(fill)}` : ''}"` : '';
  return `<span class="fp-cell k-${x.kind}${hl ? ' is-hl' : ''}"${style}${title ? ` title="${esc(cellWords(x, {hl}))}"` : ''}>${lg ? dsPic(x.ds) : ''}</span>`;
}

/** A number of datasets with its unit: a key counts datasets, never records (INV-01). */
const dsCount = n => L(`${num(n)} ชุด`, `${num(n)} ${n === 1 ? 'dataset' : 'datasets'}`);

/** The parts of a fingerprint's key in words, each number with its unit (the visible key and the image's name). */
function keyWords(n, around) {
  return [
    {kinds: ['ranked', 'few'], words: L(`ในย่าน ${dsCount(n.in)}`, `inside: ${dsCount(n.in)}`)},
    n.edge ? {kinds: ['edge'], words: L(`เฉพาะขอบเดินถึง 800 ม. ${dsCount(n.edge)}`, `only within the 800 m walkable edge: ${dsCount(n.edge)}`)} : null,
    n.zero ? {kinds: ['zero'], words: around ? L(`ไม่พบ ${dsCount(n.zero)}`, `none: ${dsCount(n.zero)}`) : L(`ไม่พบในย่าน ${dsCount(n.zero)}`, `none inside: ${dsCount(n.zero)}`)} : null,
    n.out ? {kinds: ['out'], words: L(`ไม่มีข้อมูลในจังหวัด ${dsCount(n.out)}`, `no data in the province: ${dsCount(n.out)}`)} : null,
  ].filter(Boolean);
}

/** The key of a fingerprint: how many datasets in each state (a number of datasets, never of records: INV-01). */
export function fingerprintKey(cells, {around = true} = {}) {
  const swatch = kind => `<span class="fp-cell mini k-${kind}"${kind === 'ranked' ? ` style="background:${COUNT_SCALE.lut[30]}"` : ''} aria-hidden="true"></span>`;
  return `<p class="fp-key">${keyWords(cellCounts(cells), around).map(p => `<span>${p.kinds.map(swatch).join('')}${p.words}</span>`).join('')}</p>`;
}

/**
 * The 16 cells of a neighbourhood in the order of the datasets (Land 4 · Location 7 · Living 5, D-V7b), one group per
 * pillar. Large: each cell carries its dataset's pictogram and its words in a title; the whole reads as one image whose
 * name is the key (the axes below list every dataset by name).
 */
export function fingerprint(model, row, around, {hl = new Set(), label = ''} = {}) {
  const cells = cellsOf(model, row, around);
  const groups = PILLARS.map(p => `<span class="fp-group" data-pillar="${p}">${cells.filter(x => x.ds.group === p).map(x => fpCell(x, {lg: true, hl: hl.has(x.ds.id)})).join('')}</span>`).join('');
  const name = label || `${L('ลายนิ้วมือ 16 ชุดข้อมูลของย่าน:', 'Fingerprint of the 16 datasets:')} ${keyWords(cellCounts(cells), Boolean(around)).map(p => p.words).join(' · ')}`;
  return `<div class="fp-head"><span class="fp fp-lg" role="img" aria-label="${esc(name)}">${groups}</span>${fingerprintKey(cells, {around: Boolean(around)})}</div>`;
}

/* ---------- the matrix: neighbourhoods × 16 datasets (§4.5) ---------- */

const RAMP_WORDS = () => L('น้อย·บาง → มาก·แน่น', 'few·sparse → many·dense');

/** The legend of the matrix: the states in words (never numbers), the ring, the column key (LDS ICON-01: names beside pictograms). */
export function matrixLegend(model, {columns = true} = {}) {
  const swatch = (kind, fill = '', hl = false) => `<span class="fp-cell k-${kind}${hl ? ' is-hl' : ''}"${fill ? ` style="background:${fill}"` : ''} aria-hidden="true"></span>`;
  const states = `<ul class="mx-legend">
    <li>${swatch('ranked', COUNT_SCALE.lut[6])}${swatch('ranked', COUNT_SCALE.lut[20])}${swatch('ranked', COUNT_SCALE.lut[36])}${esc(RAMP_WORDS())}</li>
    <li>${swatch('few')}${L('มี แต่ไม่จัดอันดับ', 'present, not ranked')}</li>
    <li>${swatch('edge')}${L('เฉพาะนอกขอบ ≤800 ม.', 'only beyond the edge ≤800 m')}</li>
    <li>${swatch('zero')}${L('ไม่พบ', 'none')}</li>
    <li>${swatch('out')}${L('ไม่มีข้อมูลในจังหวัด', 'no data in the province')}</li>
    <li>${swatch('ranked', COUNT_SCALE.lut[36], true)}${L('กรอบหนา = จุดเด่นของย่าน', 'thick ring = a highlight')}</li></ul>`;
  const cols = columns ? `<p class="mx-cols">${PILLARS.map(p => `<span class="mx-cols-group"><b class="eyebrow-cue">${cueMarkup(PILLAR_SERIES[p])}${esc(p.toUpperCase())}</b> ${model.datasets.filter(d => d.group === p).map(d => nw(`${dsPic(d)}${esc(dsName(d))}`)).join(' · ')}</span>`).join('')}</p>` : '';
  return `${states}${cols}`;
}

/**
 * A matrix of neighbourhoods. rows: [{row, head (HTML of the row header), hl (Set of highlighted dataset ids), self}];
 * the header row names every dataset by pictogram, title and words for screen readers; every cell has its words (the
 * screen reader's and the readout's) and a title; `answer`: the line that reads the matrix first, as the 7×24 grid of
 * «รอบศูนย์นี้» does; `caption`: what the table holds.
 */
export function matrix(model, around, rows, {caption = '', answer = '', sub = null} = {}) {
  const ds = model.datasets;
  const gap = j => (j && ds[j].group !== ds[j - 1].group ? ' mx-gap' : '');
  const head = `<tr><td class="mx-corner"></td>${ds.map((d, j) => `<th scope="col" class="mx-h${gap(j)}" title="${esc(`${dsName(d)} · ${d.group}`)}">${dsPic(d, 'mx-ico')}<span class="sr-only">${esc(dsName(d))}</span></th>`).join('')}</tr>`;
  const body = rows.map((x, i) => {
    const cells = cellsOf(model, x.row, around);
    const tds = cells.map((c, j) => {
      const hl = x.hl?.has(c.ds.id) || false;
      return `<td class="mx-c${gap(j)}" tabindex="${i === 0 && j === 0 ? 0 : -1}">${fpCell(c, {hl, title: false})}<span class="sr-only">${esc(cellShort(c, {hl}))}</span></td>`;
    }).join('');
    const extra = sub ? sub(x) : '';
    return `<tr class="mx-r${x.self ? ' is-self' : ''}" data-nb="${esc(x.row.id)}"><th scope="row" class="mx-row">${x.head}</th>${tds}</tr>${extra ? `<tr class="mx-sub"><td colspan="${ds.length + 1}">${extra}</td></tr>` : ''}`;
  }).join('');
  return `${answer ? `<p class="mx-answer">${answer}</p>` : ''}<div class="mx-wrap"><table class="mx">${caption ? `<caption class="sr-only">${esc(caption)}</caption>` : ''}<thead>${head}</thead><tbody>${body}</tbody></table></div>
    <p class="mx-readout hint" aria-live="polite"></p>`;
}

/** The answer line of a few neighbourhoods side by side: the datasets where every one of them stands above 50 (D-V1c). */
export function matrixAnswer(model, around, list) {
  if (list.length < 2) return '';
  const both = model.datasets.filter(ds => list.every(r => { const x = cellOf(model, r, ds, around); return x.kind === 'ranked' && x.level > 50; }));
  if (!both.length) return '';
  const peers = ds => levelModel(model).get(ds.id)?.n || 0;
  return `${esc(L(`ทั้ง ${num(list.length)} ย่านได้ระดับเกิน 50 จาก 100 ใน:`, `All ${num(list.length)} neighbourhoods are above level 50 of 100 in:`))} ${both.map(ds => `${nw(`${dsPic(ds)}${esc(dsName(ds))}`)} <small>${esc(L(`(เทียบ ${num(peers(ds))} ย่าน)`, `(among ${num(peers(ds))})`))}</small>`).join(' · ')}`;
}

/** The scope line under a matrix or a row of dots (D-V1c: one value everywhere; D-V1d: a level, not a total). */
export const levelScopeLine = ({touch = true} = {}) => L(`สี = ระดับ (จำนวนกับความแน่นเฉลี่ยกัน) เทียบย่านที่มีชุดนั้นตั้งแต่ 3 รายการ ไม่ใช่ผลรวม${touch ? ' · ชี้หรือแตะช่อง หรือกดปุ่มลูกศรในตาราง เพื่อดูตัวเลขและอันดับ' : ''}`,
  `Colour = level (count and density averaged) among the neighbourhoods with at least 3 records of the dataset, not a total${touch ? ' · point at or tap a cell, or use the arrow keys in the table, for its figures and ranks' : ''}`);

/* ---------- the axes อยู่ · เที่ยว · ค้าขาย (§4.9, D-V7 A) ---------- */

const reachOf = (x, distance) => (distance === '400' ? x.r400 : distance === '800' ? x.r800 : null);

/** A row of a dataset on its axis: name (sets the map's lens), a track with the dot at its level, the count, k/N, its demo. */
function axisRow(x, {distance, hl, demo, edgeRow = false}) {
  const name = `${dsPic(x.ds)}<span class="ax-name">${esc(dsName(x.ds))}${lowLocated(x.ds) ? '<sup aria-hidden="true">*</sup>' : ''}</span>`;
  const title = L(`ระบายสีย่านบนแผนที่ตาม${x.ds.nameTh}`, `Colour the neighbourhoods on the map by ${dsName(x.ds)}`);
  const button = `<button type="button" class="ax-ds" id="axis-${esc(x.ds.id)}" data-action="set-lens" data-value="${esc(x.ds.id)}" title="${esc(title)}">${name}</button>`;
  const reach = reachOf(x, distance);
  const chip = reach ? `<span class="edge-chip" title="${esc(L(`นอกขอบไม่เกิน ${num(+distance)} ม. ${num(reach)} ${dsUnitN(x.ds, reach)} ไม่รวมกับในย่าน`, `${num(reach)} ${dsUnitN(x.ds, reach)} outside within ${num(+distance)} m, never added to the inside`))}">${num(reach)}</span>` : '';
  let track, val, sr = '';
  if (edgeRow) {
    track = '<span class="ax-track is-empty" aria-hidden="true"></span>';
    val = `<b class="data-number">0</b> <small>${esc(L('ในย่าน', 'inside'))}</small>${chip}`;
    sr = L(`ในย่าน 0 · นอกขอบไม่เกิน ${num(+distance)} ม. ${num(reach)} ${dsUnitN(x.ds, reach)}`, `0 inside · ${num(reach)} ${dsUnitN(x.ds, reach)} outside within ${num(+distance)} m`);
  } else {
    const dot = x.kind === 'ranked' ? `<b class="ax-dot" style="left:${x.level.toFixed(1)}%;background:${levelFill(x.level)}" title="${esc(`${dsName(x.ds)} · ${levelWords(x)} · ${rankWords(x)}`)}"></b>` : '';
    track = `<span class="ax-track" aria-hidden="true"><i class="ax-mid"></i>${dot}</span>`;
    val = `<b class="data-number">${num(x.c.count)}</b> <small>${esc(dsUnitN(x.ds, x.c.count))}</small>${chip}${x.kind === 'ranked' ? `<small class="ax-rank data-number">${num(x.rank)}/${num(x.n)}</small>` : ''}`;
    sr = x.kind === 'ranked' ? `${L(`ระดับ ${num(round(x.level))} จาก 100 อันดับ ${num(x.rank)} จาก ${num(x.n)} ย่าน`, `level ${num(round(x.level))} of 100, rank ${num(x.rank)} of ${num(x.n)} neighbourhoods`)} · ${rankWords(x)}${reach ? ` · ${L(`นอกขอบไม่เกิน ${num(+distance)} ม. ${num(reach)}`, `${num(reach)} outside within ${num(+distance)} m`)}` : ''}`
      : x.kind === 'starred' ? L('มีพิกัดไม่ถึง 90% ของรายการ ไม่จัดอันดับ', 'points for under 90% of its records, not ranked') : L('น้อยกว่า 3 ไม่จัดอันดับ', 'fewer than 3, not ranked');
    if (reach && x.kind !== 'ranked') sr += ` · ${L(`นอกขอบไม่เกิน ${num(+distance)} ม. ${num(reach)}`, `${num(reach)} outside within ${num(+distance)} m`)}`;
  }
  const link = demo ? `<a class="ax-demo" href="${esc(demo.href)}" title="${esc(demo.title)}" aria-label="${esc(demo.title)}"><span class="nav-icon" aria-hidden="true"></span></a>` : '<span class="ax-demo" aria-hidden="true"></span>';
  return `<li class="ax-row k-${edgeRow ? 'edge' : x.kind}${hl ? ' is-hl' : ''}">${button}${track}<span class="ax-val">${val}</span>${link}<span class="sr-only">${esc(sr)}${hl ? ` · ${esc(L('จุดเด่นของย่าน', 'a highlight of this neighbourhood'))}` : ''}</span></li>`;
}

/**
 * The axis cards of a neighbourhood: per axis a title, its meaning, a “?” for the indicators it has no data for yet, the
 * line “ระดับสูง:” (datasets at level ≥ 75, only when there is one; “เด่น” stays the highlights' word, D-V2), a row per dataset present inside (and, at 400 or 800 m,
 * those found only beyond the edge), then one line of those found nowhere and one of those with no data in the province.
 * demoOf(ds) → {href, title} of the dataset's own demo at the neighbourhood's province.
 */
export function axisCards(model, row, around, {distance = 'in', hl = new Set(), demoOf = () => null} = {}) {
  const byId = new Map(cellsOf(model, row, around).map(x => [x.ds.id, x]));
  return AXES.map(a => {
    const rows = [], edgeRows = [], none = [], out = [], lead = [];
    for (const id of a.datasets) {
      const x = byId.get(id);
      if (!x) continue;
      if (x.kind === 'out') { out.push(x); continue; }
      if (x.kind === 'edge' || x.kind === 'zero') {
        if (distance !== 'in' && reachOf(x, distance) > 0) edgeRows.push(axisRow(x, {distance, demo: demoOf(x.ds), edgeRow: true}));
        else none.push(x);
        continue;
      }
      if (x.kind === 'ranked' && x.level >= AXIS_LEAD_MIN) lead.push(x);
      rows.push(axisRow(x, {distance, hl: hl.has(id), demo: demoOf(x.ds)}));
    }
    const names = list => list.map(x => nw(`${dsPic(x.ds)}${esc(dsName(x.ds))}${x.kind !== 'out' && lowLocated(x.ds) ? '<sup aria-hidden="true">*</sup>' : ''}`)).join(' · ');
    const pend = a.pending.map(p => L(p.th, p.en)).join(' · ');
    const title = `<h4 class="ax-title" id="ax-${a.id}">${pic(a.icon, 'ax-ico')}<b id="ax-${a.id}-name">${esc(L(a.th, a.en))}</b><span class="hint">${esc(L(...a.meaning))}</span><span class="ax-pend" title="${esc(L(`ยังไม่มีข้อมูล: ${pend}`, `No data yet: ${pend}`))}"><span aria-hidden="true">?</span><span class="sr-only">${esc(L(`ตัวชี้วัดที่ยังไม่มีข้อมูล: ${pend}`, `Indicators with no data yet: ${pend}`))}</span></span></h4>`;
    const leadLine = lead.length ? `<p class="ax-lead">${esc(L('ระดับสูง:', 'High level:'))} ${lead.map(x => esc(dsName(x.ds))).join(' · ')}</p>` : '';
    const list = rows.length || edgeRows.length ? `<ul class="ax-rows" aria-labelledby="ax-${a.id}-name">${rows.join('')}${edgeRows.length ? `<li class="ax-sub">${esc(L(`พบเฉพาะนอกขอบ ไม่เกิน ${num(+distance)} ม.`, `Only beyond the edge, within ${num(+distance)} m`))}</li>${edgeRows.join('')}` : ''}</ul>` : '';
    const noneLine = none.length ? `<p class="ax-line"><span class="ax-line-head">${esc(distance === 'in' ? L('ไม่พบในย่าน', 'None inside') : L(`ไม่พบในย่านและ${reachWords(distance)}`, `None inside or within ${reachWords(distance)}`))}</span> ${names(none)}</p>` : '';
    const outLine = out.length ? `<p class="ax-line"><span class="ax-line-head">${esc(L('ไม่มีข้อมูลในจังหวัด', 'No data in the province'))}</span> ${names(out)}</p>` : '';
    return `<section class="ax-card" data-axis="${a.id}" aria-labelledby="ax-${a.id}-name">${title}${leadLine}${list}${noneLine}${outLine}</section>`;
  }).join('');
}

/** The key of the axis cards (symbols and what they mark; a legend, not a caveat). */
export function axisKey({distance = 'in', hl = false, star = false} = {}) {
  const parts = [
    `<span><b class="ax-dot key" style="background:${COUNT_SCALE.lut[30]}" aria-hidden="true"></b>${esc(L('จุด = ระดับ 0–100 (จำนวนกับความแน่นเฉลี่ยกัน) เทียบย่านที่มีตั้งแต่ 3 รายการ · k/N = อันดับจาก N ย่าน · ไม่มีจุด = ไม่จัดอันดับ · ระดับสูง = ระดับ 75 ขึ้นไป',
      'Dot = level 0–100 (count and density averaged) among the neighbourhoods with at least 3 records · k/N = rank of N · no dot = not ranked · High level = 75 or more'))}</span>`,
    distance !== 'in' ? `<span><i class="edge-chip key" aria-hidden="true">n</i>${esc(L(`= นอกขอบไม่เกิน ${num(+distance)} ม. ไม่รวมกับในย่าน`, `= outside within ${num(+distance)} m, never added to the inside`))}</span>` : '',
    hl ? `<span><b class="ax-dot key is-hl-key" aria-hidden="true"></b>${esc(L('กรอบหนา = จุดเด่นของย่าน', 'thick ring = a highlight of this neighbourhood'))}</span>` : '',
    `<span><i class="ax-pend key" aria-hidden="true">?</i>${esc(L('= ตัวชี้วัดที่ยังไม่มีข้อมูล (ชื่ออยู่ในส่วนพับ)', '= indicators with no data yet (named in the closed part)'))}</span>`,
    star ? `<span>${esc(L('* = มีพิกัดไม่ถึง 90% ของรายการ: แสดงจำนวน ไม่จัดอันดับ', '* = points for under 90% of the records: count shown, no rank'))}</span>` : '',
  ].filter(Boolean);
  return `<p class="hint ax-key">${parts.join('')}</p>`;
}

/** What the closed part says before the full table: how to read the axes, and the indicators each has no data for yet. */
export function axisFoldIntro(model) {
  const read = L('จุดของแต่ละชุดคือระดับ 0–100 ค่าเฉลี่ยของระดับจำนวนกับระดับความแน่น (ต่อ ตร.กม.) แต่ละระดับเป็นอันดับแบบ mid-rank เทียบย่านทั่วประเทศที่มีชุดนั้นตั้งแต่ 3 รายการ ระดับนี้ไม่ใช่จำนวนรวม ตัวเลข k/N คืออันดับของระดับนี้และจำนวนย่านที่เทียบ ชี้จุดเพื่อดูอันดับจำนวนและอันดับความแน่นแยกกัน สีแผนที่ใต้ชุดข้อมูลวัดความแน่นเทียบย่านในมุมมองปัจจุบัน จึงต่างจากจุดนี้ได้ ชุดข้อมูลละหนึ่งแกนหลัก และไม่มีคะแนนรวมของแกน',
    'Each dataset’s dot is a level 0–100: the mean of its count level and its density level (per km²), each a mid-rank among the neighbourhoods nationwide with at least 3 records of the dataset; a level, never a total. k/N is the rank of that level among N neighbourhoods; point at a dot for the count rank and the density rank. The map’s colour under a dataset is density among the neighbourhoods in view, so it can differ from the dot. Each dataset sits on one main axis; an axis has no score or total.');
  const pend = AXES.map(a => `<li><b>${pic(a.icon)}${esc(L(a.th, a.en))}</b> ${a.pending.map(p => `${esc(L(p.th, p.en))} <small class="hint">(${esc(L(...p.source))})</small>`).join(' · ')}</li>`).join('');
  return `<p>${esc(read)}</p><p class="pillar-label">${esc(L('ตัวชี้วัดที่ยังไม่มีข้อมูลในรุ่นนี้ และแหล่งเปิดหรือของ CityMETER ที่ตรวจไว้', 'Indicators with no data in this release, and the open or CityMETER sources looked at'))}</p><ul class="plain-list ax-pending">${pend}</ul>`;
}

/* ---------- the comparison as dots (§4.6) ---------- */

const SHAPES = ['circle', 'triangle', 'square', 'diamond'];
const SHAPE_WORDS = {circle: ['วงกลม', 'circle'], triangle: ['สามเหลี่ยม', 'triangle'], square: ['สี่เหลี่ยม', 'square'], diamond: ['ข้าวหลามตัด', 'diamond']};
const f1 = v => v.toFixed(1);
function marker(shape, x, y, r = 5.5) {
  if (shape === 'circle') return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}"/>`;
  if (shape === 'square') return `<rect x="${f1(x - r + 0.8)}" y="${f1(y - r + 0.8)}" width="${f1(2 * r - 1.6)}" height="${f1(2 * r - 1.6)}"/>`;
  if (shape === 'triangle') return `<path d="M${f1(x)} ${f1(y - r - 0.5)}L${f1(x + r + 0.5)} ${f1(y + r - 0.5)}L${f1(x - r - 0.5)} ${f1(y + r - 0.5)}z"/>`;
  return `<path d="M${f1(x)} ${f1(y - r - 1)}L${f1(x + r + 1)} ${f1(y)}L${f1(x)} ${f1(y + r + 1)}L${f1(x - r - 1)} ${f1(y)}z"/>`;
}

/** The shape of the k-th compared neighbourhood, as a small picture beside its name (its mark that is not colour). */
export const shapeMark = k => `<svg class="cmp-shape" viewBox="-7 -7 14 14" width="12" height="12" aria-hidden="true">${marker(SHAPES[k], 0, 0, 5)}</svg>`;

/**
 * One row per dataset that at least one compared neighbourhood ranks; per neighbourhood a shape (its mark that is not
 * colour) in its own lane, placed and coloured by the level; a dashed line at 50. The rows also stand as a list for
 * screen readers.
 */
export function compareDots(model, rows) {
  if (!rows.length) return '';
  const ids = model.datasets.filter(ds => rows.some(r => cellOf(model, r, ds).kind === 'ranked'));
  if (!ids.length) return `<p class="hint">${esc(L('ไม่มีชุดข้อมูลที่ย่านใดในกลุ่มนี้จัดอันดับได้: ตัวเลขอยู่ในตาราง', 'No dataset ranks any of these neighbourhoods: the figures are in the table'))}</p>`;
  const x0 = 132, x1 = 372, rowh = 26, top = 8, h = top + rowh * ids.length + 8;
  const svg = [`<svg class="cmp-dots" viewBox="0 0 380 ${h}" width="380" height="${h}" aria-hidden="true">`, `<line class="cd-mid" x1="${(x0 + x1) / 2}" x2="${(x0 + x1) / 2}" y1="${top - 4}" y2="${h - 6}"/>`];
  const list = [];
  ids.forEach((ds, j) => {
    const y = top + rowh * j + rowh / 2;
    svg.push(`<text class="cd-label" x="${x0 - 8}" y="${f1(y + 4)}" text-anchor="end">${esc(dsName(ds))}</text><line class="cd-track" x1="${x0}" x2="${x1}" y1="${f1(y)}" y2="${f1(y)}"/>`);
    const said = [];
    rows.forEach((r, k) => {
      const x = cellOf(model, r, ds);
      if (x.kind !== 'ranked') { said.push(`${r.name} · ${stateWords(x)}`); return; }
      const px = x0 + ((x1 - x0) * x.level) / 100, ly = y + (k - (rows.length - 1) / 2) * 4.5;
      svg.push(`<g class="cd-m" style="fill:${levelFill(x.level)}"><title>${esc(`${r.name} · ${dsName(ds)} · ${levelWords(x)} · ${rankWords(x)}`)}</title>${marker(SHAPES[k], px, ly)}</g>`);
      said.push(`${r.name} · ${stateWords(x)}`);
    });
    // names between separators: an English page keeps the Thai names whole, never inside an English sentence
    list.push(`<li>${esc(dsName(ds))} · ${esc(said.join(' · '))}</li>`);
  });
  svg.push('</svg>');
  const legend = rows.map((r, k) => `<span class="cd-key"><svg viewBox="-7 -7 14 14" width="14" height="14" aria-hidden="true"><g class="cd-m" style="fill:${COUNT_SCALE.lut[24]}">${marker(SHAPES[k], 0, 0, 5)}</g></svg>${esc(r.name)}<span class="sr-only"> (${esc(L(...SHAPE_WORDS[SHAPES[k]]))})</span></span>`).join('');
  return `<div class="cmp-dots-wrap"><p class="cd-legend">${legend}</p>${svg.join('')}<ul class="sr-only">${list.join('')}</ul>
    <p class="hint">${esc(L('ขวาและสีเข้ม = ระดับสูงกว่า เทียบย่านที่มีชุดนั้นตั้งแต่ 3 รายการ · เส้นประ = 50 · รูปทรงบอกย่าน · ชุดที่ไม่มีย่านใดจัดอันดับได้อยู่ในตาราง',
      'Right and darker = a higher level, among the neighbourhoods with at least 3 records of the dataset · dashed line = 50 · the shape names the neighbourhood · datasets none of them ranks are in the table'))}</p></div>`;
}

/* ---------- small helpers for panel.js ---------- */

/** A row header of the matrix: the name (a button that opens it, unless it is the open one) and a small line under it. */
export function matrixHead(row, {self = false, small = '', rank = null} = {}) {
  const inner = `<span class="mx-name">${esc(row.name)}</span>${small ? `<small>${small}</small>` : ''}`;
  const who = self ? `<span class="mx-who is-self">${inner}</span>` : `<button type="button" class="mx-who mx-nb" data-action="select-nb" data-id="${esc(row.id)}">${inner}</button>`;
  return `<span class="mx-th">${rank != null ? `<span class="mx-rank data-number" aria-hidden="true">${num(rank)}</span>` : ''}${who}</span>`;
}

/** “1,261 ไร่” — a row's area for the small line of a matrix header. */
export const areaWords = r => nw(`${rai(r.areaM2)} ${L('ไร่', 'rai')}`);
export const provinceWords = r => esc(provinceName(r.province));
