/**
 * CityMETER · Commercial District — the topics of น่าอยู่ · น่าเที่ยว · น่าค้าขาย (0.7.0; pure).
 *
 * Owner 2026-11-26 14:03 (VERBATIM in handoff/visual/decisions.json, D-V6b): “น่าอยู่ น่าเที่ยว น่าค้าขาย ผมว่าน่าจะคงคำไว้แบบนี้
 * แล้วเรามาพยายามทำข้อมูลให้สามารถตอบความ "น่า" ให้ได้จริง … ให้เห็นทั้ง เชิงปริมาณ และ คุณภาพ” and the topics of 2.1–2.3.
 * Each topic is one row: what is counted (quantity) and, where the data allows, how varied or how complete it is
 * (quality), with its unit and its label. The guard D-V6 kept by leaving “น่า” off the screen moves into these rows
 * (D-V6b, binding): a number, a unit and what it means on every row; no score, total or rank of a neighbourhood per
 * axis; a topic without data says ยังไม่มีข้อมูล and what would fill it, never 0. Counts of two datasets sit side by side
 * and are never added (INV-01); placing a topic on an axis is this demo's reading (an Inference, DATA_METHOD.md §15).
 */
import {LANG} from './shell/i18n.js';
import {num, dsName, lowLocated} from './model.js';
import {cellsOf} from './levels.js';
import {aboutPeople} from './people.js';

const EN = LANG === 'en';
const L = (th, en) => (EN ? en : th);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pic = (role, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(role)}" aria-hidden="true"></i>`;
const nw = html => `<span class="nowrap">${html}</span>`;

/** Located records of a dataset at the axis distance: inside, or inside and within 400/800 m of the edge (never one total of two datasets). */
export function countAt(row, around, dsId, distance = 'in') {
  if (!(dsId in (row.c || {}))) return null;   // out of scope: no data in the province
  const inside = row.c[dsId] || 0;
  if (distance === 'in') return inside;
  const a = around?.rows.get(row.id)?.a?.[dsId];
  if (!a) return inside;
  return inside + (distance === '400' ? a[0] : a[1]);
}
const whereWords = distance => (distance === 'in' ? L('ในย่าน', 'inside') : L(`ในย่านและขอบเดินถึง ${num(+distance)} ม.`, `inside and within the ${num(+distance)} m walkable edge`));
/** How many subgroups (kinds) of a dataset are present inside: [present, all]. */
function kindsInside(row, model, dsId) {
  const s = row.s?.[dsId], ds = model.dsById.get(dsId);
  if (!s || !ds?.subgroups?.length) return null;
  return [s.filter(n => n > 0).length, ds.subgroups.length];
}
const nameOf = (model, id) => dsName(model.dsById.get(id)) + (lowLocated(model.dsById.get(id)) ? '*' : '');

/**
 * The topics of one axis for one neighbourhood: [{id, icon, th, en, text: html | null, wait: [th, en] | null}].
 * ctx = {row, model, around, people (data/people/<id>.json or null), reach, distance}.
 */
export function topicsOf(axisId, {row, model, around, people = null, peopleMeta = null, reach = '1000', distance = 'in'}) {
  const at = id => countAt(row, around, id, distance);
  const where = whereWords(distance);
  const ps = people?.s?.[distance] || null, pin = people?.s?.in || null;
  const n = (v, th, en) => (v == null ? '' : `${esc(L(th, en))} ${nw(`<b class="data-number">${num(v)}</b>`)}`);
  // a dataset's count at the axis distance, its name starred when under 90 % of its records have a point (the key of the cards)
  const nd = (id, th, en) => { const star = lowLocated(model.dsById.get(id)) ? '*' : ''; return n(at(id), th + star, en + star); };
  const join = parts => parts.filter(Boolean).join(' · ');
  const T = (id, icon, th, en, text, wait = null) => ({id, icon, th, en, text: text || null, wait: text ? null : wait});
  const cells = new Map(cellsOf(model, row, around).map(x => [x.ds.id, x]));
  // residents at a scale: built (a figure, or none where Building V4 has no building) or not built yet
  const resBuilt = key => (peopleMeta?.residents?.scales || []).includes(key);
  const resWait = key => (resBuilt(key) ? ['ยังไม่มีข้อมูลอาคารในขอบนี้', 'no building data here yet'] : ['รอข้อมูลรอบถัดไป', 'coming in the next data round']);

  if (axisId === 'live') {
    const eat = join([nd('restaurant', 'ร้านอาหาร', 'restaurants'), nd('grocery', 'ร้านของชำ', 'groceries')]);
    const eatOut = [['restaurant', 'ร้านอาหาร', 'restaurants'], ['grocery', 'ร้านของชำ', 'groceries']].filter(([id]) => at(id) == null);
    const eatGap = eat && eatOut.length ? esc(L(`${eatOut.map(x => x[1]).join(' และ ')}: ยังไม่มีข้อมูลในจังหวัดนี้`, `${eatOut.map(x => x[2]).join(' and ')}: no data in this province yet`)) : '';
    const kinds = kindsInside(row, model, 'restaurant');
    const eatQ = kinds && kinds[0] ? esc(L(`ร้านอาหาร ${num(kinds[0])} ประเภทจาก ${num(kinds[1])} ในย่าน`, `${num(kinds[0])} of ${num(kinds[1])} kinds of restaurant inside`)) : '';
    const needs = ['grocery', 'pharmacy', 'hospital', 'school', 'transit', 'governmentoffice', 'fitness'].filter(id => id in (row.c || {}));
    const have = needs.filter(id => (at(id) || 0) > 0), lack = needs.filter(id => !((at(id) || 0) > 0));
    const needText = needs.length ? `${esc(L(`มีครบ ${num(have.length)} จาก ${num(needs.length)} อย่าง ${where}`, `${num(have.length)} of ${num(needs.length)} kinds ${where}`))}${lack.length ? `<br><small>${esc(L('ไม่พบ: ', 'not found: '))}${esc(lack.map(id => nameOf(model, id)).join(' · '))}</small>` : ''}` : '';
    const st = at('transit');
    const resIn = pin?.res, km2 = row.km2;
    const perKm2 = km2 > 0 ? resIn / km2 : null;
    const resText = resIn != null ? join([`${esc(L('คนในทะเบียนบ้านในย่าน', 'registered residents inside'))} ${resIn === 0 ? nw(`<b class="data-number">0</b>${EN ? '' : ' คน'}`) : aboutPeople(resIn) ? `${esc(L('ราว', 'about'))} ${nw(`<b class="data-number">${aboutPeople(resIn)}</b>${EN ? '' : ' คน'}`)}` : nw(esc(L('ไม่ถึง 10 คน', 'under 10')))}`,
      perKm2 > 0 ? nw(esc(L(aboutPeople(perKm2) ? `ราว ${aboutPeople(perKm2)} คน/ตร.กม.` : 'ไม่ถึง 10 คน/ตร.กม.', aboutPeople(perKm2) ? `about ${aboutPeople(perKm2)} per km²` : 'under 10 per km²'))) : '']) : '';
    const rest = cells.get('restaurant');
    const lively = rest?.kind === 'ranked' ? esc(L(`ร้านอาหารแน่นและมาก ระดับ ${num(Math.round(rest.level))}/100 เทียบ ${num(rest.n)} ย่าน`, `restaurants, count and density: level ${num(Math.round(rest.level))}/100 among ${num(rest.n)} neighbourhoods`)) : '';
    return [
      T('eat', 'restaurant', 'กิน', 'Eating', eat ? `${eat} ${esc(where)}${eatQ || eatGap ? `<br><small>${join([eatQ, eatGap])}</small>` : ''}` : '', ['ร้านอาหารและร้านของชำยังไม่มีข้อมูลในจังหวัดนี้', 'no restaurant or grocery data in this province']),
      T('needs', 'grocery', 'ของจำเป็นใกล้ตัว', 'Everyday needs', needText, ['ยังไม่มีข้อมูล', 'no data yet']),
      T('move', 'rail', 'การเดินทาง', 'Getting around', st != null ? `${nd('transit', 'สถานีราง', 'rail stations')} ${esc(where)}<br><small>${esc(L('รถเมล์และเรือ: ยังไม่มีข้อมูล', 'buses and boats: no data yet'))}</small>` : '', ['ยังไม่มีข้อมูลระบบรางในจังหวัดนี้ · รถเมล์และเรือยังไม่มีข้อมูล', 'no rail data in this province · buses and boats: no data yet']),
      T('crowd', 'building', 'คนและความแน่น', 'People and crowding', resText, resWait('in').map((w, k) => `${k ? 'residents' : 'คนอยู่'}: ${w}`)),
      T('lively', 'venue', 'ความคึกคัก', 'Liveliness', lively, !rest || rest.kind === 'out' ? ['ร้านอาหารยังไม่มีข้อมูลในจังหวัดนี้', 'no restaurant data in this province yet'] : ['ร้านอาหารในย่านน้อยกว่า 3 ร้าน จึงไม่จัดระดับ', 'fewer than 3 restaurants inside, so no level']),
      T('green', 'fitness', 'ออกกำลังกายและสีเขียว', 'Exercise and green space', at('fitness') != null ? `${nd('fitness', 'ฟิตเนส', 'gyms')} ${esc(where)}<br><small>${esc(L('สวนสาธารณะ: ยังไม่มีข้อมูล', 'parks: no data yet'))}</small>` : '', ['ยังไม่มีข้อมูล', 'no data yet']),
      T('air', 'forest', 'อากาศและความสงบ', 'Air and quiet', '', ['ยังไม่มีข้อมูล: PM2.5 (กรมควบคุมมลพิษ · AirBKK) และเสียง', 'no data yet: PM2.5 (Pollution Control Department · AirBKK) and noise']),
    ];
  }
  if (axisId === 'visit') {
    const rooms = row.m?.hotel, kinds = kindsInside(row, model, 'hotel');
    const stay = rooms ? `${nw(`${esc(L('ห้องพัก', 'rooms'))} <b class="data-number">${num(rooms[0])}</b>`)} ${esc(L('ในย่าน', 'inside'))}${kinds && kinds[0] ? ` · ${nw(esc(L(`${num(kinds[0])} แบบจาก ${num(kinds[1])}`, `${num(kinds[0])} of ${num(kinds[1])} kinds`)))}` : ''}${pin?.gst >= 10 ? `<br><small>${esc(L(`ผู้เข้าพักราว ${aboutPeople(pin.gst)} คนต่อปี (แบบจำลอง)`, `about ${aboutPeople(pin.gst)} guests a year (modelled)`))}</small>` : ''}`
      : 'hotel' in (row.c || {}) ? `${n(0, 'ห้องพัก', 'rooms')} ${esc(L('ในย่าน · ไม่พบที่พักที่บันทึกไว้', 'inside · no recorded lodging'))}` : '';
    const shop = join([nd('shoppingcenter', 'ศูนย์การค้าและตลาด', 'centres and markets'), nd('luxurybrands', 'แบรนด์หรู', 'luxury points')]);
    const lux = kindsInside(row, model, 'luxurybrands');
    const kindsCount = ['hotel', 'shoppingcenter', 'restaurant', 'luxurybrands'].filter(id => id in (row.c || {}));
    const present = kindsCount.filter(id => (at(id) || 0) > 0);
    return [
      T('stay', 'hotel', 'ที่พัก', 'Places to stay', stay, ['ยังไม่มีข้อมูลที่พักในจังหวัดนี้', 'no lodging data in this province yet']),
      T('shop', 'venue', 'ช้อปปิ้งและแฟชั่น', 'Shopping and fashion', shop ? `${shop} ${esc(where)}${lux && lux[0] ? `<br><small>${esc(L(`แบรนด์หรู ${num(lux[0])} กลุ่มสินค้าจาก ${num(lux[1])} ในย่าน`, `luxury brands in ${num(lux[0])} of ${num(lux[1])} groups inside`))}</small>` : ''}<br><small>${esc(L('ร้านเสื้อผ้า: ยังไม่มีในเดโมนี้', 'apparel shops: not in this demo yet'))}</small>` : '', ['ยังไม่มีข้อมูล', 'no data yet']),
      T('mix', 'rank', 'ความหลากหลาย', 'Variety', kindsCount.length ? esc(L(`มีของให้เที่ยว ${num(present.length)} จาก ${num(kindsCount.length)} หมวดที่นับได้ ${where}`, `${num(present.length)} of ${num(kindsCount.length)} counted kinds ${where}`)) : '', ['ยังไม่มีข้อมูล', 'no data yet']),
      T('arts', 'arts', 'พิพิธภัณฑ์ ศิลปะ แหล่งเรียนรู้', 'Museums, arts and learning', '', ['ยังไม่มีข้อมูล: ทะเบียนวิจัย CityMETER ยังคัดรายการ', 'no data yet: the CityMETER research register is still sorting its list']),
      T('history', 'history', 'ประวัติศาสตร์', 'History', '', ['ยังไม่มีข้อมูล: โบราณสถานขึ้นทะเบียน (กรมศิลปากร)', 'no data yet: registered monuments (Fine Arts Department)']),
      T('night', 'date', 'กลางคืน คอนเสิร์ต โรงภาพยนตร์', 'Nightlife, concerts and cinemas', '', ['ยังไม่มีข้อมูล: โรงภาพยนตร์มีรายชื่อใน CityMETER Yolk แต่ยังไม่มีพิกัด', 'no data yet: cinemas are listed in CityMETER Yolk without points']),
      T('nature', 'sea', 'ธรรมชาติ หาด ภูเขา น้ำตก', 'Nature, beaches, hills and falls', '', ['ยังไม่มีข้อมูล: อุทยานแห่งชาติ (กรมอุทยานแห่งชาติฯ)', 'no data yet: national parks (Department of National Parks)']),
    ];
  }
  // trade
  // a measured 0 reads 0; under 10 reads “ไม่ถึง 10”; otherwise “ราว” and the rounded figure (js/people.js#aboutPeople)
  const about = v => (v === 0 ? nw('<b class="data-number">0</b>') : aboutPeople(v) ? `${esc(L('ราว', 'about'))} ${nw(`<b class="data-number">${aboutPeople(v)}</b>`)}` : nw(`${esc(L('ไม่ถึง', 'under'))} <b class="data-number">10</b>`));
  const buyers = ps ? join([ps.res != null ? `${esc(L('คนอยู่', 'living here'))} ${about(ps.res)}` : esc(L(...resWait(distance).map((w, k) => `${k ? 'living here' : 'คนอยู่'}: ${w}`))),
    ps.com != null ? `${esc(L('คนมาทำงานและเรียนอย่างน้อย', 'come to work and study, at least'))} ${about(ps.com)}` : '',
    ps.gst != null ? `${esc(L('ผู้มาเยือนค้างคืน', 'overnight visitors'))} ${about(ps.gst)} ${esc(L('คนต่อปี', 'a year'))}` : '']) : '';
  const off = ps?.off;
  const work = join([nd('office', 'สำนักงาน', 'offices'), off ? `${esc(L('คนทำงานในสำนักงาน', 'office workers'))} ${nw(`<b class="data-number">${num(off[0])}–${num(off[1])}</b>`)} <small>${esc(L('แบบจำลอง', 'modelled'))}</small>` : '']);
  const biz = join([nd('factory', 'โรงงาน', 'factories'), nd('industrialestate', 'นิคมอุตสาหกรรม', 'industrial estates'), nd('camera', 'ร้านกล้อง', 'camera shops')]);
  return [
    T('buyers', 'home', 'ผู้ซื้อ', 'Buyers', buyers ? `${buyers} ${esc(where)}<br><small>${esc(L('สามกลุ่มไม่รวมกัน · ไม่ใช่จำนวนลูกค้า', 'three groups, never added · not customers'))}</small>` : '', ['กำลังโหลดตัวเลขคน', 'loading the people figures']),
    T('spend', 'fee', 'กำลังจ่าย', 'Spending power', at('luxurybrands') != null ? `${nd('luxurybrands', 'จุดขายแบรนด์หรู', 'luxury points of sale')} ${esc(where)}<br><small>${esc(L('ราคาประเมินที่ดินและค่าเช่า: ยังไม่มีในเดโมนี้ · ไม่ใช่รายได้ของคนในย่าน', 'land prices and rents: not in this demo yet · not the income of the people here'))}</small>` : '', ['ยังไม่มีข้อมูล', 'no data yet']),
    T('work', 'office', 'คนทำงาน', 'Workers', work ? `${work} ${esc(where)}` : '', ['ยังไม่มีข้อมูลสำนักงานในจังหวัดนี้', 'no office data in this province']),
    T('biz', 'factory', 'กิจการรอบตัว', 'Businesses around', biz ? `${biz} ${esc(where)}` : '', ['ยังไม่มีข้อมูล', 'no data yet']),
    T('rivals', 'compare', 'คู่แข่ง พันธมิตร สาขาของเรา', 'Rivals, partners, own branches', '', ['เลือกประเภทธุรกิจและแบรนด์ได้ในรุ่นถัดไป (0.7.1)', 'pick a business type and brand in the next release (0.7.1)']),
  ];
}

/** The rows of one axis as HTML (a list; a topic without data reads as such, in the same place). */
export function topicsHTML(axisId, ctx) {
  const rows = topicsOf(axisId, ctx);
  return `<ul class="tp-rows">${rows.map(t => `<li class="tp-row${t.text ? '' : ' is-wait'}" data-topic="${esc(t.id)}">${pic(t.icon)}<span class="tp-name">${esc(L(t.th, t.en))}</span><span class="tp-text">${t.text || esc(L(...t.wait))}</span></li>`).join('')}</ul>`;
}
