/**
 * CityMETER · Commercial District — «ใคร ใช้จ่ายกับอะไร และเมื่อไร»: the three groups of a neighbourhood side by side (0.8.0; pure).
 *
 * Owner 2026-11-28 19:36, VERBATIM: “… ย่านการค้าควรเล่าได้ว่า น่าอยู่ น่าเที่ยว น่าค้าขายอย่างไร และสามารถนับจำนวน บอก
 * พฤติกรรมการจับจ่าย ของ traffic ในพื้นที่ ซึ่งประกอบด้วย Resident + Visitor + Commuter (ถ้ายากไปยังไม่ทำ commuter ได้) ที่มีจังหวะ
 * ที่ต่างกันใน daypart 7x24 (day x hour)”; 20:12 “… ขอให้ leverage ข้อมูลที่เรามีให้เต็มที่”.
 *
 * For each group, in the owner's order (D-V9: คนอยู่ · ผู้มาเยือน · คนมาทำงานและเรียน):
 *   how many — the people file's own figure within 1 km of the edge (residents modelled, overnight visitors a year
 *     modelled, people who come to work and study at least): three groups, never added, never customers or footfall;
 *   where they can spend nearby — the places of the datasets that serve that group, inside and within the 800 m walkable
 *     edge, each in its own unit (a dataset's records, never added across datasets; a starred one says its points are short);
 *   when — the group's own 7 × 24 week, a Hypothesis in the Shopping Center page's busy-block tones (levels 1–5 against the
 *     group's own busiest hour): a base week for the group, shifted by the places round it (the strengths of
 *     js/daypart.js). No hour is measured; never people, footfall, customers or sales (MBB §3.7). DATA_METHOD.md §21.
 */
import {LANG} from './shell/i18n.js';
import {num, dsName, dsUnitN, lowLocated} from './model.js';
import {countAt} from './indicators.js';
import {aboutPeople, atLeastPeople} from './people.js';
import {DAYS, GRID_LEVELS, CUTS, DAYPART_REACH, countStrength, levelStrength, daypartGroups} from './daypart.js';
import {dsIcon} from './axes.js';

const EN = LANG === 'en';
const L = (th, en) => (EN ? en : th);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pic = (role, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(role)}" aria-hidden="true"></i>`;
const nw = html => `<span class="nowrap">${html}</span>`;
const hh = h => String(h).padStart(2, '0');

const WD = [0, 1, 2, 3, 4], WE = [5, 6], ALL = [0, 1, 2, 3, 4, 5, 6];
/** The distance «where they can spend nearby» reads: inside and within the 800 m walkable edge. */
export const SPEND_REACH = '800';

/**
 * The groups: their base week (weekday, weekend; index = hour, a share of the group's own busiest hour before the shifts),
 * the shifts the places round them bring (`sig`: a dataset id read at 800 m, or a level of the people file), and the
 * datasets of the places they can spend at, in reading order.
 */
export const GROUPS = Object.freeze([
  {id: 'res', icon: 'home', th: 'คนอยู่', en: 'Residents', key: 'res',
    base: [[0.05, 0.03, 0.02, 0.02, 0.04, 0.15, 0.40, 0.55, 0.35, 0.25, 0.25, 0.30, 0.35, 0.30, 0.25, 0.28, 0.40, 0.65, 0.85, 0.90, 0.75, 0.50, 0.25, 0.10],
           [0.08, 0.05, 0.03, 0.02, 0.03, 0.08, 0.20, 0.40, 0.60, 0.75, 0.85, 0.90, 0.88, 0.80, 0.75, 0.75, 0.80, 0.88, 0.92, 0.85, 0.70, 0.50, 0.30, 0.12]],
    baseTh: 'คนอยู่ใช้จ่ายก่อนออกจากบ้าน หลังเลิกงาน และกลางวันวันหยุด', baseEn: 'Residents spend before leaving home, after work and through weekend days',
    rules: [
      {sig: 'park', th: 'ออกกำลังกายในสวนช่วงเช้าตรู่และเย็น', en: 'Exercise in the parks early morning and evening', parts: [{days: ALL, from: 5, to: 8, d: 0.12}, {days: ALL, from: 17, to: 19, d: 0.08}]},
      {sig: 'school', th: 'รับส่งลูกช่วงเลิกเรียน', en: 'School runs at the end of the school day', parts: [{days: WD, from: 15, to: 17, d: 0.10}]},
      {sig: 'grocery', th: 'ร้านสะดวกซื้อรับช่วงดึก', en: 'Convenience stores take the late hours', parts: [{days: ALL, from: 21, to: 24, d: 0.06}]},
    ],
    spend: ['grocery', 'restaurant', 'pharmacy', 'park', 'bank', 'salon', 'fitness', 'pet', 'car', 'services', 'hospital', 'housingestate']},
  {id: 'gst', icon: 'luggage', th: 'ผู้มาเยือน', en: 'Visitors', key: 'gst',
    base: [[0.10, 0.06, 0.04, 0.03, 0.03, 0.05, 0.12, 0.25, 0.40, 0.55, 0.70, 0.78, 0.80, 0.78, 0.75, 0.75, 0.78, 0.85, 0.92, 0.95, 0.90, 0.75, 0.50, 0.25],
           [0.12, 0.08, 0.05, 0.03, 0.03, 0.05, 0.12, 0.25, 0.45, 0.65, 0.82, 0.90, 0.92, 0.92, 0.90, 0.90, 0.92, 0.95, 0.98, 1.00, 0.95, 0.80, 0.55, 0.30]],
    baseTh: 'ผู้มาเยือนเที่ยวกลางวันถึงค่ำ วันหยุดมากกว่าวันธรรมดา', baseEn: 'Visitors are out from day into the evening, more at weekends',
    rules: [
      {sig: 'tourism', th: 'แหล่งท่องเที่ยวรอบย่านดึงคนช่วงกลางวัน', en: 'Attractions round the area draw people in the daytime', parts: [{days: ALL, from: 9, to: 17, d: 0.10}]},
      {sig: 'shoppingcenter', th: 'ศูนย์และตลาดเปิดสายถึงค่ำ', en: 'Centres and markets open late morning to evening', parts: [{days: ALL, from: 10, to: 21, d: 0.08}]},
      {sig: 'massage', th: 'นวดและสปาช่วงบ่ายถึงดึก', en: 'Massage and spas afternoon to late', parts: [{days: ALL, from: 14, to: 23, d: 0.08}]},
      {sig: 'hotel', th: 'ผู้เข้าพักออกจากที่พักช่วงเช้า', en: 'Guests leave their lodging in the morning', parts: [{days: ALL, from: 7, to: 10, d: 0.08}]},
    ],
    spend: ['hotel', 'tourism', 'shoppingcenter', 'restaurant', 'apparel', 'beauty', 'luxurybrands', 'massage', 'arts', 'cinema', 'playground', 'park']},
  {id: 'com', icon: 'office', th: 'คนมาทำงานและเรียน', en: 'People who come to work and study', key: 'com',
    base: [[0.02, 0.01, 0.01, 0.01, 0.02, 0.05, 0.25, 0.70, 0.85, 0.55, 0.45, 0.80, 0.95, 0.70, 0.45, 0.45, 0.60, 0.90, 0.80, 0.45, 0.25, 0.12, 0.06, 0.03],
           [0.02, 0.01, 0.01, 0.01, 0.01, 0.02, 0.05, 0.10, 0.15, 0.18, 0.20, 0.25, 0.28, 0.25, 0.20, 0.18, 0.18, 0.18, 0.15, 0.10, 0.07, 0.05, 0.03, 0.02]],
    baseTh: 'คนทำงานและนักเรียนมาเช้า พักกลางวัน และกลับเย็นวันธรรมดา', baseEn: 'Workers and students arrive in the morning, break at lunch and leave in the weekday evening',
    rules: [
      {sig: 'office', th: 'พักกลางวันของคนทำงานออฟฟิศ', en: 'Office workers’ lunch break', parts: [{days: WD, from: 11, to: 14, d: 0.10}]},
      {sig: 'university', th: 'นักศึกษาช่วงบ่ายถึงค่ำวันธรรมดา', en: 'University students afternoon to evening on weekdays', parts: [{days: WD, from: 13, to: 21, d: 0.08}]},
      {sig: 'factory', th: 'เข้าออกกะของคนงานโรงงาน', en: 'Factory shifts starting and ending', parts: [{days: WD, from: 6, to: 8, d: 0.08}, {days: WD, from: 16, to: 18, d: 0.08}]},
      {sig: 'transit', th: 'เดินทางผ่านสถานีช่วงเช้าและเย็น', en: 'Through the stations morning and evening', parts: [{days: WD, from: 7, to: 9, d: 0.08}, {days: WD, from: 17, to: 20, d: 0.08}]},
    ],
    spend: ['restaurant', 'grocery', 'bank', 'pharmacy', 'services', 'optical', 'clinic', 'fitness', 'beauty', 'apparel']},
]);

const r2 = v => Math.round(v * 100) / 100;
/** A park's ground counts as places do by its ไร่ in steps (10 ไร่ or more a quarter, 50 half, 200 whole); other datasets by count. */
const parkStrength = rai => (!(rai >= 10) ? 0 : rai >= 200 ? 1 : rai >= 50 ? 0.5 : 0.25);

/** The week of one group: {grid: 168 digits 1–5, rules: [[th, en, strength, n]]} — a Hypothesis, relative to the group's own top. */
export function groupWeek(group, row, around) {
  const at = id => countAt(row, around, id, SPEND_REACH);
  const w = Array.from({length: 7}, (_, d) => group.base[WE.includes(d) ? 1 : 0].slice());
  const rules = [];
  for (const rule of group.rules) {
    const n = at(rule.sig);
    if (n == null) continue;
    const st = r2(rule.sig === 'park' ? parkStrength(n) : countStrength(n));
    if (!(st > 0)) continue;
    rules.push([rule.th, rule.en, st, n, rule.sig]);
    for (const part of rule.parts) for (const d of part.days) for (let h = part.from; h < part.to; h++) w[d][h] += st * part.d;
  }
  const top = Math.max(...w.flat().map(v => Math.max(0.02, v)));
  const grid = w.map(r => r.map(v => String(1 + CUTS.filter(c => Math.max(0.02, v) / top >= c).length)).join('')).join('');
  return {grid, rules};
}

const hourRuns = ranges => ranges.map(([x, y]) => `${hh(x)}:00–${hh(y)}:00`).join(', ');
const dayRun = days => (days.length > 1 ? [`${DAYS[days[0]][0]}–${DAYS[days[days.length - 1]][0]}`, `${DAYS[days[0]][1]}–${DAYS[days[days.length - 1]][1]}`] : [DAYS[days[0]][0], DAYS[days[0]][1]]);

/** The group's busiest hours of the week in words: [th, en]. */
export function peakWords(grid) {
  const best = daypartGroups(grid).filter(g => g.top === 5);
  return [best.map(g => `${dayRun(g.days)[0]} ${hourRuns(g.ranges)} น.`).join(' · '), best.map(g => `${dayRun(g.days)[1]} ${hourRuns(g.ranges)}`).join(' · ')];
}

/** The figure of a group within 1 km of the edge, in its own words (or why there is none). */
function figureOf(group, rec) {
  const s = rec?.s?.[DAYPART_REACH];
  if (!s) return L('รอตัวเลขคน', 'people figures not loaded');
  const v = s[group.key];
  if (v == null) return L('ยังไม่มีตัวเลข', 'no figure yet');
  const fig = t => `<b class="data-number">${esc(t)}</b>`;
  if (group.id === 'res') return v === 0 ? `${fig('0')} ${L('คน', 'people')}` : aboutPeople(v) ? `${L('ราว', 'about')} ${fig(aboutPeople(v))} ${L('คน', 'people')}` : L('ไม่ถึง 10 คน', 'under 10 people');
  if (group.id === 'gst') return v === 0 ? `${fig('0')} ${L('คนต่อปี', 'a year')}` : aboutPeople(v) ? `${L('ค้างคืนราว', 'overnight, about')} ${fig(aboutPeople(v))} ${L('คนต่อปี', 'a year')}` : L('ไม่ถึง 10 คนต่อปี', 'under 10 a year');
  return `${L('อย่างน้อย', 'at least')} ${fig(atLeastPeople(v))} ${L('คน', 'people')}${s.comLow ? '*' : ''}`;
}
const evidence = group => (group.id === 'com' ? L('นับจากรายการ', 'counted from records') : L('แบบจำลอง', 'modelled'));

/** The places a group can spend at nearby: [{id, n, text}] of the datasets in scope that hold something, in the group's order. */
export function spendOf(group, row, model, around) {
  const out = [];
  for (const id of group.spend) {
    const ds = model.dsById.get(id);
    if (!ds) continue;
    const n = countAt(row, around, id, SPEND_REACH);
    if (!(n > 0)) continue;
    const unit = id === 'park' ? L('ไร่', 'rai') : dsUnitN(ds, n);
    const name = id === 'park' ? L('สวนราว', 'parks, about') : dsName(ds);
    out.push({id, n, star: lowLocated(ds), text: `${pic(dsIcon(ds))}${esc(name)}${lowLocated(ds) ? '*' : ''} ${nw(`<b class="data-number">${num(n)}</b> ${esc(unit)}`)}`});
  }
  return out;
}

function miniGrid(grid, label) {
  const head = `<tr><td></td>${Array.from({length: 24}, (_, h) => `<th scope="col">${h % 6 === 0 ? hh(h) : ''}</th>`).join('')}</tr>`;
  const body = DAYS.map((d, i) => `<tr><th scope="row">${esc(L(d[0], d[1]))}</th>${[...grid.slice(i * 24, i * 24 + 24)].map((c, h) =>
    `<td class="g${c}" title="${esc(`${label} · ${L(d[2], d[3])} ${hh(h)}:00–${hh(h + 1)}:00${EN ? '' : ' น.'} · ${L(...GRID_LEVELS[Number(c)])}`)}"></td>`).join('')}</tr>`).join('');
  return `<div class="dp-wrap"><table class="dp-grid gr-grid" aria-hidden="true"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/**
 * The section: one card per group (figure · places to spend nearby · its week), the legend once, the rules folded, then
 * the provenance line. '' without a people record (the tiles above say why).
 */
export function groupsSection(row, model, around, rec, {prov = ''} = {}) {
  if (!rec?.s?.[DAYPART_REACH]) return '';
  const cards = GROUPS.map(g => {
    const week = groupWeek(g, row, around);
    const [pth, pen] = peakWords(week.grid);
    const spend = spendOf(g, row, model, around);
    const shown = spend.slice(0, 6);
    const label = L(g.th, g.en);
    const rules = [`<li>${esc(L(g.baseTh, g.baseEn))}</li>`, ...week.rules.map(([th, en, st, n, sig]) =>
      `<li>${esc(L(th, en))} <span class="fact-rank">(${esc(sig === 'park' ? L(`สวนราว ${num(n)} ไร่`, `parks of about ${num(n)} rai`) : `${dsName(model.dsById.get(sig))} ${num(n)} ${dsUnitN(model.dsById.get(sig), n)}`)}${st < 1 ? ` · ${esc(L(st >= 0.5 ? 'ปานกลาง' : 'เล็กน้อย', st >= 0.5 ? 'moderate' : 'slight'))}` : ''})</span></li>`)].join('');
    return `<article class="gr-card" data-group="${esc(g.id)}">
      <h4 class="gr-head">${pic(g.icon)}<span class="gr-name">${esc(label)}</span><span class="gr-fig">${figureOf(g, rec)} <small>${esc(L('ใน 1 กม. จากขอบ', 'within 1 km of the edge'))} · ${esc(evidence(g))}</small></span></h4>
      <p class="gr-spend"><span class="gr-label">${esc(L('ที่ใช้จ่ายได้ใกล้ ๆ', 'Places to spend nearby'))}</span> ${shown.length ? shown.map(x => `<span class="gr-chip">${x.text}</span>`).join(' ') : esc(L('ไม่พบในชุดข้อมูลที่มี', 'none in the datasets at hand'))}${spend.length > shown.length ? ` <span class="hint">${esc(L(`อีก ${num(spend.length - shown.length)} ชุด`, `${num(spend.length - shown.length)} more datasets`))}</span>` : ''}</p>
      <p class="gr-peak">${esc(L('ช่วงที่น่าจะใช้จ่ายมากที่สุด', 'Likely busiest for this group'))}: <b>${esc(L(pth, pen))}</b></p>
      ${miniGrid(week.grid, label)}
      <details class="scope-details gr-why"><summary>${esc(L('ทำไมจังหวะเป็นแบบนี้', 'Why this rhythm'))}</summary><ul class="prior-targets">${rules}</ul></details>
    </article>`;
  }).join('');
  const legend = `<ul class="dp-legend" aria-label="${esc(L('คำอธิบายสัญลักษณ์', 'Legend'))}">${GRID_LEVELS.slice(1).map((l, i) => `<li><i class="g${i + 1}" aria-hidden="true"></i>${esc(L(l[0], l[1]))}</li>`).join('')}</ul>`;
  const stars = GROUPS.some(g => spendOf(g, row, model, around).some(x => x.star));
  return `<section class="panel-section groups-section" id="nb-groups" aria-labelledby="nb-groups-title"><div class="section-heading"><h3 id="nb-groups-title">${pic('students')}${esc(L('ใคร ใช้จ่ายกับอะไร และเมื่อไร', 'Who spends on what, and when'))}<span class="prior-badge">${esc(L('จังหวะเป็นสมมติฐาน', 'Rhythms are a hypothesis'))}</span></h3></div>
    <p class="hint gr-lead">${esc(L('สามกลุ่มไม่รวมกัน · ไม่ใช่จำนวนลูกค้าหรือยอดขาย · ที่ใช้จ่ายได้นับในย่านและขอบเดินถึง 800 ม. ทีละชุดข้อมูล ไม่รวมข้ามชุด', 'Three groups, never added · not customers or sales · places to spend are counted inside and within the 800 m walkable edge, one dataset at a time, never added across datasets'))}${stars ? esc(L(' · * มีพิกัดไม่ถึง 90% ของรายการ', ' · * points for under 90% of its records')) : ''}</p>
    <div class="gr-cards">${cards}</div>
    ${legend}
    <p class="hint dp-note">${esc(L('แต่ละตารางเทียบกับชั่วโมงที่คึกที่สุดของกลุ่มนั้นเอง ไม่ใช่จำนวนคน · ตรวจได้ด้วยการเดินดูหน้างานในช่วงที่ตารางบอก', 'Each grid is relative to that group’s own busiest hour — not people counts · check it on the ground in the hours it names'))}</p>${prov}</section>`;
}
