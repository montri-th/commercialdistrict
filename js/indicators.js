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
import {num, dsName, dsUnitN, lowLocated} from './model.js';
import {cellsOf} from './levels.js';
import {aboutPeople, atLeastPeople} from './people.js';

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
 * ctx = {row, model, around, people (data/people/<id>.json or null), peopleMeta, peopleState ('ready' · 'loading' ·
 * 'error'), distance}. A count carries its dataset's unit and star; a dataset that does not reach the province is named
 * on the row it belongs to (“ยังไม่มีข้อมูลในจังหวัดนี้”), never dropped; a modelled figure says แบบจำลอง.
 */
export function topicsOf(axisId, {row, model, around, people = null, peopleMeta = null, peopleState = 'ready', distance = 'in'}) {
  const at = id => countAt(row, around, id, distance);
  const where = whereWords(distance);
  const ps = people?.s?.[distance] || null, pin = people?.s?.in || null;
  const ds = id => model.dsById.get(id);
  // a figure and its unit, kept together; a string is a figure already written (rounded, “about”)
  const fig = (v, unit = '') => nw(`<b class="data-number">${typeof v === 'string' ? esc(v) : num(v)}</b>${unit ? ` ${esc(unit)}` : ''}`);
  // a dataset's count at the axis distance with its unit; its name starred when under 90 % of its records have a point
  const nd = (id, th, en) => {
    const v = at(id);
    if (v == null) return '';
    const star = lowLocated(ds(id)) ? '*' : '';
    return `${esc(L(th, en))}${star} ${fig(v, dsUnitN(ds(id), v))}`;
  };
  const join = parts => parts.filter(Boolean).join(' · ');
  // the datasets of a row that do not reach the province, named
  const gap = ids => {
    const out = ids.filter(id => model.dsById.has(id) && !(id in (row.c || {}))).map(id => dsName(ds(id)));
    return out.length ? esc(L(`ยังไม่มีข้อมูลในจังหวัดนี้: ${out.join(' · ')}`, `no data in this province yet: ${out.join(' · ')}`)) : '';
  };
  const small = parts => { const t = join(parts); return t ? `<br><small>${t}</small>` : ''; };
  const T = (id, icon, th, en, text, wait = null) => ({id, icon, th, en, text: text || null, wait: text ? null : wait});
  const cells = new Map(cellsOf(model, row, around).map(x => [x.ds.id, x]));
  // the people figures: still loading, failed, a scale not built yet, or built without a building here
  const peopleWait = peopleState === 'error' ? ['ยังไม่มีข้อมูล: โหลดตัวเลขคนไม่สำเร็จ', 'no data: the people figures did not load']
    : !people ? ['กำลังโหลดตัวเลขคน', 'loading the people figures'] : null;
  const resBuilt = key => (peopleMeta?.residents?.scales || []).includes(key);
  const resWait = key => peopleWait || (resBuilt(key) ? ['ยังไม่มีข้อมูลอาคารในขอบนี้', 'no building data here yet'] : ['รอข้อมูลรอบถัดไป', 'coming in the next data round']);
  const modelled = `<small>${esc(L('แบบจำลอง', 'modelled'))}</small>`;
  const people_ = v => (v === 0 ? fig(0, L('คน', 'people')) : aboutPeople(v) ? `${esc(L('ราว', 'about'))} ${fig(aboutPeople(v), L('คน', 'people'))}` : nw(esc(L('ไม่ถึง 10 คน', 'under 10 people'))));

  if (axisId === 'live') {
    const eat = join([nd('restaurant', 'ร้านอาหาร', 'restaurants'), nd('grocery', 'ร้านของชำ', 'groceries')]);
    const kinds = kindsInside(row, model, 'restaurant');
    const eatQ = kinds && kinds[0] ? esc(L(`ร้านอาหาร ${num(kinds[0])} ประเภทจาก ${num(kinds[1])} ในย่าน`, `${num(kinds[0])} of ${num(kinds[1])} kinds of restaurant inside`)) : '';
    const NEEDS = ['grocery', 'pharmacy', 'hospital', 'school', 'transit', 'governmentoffice', 'fitness'];
    const needs = NEEDS.filter(id => id in (row.c || {}));
    const have = needs.filter(id => (at(id) || 0) > 0), lack = needs.filter(id => !((at(id) || 0) > 0));
    const needText = needs.length ? `${esc(L(`มี ${num(have.length)} จาก ${num(needs.length)} อย่างที่มีข้อมูล ${where}`, `${num(have.length)} of the ${num(needs.length)} kinds with data ${where}`))}${small([lack.length ? esc(L('ไม่พบ: ', 'not found: ')) + esc(lack.map(id => nameOf(model, id)).join(' · ')) : '', gap(NEEDS)])}` : '';
    const st = at('transit');
    const resIn = pin?.res, km2 = row.km2;
    const perKm2 = km2 > 0 && resIn != null ? resIn / km2 : null;
    const resText = resIn != null ? `${join([`${esc(L('คนในทะเบียนบ้านในย่าน', 'registered residents inside'))} ${people_(resIn)}`,
      perKm2 > 0 ? nw(esc(L(aboutPeople(perKm2) ? `ราว ${aboutPeople(perKm2)} คน/ตร.กม.` : 'ไม่ถึง 10 คน/ตร.กม.', aboutPeople(perKm2) ? `about ${aboutPeople(perKm2)} per km²` : 'under 10 per km²'))) : ''])} ${modelled}` : '';
    const rest = cells.get('restaurant');
    // the level of §14 (count and density among the neighbourhoods with 3 or more), said neutrally at any level
    const lively = rest?.kind === 'ranked' ? `${esc(L('ระดับร้านอาหาร (จำนวนและความแน่น)', 'restaurant level (count and density)'))} ${fig(Math.round(rest.level), '/100')} ${esc(L('เทียบ', 'among'))} ${fig(rest.n, L('ย่าน', 'neighbourhoods'))}` : '';
    return [
      T('eat', 'restaurant', 'กิน', 'Eating', eat ? `${eat} ${esc(where)}${small([eatQ, gap(['restaurant', 'grocery'])])}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้: ร้านอาหาร · ร้านของชำ', 'no data in this province yet: restaurants · groceries']),
      T('needs', 'grocery', 'ของจำเป็นใกล้ตัว', 'Everyday needs', needText, ['ยังไม่มีข้อมูลในจังหวัดนี้', 'no data in this province yet']),
      T('move', 'rail', 'การเดินทาง', 'Getting around', st != null ? `${nd('transit', 'สถานีราง', 'rail stations')} ${esc(where)}${small([esc(L('รถเมล์และเรือ: ยังไม่มีข้อมูล', 'buses and boats: no data yet'))])}` : '', ['ยังไม่มีข้อมูลระบบรางในจังหวัดนี้ · รถเมล์และเรือยังไม่มีข้อมูล', 'no rail data in this province yet · buses and boats: no data yet']),
      T('crowd', 'building', 'คนและความแน่น', 'People and crowding', resText, resWait('in').map((w, k) => `${k ? 'residents' : 'คนอยู่'}: ${w}`)),
      T('lively', 'venue', 'ความคึกคัก', 'Liveliness', lively, !rest || rest.kind === 'out' ? ['ยังไม่มีข้อมูลในจังหวัดนี้: ร้านอาหาร', 'no data in this province yet: restaurants'] : ['ร้านอาหารในย่านน้อยกว่า 3 ร้าน จึงไม่จัดระดับ', 'fewer than 3 restaurants inside, so no level']),
      T('green', 'fitness', 'ออกกำลังกายและสีเขียว', 'Exercise and green space', at('fitness') != null ? `${nd('fitness', 'ฟิตเนส', 'gyms')} ${esc(where)}${small([esc(L('สวนสาธารณะ: ยังไม่มีข้อมูล', 'parks: no data yet'))])}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้: ฟิตเนส · สวนสาธารณะ: ยังไม่มีข้อมูล', 'no data in this province yet: fitness · parks: no data yet']),
      T('air', 'forest', 'อากาศและความสงบ', 'Air and quiet', '', ['ยังไม่มีข้อมูล: PM2.5 (กรมควบคุมมลพิษ · AirBKK) และเสียง', 'no data yet: PM2.5 (Pollution Control Department · AirBKK) and noise']),
    ];
  }
  if (axisId === 'visit') {
    const rooms = row.m?.hotel, kinds = kindsInside(row, model, 'hotel'), places = row.c?.hotel;
    const roomsPart = rooms && places > rooms[1] ? ` · ${nw(esc(L(`มีตัวเลขห้อง ${num(rooms[1])} จาก ${num(places)} แห่ง`, `room figures for ${num(rooms[1])} of ${num(places)} places`)))}` : '';
    const guests = pin?.gst >= 10 ? esc(L(`ผู้เข้าพักราว ${aboutPeople(pin.gst)} คนต่อปี`, `about ${aboutPeople(pin.gst)} guests a year`)) + ` ${modelled}` : '';
    const stay = rooms ? `${esc(L('ห้องพัก', 'rooms'))} ${fig(rooms[0], L('ห้อง', 'rooms'))} ${esc(L('ในย่าน', 'inside'))}${kinds && kinds[0] ? ` · ${nw(esc(L(`${num(kinds[0])} แบบจาก ${num(kinds[1])}`, `${num(kinds[0])} of ${num(kinds[1])} kinds`)))}` : ''}${roomsPart}${guests ? `<br><small>${guests}</small>` : ''}`
      : places > 0 ? `${esc(L('ที่พัก', 'lodging'))} ${fig(places, dsUnitN(ds('hotel'), places))} ${esc(L('ในย่าน · ไม่มีตัวเลขห้อง', 'inside · no room figures'))}`
      : places === 0 ? `${esc(L('ที่พัก', 'lodging'))} ${fig(0, dsUnitN(ds('hotel'), 0))} ${esc(L('ในย่าน', 'inside'))}` : '';
    const shop = join([nd('shoppingcenter', 'ศูนย์การค้าและตลาด', 'centres and markets'), nd('luxurybrands', 'แบรนด์หรู', 'luxury points')]);
    const lux = kindsInside(row, model, 'luxurybrands');
    const KINDS = ['hotel', 'shoppingcenter', 'restaurant', 'luxurybrands'];
    const kindsCount = KINDS.filter(id => id in (row.c || {}));
    const present = kindsCount.filter(id => (at(id) || 0) > 0);
    return [
      T('stay', 'hotel', 'ที่พัก', 'Places to stay', stay, ['ยังไม่มีข้อมูลในจังหวัดนี้: ที่พัก', 'no data in this province yet: lodging']),
      T('shop', 'venue', 'ช้อปปิ้งและแฟชั่น', 'Shopping and fashion', shop ? `${shop} ${esc(where)}${small([lux && lux[0] ? esc(L(`แบรนด์หรู ${num(lux[0])} กลุ่มสินค้าจาก ${num(lux[1])} ในย่าน`, `luxury brands in ${num(lux[0])} of ${num(lux[1])} groups inside`)) : '', gap(['shoppingcenter', 'luxurybrands']), esc(L('ร้านเสื้อผ้า: ยังไม่มีในเดโมนี้', 'apparel shops: not in this demo yet'))])}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้: ศูนย์การค้าและตลาด · แบรนด์หรู', 'no data in this province yet: centres and markets · luxury brands']),
      T('mix', 'rank', 'ความหลากหลาย', 'Variety', kindsCount.length ? `${esc(L(`มีของให้เที่ยว ${num(present.length)} จาก ${num(kindsCount.length)} หมวดที่มีข้อมูล ${where}`, `${num(present.length)} of the ${num(kindsCount.length)} kinds with data ${where}`))}${small([gap(KINDS)])}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้', 'no data in this province yet']),
      T('arts', 'arts', 'พิพิธภัณฑ์ ศิลปะ แหล่งเรียนรู้', 'Museums, arts and learning', '', ['ยังไม่มีข้อมูล: ทะเบียนวิจัย CityMETER ยังคัดรายการ', 'no data yet: the CityMETER research register is still sorting its list']),
      T('history', 'history', 'ประวัติศาสตร์', 'History', '', ['ยังไม่มีข้อมูล: โบราณสถานขึ้นทะเบียน (กรมศิลปากร)', 'no data yet: registered monuments (Fine Arts Department)']),
      T('night', 'date', 'กลางคืน คอนเสิร์ต โรงภาพยนตร์', 'Nightlife, concerts and cinemas', '', ['ยังไม่มีข้อมูล: โรงภาพยนตร์มีรายชื่อใน CityMETER Yolk แต่ยังไม่มีพิกัด', 'no data yet: cinemas are listed in CityMETER Yolk without points']),
      T('nature', 'sea', 'ธรรมชาติ หาด ภูเขา น้ำตก', 'Nature, beaches, hills and falls', '', ['ยังไม่มีข้อมูล: อุทยานแห่งชาติ (กรมอุทยานแห่งชาติฯ)', 'no data yet: national parks (Department of National Parks)']),
    ];
  }
  // trade
  const buyers = ps ? join([
    ps.res != null ? `${esc(L('คนอยู่', 'living here'))} ${people_(ps.res)} ${modelled}` : esc(L(...resWait(distance).map((w, k) => `${k ? 'living here' : 'คนอยู่'}: ${w}`))),
    ps.com != null ? `${esc(L('คนมาทำงานและเรียน อย่างน้อย', 'come to work and study, at least'))} ${fig(atLeastPeople(ps.com), L('คน', 'people'))}${ps.comLow ? '*' : ''}` : '',
    ps.gst != null ? `${esc(L('ผู้มาเยือนค้างคืน', 'overnight visitors'))} ${ps.gst === 0 ? fig(0, L('คนต่อปี', 'a year')) : aboutPeople(ps.gst) ? `${esc(L('ราว', 'about'))} ${fig(aboutPeople(ps.gst), L('คนต่อปี', 'a year'))}` : nw(esc(L('ไม่ถึง 10 คนต่อปี', 'under 10 a year')))} ${modelled}` : '']) : '';
  const off = ps?.off;
  const work = join([nd('office', 'สำนักงาน', 'offices'), off ? `${esc(L('คนทำงานในสำนักงาน', 'office workers'))} ${nw(`<b class="data-number">${num(off[0])}–${num(off[1])}</b> ${esc(L('คน', 'people'))}`)} ${modelled}` : '']);
  const biz = join([nd('factory', 'โรงงาน', 'factories'), nd('industrialestate', 'นิคมอุตสาหกรรม', 'industrial estates'), nd('camera', 'ร้านกล้อง', 'camera shops')]);
  return [
    T('buyers', 'home', 'ผู้ซื้อ', 'Buyers', buyers ? `${buyers} ${esc(where)}<br><small>${esc(L('สามกลุ่มไม่รวมกัน · ไม่ใช่จำนวนลูกค้า', 'three groups, never added · not customers'))}${ps?.comLow ? esc(L(' · * ส่วนใหญ่มาจากชุดที่มีพิกัดไม่ครบ', ' · * mostly from datasets without points for every record')) : ''}</small>` : '', peopleWait || ['ยังไม่มีข้อมูล', 'no data yet']),
    T('spend', 'fee', 'กำลังจ่าย', 'Spending power', at('luxurybrands') != null ? `${nd('luxurybrands', 'จุดขายแบรนด์หรู', 'luxury points of sale')} ${esc(where)}${small([esc(L('ราคาประเมินที่ดินและค่าเช่า: ยังไม่มีในเดโมนี้ · ไม่ใช่รายได้ของคนในย่าน', 'land prices and rents: not in this demo yet · not the income of the people here'))])}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้: แบรนด์หรู · ราคาประเมินที่ดินและค่าเช่า: ยังไม่มีในเดโมนี้', 'no data in this province yet: luxury brands · land prices and rents: not in this demo yet']),
    T('work', 'office', 'คนทำงาน', 'Workers', work ? `${work} ${esc(where)}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้: สำนักงาน', 'no data in this province yet: offices']),
    T('biz', 'factory', 'กิจการรอบตัว', 'Businesses around', biz ? `${biz} ${esc(where)}${small([gap(['factory', 'industrialestate', 'camera'])])}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้: โรงงาน · นิคมอุตสาหกรรม · ร้านกล้อง', 'no data in this province yet: factories · industrial estates · camera shops']),
    T('rivals', 'compare', 'คู่แข่ง พันธมิตร สาขาของเรา', 'Rivals, partners, own branches', '', ['ยังไม่มีข้อมูล: ต้องเลือกประเภทธุรกิจและแบรนด์ก่อน ซึ่งหน้านี้ยังไม่มีตัวเลือก', 'no data yet: it needs a business type and brand to be picked, which this page does not offer yet']),
  ];
}

/** The rows of one axis as HTML (a list; a topic without data reads as such, in the same place). */
export function topicsHTML(axisId, ctx) {
  const rows = topicsOf(axisId, ctx);
  return `<ul class="tp-rows">${rows.map(t => `<li class="tp-row${t.text ? '' : ' is-wait'}" data-topic="${esc(t.id)}">${pic(t.icon)}<span class="tp-name">${esc(L(t.th, t.en))}</span><span class="tp-text">${t.text || esc(L(...t.wait))}</span></li>`).join('')}</ul>`;
}
