/**
 * CityMETER · Commercial District — «ใครอยู่ตรงนี้» and the round 250 m maps of a neighbourhood (0.7.0; pure HTML).
 *
 * Owner 2026-11-26 14:03 (VERBATIM in handoff/around/decisions.json): “ทำยังไงถึงจะเห็นปริมาณคน residents, visitors,
 * commuters ได้ อยากได้วิธีง่ายๆตรงไปตรงมาไม่ซับซ้อนมาก” — 14:31 “A ตัวเลขทางการแบ่งลงย่าน (แนะนำ)” (D-12); “charts ใน sidebar
 * ตอนนี้ยังดูยากอยู่มาก ตัวเล็ก ตัวเลขต่างไม่รู้ว่ามีความหมายอย่างไร ยังไม่ consistent กับ venue locale insight เท่าที่ควร พวก
 * heatmap กลมๆก็ไม่มี” (2.4); 14:40 1 · 3 · 5 กม. “จากขอบย่าน (แนะนำ)” (D-13).
 *
 * The figures come from data/people/<id>.json (scripts/build-people.py, DATA_METHOD.md §15): one group, one figure, its
 * words and its label (แบบจำลอง · ที่แหล่งบันทึก), never one total across groups (INV-01; D-12 lets the group คนมาทำงานและเรียน
 * add its own parts, said as “อย่างน้อย” with every part beside it). The tiles, the words “ระดับเทียบ” and the five-step
 * meter are «รอบศูนย์นี้»'s (montri-th/shoppingcenter js/venue-locale.js glanceHTML, levelOf, aboutPeople). The maps
 * draw the 250 m cells within 5 km of the outline, coloured by rank within the map (D49 and D60 of Shopping Center), with
 * the outline, the walk edges and the service lines over them, and read as a table too.
 */
import {LANG} from './shell/i18n.js';
import {num} from './model.js';
import {COUNT_SCALE, DENSITY_SCALE, ACTIVITY_SCALE, buildRamp, classify, rampLegendHTML, contrastRatio} from './scales.js';
import {LEVEL_WORDS, pctFill} from './around.js';

const EN = LANG === 'en';
const L = (th, en) => (EN ? en : th);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nw = html => `<span class="nowrap">${html}</span>`;
const pic = (role, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(role)}" aria-hidden="true"></i>`;

/** The scales of «ใครอยู่ตรงนี้»: inside, then the service area 1 · 3 · 5 km from the edge (D-10, D-13). */
export const REACHES = Object.freeze(['in', '1000', '3000', '5000']);
/** Author judgement (0.7.0): a neighbourhood opens at 1 km, the nearest service distance; the reader picks another. */
export const DEFAULT_REACH = '1000';
/**
 * The groups in the owner's order, tiles and map tabs alike (0.7.4; owner 2026-11-27 07:15, VERBATIM: “ควรจะเรียงลำดับ
 * Resident > Visitor > Commutor และให้มีภาษาอังกฤษด้วย ตอนนี้คลิกไม่ได้”): คนอยู่ › ผู้มาเยือน › คนมาทำงานและเรียน.
 * The residents map opens first; a neighbourhood without one opens the next tab that has its data.
 */
export const MAP_TABS = Object.freeze(['res', 'visit', 'work']);
export const DEFAULT_MAP = 'res';
export const validReach = v => (REACHES.includes(String(v)) ? String(v) : DEFAULT_REACH);
export const validMap = v => (MAP_TABS.includes(String(v)) ? String(v) : DEFAULT_MAP);
/** The tab a map opens on: the one asked for when its data is here, else the first that has its data. */
export const mapTabOf = (map, tab) => {
  const has = t => t !== 'res' || Array.isArray(map?.res);
  return has(tab) ? tab : MAP_TABS.find(has);
};

export const reachWords = (reach, {short = false} = {}) => (reach === 'in' ? L('ในย่าน', 'Inside')
  : short ? L(`${num(+reach / 1000)} กม.`, `${num(+reach / 1000)} km`) : L(`${num(+reach / 1000)} กม. จากขอบย่าน`, `${num(+reach / 1000)} km from the edge`));

/** «รอบศูนย์นี้»'s rounding: 10s, 100s from 1,000, 1,000s from 10,000; under 10 says so (null). */
export function aboutPeople(x) {
  if (!(x >= 10)) return null;
  const step = x >= 10000 ? 1000 : x >= 1000 ? 100 : 10;
  return num(Math.round(x / step) * step);
}
/** An at-least figure rounded down (never above what was counted): the same steps as aboutPeople; under 10 exact. */
export function atLeastPeople(x) {
  if (x == null) return null;
  if (x < 10) return num(x);
  const step = x >= 10000 ? 1000 : x >= 1000 ? 100 : 10;
  return num(Math.floor(x / step) * step);
}
const UNDER_10 = ['ไม่ถึง 10', 'under 10'];
/** «รอบศูนย์นี้»'s five steps: min(5, floor(p / 20) + 1); 0 = none found. */
export const levelOf = (p, count = 1) => (count > 0 && p != null ? Math.min(5, Math.floor(p / 20) + 1) : 0);
function levelMeter(level, p = null) {
  const fill = p == null ? '' : ` style="background:${pctFill(p)}"`;
  return `<span class="level-meter" data-level="${level}" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i${i <= level ? ` class="on"${fill}` : ''}></i>`).join('')}</span>`;
}

/** A people file as the panel reads it; null when it is not one. */
export function decodePeople(json, id) {
  if (!json || json.id !== id || !json.s || !json.s.in || !json.map?.cell) return null;
  return json;
}

const MONTH_TH = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_EN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthWords = ym => {
  const [y, m] = String(ym || '').split('-').map(Number);
  return y && m ? L(`${MONTH_TH[m]} ${y + 543}`, `${MONTH_EN[m]} ${y}`) : '';
};

/**
 * The four tiles at one scale, in the owner's order (0.7.4, MAP_TABS): คนอยู่ (modelled) · ผู้มาเยือนค้างคืน (guests a year,
 * modelled) · คนมาทำงานและเรียน (at least; starred when half or more of it comes from datasets located under 90 %, then no
 * level) · ศูนย์และตลาด (places).
 */
export function peopleTiles(rec, reach, meta = null) {
  const s = rec?.s?.[reach] || {}, p = rec?.p?.[reach] || {};
  // residents: built at this scale (a figure, or none where Building V4 has no building here) or not built yet
  const resState = s.res != null ? 'ready' : (meta?.residents?.scales || []).includes(reach) ? 'none' : 'pending';
  return [
    {key: 'res', icon: 'home', th: 'คนอยู่', en: 'Living here', tag: ['แบบจำลอง', 'modelled'], state: resState, count: s.res ?? null,
      value: s.res == null ? '' : s.res === 0 ? '0' : aboutPeople(s.res) || L(...UNDER_10), about: Boolean(aboutPeople(s.res)), unit: ['คน', 'people'], star: false, p: p.res ?? null},
    {key: 'gst', icon: 'luggage', th: 'ผู้มาเยือนค้างคืน', en: 'Overnight visitors', tag: ['แบบจำลอง', 'modelled'], state: s.gst == null ? 'none' : 'ready', count: s.gst ?? null,
      value: s.gst == null ? '' : s.gst === 0 ? '0' : aboutPeople(s.gst) || L(...UNDER_10), about: Boolean(aboutPeople(s.gst)), unit: ['คนต่อปี', 'a year'], star: false, p: p.gst ?? null, roomsN: s.roomsN || null},
    // at least: rounded down, never “ราว”
    {key: 'com', icon: 'office', th: 'คนมาทำงานและเรียน', en: 'Come to work and study', tag: ['อย่างน้อย', 'at least'], state: s.com == null ? 'none' : 'ready', count: s.com ?? null,
      value: s.com == null ? '' : atLeastPeople(s.com), about: false, unit: ['คน', 'people'], star: Boolean(s.comLow), p: s.comLow ? null : p.com ?? null},
    {key: 'ctr', icon: 'venue', th: 'ศูนย์และตลาด', en: 'Centres and markets', tag: null, state: s.n?.shoppingcenter == null ? 'none' : 'ready', count: s.n?.shoppingcenter ?? null,
      value: s.n?.shoppingcenter == null ? '' : num(s.n.shoppingcenter), about: false, unit: ['แห่ง', 'places'], star: false, p: p.ctr ?? null},
  ];
}

/** Why a tile has no figure (never 0): the scale is built, but its source has nothing to say here. */
const NONE_WORDS = {
  res: ['ยังไม่มีข้อมูลอาคารในขอบนี้', 'No building data here yet'],
  gst: ['ยังไม่มีข้อมูลที่พักในจังหวัดนี้', 'No lodging data in this province yet'],
  any: ['ยังไม่มีข้อมูล', 'No data yet'],
};

/** The parts of a tile, one short line each (numbers with their units; the model's range for office workers). */
function partsLine(key, s, meta) {
  if (key === 'com') {
    // a part: its figure (and how many of its records carry one, when not all do); unknown when none does — never 0
    // (0.7.3) a university counts only when every site of it is located and within the distance, so one that cannot be
    // counted is “ยังนับไม่ได้”, not a missing figure (seen on the live page of 0.7.0)
    const part = (v, N, th, en, of, {countable = false} = {}) => {
      if (v == null && !N) return '';
      if (v == null) return `${esc(L(th, en))}: ${nw(esc(countable ? L(`ยังนับไม่ได้ (${num(N[1])} ${of[0]})`, `not countable yet (${num(N[1])} ${of[1]})`) : L(`ไม่มีตัวเลข (${num(N[1])} ${of[0]})`, `no figure (${num(N[1])} ${of[1]})`)))}`;
      const partial = N && N[0] < N[1] ? ` <small>${nw(esc(countable ? L(`นับได้ ${num(N[0])} จาก ${num(N[1])} ${of[0]}`, `counted ${num(N[0])} of ${num(N[1])} ${of[1]}`) : L(`มีตัวเลข ${num(N[0])} จาก ${num(N[1])} ${of[0]}`, `figures for ${num(N[0])} of ${num(N[1])} ${of[1]}`)))}</small>` : '';
      return `${nw(`${esc(L(th, en))} ${num(v)}`)}${partial}`;
    };
    const off = s.off ? `${nw(`${esc(L('คนทำงานในสำนักงาน', 'office workers'))} ${num(s.off[0])}–${num(s.off[1])}`)} <small>${esc(L('แบบจำลอง', 'modelled'))}</small>` : '';
    return [part(s.stu, s.stuN, 'นักเรียน', 'students', ['แห่ง', 'schools']), part(s.uni, s.uniN, 'นักศึกษา', 'university students', ['มหาวิทยาลัย', 'universities'], {countable: true}),
      part(s.fac, s.facN, 'คนงานโรงงาน', 'factory workers', ['โรงงาน', 'factories']), part(s.gov, s.govN, 'บุคลากรรัฐ', 'government staff', ['แห่ง', 'offices']), off].filter(Boolean).join(' · ');
  }
  if (key === 'gst' && s.rooms != null) {
    const N = s.roomsN;
    const partial = N && N[0] < N[1] ? ` · ${nw(esc(L(`มีตัวเลขห้อง ${num(N[0])} จาก ${num(N[1])} แห่ง`, `room figures for ${num(N[0])} of ${num(N[1])} places`)))}` : '';
    return `${nw(esc(L(`ห้องที่แหล่งบันทึก ${num(s.rooms)} ห้อง`, `${num(s.rooms)} recorded rooms`)))}${partial}`;
  }
  if (key === 'res' && s.res != null && meta?.residents?.populationMonth) {
    return nw(esc(L(`ทะเบียนบ้าน ${monthWords(meta.residents.populationMonth)}`, `register of ${monthWords(meta.residents.populationMonth)}`)));
  }
  return '';
}

/** «ใครอยู่ตรงนี้»: the scale switch, four tiles, the key, the parts, one source line and the method, folded. */
export function peopleSection(row, rec, meta, {reach = DEFAULT_REACH, refN = 395, state = 'ready', prov = ''} = {}) {
  const head = `<div class="section-heading"><h3 id="nb-people-title">${pic('home')}${esc(L('ใครอยู่ตรงนี้', 'Who is here'))}</h3></div>`;
  if (state !== 'ready' || !rec) {
    const words = state === 'error' ? L('โหลดตัวเลขคนไม่สำเร็จ', 'The people figures did not load') : L('กำลังโหลดตัวเลขคน…', 'Loading the people figures…');
    const retry = state === 'error' ? ` <button type="button" class="btn" data-action="people-retry">${esc(L('ลองอีกครั้ง', 'Try again'))}</button>` : '';
    return `<section class="panel-section people-section" id="nb-people" aria-labelledby="nb-people-title" tabindex="-1">${head}<p class="people-wait">${esc(words)}${retry}</p></section>`;
  }
  const switcher = `<div class="people-switch" role="group" aria-label="${esc(L('อ่านตัวเลขที่ระยะ', 'Read the figures at'))}">${REACHES.map(v => `<button type="button" class="seg" data-action="set-reach" data-value="${v}" aria-pressed="${reach === v}">${esc(reachWords(v, {short: true}))}</button>`).join('')}</div>`;
  const s = rec.s[reach] || {};
  const tiles = peopleTiles(rec, reach, meta);
  const tile = t => {
    const ready = t.state === 'ready', level = ready && !t.star && t.count > 0 && t.p != null ? levelOf(t.p, t.count) : null;
    const star = t.star ? `<sup aria-hidden="true">*</sup><span class="sr-only">${esc(L('ส่วนใหญ่มาจากชุดที่มีพิกัดไม่ครบ จึงไม่จัดระดับ', 'mostly from datasets without points for every record, so no level'))}</span>` : '';
    const figure = ready
      ? `<span class="people-fig">${t.about ? `<small>${esc(L('ราว', 'about'))}</small> ` : ''}<b class="data-number">${esc(t.value)}</b> <span class="people-unit">${esc(L(...t.unit))}${star}</span></span>`
      : `<span class="people-fig is-state">${esc(t.state === 'pending' ? L('รอข้อมูลรอบถัดไป', 'Coming in the next data round')
        : t.key === 'gst' && t.roomsN ? L(`ไม่มีตัวเลขห้องพัก (${num(t.roomsN[1])} แห่ง)`, `No room figures (${num(t.roomsN[1])} places)`) : L(...(NONE_WORDS[t.key] || NONE_WORDS.any)))}</span>`;
    const meter = level == null ? '' : `<span class="people-level">${levelMeter(level, t.count > 0 ? t.p : null)}<span>${esc(L(`ระดับเทียบ ${num(Math.round(t.p ?? 0))}/100`, `level ${num(Math.round(t.p ?? 0))}/100`))}</span><span class="sr-only">${esc(L(`${LEVEL_WORDS[level][0]} ระดับ ${num(level)} จาก 5 เทียบ ${num(refN)} ย่าน`, `${LEVEL_WORDS[level][1]}, level ${num(level)} of 5 among ${num(refN)} neighbourhoods`))}</span></span>`;
    const parts = ready ? partsLine(t.key, s, meta) : '';
    return `<li class="people-tile is-${t.state}" data-people="${t.key}">${pic(t.icon)}<span class="people-label">${esc(L(t.th, t.en))}${t.tag ? ` <span class="glance-tag">${esc(L(...t.tag))}</span>` : ''}</span>${figure}${meter}${parts ? `<small class="people-parts">${parts}</small>` : ''}</li>`;
  };
  const starred = tiles.some(t => t.state === 'ready' && t.star);
  const key = `<p class="hint people-key">${levelMeter(3)}<span>${esc(L(`ระดับเทียบ ${num(refN)} ย่าน · น้อย → มาก`, `Level among ${num(refN)} neighbourhoods · low → high`))}</span>${starred ? `<span>${esc(L('* ส่วนใหญ่มาจากชุดที่มีพิกัดไม่ครบ จึงไม่จัดระดับ', '* mostly from datasets without points for every record, so no level'))}</span>` : ''}</p>`;
  const lead = `<p class="people-lead">${pic('distance')}<span>${reach === 'in' ? esc(L('ในขอบร่างของย่าน', 'Inside the draft outline')) : `${esc(L('ในย่านและพื้นที่', 'Inside and within'))} ${nw(esc(L(`${num(+reach / 1000)} กม.`, `${num(+reach / 1000)} km`)))} ${esc(L('จากขอบ', 'of the edge'))}`}</span></p>`;
  return `<section class="panel-section people-section" id="nb-people" aria-labelledby="nb-people-title" tabindex="-1">${head}${switcher}${lead}
    <ul class="people-grid" aria-labelledby="nb-people-title">${tiles.map(tile).join('')}</ul>${key}${prov || peopleSource(meta)}${peopleMethod(meta)}</section>`;
}

/** One provenance line: dataset · source · date · boundary, short (the method is folded below). */
export function peopleSource(meta) {
  const pm = meta?.residents?.populationMonth;
  const th = [pm ? `คนอยู่: ทะเบียนราษฎร ${monthWords(pm)} แบ่งลงอาคาร CityMETER Building V4` : 'คนอยู่: ทะเบียนราษฎรแบ่งลงอาคาร CityMETER Building V4',
    'คนมาทำงานและเรียน: ชุดข้อมูล CityMETER', `ผู้มาเยือน: กระทรวงการท่องเที่ยวและกีฬา ${meta?.gst?.source?.year ? meta.gst.source.year + 543 : ''}`.trim(),
    'วัดเส้นตรงจากขอบย่าน (รอระยะตามทางจริง)'].join(' · ');
  const en = [pm ? `Living here: civil register of ${monthWords(pm)} spread over CityMETER Building V4` : 'Living here: civil register spread over CityMETER Building V4',
    'work and study: CityMETER datasets', `visitors: Ministry of Tourism and Sports ${meta?.gst?.source?.year || ''}`.trim(),
    'straight line from the edge (distances along real paths to come)'].join(' · ');
  return `<p class="hint people-source">${esc(L(th, en))}</p>`;
}

/** The method, folded: what each figure is, where it comes from and what it is not. */
export function peopleMethod(meta) {
  const items = [
    [L('คนอยู่ (แบบจำลอง)', 'Living here (modelled)'), L('ประชากรตามทะเบียนบ้านของแขวง/ตำบล (กรมการปกครอง) แบ่งลงทุกอาคารของ CityMETER Building V4 ตามพื้นที่ใช้สอย แล้วรวมอาคารที่จุดกึ่งกลางอยู่ในระยะ วิธีเดียวกับคนในทะเบียนบ้านของหน้าศูนย์การค้า · คนที่อยู่จริงแต่ไม่ได้ย้ายชื่อไม่ถูกนับ ย่านพาณิชย์จึงได้ตัวเลขสูงกว่าคนที่อยู่จริงได้ เพราะอาคารพาณิชย์ได้รับคนตามพื้นที่ด้วย',
      'The registered population of each subdistrict (Department of Provincial Administration) spread over every CityMETER Building V4 building by floor area, summed over the buildings whose centre is within the distance — the Shopping Center page’s method · people who live here without being registered are not counted, and a commercial area can read higher than the people who live there, since commercial buildings take people by floor area too')],
    [L('คนมาทำงานและเรียน (อย่างน้อย)', 'Come to work and study (at least)'), L('นักเรียนที่บันทึกปี 2569 + นักศึกษาของมหาวิทยาลัยที่ทุกวิทยาเขตอยู่ในระยะ + คนงานตามทะเบียนโรงงาน + บุคลากรที่หน่วยงานรัฐบันทึก + คนทำงานในสำนักงานแบบจำลอง (พื้นที่ × อัตราการเช่า ÷ 10–12 ตร.ม. ต่อคน ใช้ค่าต่ำในยอด) · ยังไม่มีคนทำงานร้านค้า โรงแรม และโรงพยาบาล ยอดจึงเป็น “อย่างน้อย” และปัดลง · นับเฉพาะรายการที่มีพิกัด · รายการที่ไม่มีตัวเลขไม่นับเป็นศูนย์ บอกว่ามีตัวเลขกี่แห่ง',
      'Students recorded for 2026 + students of universities whose every site is within the distance + workers on the factory register + staff that government offices record + office workers by model (area × occupancy ÷ 10–12 m² per person, the low end in the figure) · shop, hotel and hospital workers are not in it yet, so the figure is “at least”, rounded down · only records with a point count · a record without a figure is never taken as 0: the parts say how many carry one')],
    [L('ผู้มาเยือนค้างคืน (แบบจำลอง)', 'Overnight visitors (modelled)'), L('ผู้เข้าพักทั้งปีของจังหวัด (กระทรวงการท่องเที่ยวและกีฬา ตาราง 17.1 พ.ศ. 2567) แบ่งตามสัดส่วนห้องพักที่บันทึกในย่าน · ที่พักที่ไม่มีตัวเลขห้องไม่ถูกนับ · เป็นคนต่อปี ไม่ใช่ต่อคืน เพราะตารางไม่มีระยะพำนัก · คนที่มาเช้าไปเย็นกลับยังนับไม่ได้ จึงดูได้จากแผนที่ที่ผู้มาเยือนใช้',
      'The province’s guests of the year (Ministry of Tourism and Sports, Table 17.1, 2024) shared by the neighbourhood’s recorded rooms · lodging without a room figure is not counted · a year, not a night: the table has no length of stay · day visitors cannot be counted yet; the map of places visitors use stands for them')],
    [L('ระยะและระดับ', 'Distances and levels'), L('ในย่าน = ในขอบร่าง · 1 · 3 · 5 กม. = ในย่านและพื้นที่ห่างจากขอบไม่เกินระยะนั้น วัดเส้นตรงจนกว่าจะได้วิธีวัดตามทางจริงชุดเดียวกับหน้าศูนย์การค้า · วัดจากขอบ ตัวเลขจึงเทียบตรง ๆ กับวงจากจุดของศูนย์ไม่ได้ · ระดับเทียบ = อันดับกึ่งกลางเทียบ 395 ย่านอ้างอิง · ไม่ใช่คนเดิน จำนวนลูกค้า หรือยอดขาย',
      'Inside = within the draft outline · 1 · 3 · 5 km = inside and within that distance of the edge, a straight line until the Shopping Center page’s method along real paths is in hand · measured from the edge, so the figures do not compare one to one with a centre’s circles · level = mid-rank among the 395 reference neighbourhoods · not footfall, customers or sales')],
  ];
  return `<details class="scope-details people-method"><summary>${esc(L('วิธีคิดตัวเลขคน', 'How the people figures are made'))}</summary><dl>${items.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl></details>`;
}

/* ---------- the round 250 m maps ---------- */

const MAP_CFG = {
  visit: {th: 'ที่ผู้มาเยือนใช้', en: 'Places visitors use', scale: ACTIVITY_SCALE, unit: ['แห่งต่อช่อง', 'places per cell'],
    what: ['ที่พัก ศูนย์การค้าและตลาด ร้านของชำ ร้านอาหาร ร้านยา ฟิตเนส แบรนด์หรู และร้านกล้อง ต่อช่อง 250 × 250 ม.', 'stays, centres and markets, groceries, restaurants, pharmacies, fitness, luxury brands and camera shops per 250 × 250 m cell']},
  work: {th: 'ที่ทำงานและที่เรียน', en: 'Work and study', scale: COUNT_SCALE, unit: ['แห่งต่อช่อง', 'places per cell'],
    what: ['สำนักงาน หน่วยงานรัฐ โรงงาน นิคมอุตสาหกรรม มหาวิทยาลัย สถานพยาบาล และสถานศึกษา ต่อช่อง 250 × 250 ม.', 'offices, government offices, factories, industrial estates, universities, hospitals and schools per 250 × 250 m cell']},
  res: {th: 'คนอยู่', en: 'Living here', scale: DENSITY_SCALE, unit: ['คนต่อช่อง', 'people per cell'],
    what: ['คนในทะเบียนบ้าน (แบบจำลอง) ต่อช่อง 250 × 250 ม.', 'registered residents (modelled) per 250 × 250 m cell']},
};
// the datasets of each place map (scripts/build-people.py#MAP_GROUPS)
const MAP_GROUP_IDS = {visit: ['hotel', 'shoppingcenter', 'grocery', 'restaurant', 'pharmacy', 'fitness', 'luxurybrands', 'camera'],
  work: ['office', 'governmentoffice', 'factory', 'industrialestate', 'university', 'hospital', 'school']};
const BAND_WORDS = [['ในย่าน', 'Inside'], ['ถึง 1 กม.', 'to 1 km'], ['1–3 กม.', '1–3 km'], ['3–5 กม.', '3–5 km']];
export const DIRECTIONS = Object.freeze([['เหนือ', 'North'], ['ตะวันออกเฉียงเหนือ', 'Northeast'], ['ตะวันออก', 'East'], ['ตะวันออกเฉียงใต้', 'Southeast'],
  ['ใต้', 'South'], ['ตะวันตกเฉียงใต้', 'Southwest'], ['ตะวันตก', 'West'], ['ตะวันตกเฉียงเหนือ', 'Northwest']]);

/** The cells of one map as {k, v, band}, and its ramp (41 samples ranked within this map). */
export function mapModel(map, tab) {
  const cells = (map?.[tab] || []).map(([k, v, band]) => ({k, v, band}));
  const cfg = MAP_CFG[tab];
  const ramp = buildRamp(cells.map(c => c.v), {scale: cfg.scale, unit: L(...cfg.unit), format: tab === 'res' ? resFigure : (x => num(x))});
  return {cells, ramp, cfg};
}

/** (0.7.3) A modelled count of residents in a cell or a band: rounded as aboutPeople, “ไม่ถึง 10” under 10, 0 as 0. */
function resFigure(x) {
  if (!(x > 0)) return num(0);
  return x >= 10 ? aboutPeople(x) : L(...UNDER_10);
}

/**
 * The cells by direction (8 sectors of 45°, the first centred on north, from the neighbourhood's reference point) and by
 * band from the edge (inside · to 1 km · 1–3 · 3–5 km): {rows: [{th, en, v: [4], total, share}], top, total}.
 */
export function mapSectors(map, tab) {
  const {cells} = mapModel(map, tab);
  const {m, x0, y1, w} = map.cell;
  const sums = DIRECTIONS.map(() => [0, 0, 0, 0]);
  for (const c of cells) {
    const east = (x0 + (c.k % w) + 0.5) * m, north = (y1 - Math.floor(c.k / w) + 0.5) * m;
    const bearing = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
    const s = Math.floor(((bearing + 22.5) % 360) / 45);
    sums[s][c.band] += c.v;
  }
  const total = sums.reduce((a, r) => a + r[0] + r[1] + r[2] + r[3], 0);
  const rows = DIRECTIONS.map(([th, en], s) => {
    const sum = sums[s].reduce((a, b) => a + b, 0);
    return {th, en, v: sums[s], total: sum, share: total > 0 ? (100 * sum) / total : 0};
  });
  const top = rows.reduce((best, r) => (r.total > best.total ? r : best), rows[0]);
  const tops = top && top.total > 0 ? rows.filter(r => r.total === top.total) : [];
  return {rows, top, tops, total};
}

const isPale = fill => contrastRatio(fill, '#FFFFFF') < 1.25;

/**
 * What a reader finds the way by (0.7.1; owner 2026-11-26 17:51, VERBATIM: “แผนที่รัศมีควรจะมี โครงร่างถนน ทะเล ลำน้ำ
 * กายภาพ ให้ดูแบบเดียวกับ shopping center ด้วยได้มั้ยครับ”): map.ctx from scripts/build-context-map.py, OpenStreetMap of
 * the Shopping Center page's extract, in the map's own 25 m units. The sea and the water areas fill the ground under the
 * cells (a cell keeps its colour where it meets water); rivers, roads, rail and stations are drawn over the cells in the
 * ink and paper of the map's label chips, as «รอบศูนย์นี้» draws them — never a data colour, never a count.
 */
const ctxOf = map => (map?.ctx && Array.isArray(map.ctx.r) ? map.ctx : null);
const ROAD_ORDER = [3, 2, 1, 0];

function ctxUnder(ctx) {
  if (!ctx) return '';
  return (ctx.c ? `<path class="pm-sea" d="${esc(ctx.c)}" fill-rule="evenodd"/>` : '')
    + (ctx.a ? `<path class="pm-water" d="${esc(ctx.a)}" fill-rule="evenodd"/>` : '');
}

function ctxOver(ctx) {
  if (!ctx) return '';
  const roads = ROAD_ORDER.filter(c => ctx.r[c]);
  return '<g class="pm-ctx">'
    + (ctx.w ? `<path class="pm-river-case" d="${esc(ctx.w)}"/><path class="pm-river" d="${esc(ctx.w)}"/>` : '')
    + roads.map(c => `<path class="pm-road-case c${c}" d="${esc(ctx.r[c])}"/>`).join('')
    + roads.map(c => `<path class="pm-road c${c}" d="${esc(ctx.r[c])}"/>`).join('')
    + (ctx.t ? `<path class="pm-rail-case" d="${esc(ctx.t)}"/><path class="pm-rail" d="${esc(ctx.t)}"/>` : '')
    + (ctx.s || []).map(([x, y]) => `<circle class="pm-station" cx="${Number(x)}" cy="${Number(y)}" r="3.4"/>`).join('')
    + '</g>';
}

/** What the map draws to find the way by, in words (“ถนน ราง และลำน้ำ” · “roads, rail and rivers”), for its title. */
function ctxWords(map) {
  const ctx = ctxOf(map);
  if (!ctx) return '';
  const w = [ctx.r.some(Boolean) && ['ถนน', 'roads'], ctx.t && ['ราง', 'rail'], ctx.w && ['ลำน้ำ', 'rivers'],
    ctx.c && ['ทะเล', 'the sea'], ctx.a && ['แหล่งน้ำ', 'water']].filter(Boolean);
  if (!w.length) return '';
  const th = w.map(x => x[0]), en = w.map(x => x[1]);
  return L(th.length > 1 ? `${th.slice(0, -1).join(' ')} และ${th.at(-1)}` : th[0],
    en.length > 1 ? `${en.slice(0, -1).join(', ')} and ${en.at(-1)}` : en[0]);
}

/** The names the build placed (≤ 1 sea, 1 river, 4 roads, 3 stations; none overlap at 360 px); a name OpenStreetMap
 *  gives only in Thai stays Thai on the English page (it is a name, not a sentence). */
function ctxLabels(ctx, at) {
  return (ctx?.L || []).map(([kind, x, y, align, th, en]) => {
    const [lx, ly] = at(Number(x), Number(y));
    return `<span class="pm-lab is-${esc(kind)} at-${esc(align)}" style="left:${lx}%;top:${ly}%">${esc(L(th, en || th))}</span>`;
  }).join('');
}

/**
 * The names over a round map (0.7.2). The build fits them for a map 360 px wide; the panel draws it 250–440 px wide (the
 * live check of 0.7.1 found names touching on a 325 px map). Once the map is laid out, a name that would cover an
 * earlier name (map.ctx.L is in order of priority: the nearest station, the sea, the river, the roads, other stations),
 * a ring label or the north mark, would sit on the outline, or would leave the map, is hidden; 2 px of touching is
 * allowed. Runs again whenever the map changes size (watchMapNames). Returns how many names it hid.
 */
const TOUCH_PX = 2;
export function fitMapNames(wrap) {
  const box = wrap?.getBoundingClientRect?.();
  if (!box || !box.width) return 0;
  const svg = wrap.querySelector('.pm-map'), outline = wrap.querySelector('.pm-outline');
  const inv = svg?.getScreenCTM?.()?.inverse?.() || null;
  const onOutline = (x, y) => {
    if (!inv || typeof outline?.isPointInFill !== 'function') return false;
    const u = {x: inv.a * x + inv.c * y + inv.e, y: inv.b * x + inv.d * y + inv.f};
    return outline.isPointInFill(typeof DOMPoint === 'function' ? new DOMPoint(u.x, u.y) : u);
  };
  const taken = [...wrap.querySelectorAll('.pm-ring-label, .pm-north')].map(e => e.getBoundingClientRect());
  let hid = 0;
  for (const lab of wrap.querySelectorAll('.pm-lab')) {
    lab.hidden = false;
    const r = lab.getBoundingClientRect();
    const out = r.left < box.left - TOUCH_PX || r.right > box.right + TOUCH_PX || r.top < box.top - TOUCH_PX || r.bottom > box.bottom + TOUCH_PX;
    const hit = taken.some(t => r.left + TOUCH_PX < t.right && t.left + TOUCH_PX < r.right && r.top + TOUCH_PX < t.bottom && t.top + TOUCH_PX < r.bottom);
    const onLine = !out && !hit && [0.1, 0.5, 0.9].some(fx => [0.2, 0.5, 0.8].some(fy => onOutline(r.left + fx * r.width, r.top + fy * r.height)));
    if (out || hit || onLine) { lab.hidden = true; hid++; } else taken.push(r);
  }
  return hid;
}

let nameWatch = null;
/** Fit the names of every round map under root now, again when a map changes size, and once the fonts have loaded. */
export function watchMapNames(root) {
  const wraps = [...(root?.querySelectorAll?.('.pm-wrap') || [])];
  if (typeof ResizeObserver === 'function') {
    nameWatch ||= new ResizeObserver(entries => { for (const e of entries) fitMapNames(e.target); });
    nameWatch.disconnect();
    for (const w of wraps) nameWatch.observe(w);
  } else {
    wraps.forEach(fitMapNames);
  }
  if (wraps.length && globalThis.document?.fonts?.ready) document.fonts.ready.then(() => wraps.forEach(w => w.isConnected && fitMapNames(w)));
}

/** The SVG of one map: cells (runs of one colour per row), the 5 km ground, the service lines, the walk edges, the outline. */
export function mapSVG(row, map, tab, {title = ''} = {}) {
  const {cells, ramp} = mapModel(map, tab);
  const {x0, y1, w, h} = map.cell, U = 10;   // a 250 m cell is 10 units of 25 m
  const fill = new Map(cells.map(c => [c.k, classify(c.v, ramp).fill]));
  const paths = new Map();
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w;) {
      const f = fill.get(r * w + c);
      if (!f) { c++; continue; }
      let e = c + 1;
      while (e < w && fill.get(r * w + e) === f) e++;
      const x = (x0 + c) * U, y = (r - y1 - 1) * U;
      paths.set(f, `${paths.get(f) || ''}M${x} ${y}h${(e - c) * U}v${U}h${-(e - c) * U}z`);
      c = e;
    }
  }
  const pad = 6, vx = x0 * U - pad, vy = -(y1 + 1) * U - pad, vw = w * U + 2 * pad, vh = h * U + 2 * pad;
  const at = (x, y) => [(((x - vx) / vw) * 100).toFixed(2), (((y - vy) / vh) * 100).toFixed(2)];
  const L_ = map.lines || {};
  const ctx = ctxOf(map);
  const id = `pm-${tab}-${String(row.id).replace(/[^\w-]/g, '')}`;
  const labels = ['s1', 's3', 's5'].filter(k => L_.lab?.[k]).map(k => {
    const [lx, ly] = at(...L_.lab[k]);
    return `<span class="pm-ring-label" style="left:${lx}%;top:${ly}%">${esc(L(`${k.slice(1)} กม.`, `${k.slice(1)} km`))}</span>`;
  }).join('');
  return `<div class="pm-wrap"><svg class="pm-map" viewBox="${vx} ${vy} ${vw} ${vh}" role="img" aria-labelledby="${id}-t"><title id="${id}-t">${esc(title)}</title>`
    + `<defs><clipPath id="${id}-c"><path d="${esc(L_.s5 || '')}"/></clipPath></defs>`
    + `<path class="pm-bg" d="${esc(L_.s5 || '')}"/><g clip-path="url(#${id}-c)">`
    + ctxUnder(ctx)
    + [...paths].map(([f, d]) => `<path d="${d}" fill="${f}" shape-rendering="crispEdges"${isPale(f) ? ' class="pm-pale"' : ''}/>`).join('')
    + ctxOver(ctx)
    + '</g>'
    + ['s3', 's1'].filter(k => L_[k]).map(k => `<path class="pm-line" d="${esc(L_[k])}"/>`).join('')
    + `<path class="pm-edge" d="${esc(L_.s5 || '')}"/>`
    + ['w800', 'w400'].filter(k => L_[k]).map(k => `<path class="pm-walk" d="${esc(L_[k])}"/>`).join('')
    + `${L_.o ? `<path class="pm-outline-case" d="${esc(L_.o)}"/><path class="pm-outline" d="${esc(L_.o)}"/>` : ''}</svg>`
    + `${labels}${ctxLabels(ctx, at)}<span class="pm-north" aria-hidden="true">↑ ${esc(L('เหนือ', 'N'))}</span></div>`;
}

/** The key of the lines over the map; the context items only for what this map draws. */
function mapKey(map) {
  const line = (cls, th, en, cased = false) => `<span class="pm-key-item"><svg class="pm-key-line" viewBox="0 0 24 8" aria-hidden="true">${cased ? `<path class="${cls.split(' ')[0]}-case${cls.includes(' ') ? ` ${cls.split(' ')[1]}` : ''}" d="M2 4h20"/>` : ''}<path class="${cls}" d="M2 4h20"/></svg>${esc(L(th, en))}</span>`;
  const cell = `<span class="pm-key-item"><svg class="pm-key-cell" viewBox="0 0 12 12" aria-hidden="true"><rect class="pm-bg" x="0.5" y="0.5" width="11" height="11"/></svg>${esc(L('ไม่มีในชุดข้อมูลที่นับ', 'none in the datasets counted'))}</span>`;
  const ctx = ctxOf(map);
  const water = ctx && (ctx.c || ctx.a) ? `<span class="pm-key-item"><svg class="pm-key-cell" viewBox="0 0 12 12" aria-hidden="true"><rect class="${ctx.c ? 'pm-sea' : 'pm-water'}" x="0.5" y="0.5" width="11" height="11"/></svg>${esc(ctx.c ? L('ทะเลและแหล่งน้ำ', 'Sea and water') : L('แหล่งน้ำ', 'Water'))}</span>` : '';
  const station = ctx?.s?.length ? `<span class="pm-key-item"><svg class="pm-key-line" viewBox="0 0 24 8" aria-hidden="true"><circle class="pm-station" cx="12" cy="4" r="3"/></svg>${esc(L('สถานี', 'Stations'))}</span>` : '';
  const context = ctx ? [
    ctx.r.some(Boolean) ? line('pm-road c2', 'ถนนสายหลัก', 'Major roads', true) : '',
    ctx.t ? line('pm-rail', 'รถไฟฟ้าและรถไฟ', 'Rail lines', true) : '',
    station,
    ctx.w ? line('pm-river', 'ลำน้ำ', 'Rivers', true) : '',
    water,
  ].join('') : '';
  return `<p class="pm-key">${line('pm-outline', 'ขอบย่าน', 'Neighbourhood outline', true)}${line('pm-walk', 'ขอบเดินถึง 400 · 800 ม.', 'Walkable edge 400 · 800 m')}${line('pm-line', '1 · 3 · 5 กม. จากขอบ', '1 · 3 · 5 km from the edge')}${cell}${context}</p>`;
}

/** The map read as a table: 8 directions × 4 bands from the edge, places (or people) per band, the top direction bold. */
function mapTable(sec, cfg, tab = '') {
  const res = tab === 'res';
  const fmt = v => (res ? resFigure(v || 0) : num(Math.round(v || 0)));
  const head = `<tr><th scope="col">${esc(L('ทิศ', 'Direction'))}</th>${BAND_WORDS.map(b => `<th scope="col">${esc(L(...b))}</th>`).join('')}<th scope="col">${esc(L('รวมทิศนี้', 'This direction'))}</th></tr>`;
  const rows = sec.rows.map(r => `<tr${r === sec.top && r.total > 0 ? ' class="is-top"' : ''}><th scope="row">${esc(L(r.th, r.en))}</th>${r.v.map(v => `<td class="data-number">${esc(fmt(v))}</td>`).join('')}<td class="data-number">${esc(fmt(r.total))}<small>${num(Math.round(r.share))}%</small></td></tr>`).join('');
  const note = res
    ? L('ช่อง 250 ม. นับเข้าทิศและระยะตามจุดกึ่งกลางช่อง · คนอยู่เป็นแบบจำลอง ปัดเป็นหลักสิบ ร้อย หรือพัน · 0 = ไม่มีคนในทะเบียนที่แบ่งลงอาคารในช่องนั้น · ทิศวัดจากจุดอ้างอิงของย่าน',
      'A 250 m cell goes to a direction and a band by its centre · residents are modelled, rounded to tens, hundreds or thousands · 0 = no registered residents spread to a building there · directions from the neighbourhood’s reference point')
    : L('ช่อง 250 ม. นับเข้าทิศและระยะตามจุดกึ่งกลางช่อง · 0 = ไม่พบในชุดข้อมูลที่นับ · ทิศวัดจากจุดอ้างอิงของย่าน', 'A 250 m cell goes to a direction and a band by its centre · 0 = none in the datasets counted · directions from the neighbourhood’s reference point');
  return `<details class="scope-details pm-table-fold"><summary>${esc(L('อ่านแผนที่เป็นตาราง', 'Read the map as a table'))}</summary><div class="table-scroll"><table class="pm-table"><caption class="sr-only">${esc(L(`${cfg.th} แยกทิศและระยะจากขอบ`, `${cfg.en} by direction and distance from the edge`))}</caption><thead>${head}</thead><tbody>${rows}</tbody></table></div><p class="hint">${esc(note)}</p></details>`;
}

/** «แผนที่รอบย่าน»: three tabs, the map of the chosen one, its legend and key, the top direction and the table. */
export function mapSection(row, rec, meta, {tab = DEFAULT_MAP, prov = null, outOfScope = null} = {}) {
  if (!rec?.map) return '';
  const map = rec.map;
  const has = t => t !== 'res' || Array.isArray(map.res);
  const current = mapTabOf(map, tab);
  const cfg = MAP_CFG[current];
  const tabs = `<div class="pm-tabs" role="group" aria-label="${esc(L('แผนที่ของ', 'Map of'))}">${MAP_TABS.map(t => `<button type="button" class="seg" data-action="set-map" data-value="${t}" aria-pressed="${t === current}"${has(t) ? '' : ' disabled'}>${esc(L(MAP_CFG[t].th, MAP_CFG[t].en))}${has(t) ? '' : ` <small>${esc(L('รอบถัดไป', 'next round'))}</small>`}</button>`).join('')}</div>`;
  const {cells, ramp} = mapModel(map, current);
  const sec = mapSectors(map, current);
  // no name in the title: the panel names the neighbourhood, and a name in an English sentence would leave Thai in it
  const found = ctxWords(map);
  const title = L(`${cfg.th}: ${cfg.what[0]} ในระยะ 5 กม. จากขอบย่าน ทิศเหนืออยู่ด้านบน${found ? ` มี${found}ให้ดูตำแหน่ง` : ''}`, `${cfg.en}: ${cfg.what[1]} within 5 km of the neighbourhood’s edge, north up${found ? `, with ${found} to find the way by` : ''}`);
  const res = current === 'res';
  const most = res ? (ramp.max >= 10 ? L(`ราว ${aboutPeople(ramp.max)}`, `about ${aboutPeople(ramp.max)}`) : L(...UNDER_10)) : num(ramp.max);
  const lead = cells.length
    ? `${esc(L(`${num(cells.length)} ช่องที่มี · มากสุด`, `${num(cells.length)} cells with any · up to`))} ${nw(esc(`${most} ${L(...cfg.unit)}`))}`
    : esc(res ? L('ยังไม่มีข้อมูลอาคารในระยะ 5 กม.', 'No building data within 5 km yet') : L('ไม่พบในชุดข้อมูลที่นับในระยะ 5 กม. (0)', 'None in the datasets counted within 5 km (0)'));
  const tied = sec.tops.length > 1;
  const dir = sec.total > 0 ? `<p class="pm-dir">${pic('distance')}<span>${esc(tied
    ? L(`ทิศ${sec.tops.map(t => t.th).join(' และ ')} มีมากเท่ากัน ทิศละ ${num(Math.round(sec.top.share))}% ของทั้งแผนที่`, `${sec.tops.map(t => t.en).join(' and ')} hold the most, ${num(Math.round(sec.top.share))}% of the map each`)
    : L(`ทิศ${sec.top.th}มีมากที่สุด ${num(Math.round(sec.top.share))}% ของทั้งแผนที่`, `${sec.top.en} holds the most, ${num(Math.round(sec.top.share))}% of the map`))}</span></p>` : '';
  const legend = ramp.levels.length ? `<div class="pm-legend"><span class="pm-legend-title">${esc(L(`${cfg.unit[0]} 250 × 250 ม. · สีเทียบเฉพาะในแผนที่นี้`, `${cfg.unit[1]}, 250 × 250 m · colours compare within this map only`))}</span>${rampLegendHTML(ramp)}</div>` : '';
  const lacking = res || !outOfScope ? [] : outOfScope(MAP_GROUP_IDS[current] || []);
  const what = res
    ? L(`${cfg.what[0]} · คนของอาคารที่อยู่ห่างขอบย่านไม่เกิน 5 กม. เส้นตรง รวมลงช่อง`, `${cfg.what[1]} · the residents of buildings within 5 km of the edge, straight line, added per cell`)
    : L(`${cfg.what[0]} · สถานที่ที่อยู่ห่างขอบย่านไม่เกิน 5 กม. เส้นตรง นับลงช่อง · ไม่ใช่จำนวนคนหรือจำนวนครั้งที่มา`, `${cfg.what[1]} · places within 5 km of the edge, straight line, counted in cells · not people or visits`);
  const source = `<p class="hint pm-source">${esc(what)}${lacking.length ? `<br>${esc(L(`ไม่มีข้อมูลในจังหวัดนี้: ${lacking.join(' · ')}`, `no data in this province: ${lacking.join(' · ')}`))}` : ''}</p>${typeof prov === 'function' ? prov(current) : ''}`;
  return `<section class="panel-section map-section" id="nb-map" aria-labelledby="nb-map-title"><div class="section-heading"><h3 id="nb-map-title">${pic('maps')}${esc(L('แผนที่รอบย่าน ช่อง 250 ม.', 'Around the neighbourhood, 250 m cells'))} <span class="glance-tag">${esc(current === 'res' ? L('แบบจำลอง', 'modelled') : L('อนุมาน', 'inferred'))}</span></h3></div>
    ${tabs}<p class="pm-lead">${lead}</p>${mapSVG(row, map, current, {title})}${legend}${mapKey(map)}${dir}${mapTable(sec, cfg, current)}${source}</section>`;
}
