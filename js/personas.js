/**
 * CityMETER · Commercial District — who stands out in a neighbourhood, its price level and the neighbourhoods most alike
 * (0.9.0; pure: HTML strings from data/profile.json, no DOM, no map).
 *
 * Owner 2026-11-29 00:41, VERBATIM (items 1–3 of his message):
 *   “1) ย่านที่ส่วนผสมคล้ายกัน มันควรจะดูด้านขนาดด้วยนะ เช่น จำนวนคน ความถี่ และด้านคุณภาพ จำนวนเงิน ระดับราคา … ระดับราคาของ
 *   โรงเรียน โรงแรม คอนโด บ้านจัดสรร etc พวกนี้ ควรจะใช้ infer ได้
 *   2) ที่อยากให้ทำได้มากๆคือระบุ persona เด่นๆ ในย่าน ออกมาให้เห็นชัดว่าเป็นใคร ใน traffic แต่ละประเภท ทั้ง คนอยู่, ผู้มาเยือน,
 *   คนทำงาน_เรียน อยู่ในย่านช่วงไหน ว่าซื้ออะไรหรือมาทำอะไรในย่านบ้าง
 *   3) ส่วนลายมือย่านที่เป็น icon เยอะๆ คือผมดูไม่รู้เรื่องเลย … อย่าหวังว่า first-time user จะไม่งง”
 *
 * Rules (DATA_METHOD.md §22): a profile is an Inference — its rule holds on counted records within the walkable edge (800 m)
 * and the people figures within 1 km; its week is a Hypothesis (no hour is measured); never people counts, customers, footfall
 * or sales. The price level is an Inference from recorded prices and proxies, each against every neighbourhood that has it;
 * never a price, an income or a spend. The three groups are never added. Every number carries its unit; a dataset with points
 * for under 90 % of its records keeps its star. Words, not icon grids: every pictogram stands beside its words.
 */
import {LANG} from './shell/i18n.js';
import {num, dsName, dsUnitN, lowLocated, provinceName} from './model.js';
import {aboutPeople, atLeastPeople} from './people.js';
import {GRID_LEVELS, CUTS} from './daypart.js';

const EN = LANG === 'en';
const L = (th, en) => (EN ? en : th);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pic = (role, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(role)}" aria-hidden="true"></i>`;
const nw = html => `<span class="nowrap">${html}</span>`;
const b = v => `<b class="data-number">${esc(v)}</b>`;
const hh = h => String(h).padStart(2, '0');

/* ---------- decoding ---------- */

/** data/profile.json → {meta, rows: Map(id → record)}; null when the file is not the schema the page reads. */
export function decodeProfile(json) {
  if (!json?.meta || json.meta.schema !== 'citymeter-commercialdistrict-profile/1' || !json.rows) return null;
  return {meta: json.meta, rows: new Map(Object.entries(json.rows))};
}

/* ---------- the price level (Inference) ---------- */

/** Words of a level 0–100, five steps. */
export const PRICE_WORDS = Object.freeze([['ประหยัด', 'Budget'], ['ค่อนข้างประหยัด', 'Fairly budget'], ['กลาง', 'Middle'], ['ค่อนข้างสูง', 'Fairly high'], ['สูง', 'High']]);
export const priceStep = lv => (lv == null ? -1 : Math.min(4, Math.floor(lv / 20)));
export const priceWord = lv => (lv == null ? '' : L(...PRICE_WORDS[priceStep(lv)]));

/** One reading in words: [label, value sentence, records] — the reading's own unit; `p` is its place among neighbourhoods. */
export function readingWords(id, x) {
  const [v, n] = x;
  switch (id) {
    case 'hotel': return [L('ที่พัก', 'Lodging'), L(`ราคาที่บันทึกกลาง ${num(v)} บาท/คืน`, `median recorded price ${num(v)} baht a night`), L(`${num(n)} แห่ง`, `${num(n)} places`)];
    case 'condo': return [L('ห้องชุด', 'Condominiums'), L(`ราคาประเมินกลาง ${num(v)} บาท/ตร.ม.`, `median appraisal ${num(v)} baht/m²`), L(`${num(n)} รายการ`, `${num(n)} records`)];
    case 'rest': return [L('ร้านอาหาร', 'Restaurants'), L(`${num(v)}% ราคา 300 บาทขึ้นไป`, `${num(v)}% priced 300 baht or more`), L(`จาก ${num(n)} ร้านที่มีราคา`, `of ${num(n)} with a price`)];
    case 'office': return [L('สำนักงาน', 'Offices'), L(`ค่าเช่ากลาง ${num(Math.round(v))} บาท/ตร.ม./เดือน`, `median asking rent ${num(Math.round(v))} baht/m² a month`), L(`${num(n)} รายการที่มีค่าเช่า`, `${num(n)} with a rent`)];
    case 'school': return [L('โรงเรียน', 'Schools'), L(`เอกชนและนานาชาติ ${num(v)}%`, `${num(v)}% private or international`), L(`จาก ${num(n)} แห่ง`, `of ${num(n)}`)];
    case 'grocery': return [L('ซูเปอร์มาร์เก็ต', 'Supermarkets'), L(`แบรนด์ระดับบน ${num(v)}%`, `${num(v)}% upmarket banners`), L(`จาก ${num(n)} ร้าน`, `of ${num(n)} stores`)];
    case 'lux': return [L('แบรนด์หรู', 'Luxury brands'), L(`${num(v)} จุดขาย`, `${num(v)} points of sale`), ''];
    default: return [id, num(v), ''];
  }
}

/** A five-step meter (the same marks as «ใครอยู่ตรงนี้», neutral ink: a level of price is no data colour of a dataset). */
const meter = (step, cls = 'level-meter') => `<span class="${cls}" aria-hidden="true">${[0, 1, 2, 3, 4].map(k => `<i class="${k <= step ? 'on' : ''}"></i>`).join('')}</span>`;

/** The head's price line: the level in words, its five-step meter and how many readings it rests on; '' without a level. */
export function priceLine(prof) {
  const pr = prof?.pr;
  if (!pr) return '';
  const n = Object.keys(pr.c || {}).length;
  if (pr.lv == null) {
    return `<p class="pl-line is-unknown">${pic('fee')}<span class="pl-label">${esc(L('ระดับราคา', 'Price level'))}</span> <span class="hint">${esc(L('ข้อมูลราคายังไม่พอบอก', 'not enough price data to say'))}${n ? esc(L(` (มี ${num(n)} ด้าน ต้องมีอย่างน้อย 2)`, ` (${num(n)} reading; at least 2 needed)`)) : ''}</span></p>`;
  }
  const s = priceStep(pr.lv);
  return `<p class="pl-line">${pic('fee')}<span class="pl-label">${esc(L('ระดับราคาในย่าน', 'Price level here'))}</span> ${meter(s)} <b class="pl-word">${esc(priceWord(pr.lv))}</b> <span class="pl-num data-number">${esc(num(Math.round(pr.lv)))}/100</span></p>`;
}

/** The readings behind the level, folded: each with its value, its records and its place among neighbourhoods. */
export function priceDetails(prof, meta) {
  const pr = prof?.pr;
  if (!pr || !Object.keys(pr.c || {}).length) return '';
  const order = meta?.price?.order || Object.keys(pr.c);
  const items = order.filter(id => pr.c[id]).map(id => {
    const [label, value, recs] = readingWords(id, pr.c[id]);
    const p = pr.c[id][2];
    return `<li><span class="pd-label">${esc(label)}</span> <span class="pd-value">${esc(value)}</span>${recs ? ` <span class="hint">(${esc(recs)})</span>` : ''} <span class="pd-place">${esc(L(`สูงกว่า ${num(Math.round(p))}% ของย่าน`, `above ${num(Math.round(p))}% of neighbourhoods`))}</span></li>`;
  }).join('');
  const gaps = L('ยังไม่มีราคาในชุดข้อมูล: บ้านจัดสรร (มีจำนวนแปลงและแบบบ้าน ไม่มีราคา) · ค่าเล่าเรียนมีเฉพาะโรงเรียนนานาชาติบางแห่ง', 'No price in the data yet: housing estates (plots and house types, no price) · tuition only for some international schools');
  return `<details class="scope-details pd-fold"><summary>${esc(L('ระดับราคามาจากอะไร', 'What the price level rests on'))}</summary>
    <ul class="pd-list">${items}</ul>
    <p class="hint">${esc(L(`ในย่านและขอบเดินถึง 800 ม. · ระดับ = ค่าเฉลี่ยของอันดับร้อยละแต่ละด้านเทียบทุกย่านที่มีด้านนั้น (ต้องมีอย่างน้อย 2 ด้าน) · อนุมานจากราคาที่บันทึกและสัดส่วนประเภทร้าน ไม่ใช่ราคาวันนี้ รายได้ หรือการใช้จ่าย · ราคาห้องพักเป็นราคาที่แหล่งบันทึก ไม่ทราบช่วงเวลา · ราคาห้องชุดเป็นราคาประเมินในทะเบียนวิจัย ไม่ใช่ราคาซื้อขาย`,
      `Inside and within the 800 m walkable edge · level = the mean of each reading’s percentile among every neighbourhood that has it (at least 2 readings) · inferred from recorded prices and shares of kinds of store, not today’s prices, incomes or spending · lodging prices are the source’s recorded prices, period unknown · condominium prices are the research register’s appraisal, not sale prices`))} · ${esc(gaps)}</p></details>`;
}

/* ---------- who stands out (Inference) ---------- */

const WD = [0, 1, 2, 3, 4];
// a day of 24 hours from runs: [[from, to, value], …] over a floor
const day = (floor, runs) => { const d = Array(24).fill(floor); for (const [f, t, v] of runs) for (let h = f; h < t; h++) d[h % 24] = Math.max(d[h % 24], v); return d; };

/**
 * The profiles: their group, pictogram, words, the sentence of their evidence (from the facts data/profile.json gives) and
 * their likely week (weekday, weekend), a Hypothesis written for each profile, levels relative to its own busiest hour.
 */
export const PERSONAS = Object.freeze({
  condo_upper: {g: 'res', icon: 'building', th: 'คนทำงานในเมืองที่อยู่คอนโดราคาสูง', en: 'City workers in high-priced condominiums',
    why: ([n, p]) => L(`ห้องชุด ${num(n)} รายการ ราคาประเมินกลาง ${num(p)} บาท/ตร.ม.`, `${num(n)} condominium records, median appraisal ${num(p)} baht/m²`),
    week: [day(0.1, [[6, 8, 0.45], [18, 23, 1]]), day(0.2, [[9, 13, 0.6], [13, 18, 0.7], [18, 23, 0.9]])],
    doTh: 'เช้าออกไปทำงาน ค่ำกลับมากิน ซื้อของ ออกกำลังกาย', doEn: 'Out to work in the morning; back for dinner, shopping and exercise in the evening'},
  condo: {g: 'res', icon: 'building', th: 'คนทำงานที่อยู่คอนโด', en: 'Workers living in condominiums',
    why: ([n, p]) => L(`ห้องชุด ${num(n)} รายการ ราคาประเมินกลาง ${num(p)} บาท/ตร.ม.`, `${num(n)} condominium records, median appraisal ${num(p)} baht/m²`),
    week: [day(0.1, [[6, 8, 0.5], [17, 22, 1]]), day(0.2, [[8, 12, 0.6], [12, 18, 0.7], [18, 22, 0.9]])],
    doTh: 'ซื้อของใช้ใกล้ที่พัก กินข้าวเย็น ซักผ้า ออกกำลังกาย', doEn: 'Everyday shopping near home, dinner, laundry and exercise'},
  estate: {g: 'res', icon: 'housing', th: 'ครอบครัวในหมู่บ้านจัดสรร', en: 'Families in housing estates',
    why: ([n, plots]) => L(`ใบอนุญาตจัดสรร ${num(n)} ใบ รวม ${num(plots)} แปลง`, `${num(n)} land-allocation permits, ${num(plots)} plots`),
    week: [day(0.1, [[6, 8, 0.5], [16, 20, 0.9]]), day(0.15, [[9, 19, 1]])],
    doTh: 'จ่ายของเข้าบ้านครั้งใหญ่ พาลูกไปโรงเรียน เที่ยวห้างวันหยุด', doEn: 'Big household shops, school runs, malls at weekends'},
  family: {g: 'res', icon: 'child', th: 'ครอบครัวที่มีลูกวัยเรียน', en: 'Families with school-age children',
    why: ([n, stu], s) => L(`โรงเรียน ${num(n)} แห่ง${s('school')} นักเรียน ${num(stu)} คน`, `${num(n)} schools${s('school')}, ${num(stu)} students`),
    week: [day(0.1, [[6, 8, 0.9], [15, 17, 1], [17, 20, 0.6]]), day(0.15, [[9, 18, 0.8]])],
    doTh: 'รับส่งลูก ซื้อของกิน พาลูกไปสวนและสนามเด็กเล่น', doEn: 'School runs, food shopping, parks and playgrounds with the children'},
  family_private: {g: 'res', icon: 'child', th: 'ครอบครัวที่ส่งลูกเรียนเอกชนหรือนานาชาติ', en: 'Families with children at private or international schools',
    why: ([n, stu, priv, intl], s) => L(`โรงเรียน ${num(n)} แห่ง${s('school')} เป็นเอกชนและนานาชาติ ${num(priv)} แห่ง${intl ? ` (นานาชาติ ${num(intl)})` : ''} นักเรียน ${num(stu)} คน`, `${num(n)} schools${s('school')}, ${num(priv)} private or international${intl ? ` (${num(intl)} international)` : ''}, ${num(stu)} students`),
    week: [day(0.1, [[6, 8, 1], [15, 17, 1], [17, 20, 0.6]]), day(0.15, [[9, 18, 0.8]])],
    doTh: 'รับส่งลูกเช้า–เย็น เรียนพิเศษ ซื้อของในซูเปอร์มาร์เก็ตและห้าง', doEn: 'School runs, tutoring, supermarket and mall shopping'},
  student_rent: {g: 'res', icon: 'students', th: 'นักศึกษาที่เช่าหอใกล้มหาวิทยาลัย', en: 'Students renting near the university',
    why: ([n, apt]) => L(`มหาวิทยาลัย ${num(n)} แห่ง อพาร์ตเมนต์และเซอร์วิสอพาร์ตเมนต์ ${num(apt)} แห่ง`, `${num(n)} university sites, ${num(apt)} apartments`),
    week: [day(0.15, [[7, 9, 0.5], [11, 13, 0.6], [17, 24, 1], [0, 1, 0.7]]), day(0.25, [[11, 24, 0.9], [0, 1, 0.7]])],
    doTh: 'กินร้านราคาย่อมเยา คาเฟ่ ร้านสะดวกซื้อดึก ร้านมือถือและเครื่องเขียน', doEn: 'Cheap meals, cafés, late convenience stores, phone and stationery shops'},
  local_community: {g: 'res', icon: 'home', th: 'คนในชุมชนเดิม จ่ายตลาดใกล้บ้าน', en: 'Long-settled community shopping at local markets',
    why: ([m, t, v]) => L(`ตลาด ${num(m)} แห่ง ศาสนสถาน ${num(t)} แห่ง${v ? ` ร้านถูกดีมีมาตรฐาน ${num(v)} ร้าน` : ''}`, `${num(m)} markets, ${num(t)} places of worship${v ? `, ${num(v)} Tookdee community stores` : ''}`),
    week: [day(0.15, [[5, 8, 1], [16, 19, 0.8]]), day(0.2, [[5, 9, 1], [9, 12, 0.6], [16, 19, 0.7]])],
    doTh: 'จ่ายตลาดเช้าตรู่และเย็น ทำบุญ ซื้อทอง ใช้ธนาคารใกล้บ้าน', doEn: 'Early and evening market runs, merit-making at temples, gold shops, local banks'},
  biz: {g: 'gst', icon: 'luggage', th: 'นักเดินทางธุรกิจและผู้มาประชุม', en: 'Business travellers and conference visitors',
    why: ([h, med, o, m], s) => L(`ที่พัก ${num(h)} แห่ง${med != null ? ` ราคาที่บันทึกกลาง ${num(med)} บาท/คืน` : ''}${o ? ` สำนักงาน ${num(o)} รายการ${s('office')}` : ''}${m ? ` ที่พักมีห้องประชุม ${num(m)} แห่ง` : ''}`, `${num(h)} places to stay${med != null ? `, median recorded price ${num(med)} baht a night` : ''}${o ? `, ${num(o)} offices${s('office')}` : ''}${m ? `, ${num(m)} with meeting rooms` : ''}`),
    week: [day(0.2, [[7, 9, 0.6], [12, 14, 0.7], [18, 22, 1]]), day(0.15, [[10, 20, 0.4]])],
    doTh: 'ประชุมและงานแสดงสินค้ากลางวัน กินเลี้ยงค่ำ นวด เดินห้าง', doEn: 'Meetings and fairs by day, dinners, massages and malls in the evening'},
  upscale: {g: 'gst', icon: 'luggage', th: 'นักท่องเที่ยวกำลังซื้อสูง', en: 'High-spending visitors',
    why: ([p, r, lux]) => L(`ที่พักราคา 2,500 บาทขึ้นไป ${num(p)} แห่ง ${num(r)} ห้อง${lux ? ` แบรนด์หรู ${num(lux)} จุดขาย` : ''}`, `${num(p)} places at 2,500 baht or more, ${num(r)} rooms${lux ? `, ${num(lux)} luxury points of sale` : ''}`),
    week: [day(0.15, [[10, 18, 0.7], [18, 23, 1]]), day(0.2, [[10, 18, 0.85], [18, 23, 1]])],
    doTh: 'ช้อปแบรนด์ดัง กินร้านอาหารนานาชาติ สปาและคลินิกความงาม', doEn: 'Designer shopping, international dining, spas and beauty clinics'},
  budget: {g: 'gst', icon: 'luggage', th: 'นักท่องเที่ยวงบประหยัด', en: 'Budget travellers',
    why: ([p, r]) => L(`เกสต์เฮาส์ โฮมสเตย์ และที่พักราคาต่ำกว่า 800 บาท ${num(p)} แห่ง ${num(r)} ห้อง`, `${num(p)} guesthouses, homestays and rooms under 800 baht, ${num(r)} rooms`),
    week: [day(0.2, [[10, 17, 0.6], [18, 24, 1], [0, 2, 0.8]]), day(0.25, [[10, 17, 0.7], [18, 24, 1], [0, 2, 0.9]])],
    doTh: 'กินร้านไทยราคาย่อมเยา นวด เที่ยวกลางคืน เดินทางด้วยระบบราง', doEn: 'Cheap Thai food, massages, nightlife, getting around by rail'},
  resort: {g: 'gst', icon: 'sea', th: 'นักท่องเที่ยวพักผ่อนแบบรีสอร์ท', en: 'Resort holidaymakers',
    why: ([n, r]) => L(`รีสอร์ท ${num(n)} แห่ง ${num(r)} ห้อง`, `${num(n)} resorts, ${num(r)} rooms`),
    week: [day(0.2, [[8, 12, 0.6], [16, 21, 1]]), day(0.25, [[8, 12, 0.8], [16, 21, 1]])],
    doTh: 'เที่ยวธรรมชาติกลางวัน สปาและนวด อาหารเย็นริมทะเลหรือริมน้ำ', doEn: 'Nature by day, spas and massages, sunset dinners'},
  culture: {g: 'gst', icon: 'temple', th: 'นักท่องเที่ยวสายวัดและวัฒนธรรม', en: 'Temple and culture visitors',
    why: ([a, t, x], s) => L(`แหล่งท่องเที่ยว ${num(a)} แห่ง ศาสนสถาน ${num(t)} แห่ง${x ? ` พิพิธภัณฑ์และหอศิลป์ ${num(x)} แห่ง${s('arts')}` : ''}`, `${num(a)} attractions, ${num(t)} places of worship${x ? `, ${num(x)} museums and galleries${s('arts')}` : ''}`),
    week: [day(0.1, [[8, 12, 1], [12, 17, 0.8]]), day(0.15, [[8, 12, 1], [12, 17, 0.9]])],
    doTh: 'ไหว้พระ ชมพิพิธภัณฑ์ช่วงเช้าถึงบ่าย กินอาหารไทย ซื้อของฝาก', doEn: 'Temples and museums from morning to afternoon, Thai food, souvenirs'},
  shopper: {g: 'gst', icon: 'venue', th: 'คนมาช้อปและเดินตลาด (ไปกลับ)', en: 'Day visitors who come to shop and stroll',
    why: ([m, k, c]) => L(`ศูนย์การค้า ${num(m)} แห่ง ตลาด ${num(k)} แห่ง${c ? ` คอมมูนิตี้มอลล์ ${num(c)} แห่ง` : ''}`, `${num(m)} malls, ${num(k)} markets${c ? `, ${num(c)} community malls` : ''}`),
    week: [day(0.1, [[11, 17, 0.6], [17, 21, 0.85]]), day(0.15, [[11, 21, 1]])],
    doTh: 'ช้อปเสื้อผ้าและความงาม ดูหนัง กินคาเฟ่ เดินตลาดเย็น', doEn: 'Fashion and beauty shopping, cinema, cafés, evening markets'},
  patient: {g: 'gst', icon: 'hospital', th: 'ผู้ป่วยและญาติ', en: 'Patients and their families',
    why: ([h, beds], s) => L(`สถานพยาบาล ${num(h)} แห่ง${s('hospital')} ${num(beds)} เตียง`, `${num(h)} health facilities${s('hospital')}, ${num(beds)} beds`),
    week: [day(0.1, [[7, 12, 1], [12, 16, 0.7], [16, 20, 0.5]]), day(0.1, [[8, 12, 0.6], [12, 18, 0.5]])],
    doTh: 'มาโรงพยาบาลช่วงเช้า ซื้อยา กินข้าวใกล้โรงพยาบาล ญาติพักค้าง', doEn: 'Morning appointments, pharmacies, meals nearby, relatives staying over'},
  office: {g: 'com', icon: 'office', th: 'พนักงานออฟฟิศ', en: 'Office workers',
    why: ([o, rent, lo, hi], s) => L(`สำนักงาน ${num(o)} รายการ${s('office')}${rent ? ` ค่าเช่ากลาง ${num(rent)} บาท/ตร.ม./เดือน` : ''}${lo ? ` · คนทำงานในสำนักงานราว ${num(lo)}–${num(hi)} คน ใน 1 กม.` : ''}`, `${num(o)} offices${s('office')}${rent ? `, median rent ${num(rent)} baht/m² a month` : ''}${lo ? ` · about ${num(lo)}–${num(hi)} office workers within 1 km` : ''}`),
    week: [day(0.05, [[7, 9, 0.6], [11, 14, 1], [17, 20, 0.75]]), day(0.05, [[10, 16, 0.15]])],
    doTh: 'กินกลางวัน คาเฟ่ ร้านสะดวกซื้อ ธนาคาร ฟิตเนสหลังเลิกงาน', doEn: 'Lunch, cafés, convenience stores, banks, the gym after work'},
  office_prime: {g: 'com', icon: 'office', th: 'พนักงานออฟฟิศในอาคารค่าเช่าสูง', en: 'Office workers in high-rent towers',
    why: ([o, rent, lo, hi], s) => L(`สำนักงาน ${num(o)} รายการ${s('office')} ค่าเช่ากลาง ${num(rent)} บาท/ตร.ม./เดือน${lo ? ` · คนทำงานในสำนักงานราว ${num(lo)}–${num(hi)} คน ใน 1 กม.` : ''}`, `${num(o)} offices${s('office')}, median rent ${num(rent)} baht/m² a month${lo ? ` · about ${num(lo)}–${num(hi)} office workers within 1 km` : ''}`),
    week: [day(0.05, [[7, 9, 0.6], [11, 14, 1], [17, 21, 0.8]]), day(0.05, [[10, 16, 0.15]])],
    doTh: 'กินกลางวันร้านญี่ปุ่นและนานาชาติ คาเฟ่ ฟิตเนส คลินิก', doEn: 'Japanese and international lunches, cafés, gyms, clinics'},
  gov: {g: 'com', icon: 'gov', th: 'ข้าราชการและเจ้าหน้าที่รัฐ', en: 'Civil servants and public staff',
    why: ([n, staff]) => L(`หน่วยงานรัฐ ${num(n)} แห่ง${staff ? ` บุคลากรที่บันทึก ${num(staff)} คน ใน 1 กม.` : ''}`, `${num(n)} government offices${staff ? `, ${num(staff)} recorded staff within 1 km` : ''}`),
    week: [day(0.03, [[8, 9, 0.6], [12, 13, 1], [13, 16, 0.6], [16, 17, 0.7]]), day(0.03, [])],
    doTh: 'กินกลางวันร้านไทย ธนาคาร ติดต่อราชการ ร้านสะดวกซื้อ', doEn: 'Thai lunches, banks, errands, convenience stores'},
  factory: {g: 'com', icon: 'factory', th: 'พนักงานโรงงาน ทำงานเป็นกะ', en: 'Factory workers on shifts',
    why: ([f, w, e], s) => L(`โรงงาน ${num(f)} ทะเบียน${s('factory')}${w ? ` คนงานตามทะเบียน ${num(w)} คน ใน 1 กม.` : ''}${e ? ` นิคมอุตสาหกรรม ${num(e)} แห่ง${s('industrialestate')}` : ''}`, `${num(f)} factory registrations${s('factory')}${w ? `, ${num(w)} registered workers within 1 km` : ''}${e ? `, ${num(e)} industrial estates${s('industrialestate')}` : ''}`),
    week: [day(0.1, [[6, 8, 0.9], [16, 18, 1], [20, 22, 0.6]]), day(0.1, [[10, 16, 0.5]])],
    doTh: 'เข้า–ออกกะ กินข้าวราคาย่อมเยา ร้านสะดวกซื้อ ธนาคารและร้านทองวันเงินออก', doEn: 'Shift changes, cheap meals, convenience stores, banks and gold shops on payday'},
  uni: {g: 'com', icon: 'university', th: 'นักศึกษามหาวิทยาลัย', en: 'University students',
    why: ([n, stu]) => L(`มหาวิทยาลัย ${num(n)} แห่ง${stu ? ` นักศึกษา ${num(stu)} คน ใน 1 กม.` : ''}`, `${num(n)} university sites${stu ? `, ${num(stu)} students within 1 km` : ''}`),
    week: [day(0.05, [[8, 12, 0.6], [12, 18, 1], [18, 21, 0.7]]), day(0.05, [[11, 18, 0.3]])],
    doTh: 'คาเฟ่ ร้านอาหาร ร้านไอทีและมือถือ ร้านหนังสือและเครื่องเขียน', doEn: 'Cafés, restaurants, phone and IT shops, books and stationery'},
  school: {g: 'com', icon: 'school', th: 'นักเรียนและผู้ปกครองที่รับส่ง', en: 'School pupils and parents on the school run',
    why: ([n, stu], s) => L(`สถานศึกษาที่มีจำนวนนักเรียน ${num(n)} แห่ง${s('school')} นักเรียน ${num(stu)} คน ใน 1 กม.`, `${num(n)} schools with a pupil count${s('school')}, ${num(stu)} pupils within 1 km`),
    week: [day(0.03, [[6, 8, 0.9], [15, 17, 1]]), day(0.03, [[9, 16, 0.3]])],
    doTh: 'รับส่งลูกเช้า–เย็น ขนมและเครื่องเขียน เรียนพิเศษวันหยุด', doEn: 'Drop-off and pick-up, snacks and stationery, weekend tutoring'},
  medical: {g: 'com', icon: 'hospital', th: 'บุคลากรการแพทย์', en: 'Medical staff',
    why: ([h, beds], s) => L(`สถานพยาบาล ${num(h)} แห่ง${s('hospital')} ${num(beds)} เตียง`, `${num(h)} health facilities${s('hospital')}, ${num(beds)} beds`),
    week: [day(0.2, [[7, 9, 0.9], [12, 13, 0.7], [15, 17, 1], [23, 24, 0.6]]), day(0.2, [[7, 9, 0.8], [15, 17, 0.8], [23, 24, 0.6]])],
    doTh: 'เข้าเวรเช้า บ่าย ดึก กินคาเฟ่และร้านใกล้โรงพยาบาล', doEn: 'Morning, afternoon and night shifts; cafés and meals near the hospital'},
  retail: {g: 'com', icon: 'trade', th: 'พนักงานร้านค้า ห้าง และตลาด', en: 'Shop, mall and market staff',
    why: ([m, k, r]) => L(`ศูนย์การค้า ${num(m)} แห่ง ตลาด ${num(k)} แห่ง ร้านอาหาร ${num(r)} ร้าน`, `${num(m)} malls, ${num(k)} markets, ${num(r)} restaurants`),
    week: [day(0.1, [[9, 11, 0.7], [11, 22, 0.9]]), day(0.1, [[9, 11, 0.8], [11, 22, 1]])],
    doTh: 'เข้างานสายถึงค่ำ กินข้าวใกล้ที่ทำงาน ร้านสะดวกซื้อ', doEn: 'Late-morning to evening shifts, meals near work, convenience stores'},
});

/** The three groups in the owner's order (D-V9): their pictogram, words and the people figure's key and reading. */
export const GROUPS = Object.freeze([
  {id: 'res', icon: 'home', th: 'คนอยู่', en: 'Residents'},
  {id: 'gst', icon: 'luggage', th: 'ผู้มาเยือน', en: 'Visitors'},
  {id: 'com', icon: 'office', th: 'คนมาทำงานและเรียน', en: 'People who come to work and study'},
]);

/** How clear a profile is (its place among the neighbourhoods where its rule holds) in words, never “เด่น” (the highlights' word). */
export const clearWords = score => (score >= 80 ? L('ชัดมาก', 'very clear') : score >= 50 ? L('ชัด', 'clear') : L('มีให้เห็น', 'present'));

/** The profiles shown for a group: the first always, the next two when at least half the neighbourhoods with them have less. */
export const shownPersonas = list => (list || []).filter((x, k) => PERSONAS[x[0]] && (k === 0 || x[1] >= 50)).slice(0, 3);

/** A week as two strips (weekday, weekend), levels 1–5 against its own busiest hour (the busy-block tones). */
export function weekLevels(week) {
  const top = Math.max(...week.flat().map(v => Math.max(0.02, v)));
  return week.map(d => d.map(v => 1 + CUTS.filter(c => Math.max(0.02, v) / top >= c).length));
}
/** The busiest hours of a strip in words: “11:00–14:00, 17:00–20:00”. */
export function peakHours(levels) {
  const runs = [];
  for (let h = 0; h < 24; h++) {
    if (levels[h] < 5) continue;
    let e = h + 1;
    while (e < 24 && levels[e] === 5) e++;
    runs.push(`${hh(h)}:00–${hh(e)}:00`);
    h = e;
  }
  return runs.join(', ');
}

function strips(week, label) {
  const lv = weekLevels(week);
  const row = (d, k) => `<span class="ps-row"><span class="ps-day">${esc(k ? L('ส.–อา.', 'Sat–Sun') : L('จ.–ศ.', 'Mon–Fri'))}</span><span class="ps-cells">${d.map((c, h) =>
    `<i class="g${c}" title="${esc(`${label} · ${k ? L('ส.–อา.', 'Sat–Sun') : L('จ.–ศ.', 'Mon–Fri')} ${hh(h)}:00–${hh((h + 1) % 24)}:00${EN ? '' : ' น.'} · ${L(...GRID_LEVELS[c])}`)}"></i>`).join('')}</span></span>`;
  const ticks = `<span class="ps-row ps-ticks" aria-hidden="true"><span class="ps-day"></span><span class="ps-cells">${Array.from({length: 24}, (_, h) => `<b>${h % 6 === 0 ? hh(h) : ''}</b>`).join('')}</span></span>`;
  return `<div class="ps-week" aria-hidden="true">${row(lv[0], 0)}${row(lv[1], 1)}${ticks}</div>`;
}
const peakSentence = week => {
  const lv = weekLevels(week);
  const wd = peakHours(lv[0]), we = peakHours(lv[1]);
  return [wd ? `${L('จ.–ศ.', 'Mon–Fri')} ${wd}${EN ? '' : ' น.'}` : '', we ? `${L('ส.–อา.', 'Sat–Sun')} ${we}${EN ? '' : ' น.'}` : ''].filter(Boolean).join(' · ');
};

/** What a profile likely uses nearby, as words with their count (one dataset or one of its kinds at a time; never added). */
function usesHTML(uses, model) {
  return (uses || []).map(([id, kind, n]) => {
    const ds = model.dsById.get(id);
    if (!ds) return '';
    const sg = kind ? (ds.subgroups || []).find(s => s.id === kind) : null;
    const name = sg ? (EN ? sg.en || sg.th : sg.th) : dsName(ds);
    const unit = id === 'park' ? L('ไร่', 'rai') : dsUnitN(ds, n);
    return `<span class="ps-use">${esc(name)}${lowLocated(ds) ? '*' : ''} ${nw(`${b(num(n))} ${esc(unit)}`)}</span>`;
  }).filter(Boolean).join('<span class="ps-sep" aria-hidden="true"> · </span><span class="sr-only">, </span>');
}

/** The group's own people figure within 1 km, as «ใครอยู่ตรงนี้» prints it. */
function groupFigure(gid, rec) {
  const s = rec?.s?.['1000'];
  if (!s) return '';
  const v = s[gid];
  if (v == null) return '';
  if (gid === 'res') return v === 0 ? `${b('0')} ${L('คน', 'people')}` : aboutPeople(v) ? `${L('ราว', 'about')} ${b(aboutPeople(v))} ${L('คน', 'people')}` : L('ไม่ถึง 10 คน', 'under 10 people');
  if (gid === 'gst') return v === 0 ? `${b('0')} ${L('คนต่อปี', 'a year')}` : aboutPeople(v) ? `${L('ค้างคืนราว', 'overnight, about')} ${b(aboutPeople(v))} ${L('คนต่อปี', 'a year')}` : L('ไม่ถึง 10 คนต่อปี', 'under 10 a year');
  return `${L('อย่างน้อย', 'at least')} ${b(atLeastPeople(v))} ${L('คน', 'people')}${s.comLow ? '*' : ''}`;
}

/** One profile as a card row: who, why (the evidence in numbers), when (two strips and the busiest hours), what nearby. */
function personaHTML(entry, model) {
  const [pid, score, facts, uses] = entry;
  const P = PERSONAS[pid];
  const star = id => (lowLocated(model.dsById.get(id)) ? '*' : '');
  const name = L(P.th, P.en);
  const when = peakSentence(P.week);
  return `<li class="ps-item" data-persona="${esc(pid)}">
    <p class="ps-name">${pic(P.icon)}<b>${esc(name)}</b> <span class="ps-clear" title="${esc(L(`มากกว่า ${num(Math.round(score))}% ของย่านที่มีคนกลุ่มนี้`, `more than in ${num(Math.round(score))}% of the neighbourhoods with this group`))}">${esc(clearWords(score))}</span></p>
    <p class="ps-why"><span class="ps-k">${esc(L('ทำไม', 'Why'))}</span> <span class="ps-v">${esc(P.why(facts, star))}</span></p>
    <p class="ps-when"><span class="ps-k">${esc(L('อยู่ช่วงไหน', 'When'))}</span> <span class="ps-v">${esc(when)}</span></p>
    ${strips(P.week, name)}
    <p class="ps-do"><span class="ps-k">${esc(L('มาทำอะไร', 'What they do'))}</span> <span class="ps-v">${esc(L(P.doTh, P.doEn))}</span></p>
    ${uses?.length ? `<p class="ps-uses"><span class="ps-k">${esc(L('ใกล้ ๆ มี', 'Nearby'))}</span> <span class="ps-v">${usesHTML(uses, model)}</span></p>` : ''}
  </li>`;
}

/**
 * The section «ใครคือคนหลักของย่าน»: per group its figure within 1 km and up to three profiles; the method folded; then the
 * provenance line. '' without the neighbourhood's profile record.
 */
export function personaSection(row, model, prof, rec, {prov = ''} = {}) {
  if (!prof?.pe) return '';
  const cards = GROUPS.map(g => {
    const list = shownPersonas(prof.pe[g.id]);
    const fig = groupFigure(g.id, rec);
    return `<article class="ps-card" data-group="${esc(g.id)}">
      <h4 class="ps-head">${pic(g.icon)}<span class="ps-group">${esc(L(g.th, g.en))}</span>${fig ? `<span class="ps-fig">${fig} <small>${esc(L('ใน 1 กม. จากขอบ', 'within 1 km of the edge'))}</small></span>` : ''}</h4>
      ${list.length ? `<ul class="ps-list">${list.map(x => personaHTML(x, model)).join('')}</ul>` : `<p class="hint">${esc(L('ข้อมูลที่มียังไม่พอบอกว่าคนกลุ่มนี้เป็นใคร', 'The data at hand cannot yet say who this group is'))}</p>`}
    </article>`;
  }).join('');
  const legend = `<ul class="dp-legend" aria-label="${esc(L('คำอธิบายสัญลักษณ์', 'Legend'))}">${GRID_LEVELS.slice(1).map((l, i) => `<li><i class="g${i + 1}" aria-hidden="true"></i>${esc(L(l[0], l[1]))}</li>`).join('')}</ul>`;
  const method = `<details class="scope-details"><summary>${esc(L('คิดอย่างไร', 'How this is read'))}</summary><ul class="prior-targets">
    <li>${esc(L('แต่ละกลุ่มคนมีกติกาจากสิ่งที่นับได้ในย่านและขอบเดินถึง 800 ม. (เช่น ห้องชุดและราคาประเมิน ที่พักตามระดับราคา สำนักงานและค่าเช่า โรงเรียนเอกชน) และตัวเลขคนใน 1 กม. ย่านที่ผ่านกติกาจะถูกเรียงตามความชัดเทียบย่านอื่นที่ผ่านกติกาเดียวกัน', 'Each group has a rule on what is counted inside and within the 800 m walkable edge (condominiums and their appraisal, lodging by price, offices and rents, private schools) and on the people figures within 1 km; the neighbourhoods that meet it are ranked by how clearly they do'))}</li>
    <li>${esc(L('ชัดมาก = มากกว่า 80% ของย่านที่มีคนกลุ่มนี้ · ชัด = มากกว่าครึ่ง · กลุ่มที่สองและสามแสดงเมื่อชัดตั้งแต่ครึ่งหนึ่ง', 'Very clear = more than in 80% of the neighbourhoods with this group · clear = more than in half · a second and third group show when at least clear'))}</li>
    <li>${esc(L('ช่วงเวลาเป็นสมมติฐานที่เขียนไว้ต่อกลุ่ม ไม่มีชั่วโมงใดที่วัดจริง · ไม่ใช่จำนวนคน ลูกค้า หรือยอดขาย · สามกลุ่มไม่รวมกัน', 'The hours are a hypothesis written for each group; no hour is measured · not people counts, customers or sales · the three groups are never added'))}</li>
    <li>${esc(L('* = ชุดข้อมูลที่มีพิกัดไม่ถึง 90% ของรายการ: จำนวนที่พบจริงอาจมากกว่านี้', '* = a dataset with points for under 90% of its records: there may be more than counted'))}</li></ul></details>`;
  return `<section class="panel-section persona-section" id="nb-personas" aria-labelledby="nb-personas-title"><div class="section-heading"><h3 id="nb-personas-title">${pic('students')}${esc(L('ใครคือคนหลักของย่าน', 'Who stands out here'))}<span class="prior-badge">${esc(L('อนุมานจากข้อมูล', 'Inferred from the data'))}</span></h3></div>
    <p class="hint ps-lead">${esc(L('แยกคนอยู่ ผู้มาเยือน และคนมาทำงานและเรียน · ใครน่าจะเป็นคนหลัก อยู่ช่วงไหน และมาทำอะไรในย่าน', 'Residents, visitors and people who come to work and study, apart · who most likely stands out, when they are here and what they do'))}</p>
    <div class="ps-cards">${cards}</div>${legend}${method}${prov}</section>`;
}

/** The head's line of the most likely people: the first profile of each group, in words. */
export function personaLine(prof) {
  if (!prof?.pe) return '';
  const firsts = GROUPS.map(g => (shownPersonas(prof.pe[g.id])[0] || null)).filter(Boolean);
  if (!firsts.length) return '';
  return `<p class="pl-line pl-people">${pic('students')}<span class="pl-label">${esc(L('คนหลัก', 'Who stands out'))}</span> ${firsts.map(x => `<button type="button" class="pl-chip" data-action="goto-personas">${esc(L(PERSONAS[x[0]].th, PERSONAS[x[0]].en))}</button>`).join('')}</p>`;
}

/* ---------- the neighbourhoods most alike (Inference) ---------- */

const pctOf = v => (v == null ? '—' : `${num(Math.round(v * 100))}%`);
/** A small bar of one likeness (0–1), its words beside it. */
const likeBar = (label, v) => `<span class="sm-part"><span class="sm-k">${esc(label)}</span><span class="sm-track" aria-hidden="true"><span style="width:${v == null ? 0 : Math.max(3, Math.round(v * 100))}%"></span></span><span class="sm-v data-number">${esc(v == null ? L('ไม่มีข้อมูล', 'no data') : pctOf(v))}</span></span>`;

const scaleText = sc => {
  const [res, gst, com] = sc || [];
  return [res != null ? L(`คนอยู่ราว ${aboutPeople(res) || 'ไม่ถึง 10'}`, `about ${aboutPeople(res) || 'under 10'} residents`) : '',
    gst != null ? L(`ผู้มาเยือนค้างคืนราว ${aboutPeople(gst) || 'ไม่ถึง 10'} คน/ปี`, `about ${aboutPeople(gst) || 'under 10'} overnight guests a year`) : '',
    com != null ? L(`คนมาทำงานและเรียนอย่างน้อย ${atLeastPeople(com)}`, `at least ${atLeastPeople(com)} who come to work and study`) : ''].filter(Boolean).join(' · ');
};

/**
 * The section «ย่านที่คล้ายกัน»: the five most alike in mix, scale and price, each with its three likenesses as bars and
 * its scale and price level in words beside this neighbourhood's; a button sets them side by side. '' without a list.
 */
export function similarSection(row, model, profile) {
  const me = profile?.rows.get(row.id);
  if (!me?.sim?.length) return '';
  const items = me.sim.map(([id, all, mix, sc, pr]) => {
    const r = model.byId.get(id), other = profile.rows.get(id);
    if (!r || !other) return '';
    const both = (r.hl || []).map(h => h.d).filter(d => (row.hl || []).some(h => h.d === d)).map(d => model.dsById.get(d)).filter(Boolean).map(dsName);
    return `<li class="sm-item"><p class="sm-head"><button type="button" class="link-button sm-name" data-action="select-nb" data-id="${esc(id)}">${esc(r.name)}</button> <small>${esc(provinceName(r.province))}</small> <span class="sm-all">${esc(L('คล้าย', 'alike'))} ${b(pctOf(all))}</span></p>
      <p class="sm-parts">${likeBar(L('ส่วนผสม', 'Mix'), mix)}${likeBar(L('ขนาดคน', 'Scale'), sc)}${likeBar(L('ระดับราคา', 'Price'), pr)}</p>
      <p class="sm-why hint">${esc(scaleText(other.sc))}${other.pr?.lv != null ? esc(L(` · ระดับราคา ${num(Math.round(other.pr.lv))}/100 (${priceWord(other.pr.lv)})`, ` · price level ${num(Math.round(other.pr.lv))}/100 (${priceWord(other.pr.lv)})`)) : ''}${both.length ? esc(L(` · เด่นเหมือนกัน: ${both.join(' · ')}`, ` · both stand out for: ${both.join(' · ')}`)) : ''}</p></li>`;
  }).filter(Boolean).join('');
  if (!items) return '';
  const mine = `${esc(scaleText(me.sc))}${me.pr?.lv != null ? esc(L(` · ระดับราคา ${num(Math.round(me.pr.lv))}/100 (${priceWord(me.pr.lv)})`, ` · price level ${num(Math.round(me.pr.lv))}/100 (${priceWord(me.pr.lv)})`)) : ''}`;
  return `<section class="panel-section sm-section" id="nb-similar" aria-labelledby="nb-similar-title"><div class="section-heading"><h3 id="nb-similar-title">${pic('compare')}${esc(L('ย่านที่คล้ายกัน', 'Neighbourhoods alike'))}<span class="prior-badge">${esc(L('ทั่วประเทศ · อนุมาน', 'nationwide · inferred'))}</span></h3></div>
    <p class="section-lead">${esc(L('คล้ายทั้งสามด้าน: ส่วนผสมของร้านและสถานที่ ขนาดคน และระดับราคา', 'Alike on all three: the mix of places, the scale of people and the price level'))}</p>
    <p class="hint sm-me">${esc(L('ย่านนี้', 'This one'))}: ${mine}</p>
    <ol class="sm-list">${items}</ol>
    <div class="aha-actions"><button type="button" class="btn quiet" data-action="cmp-similar" data-id="${esc(row.id)}">${esc(L('เทียบกับย่านเหล่านี้', 'Compare with these'))}</button></div>
    <details class="scope-details"><summary>${esc(L('คล้ายคิดอย่างไร', 'How likeness is read'))}</summary><p class="hint">${esc(L(
      'ส่วนผสม = ความหนาแน่นของแต่ละชุดข้อมูลขึ้นลงไปทางเดียวกันแค่ไหน (โคไซน์ของ log ความหนาแน่นที่หักค่าเฉลี่ยของชุด) · ขนาดคน = คนอยู่ ผู้มาเยือนค้างคืน และคนมาทำงานและเรียนใน 1 กม. ห่างกันกี่เท่า (ต่างกัน 10 เท่า = 0) · ระดับราคา = ห่างกันกี่คะแนน (ห่าง 40 = 0) · คล้ายรวม = ค่าเฉลี่ยเรขาคณิตของทั้งสามด้าน ด้านใดห่างมากจะดึงลงมาก · เป็นจุดตั้งต้นสำหรับเทียบ ไม่ได้บอกว่าขายดีเท่ากัน',
      'Mix = how alike the densities of the datasets rise and fall (cosine of centred log density) · scale = how many times apart the residents, overnight guests and people who come to work and study within 1 km are (10 times = 0) · price = how many points apart the price levels are (40 = 0) · alike = the geometric mean of the three, so one far facet pulls it down · a starting point for a comparison, not a claim that two places sell alike'))}</p></details></section>`;
}
