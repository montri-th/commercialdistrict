/**
 * CityMETER · Commercial District — «ช่วงไหนน่าจะคึก», the 7 × 24 grid of a neighbourhood (0.7.10; pure).
 *
 * Owner 2026-11-27 18:04 (VERBATIM): “และ side panel ยังขาด heatmap ใน 7x24 daypart”; on Claude's question he chose the
 * hypothesis from rules as «รอบศูนย์นี้» makes it, VERBATIM: “เลือก 1 แต่ช่วยใช้ style เหมือน demo = shopping center”
 * (D-V10 in handoff/visual/decisions.json). The family's datasets carry almost no opening hours, so no hour of a
 * neighbourhood is measured: the grid is a Hypothesis, a generated prior on observed and modelled figures, read relative
 * to the neighbourhood's own busiest hour — never people, footfall, customers or sales (MBB §3.7).
 *
 * The look and the reading are the Shopping Center page's busy block (montri-th/shoppingcenter js/venue-locale.js
 * busyBlock, daypartGroups; its rule family venue-context-adapter/0.2-demo): one line for the busiest hours of the week,
 * the grid in neutral foundation tones (a prior never takes a data colour), the legend, then the day-by-day reading and
 * the rules folded. A neighbourhood never closes, so the grid has no level 0. The rules and their hours are this page's
 * own reading of that family for an area (DATA_METHOD.md §19): a base pattern, then shifts from the residents', overnight
 * visitors' and centres' levels and from the places of work, study and rail within 1 km of the edge (s = (level − 40) /
 * 50 as there; counts in three steps). The grid does not change with the distance the tiles read.
 */
import {LANG} from './shell/i18n.js';
import {num} from './model.js';

const EN = LANG === 'en';
const L = (th, en) => (EN ? en : th);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pic = (role, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(role)}" aria-hidden="true"></i>`;

/** The distance the grid reads (inside and within 1 km of the edge), whatever the tiles read. */
export const DAYPART_REACH = '1000';
/** Monday first, as the Shopping Center page: [short th, short en, th, en]. */
export const DAYS = Object.freeze([['จ.', 'Mon', 'จันทร์', 'Monday'], ['อ.', 'Tue', 'อังคาร', 'Tuesday'], ['พ.', 'Wed', 'พุธ', 'Wednesday'],
  ['พฤ.', 'Thu', 'พฤหัสบดี', 'Thursday'], ['ศ.', 'Fri', 'ศุกร์', 'Friday'], ['ส.', 'Sat', 'เสาร์', 'Saturday'], ['อา.', 'Sun', 'อาทิตย์', 'Sunday']]);
/** Levels 1–5 of a cell, the Shopping Center page's words (its level 0, closed, never applies to an area). */
export const GRID_LEVELS = Object.freeze([null, ['เงียบ', 'Quiet'], ['ค่อนข้างเงียบ', 'Fairly quiet'], ['ปานกลาง', 'Moderate'], ['คึก', 'Busy'], ['คึกที่สุดของสัปดาห์', 'Busiest of the week']]);
/** A cell's share of the week's busiest hour → level (the Shopping Center page's cut points). */
export const CUTS = Object.freeze([0.35, 0.55, 0.75, 0.9]);

const WD = [0, 1, 2, 3, 4], WE = [5, 6], ALL = [0, 1, 2, 3, 4, 5, 6];
// the base of an area: the day through the evening, weekends fuller than weekdays (index = hour)
const BASE_WD = [0.10, 0.07, 0.05, 0.05, 0.06, 0.10, 0.22, 0.38, 0.48, 0.50, 0.55, 0.66, 0.76, 0.68, 0.58, 0.58, 0.64, 0.76, 0.86, 0.84, 0.70, 0.52, 0.36, 0.20];
const BASE_WE = [0.14, 0.10, 0.07, 0.06, 0.06, 0.08, 0.14, 0.24, 0.36, 0.48, 0.62, 0.74, 0.82, 0.84, 0.84, 0.84, 0.86, 0.90, 0.94, 0.90, 0.76, 0.58, 0.42, 0.26];

/**
 * The rules, in the order they are read: `sig` the signal that sets their strength (none: always on), `parts` the days and
 * hours [from, to) they shift and by how much at full strength.
 */
export const RULES = Object.freeze([
  {id: 'base', th: 'รูปแบบพื้นฐานของย่าน: กลางวันถึงหัวค่ำ วันหยุดคึกกว่าวันธรรมดา', en: 'Base pattern of an area: daytime into the evening, weekends busier than weekdays', parts: []},
  {id: 'friday_evening', th: 'เย็นวันศุกร์คึกกว่าวันธรรมดาอื่น', en: 'Friday evening busier than other weekdays', parts: [{days: [4], from: 17, to: 23, d: 0.10}]},
  {id: 'sunday_early', th: 'ค่ำวันอาทิตย์ซาเร็วกว่าวันเสาร์', en: 'Sunday night quietens earlier than Saturday', parts: [{days: [6], from: 20, to: 24, d: -0.12}]},
  {id: 'residents_evening', sig: 'res', th: 'คนอยู่แวะหลังเลิกงาน', en: 'Residents stop by after work', parts: [{days: WD, from: 17, to: 21, d: 0.12}]},
  {id: 'residents_weekend', sig: 'res', th: 'คนอยู่ออกมาเป็นครอบครัววันหยุด', en: 'Residents out with their families at weekends', parts: [{days: WE, from: 9, to: 18, d: 0.10}]},
  {id: 'visitors_daily', sig: 'gst', th: 'ผู้มาเยือนมาทุกวัน วันธรรมดากับวันหยุดจึงต่างกันน้อยลง', en: 'Visitors come every day, so weekdays and weekends differ less', parts: [{days: WD, from: 10, to: 17, d: 0.10}]},
  {id: 'visitors_night', sig: 'gst', th: 'ผู้มาเยือนออกมาช่วงค่ำ', en: 'Visitors out in the evening', parts: [{days: ALL, from: 19, to: 24, d: 0.12}]},
  {id: 'centres_hours', sig: 'ctr', th: 'ศูนย์และตลาดเปิดช่วงสายถึงค่ำ', en: 'Centres and markets open from late morning to evening', parts: [{days: ALL, from: 10, to: 21, d: 0.08}]},
  {id: 'workers_lunch', sig: 'work', th: 'พักกลางวันของคนทำงาน', en: 'Workers’ lunch break', parts: [{days: WD, from: 11, to: 14, d: 0.14}]},
  {id: 'workers_after', sig: 'work', th: 'หลังเลิกงานของคนทำงาน', en: 'Workers after work', parts: [{days: WD, from: 17, to: 19, d: 0.10}]},
  {id: 'workers_weekend_dip', sig: 'work', th: 'วันหยุดคนทำงานออฟฟิศน้อยลง', en: 'Fewer office workers at weekends', parts: [{days: WE, from: 9, to: 17, d: -0.08}]},
  {id: 'factory_shift', sig: 'factory', th: 'หลังเลิกกะของคนงานโรงงาน และวันอาทิตย์', en: 'Factory workers after their shift, and on Sunday', parts: [{days: WD, from: 16, to: 18, d: 0.10}, {days: [6], from: 10, to: 16, d: 0.06}]},
  {id: 'students_after_school', sig: 'school', th: 'ช่วงเลิกเรียนของโรงเรียน', en: 'Schools letting out', parts: [{days: WD, from: 15, to: 18, d: 0.10}]},
  {id: 'students_weekend', sig: 'school', th: 'เรียนพิเศษและกิจกรรมเด็กวันหยุด', en: 'Tutoring and children’s activities at weekends', parts: [{days: WE, from: 9, to: 16, d: 0.06}]},
  {id: 'university_afternoon', sig: 'university', th: 'นักศึกษาช่วงบ่ายถึงค่ำวันธรรมดา', en: 'University students from afternoon to evening on weekdays', parts: [{days: WD, from: 13, to: 21, d: 0.08}]},
  {id: 'commuters', sig: 'rail', th: 'คนเดินทางผ่านสถานีช่วงเช้าและเย็นวันธรรมดา', en: 'Commuters through the stations on weekday mornings and evenings', parts: [{days: WD, from: 7, to: 9, d: 0.08}, {days: WD, from: 17, to: 20, d: 0.08}]},
]);

const clamp01 = v => Math.max(0, Math.min(1, v));
/** Strength of a level (0–100) as the Shopping Center page reads its signals: (level − 40) / 50, within 0–1. */
export const levelStrength = p => (p == null ? 0 : clamp01((Number(p) - 40) / 50));
/** Strength of a count of places: none 0 · 1–2 slight · 3–9 moderate · 10 or more strong. */
export const countStrength = n => (!(n > 0) ? 0 : n >= 10 ? 1 : n >= 3 ? 0.66 : 0.33);

/** The signals of a people record at the grid's distance: {res, gst, ctr, work, factory, school, university, rail} in 0–1. */
export function signalsOf(rec) {
  const s = rec?.s?.[DAYPART_REACH], p = rec?.p?.[DAYPART_REACH];
  if (!s) return null;
  const n = s.n || {};
  const lv = (count, level) => (count > 0 ? levelStrength(level) : 0);
  return {
    res: lv(s.res, p?.res), gst: lv(s.gst, p?.gst), ctr: lv(n.shoppingcenter, p?.ctr),
    work: countStrength((n.office || 0) + (n.governmentoffice || 0)), factory: countStrength((n.factory || 0) + (n.industrialestate || 0)),
    school: countStrength(n.school || 0), university: countStrength(n.university || 0), rail: countStrength(n.transit || 0),
  };
}

const r2 = v => Math.round(v * 100) / 100;
/**
 * The grid of a people record: {grid: 168 digits 1–5 (Monday 00–23 … Sunday 00–23), rules: [[id, strength]], n: {…}}
 * or null without the record. Every cell = base + Σ strength × shift (never under 0.02), as a share of the week's highest.
 */
export function daypartOf(rec) {
  const sig = signalsOf(rec);
  if (!sig) return null;
  const w = Array.from({length: 7}, (_, d) => (WE.includes(d) ? BASE_WE : BASE_WD).slice());
  const rules = [];
  for (const rule of RULES) {
    // the strength as the fold lists it (two decimals) is the one applied; a rule that rounds to 0 is not on
    const st = r2(rule.sig ? sig[rule.sig] : 1);
    if (!(st > 0)) continue;
    rules.push([rule.id, st]);
    for (const part of rule.parts) for (const d of part.days) for (let h = part.from; h < part.to; h++) w[d][h] += st * part.d;
  }
  const top = Math.max(...w.flat().map(v => Math.max(0.02, v)));
  const grid = w.map(row => row.map(v => {
    const share = Math.max(0.02, v) / top;
    return String(1 + CUTS.filter(c => share >= c).length);
  }).join('')).join('');
  const s = rec.s[DAYPART_REACH], n = s.n || {};
  return {grid, rules, n: {work: (n.office || 0) + (n.governmentoffice || 0), factory: (n.factory || 0) + (n.industrialestate || 0), school: n.school || 0, university: n.university || 0, rail: n.transit || 0}};
}

/**
 * Days of a 168-character grid in runs of consecutive days with the same row: {days, top, ranges: [[from, to)]}
 * (the Shopping Center page's daypartGroups, without its closed hours).
 */
export function daypartGroups(grid) {
  const rows = Array.from({length: 7}, (_, d) => String(grid || '').slice(d * 24, d * 24 + 24));
  const groups = [];
  rows.forEach((r, d) => {
    const last = groups[groups.length - 1];
    if (last && last.row === r && last.days[last.days.length - 1] === d - 1) last.days.push(d);
    else groups.push({row: r, days: [d]});
  });
  return groups.map(({row, days}) => {
    const cells = [...row].map(Number);
    const top = Math.max(0, ...cells);
    const ranges = [];
    let start = -1;
    for (let h = 0; h <= 24; h++) {
      const on = h < 24 && top > 0 && cells[h] === top;
      if (on && start < 0) start = h;
      if (!on && start >= 0) { ranges.push([start, h]); start = -1; }
    }
    return {days, top, ranges};
  });
}
const hh = h => String(h).padStart(2, '0');
const dayRun = days => (days.length > 1 ? [`${DAYS[days[0]][0]}–${DAYS[days[days.length - 1]][0]}`, `${DAYS[days[0]][1]}–${DAYS[days[days.length - 1]][1]}`] : [DAYS[days[0]][0], DAYS[days[0]][1]]);
const hourRuns = ranges => ranges.map(([x, y]) => `${hh(x)}:00–${hh(y)}:00`).join(', ');
const strengthWords = st => (st >= 0.66 ? ['แรง', 'strong'] : st >= 0.33 ? ['ปานกลาง', 'moderate'] : ['เล็กน้อย', 'slight']);

/** The busiest hours of the week in words: [th, en] ('' when the grid has no cell at level 5). */
export function busiestWords(grid) {
  const best = daypartGroups(grid).filter(g => g.top === 5);
  return best.length ? [best.map(g => `${dayRun(g.days)[0]} ${hourRuns(g.ranges)} น.`).join(' · '), best.map(g => `${dayRun(g.days)[1]} ${hourRuns(g.ranges)}`).join(' · ')] : ['', ''];
}

/**
 * The section of a neighbourhood: the busiest line, the grid (aria-hidden: the line and the day-by-day list read it), the
 * legend, the reading, the rules folded, then its provenance line. '' without a people record.
 */
export function busySection(rec, {prov = ''} = {}) {
  const dp = daypartOf(rec);
  if (!dp) return '';
  const grid = dp.grid;
  const head = `<tr><td></td>${Array.from({length: 24}, (_, h) => `<th scope="col">${h % 6 === 0 ? hh(h) : ''}</th>`).join('')}</tr>`;
  const body = DAYS.map((d, i) => `<tr><th scope="row">${esc(L(d[0], d[1]))}</th>${[...grid.slice(i * 24, i * 24 + 24)].map((c, h) =>
    `<td class="g${c}" title="${esc(`${L(d[2], d[3])} ${hh(h)}:00–${hh(h + 1)}:00${EN ? '' : ' น.'} · ${L(...GRID_LEVELS[Number(c)])}`)}"></td>`).join('')}</tr>`).join('');
  const legend = `<ul class="dp-legend" aria-label="${esc(L('คำอธิบายสัญลักษณ์', 'Legend'))}">${GRID_LEVELS.slice(1).map((l, i) => `<li><i class="g${i + 1}" aria-hidden="true"></i>${esc(L(l[0], l[1]))}</li>`).join('')}</ul>`;
  const [bestTh, bestEn] = busiestWords(grid);
  const peaks = daypartGroups(grid).map(g => {
    const [dth, den] = dayRun(g.days), r = hourRuns(g.ranges);
    return `<li><b>${esc(L(dth, den))}</b> ${esc(g.top === 5 ? L(`คึกที่สุดของสัปดาห์ ${r} น.`, `busiest of the week ${r}`) : L(`คึกที่สุดของวัน ${r} น. (ระดับ${GRID_LEVELS[g.top][0]})`, `busiest of the day ${r} (${GRID_LEVELS[g.top][1].toLowerCase()})`))}</li>`;
  }).join('');
  const why = {work: ['สำนักงานและหน่วยงานรัฐ', 'offices and government offices'], factory: ['โรงงานและนิคมอุตสาหกรรม', 'factories and industrial estates'],
    school: ['โรงเรียน', 'schools'], university: ['มหาวิทยาลัย', 'universities'], rail: ['สถานีราง', 'rail stations']};
  // each rule with its strength in words (none at full strength, as there) and, for places, how many within 1 km
  const rules = dp.rules.map(([id, st]) => {
    const rule = RULES.find(x => x.id === id);
    const bits = [];
    if (st < 1) bits.push(L(...strengthWords(st)));
    if (why[rule.sig]) bits.push(L(`${why[rule.sig][0]} ${num(dp.n[rule.sig])} แห่ง`, `${num(dp.n[rule.sig])} ${why[rule.sig][1]}`));
    return `<li>${esc(L(rule.th, rule.en))}${bits.length ? ` <span class="fact-rank">(${esc(bits.join(' · '))})</span>` : ''}</li>`;
  }).join('');
  return `<section class="panel-section busy-section" id="nb-busy" aria-labelledby="nb-busy-title"><div class="section-heading"><h3 id="nb-busy-title">${pic('date')}${esc(L('ช่วงไหนน่าจะคึก', 'When it is likely busy'))}<span class="prior-badge">${esc(L('สมมติฐาน', 'Hypothesis'))}</span></h3></div>
    ${bestTh ? `<p class="busy-peak">${esc(L(`คึกที่สุดของสัปดาห์ ${bestTh}`, `Busiest of the week: ${bestEn}`))}</p>` : ''}
    <div class="dp-wrap"><table class="dp-grid" aria-hidden="true"><thead>${head}</thead><tbody>${body}</tbody></table></div>
    ${legend}
    <p class="hint dp-note">${esc(L('เทียบกับชั่วโมงที่คึกที่สุดของย่านนี้เอง ไม่ใช่จำนวนคน · จากคนและสถานที่ในย่านและใน 1 กม. จากขอบ', 'Relative to this neighbourhood’s own busiest hour — not people counts · from the people and places inside and within 1 km of the edge'))}</p>
    <details class="scope-details dp-why"><summary>${esc(L('อ่านทีละวัน และทำไมตารางเป็นแบบนี้', 'Day by day, and why the grid looks like this'))}</summary>
      <ul class="dp-peaks">${peaks}</ul>
      <ul class="prior-targets">${rules}</ul>
      <p class="hint">${esc(L('ตรวจได้ด้วยการเดินดูหน้างานในช่วงที่ตารางบอกว่าคึกที่สุด และช่วงที่บอกว่าเงียบ', 'Check it by walking the area in the hours the grid calls busiest and in those it calls quiet'))}</p>
    </details>${prov}</section>`;
}
