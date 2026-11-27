/**
 * CityMETER · Commercial District — «ความเป็นย่าน», the three levels of a neighbourhood as one triangle (0.7.10; pure).
 *
 * Owner 2026-11-27 18:05 (VERBATIM): “และ x-y plot แสดงความเป็นย่าน แต่รอบนี้ควรเป็น น่าอยู่ น่าเที่ยว น่าค้าขาย ทำยังไงดีมี
 * 3 แกน”; on Claude's questions he chose «คนอยู่ · ผู้มาเยือน · ศูนย์และตลาด (แนะนำ)» for the value of each axis (D-V11)
 * and «สามเหลี่ยมระดับ (แนะนำ)» for the chart (D-V12; handoff/visual/decisions.json, DATA_METHOD.md §18).
 *
 * The Shopping Center page places a centre on two ranks, people living and people working nearby, and names its quarter
 * (montri-th/shoppingcenter js/venue-locale.js compareBlock). Here the three corners are อยู่ · เที่ยว · ค้าขาย, each read by
 * a level the tiles of «ใครอยู่ตรงนี้» already print at the same distance (data/character.json from data/people): คนอยู่
 * (modelled) · ผู้มาเยือนค้างคืน (modelled) · ศูนย์และตลาด (counted). They are the corners' measures, not scores of
 * น่าอยู่ · น่าเที่ยว · น่าค้าขาย: the topic rows below keep no score, total or rank per axis (D-V6b). The three are never
 * added. The middle ring is the reference set's middle level (50) and the band its middle half (25–75), by construction
 * of a mid-rank percentile; the type is which corners reach 50 (8 types, an interpretation, as the quarters there); the
 * five nearest neighbourhoods are the closest on the three levels — never alike in shoppers, sales or a better location.
 * No url(#…) anywhere (the guard of 0.7.9), width and height beside the viewBox.
 */
import {LANG} from './shell/i18n.js';
import {num} from './model.js';
import {pctFill} from './around.js';

const EN = LANG === 'en';
const L = (th, en) => (EN ? en : th);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pic = (role, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(role)}" aria-hidden="true"></i>`;

export const CHARACTER_SCHEMA = 'citymeter-commercialdistrict-character/1';
/** The corner the split at the middle level reads (the Shopping Center page's quarters split at 50 too). */
export const SPLIT = 50;
/** The corners in the owner's order (อยู่ · เที่ยว · ค้าขาย), the measure each reads, its tile's icon and its direction. */
export const CORNERS = Object.freeze([
  Object.freeze({key: 'res', th: 'อยู่', en: 'Live', icon: 'home', of: ['คนอยู่', 'people living here'], tag: ['แบบจำลอง', 'modelled'], deg: -90}),
  Object.freeze({key: 'gst', th: 'เที่ยว', en: 'Visit', icon: 'luggage', of: ['ผู้มาเยือนค้างคืน', 'overnight visitors'], tag: ['แบบจำลอง', 'modelled'], deg: 150}),
  Object.freeze({key: 'ctr', th: 'ค้าขาย', en: 'Trade', icon: 'venue', of: ['ศูนย์และตลาด', 'centres and markets'], tag: ['นับ', 'counted'], deg: 30}),
]);
/** The eight types, keyed by which corners reach the split (อยู่ เที่ยว ค้าขาย as 1 or 0). */
export const TYPES = Object.freeze({
  111: Object.freeze(['ครบสามด้าน', 'All three']), 110: Object.freeze(['อยู่ + เที่ยว', 'Live + visit']), 101: Object.freeze(['อยู่ + ค้าขาย', 'Live + trade']),
  '011': Object.freeze(['เที่ยว + ค้าขาย', 'Visit + trade']), 100: Object.freeze(['ย่านอยู่', 'Mostly live']), '010': Object.freeze(['ย่านเที่ยว', 'Mostly visit']),
  '001': Object.freeze(['ย่านค้าขาย', 'Mostly trade']), '000': Object.freeze(['เบาบาง', 'Sparse']),
});
/** Which corners reach the split, read on the numbers the page prints (the tiles' Math.round). */
export const typeOf = (v, split = SPLIT) => v.map(x => (Math.round(x) >= split ? '1' : '0')).join('');
const complete = v => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number');

/** Decode data/character.json; throws on another schema. */
export function decodeCharacter(json) {
  const meta = json?.meta;
  if (meta?.schema !== CHARACTER_SCHEMA || !json.rows || String(meta.axes) !== 'res,gst,ctr') throw new Error('Invalid character data');
  return {meta, rows: new Map(Object.entries(json.rows))};
}

/**
 * One neighbourhood at one distance among all: {v, type, n (neighbourhoods with all three), count (of its type),
 * counts, nearest: [{id, v, d}]} — or {v, missing: [keys]} when the tiles lack a figure there, or null without its row.
 */
export function characterModel(char, id, reach, {near = 5} = {}) {
  const mine = char?.rows?.get(id)?.[reach];
  if (mine === undefined) return null;
  if (!complete(mine)) return {v: mine, missing: CORNERS.filter((c, i) => mine?.[i] == null).map(c => c.key)};
  const counts = {};
  const points = [];
  for (const [rid, row] of char.rows) {
    const v = row?.[reach];
    if (!complete(v)) continue;
    const t = typeOf(v);
    counts[t] = (counts[t] || 0) + 1;
    points.push({id: rid, v});
  }
  const type = typeOf(mine);
  const nearest = points.filter(q => q.id !== id).map(q => ({...q, d: Math.hypot(q.v[0] - mine[0], q.v[1] - mine[1], q.v[2] - mine[2])}))
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, near);
  return {v: mine, type, n: points.length, count: counts[type] || 0, counts, nearest};
}

const f1 = v => +Number(v).toFixed(1);
const at = (v, deg) => [f1(v * Math.cos((deg * Math.PI) / 180)), f1(v * Math.sin((deg * Math.PI) / 180))];
const ring = v => `M${CORNERS.map(c => at(v, c.deg).join(' ')).join('L')}Z`;
/** The viewBox: the triangle of radius 100 with room for the corner dots. */
export const VIEW = Object.freeze({x: -94, y: -106, w: 188, h: 162});

/** The SVG of one triangle (levels 0–100 in the corners' order). */
export function triangleSVG(v, {title = ''} = {}) {
  const pts = CORNERS.map((c, i) => at(Math.max(0, Math.min(100, v[i])), c.deg));
  const spokes = CORNERS.map(c => `M0 0L${at(100, c.deg).join(' ')}`).join('');
  // a corner's dot takes the LDS count sample of its level (the tiles' meters), outlined; a measured 0 is a hollow ring
  const dots = pts.map(([x, y], i) => (v[i] > 0
    ? `<circle class="chr-dot" cx="${x}" cy="${y}" r="5" fill="${pctFill(v[i])}"/>`
    : `<circle class="chr-zero" cx="${x}" cy="${y}" r="4"/>`)).join('');
  return `<svg class="chr-plot" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" width="${VIEW.w}" height="${VIEW.h}" role="img" aria-labelledby="chr-t"><title id="chr-t">${esc(title)}</title>`
    + `<path class="chr-band" d="${ring(75)}${ring(25)}" fill-rule="evenodd"/><path class="chr-ring" d="${ring(100)}"/><path class="chr-spoke" d="${spokes}"/>`
    + `<path class="chr-mid" d="${ring(50)}"/><path class="chr-me" d="M${pts.map(p => p.join(' ')).join('L')}Z"/>${dots}</svg>`;
}

const reachWords = reach => (reach === 'in' ? L('ในย่าน', 'inside') : L(`ใน ${num(+reach / 1000)} กม.`, `within ${num(+reach / 1000)} km`));
const levelText = x => (x === 0 ? L('ไม่มี', 'none') : num(Math.round(x)));

/**
 * The section: the type with how many share it, the triangle with its three corners named, the five nearest folded, the
 * method folded, then its provenance line. rowInfo(id) → {name, place} for the nearest; state: ready · loading · error.
 */
export function characterSection(row, char, {reach = '1000', refN = 395, state = 'ready', rowInfo = () => null, prov = ''} = {}) {
  const head = `<div class="section-heading"><h3 id="nb-character-title">${pic('segment')}${esc(L('ความเป็นย่าน', 'What kind of place'))}</h3></div>`;
  const wrap = inner => `<section class="panel-section character-section" id="nb-character" aria-labelledby="nb-character-title" tabindex="-1">${head}${inner}${prov}</section>`;
  if (state === 'error') return wrap(`<p class="hint">${esc(L('โหลดความเป็นย่านไม่สำเร็จ', 'Could not load this part'))} <button type="button" class="btn" data-action="character-retry">${esc(L('ลองอีกครั้ง', 'Try again'))}</button></p>`);
  if (!char) return wrap(`<p class="hint" role="status">${esc(L('กำลังโหลดความเป็นย่าน…', 'Loading…'))}</p>`);
  const m = characterModel(char, row.id, reach);
  if (!m) return '';
  const where = reachWords(reach);
  if (m.missing) {
    const names = CORNERS.filter(c => m.missing.includes(c.key)).map(c => L(c.of[0], c.of[1])).join(L(' และ', ' and '));
    return wrap(`<p class="hint">${esc(L(`ยังวาดไม่ได้${where}: ${names}ยังไม่มีตัวเลขที่ระยะนี้`, `Not drawn ${where}: no figure yet for ${names} at this distance`))}</p>`);
  }
  const [tTh, tEn] = TYPES[m.type];
  const lead = `<p class="chr-lead">${esc(L(`ย่านนี้เป็นแบบ “${tTh}”`, `This neighbourhood: “${tEn}”`))} <span class="chr-count">${esc(L(`${num(m.count)} จาก ${num(m.n)} ย่านเป็นแบบนี้${where}`, `${num(m.count)} of ${num(m.n)} neighbourhoods are like this ${where}`))}</span></p>`;
  const corner = (c, i, cls) => `<span class="chr-v ${cls}">${pic(c.icon)}<span>${esc(L(c.th, c.en))}</span> <b class="data-number">${esc(levelText(m.v[i]))}</b></span>`;
  const title = L(`ระดับของย่านนี้${where} เทียบ ${num(refN)} ย่าน: อยู่ (คนอยู่) ${levelText(m.v[0])} · เที่ยว (ผู้มาเยือนค้างคืน) ${levelText(m.v[1])} · ค้าขาย (ศูนย์และตลาด) ${levelText(m.v[2])} · แบบ “${tTh}”`,
    `Levels of this neighbourhood ${where} among ${num(refN)}: live (people living here) ${levelText(m.v[0])} · visit (overnight visitors) ${levelText(m.v[1])} · trade (centres and markets) ${levelText(m.v[2])} · “${tEn}”`);
  const figure = `<figure class="chr-figure">
    <p class="chr-top">${corner(CORNERS[0], 0, 'is-top')}</p>
    <div class="chr-wrap">${triangleSVG(m.v, {title})}</div>
    <p class="chr-bottom">${corner(CORNERS[1], 1, 'is-left')}${corner(CORNERS[2], 2, 'is-right')}</p>
    <figcaption class="chr-axes">${esc(L(`อยู่ = คนอยู่ (แบบจำลอง) · เที่ยว = ผู้มาเยือนค้างคืน (แบบจำลอง) · ค้าขาย = ศูนย์และตลาด (นับ) · ตัวเลขคือระดับเทียบ ${num(refN)} ย่าน${where} · เส้นประคือระดับกลาง แถบเทาคือครึ่งกลางของ ${num(refN)} ย่าน`,
      `Live = people living here (modelled) · visit = overnight visitors (modelled) · trade = centres and markets (counted) · the numbers are levels among ${num(refN)} neighbourhoods ${where} · the dashed line is the middle level, the grey band the middle half of the ${num(refN)}`))}</figcaption></figure>`;
  const items = m.nearest.map(q => {
    const info = rowInfo(q.id);
    if (!info) return '';
    const [qTh, qEn] = TYPES[typeOf(q.v)];
    return `<li><button type="button" class="chr-near-row" data-action="select-nb" data-id="${esc(q.id)}"><span class="chr-near-name">${esc(info.name)}<small>${esc(info.place)} · ${esc(L(qTh, qEn))}</small></span><span class="chr-near-val">${CORNERS.map((c, i) => `${pic(c.icon)}<b class="data-number">${esc(levelText(q.v[i]))}</b>`).join('')}</span></button></li>`;
  }).join('');
  const near = items ? `<details class="scope-details chr-near-fold"><summary>${esc(L('5 ย่านที่ระดับใกล้กันที่สุด', 'The five neighbourhoods with the closest levels'))}</summary><ol class="chr-near-list">${items}</ol></details>` : '';
  const method = `<details class="scope-details chr-method"><summary>${esc(L('วิธีอ่านและข้อจำกัด', 'How to read it, and the limits'))}</summary><ul class="chr-method-list">
    <li>${esc(L(`แต่ละมุมคือระดับเทียบ (อันดับกึ่งกลาง) ของตัวเลขใน «ใครอยู่ตรงนี้» ที่ระยะเดียวกัน เทียบ ${num(refN)} ย่านอ้างอิง ไม่บวกรวมกัน และไม่ใช่คะแนนน่าอยู่ น่าเที่ยว หรือน่าค้าขาย`, `Each corner is the level (mid-rank percentile) of a figure of “Who is here” at the same distance among the ${num(refN)} reference neighbourhoods; never added together, and not a score of being liveable, worth visiting or good for trade`))}</li>
    <li>${esc(L('“ไม่มี” คือนับได้ 0 ที่ระยะนี้ · คนมาทำงานและเรียนไม่อยู่ในกราฟ เพราะย่านส่วนใหญ่ยังจัดระดับไม่ได้', '“None” means 0 counted at this distance · people who come to work and study are not on the chart: most neighbourhoods have no level for them yet'))}</li>
    <li>${esc(L(`ชื่อแบบย่านเป็นการตีความ แบ่งที่ระดับ ${num(SPLIT)} ของแต่ละมุม ได้ 8 แบบ`, `The type is an interpretation, split at level ${num(SPLIT)} on each corner: eight types`))}</li>
    <li>${esc(L('ย่านที่ระดับใกล้กันคือ 5 ย่านที่ระยะห่างของสามระดับใกล้ที่สุด ไม่ได้แปลว่าลูกค้า ยอดขาย หรือทำเลเหมือนกัน และระดับสูงไม่ได้แปลว่าทำเลดีกว่า', 'The closest neighbourhoods are the five nearest on the three levels; that does not make their shoppers, sales or location alike, and a higher level does not make a better location'))}</li>
  </ul></details>`;
  return wrap(`${lead}${figure}${near}${method}`);
}
