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
// (0.8.0) the distance and its unit never split across lines (a no-break space between them)
const whereWords = distance => (distance === 'in' ? L('ในย่าน', 'inside') : L(`ในย่านและขอบเดินถึง ${num(+distance)}\u00a0ม.`, `inside and within the ${num(+distance)}\u00a0m walkable edge`));
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
    // (0.8.0) a counted-only dataset with points for under 90 % of its records: where the register still has records
    // without a point in this province, none among the placed ones is not a 0 (the row says how many lack a point);
    // where every record of the province has its point, a 0 is a measured 0
    const u = !v && star && ds(id)?.aggregate ? ds(id).unplaced?.[row.province] || 0 : 0;
    if (u > 0) return `${esc(L(th, en))}${star} ${nw(esc(L('ไม่พบในรายการที่มีพิกัด', 'none among the records with a point')))} (${esc(L('อีก', 'another'))} ${fig(u, dsUnitN(ds(id), u))} ${esc(L('ในจังหวัดยังไม่มีพิกัด', 'in the province lack a point'))})`;
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

  // (0.8.0) a counted-only dataset (its points stay private) that has no point in the province can still have records the
  // master names there without a point: said as such, never a 0 of the neighbourhood (the masters' null_zero_rule)
  const unplaced = id => { const d = ds(id); const n = d?.unplaced?.[row.province] || 0; return n ? esc(L(`${dsName(d)}: ทะเบียนมี ${num(n)} ${dsUnitN(d, n)} ในจังหวัดนี้ที่ยังไม่มีพิกัด`, `${dsName(d)}: the register lists ${num(n)} ${dsUnitN(d, n)} in this province without a point`)) : ''; };
  // the datasets of a list that hold something at the axis distance, largest first, each with its unit and star
  const present = (ids, max = 6) => {
    const got = ids.filter(id => (at(id) || 0) > 0).sort((a_, b_) => at(b_) - at(a_));
    const shown = got.slice(0, max).map(id => `${esc(dsName(ds(id)))}${lowLocated(ds(id)) ? '*' : ''} ${fig(at(id), dsUnitN(ds(id), at(id)))}`);
    return {got, text: join(shown) + (got.length > max ? ` · ${esc(L(`อีก ${num(got.length - max)} ชุด`, `${num(got.length - max)} more datasets`))}` : '')};
  };
  const starNote = ids => (ids.some(id => model.dsById.has(id) && lowLocated(ds(id)) && (at(id) || 0) > 0) ? esc(L('* มีพิกัดไม่ถึง 90% ของรายการ ตัวเลขจึงต่ำกว่าจริงได้', '* points for under 90% of its records, so the figure can be low')) : '');
  // (0.8.0, owner 2026-11-28 20:12) parks are ground, not a count: about N ไร่ of public parks, the largest by name
  const parksText = () => {
    const v = at('park');
    if (v == null) return '';
    const pk = (around?.rows.get(row.id)?.pk || []).filter(x => (distance === 'in' ? x[1] > 0 : x[1] + x[2] > 0));
    const list = model.parks || [];
    const names = pk.slice(0, 3).map(x => list[x[0]]).filter(Boolean).map(p => nw(`${esc(EN && p[1] ? p[1] : p[0])} ${esc(L(`(ทั้งสวนราว ${num(Math.round(p[2]))} ไร่)`, `(about ${num(Math.round(p[2]))} rai in all)`))}`));
    const park = cells.get('park');
    const lvl = park?.kind === 'ranked' && distance === 'in' ? `${esc(L('ระดับพื้นที่สวน', 'park ground level'))} ${nw(`<b class="data-number">${num(Math.round(park.level))}</b>/100`)} ${esc(L('เทียบ', 'among'))} ${fig(park.n, L('ย่าน', 'neighbourhoods'))}` : '';
    // a measured 0 reads 0 with its unit (the open map may not have mapped every park: the provenance line names it)
    const head = v > 0 ? `${esc(L('สวนสาธารณะราว', 'public parks of about'))} ${fig(v, L('ไร่', 'rai'))} ${esc(where)}` : `${esc(L('สวนสาธารณะในแผนที่ OpenStreetMap', 'public parks on OpenStreetMap'))} ${fig(0, L('ไร่', 'rai'))} ${esc(where)}`;
    return `${head}${small([names.length ? esc(L('สวนที่นับ: ', 'counted: ')) + names.join(' · ') : '', lvl])}`;
  };

  if (axisId === 'live') {
    const eat = join([nd('restaurant', 'ร้านอาหาร', 'restaurants'), nd('grocery', 'ร้านของชำ', 'groceries')]);
    const kinds = kindsInside(row, model, 'restaurant');
    const eatQ = kinds && kinds[0] ? esc(L(`ร้านอาหาร ${num(kinds[0])} ประเภทจาก ${num(kinds[1])} ในย่าน`, `${num(kinds[0])} of ${num(kinds[1])} kinds of restaurant inside`)) : '';
    // (0.8.0) daily needs: banks and hair salons join; gyms leave for the green row (owner 2026-11-28: parks weigh more)
    const NEEDS = ['grocery', 'pharmacy', 'hospital', 'school', 'transit', 'governmentoffice', 'bank', 'salon'];
    const needs = NEEDS.filter(id => id in (row.c || {}));
    const have = needs.filter(id => (at(id) || 0) > 0), lack = needs.filter(id => !((at(id) || 0) > 0));
    const more = present(['pet', 'car', 'services']);
    const needText = needs.length ? `${esc(L(`มี ${num(have.length)} จาก ${num(needs.length)} อย่างที่มีข้อมูล ${where}`, `${num(have.length)} of the ${num(needs.length)} kinds with data ${where}`))}${small([lack.length ? esc(L('ไม่พบ: ', 'not found: ')) + esc(lack.map(id => nameOf(model, id)).join(' · ')) : '', more.got.length ? esc(L('บริการอื่น: ', 'other services: ')) + more.text : '', gap([...NEEDS, 'pet', 'car', 'services'])])}` : '';
    const st = at('transit');
    const resIn = pin?.res, km2 = row.km2;
    const perKm2 = km2 > 0 && resIn != null ? resIn / km2 : null;
    const resText = resIn != null ? `${join([`${esc(L('คนในทะเบียนบ้านในย่าน', 'registered residents inside'))} ${people_(resIn)}`,
      perKm2 > 0 ? nw(esc(L(aboutPeople(perKm2) ? `ราว ${aboutPeople(perKm2)} คน/ตร.กม.` : 'ไม่ถึง 10 คน/ตร.กม.', aboutPeople(perKm2) ? `about ${aboutPeople(perKm2)} per km²` : 'under 10 per km²'))) : ''])} ${modelled}` : '';
    const rest = cells.get('restaurant');
    // the level of §14 (count and density among the neighbourhoods with 3 or more), said neutrally at any level
    const lively = rest?.kind === 'ranked' ? `${esc(L('ระดับร้านอาหาร (จำนวนและความแน่น)', 'restaurant level (count and density)'))} ${nw(`<b class="data-number">${num(Math.round(rest.level))}</b>/100`)} ${esc(L('เทียบ', 'among'))} ${fig(rest.n, L('ย่าน', 'neighbourhoods'))}` : '';
    const green = parksText();
    const gym = at('fitness') != null ? nd('fitness', 'ฟิตเนส', 'gyms') : '';
    const plots = row.m?.housingestate;
    const homes = at('housingestate') != null ? `${nd('housingestate', 'บ้านจัดสรร', 'housing estates')} ${esc(where)}${small([plots && distance === 'in' ? esc(L(`ในย่านรวม ${num(plots[0])} แปลงตามใบอนุญาต`, `${num(plots[0])} plots by permit inside`)) : '', esc(L('แปลงตามใบอนุญาต ไม่ใช่บ้านที่สร้างแล้วหรือคนอยู่', 'plots by permit, not houses built or people living'))])}` : '';
    return [
      T('green', 'park', 'สวนและพื้นที่สีเขียว', 'Parks and green space', green ? `${green}${small([gym ? `${gym} ${esc(where)}` : '', gap(['fitness'])])}` : '', ['ยังไม่มีข้อมูลสวน', 'no park data yet']),
      T('eat', 'restaurant', 'กิน', 'Eating', eat ? `${eat} ${esc(where)}${small([eatQ, gap(['restaurant', 'grocery'])])}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้: ร้านอาหาร · ร้านของชำ', 'no data in this province yet: restaurants · groceries']),
      T('needs', 'grocery', 'ของจำเป็นใกล้ตัว', 'Everyday needs', needText, ['ยังไม่มีข้อมูลในจังหวัดนี้', 'no data in this province yet']),
      T('homes', 'housing', 'บ้านจัดสรร', 'Housing estates', homes, ['ยังไม่มีข้อมูลในจังหวัดนี้: ใบอนุญาตจัดสรรที่ดิน', 'no data in this province yet: land-allocation permits']),
      T('move', 'rail', 'การเดินทาง', 'Getting around', st != null ? `${nd('transit', 'สถานีราง', 'rail stations')} ${esc(where)}${small([esc(L('รถเมล์และเรือ: ยังไม่มีข้อมูล', 'buses and boats: no data yet'))])}` : '', ['ยังไม่มีข้อมูลระบบรางในจังหวัดนี้ · รถเมล์และเรือยังไม่มีข้อมูล', 'no rail data in this province yet · buses and boats: no data yet']),
      T('crowd', 'building', 'คนและความแน่น', 'People and crowding', resText, resWait('in').map((w, k) => `${k ? 'residents' : 'คนอยู่'}: ${w}`)),
      T('lively', 'venue', 'ความคึกคัก', 'Liveliness', lively, !rest || rest.kind === 'out' ? ['ยังไม่มีข้อมูลในจังหวัดนี้: ร้านอาหาร', 'no data in this province yet: restaurants'] : ['ร้านอาหารในย่านน้อยกว่า 3 ร้าน จึงไม่จัดระดับ', 'fewer than 3 restaurants inside, so no level']),
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
    // attractions by kind inside (the Tourism demo's groups: nature · culture · recreation) and the large parks counted
    const tk = row.s?.tourism, tds = ds('tourism');
    const tKinds = tk && tds?.subgroups ? tk.map((n, k) => (n > 0 ? `${esc(L(tds.subgroups[k].th, tds.subgroups[k].en))} ${num(n)}` : '')).filter(Boolean).join(' · ') : '';
    const bigParks = (around?.rows.get(row.id)?.pk || []).filter(x => (distance === 'in' ? x[1] > 0 : x[1] + x[2] > 0)).map(x => (model.parks || [])[x[0]]).filter(p => p && p[3] === 0);
    const sights = at('tourism') != null ? `${nd('tourism', 'แหล่งท่องเที่ยว', 'attractions')} ${esc(where)}${small([tKinds ? esc(L('ในย่าน: ', 'inside: ')) + tKinds : '',
      bigParks.length ? esc(L('สวนใหญ่ 50 ไร่ขึ้นไปที่นับ: ', 'large parks counted (50 rai or more): ')) + bigParks.slice(0, 2).map(p => nw(esc(EN && p[1] ? p[1] : p[0]))).join(' · ') : '',
      at('arts') != null ? nd('arts', 'พิพิธภัณฑ์และหอศิลป์', 'museums and galleries') : unplaced('arts') || gap(['arts'])])}` : '';
    const shopP = present(['shoppingcenter', 'apparel', 'beauty', 'luxurybrands'], 4);
    const lux = kindsInside(row, model, 'luxurybrands');
    const SHOP = ['shoppingcenter', 'apparel', 'beauty', 'luxurybrands'], shopIn = SHOP.filter(id => at(id) != null);
    const shop = shopIn.length
      ? `${shopP.text || esc(L(`พบ 0 จาก ${num(shopIn.length)} ชุดข้อมูลที่มีในจังหวัดนี้`, `0 of the ${num(shopIn.length)} datasets with data in this province`))} ${esc(where)}${small([lux && lux[0] ? esc(L(`แบรนด์หรู ${num(lux[0])} กลุ่มสินค้าจาก ${num(lux[1])} ในย่าน`, `luxury brands in ${num(lux[0])} of ${num(lux[1])} groups inside`)) : '', starNote(['apparel', 'beauty']), gap(SHOP)])}` : '';
    const well = at('massage') != null ? `${nd('massage', 'นวดและสปา', 'massage and spas')} ${esc(where)}${small([(at('massage') || 0) > 0 ? unplaced('massage') || starNote(['massage']) : ''])}` : unplaced('massage');
    const night = at('cinema') != null ? `${nd('cinema', 'โรงภาพยนตร์และโรงละคร', 'cinemas and theatres')} ${esc(where)}` : unplaced('cinema');
    const family = at('playground') != null ? `${nd('playground', 'สนามเด็กเล่นและเกมเซ็นเตอร์', 'play places and game centres')} ${esc(where)}${small([(at('playground') || 0) > 0 ? unplaced('playground') : ''])}` : unplaced('playground');
    // (0.8.0) places of worship: the register's 53,045 have no point yet, so OpenStreetMap's are counted, by faith inside
    const tm = row.s?.temple, tmd = ds('temple');
    const tmKinds = tm && tmd?.subgroups ? tm.map((n, k) => (n > 0 ? `${esc(L(tmd.subgroups[k].th, tmd.subgroups[k].en))} ${num(n)}` : '')).filter(Boolean).join(' · ') : '';
    const monuments = esc(L('โบราณสถานขึ้นทะเบียน (กรมศิลปากร): ยังไม่มีข้อมูล', 'registered monuments (Fine Arts Department): no data yet'));
    const tv = at('temple');
    // a measured 0 reads 0 (OpenStreetMap may not have mapped one yet: the provenance line names the source)
    const worship = tv == null ? '' : `${nd('temple', 'ศาสนสถาน', 'places of worship')} ${esc(where)}${small([tmKinds ? esc(L('ในย่าน: ', 'inside: ')) + tmKinds : '', monuments])}`;
    const KINDS = ['hotel', 'tourism', 'shoppingcenter', 'restaurant', 'apparel', 'beauty', 'luxurybrands', 'massage', 'arts', 'cinema', 'playground', 'temple'];
    const kindsCount = KINDS.filter(id => id in (row.c || {}));
    const presentK = kindsCount.filter(id => (at(id) || 0) > 0);
    return [
      T('stay', 'hotel', 'ที่พัก', 'Places to stay', stay, ['ยังไม่มีข้อมูลในจังหวัดนี้: ที่พัก', 'no data in this province yet: lodging']),
      T('sights', 'tour', 'แหล่งท่องเที่ยว', 'Attractions', sights, ['ยังไม่มีข้อมูลในจังหวัดนี้: แหล่งท่องเที่ยว', 'no data in this province yet: attractions']),
      T('shop', 'venue', 'ช้อปปิ้ง แฟชั่น และความงาม', 'Shopping, fashion and beauty', shop, ['ยังไม่มีข้อมูลในจังหวัดนี้: ศูนย์การค้า ร้านแฟชั่น ความงาม', 'no data in this province yet: centres, fashion and beauty']),
      T('well', 'massage', 'นวดและสปา', 'Massage and spas', well, ['ยังไม่มีข้อมูลในจังหวัดนี้: นวดและสปา', 'no data in this province yet: massage and spas']),
      T('night', 'cinema', 'โรงภาพยนตร์ โรงละคร', 'Cinemas and theatres', night, ['ยังไม่มีข้อมูลในจังหวัดนี้: โรงภาพยนตร์และโรงละคร', 'no data in this province yet: cinemas and theatres']),
      T('family', 'playground', 'เด็กและครอบครัว', 'Children and families', family, ['ยังไม่มีข้อมูลในจังหวัดนี้: สนามเด็กเล่นและเกมเซ็นเตอร์', 'no data in this province yet: play places and game centres']),
      T('mix', 'rank', 'ความหลากหลาย', 'Variety', kindsCount.length ? `${esc(L(`มีของให้เที่ยว ${num(presentK.length)} จาก ${num(kindsCount.length)} หมวดที่มีข้อมูล ${where}`, `${num(presentK.length)} of the ${num(kindsCount.length)} kinds with data ${where}`))}${small([gap(KINDS)])}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้', 'no data in this province yet']),
      T('history', 'temple', 'ศาสนสถานและประวัติศาสตร์', 'Places of worship and history', worship, ['ยังไม่มีข้อมูล: ศาสนสถานในจังหวัดนี้ · โบราณสถานขึ้นทะเบียน (กรมศิลปากร)', 'no data yet: places of worship in this province · registered monuments (Fine Arts Department)']),
    ];
  }
  // trade
  const buyers = ps ? join([
    ps.res != null ? `${esc(L('คนอยู่', 'living here'))} ${people_(ps.res)} ${modelled}` : esc(L(...resWait(distance).map((w, k) => `${k ? 'living here' : 'คนอยู่'}: ${w}`))),
    ps.com != null ? `${esc(L('คนมาทำงานและเรียน อย่างน้อย', 'come to work and study, at least'))} ${fig(atLeastPeople(ps.com), L('คน', 'people'))}${ps.comLow ? '*' : ''}` : '',
    ps.gst != null ? `${esc(L('ผู้มาเยือนค้างคืน', 'overnight visitors'))} ${ps.gst === 0 ? fig(0, L('คนต่อปี', 'a year')) : aboutPeople(ps.gst) ? `${esc(L('ราว', 'about'))} ${fig(aboutPeople(ps.gst), L('คนต่อปี', 'a year'))}` : nw(esc(L('ไม่ถึง 10 คนต่อปี', 'under 10 a year')))} ${modelled}` : '']) : '';
  const off = ps?.off;
  const work = join([nd('office', 'สำนักงาน', 'offices'), off ? `${esc(L('คนทำงานในสำนักงาน', 'office workers'))} ${nw(`<b class="data-number">${num(off[0])}–${num(off[1])}</b> ${esc(L('คน', 'people'))}`)} ${modelled}` : '']);
  const biz = join([nd('factory', 'โรงงาน', 'factories'), nd('industrialestate', 'นิคมอุตสาหกรรม', 'industrial estates'), nd('bank', 'สาขาธนาคาร', 'bank branches')]);
  // (0.8.0) the chains of shops round the neighbourhood: the registry's research datasets, each in its own unit, never added
  const RETAIL = ['gold', 'optical', 'sport', 'hobby', 'furniture', 'clinic', 'nail', 'camera'];
  const retail = present(RETAIL);
  const retailIn = RETAIL.filter(id => at(id) != null);
  const retailText = retailIn.length ? `${retail.text || esc(L(`พบ 0 จาก ${num(retailIn.length)} ชุดข้อมูลที่มีในจังหวัดนี้`, `0 of the ${num(retailIn.length)} datasets with data in this province`))} ${esc(where)}${small([esc(L('นับเฉพาะร้านของเครือที่ทะเบียนสำรวจ ไม่ใช่ทุกร้านในพื้นที่', 'only the chains the register surveyed, not every shop here')), starNote(RETAIL), gap(RETAIL)])}` : '';
  return [
    T('buyers', 'home', 'ผู้ซื้อ', 'Buyers', buyers ? `${buyers} ${esc(where)}<br><small>${esc(L('สามกลุ่มไม่รวมกัน · ไม่ใช่จำนวนลูกค้า', 'three groups, never added · not customers'))}${ps?.comLow ? esc(L(' · * ส่วนใหญ่มาจากชุดที่มีพิกัดไม่ครบ', ' · * mostly from datasets without points for every record')) : ''}</small>` : '', peopleWait || ['ยังไม่มีข้อมูล', 'no data yet']),
    T('spend', 'fee', 'กำลังจ่าย', 'Spending power', at('luxurybrands') != null ? `${nd('luxurybrands', 'จุดขายแบรนด์หรู', 'luxury points of sale')} ${esc(where)}${small([esc(L('ราคาประเมินที่ดินและค่าเช่า: ยังไม่มีในเดโมนี้ · ไม่ใช่รายได้ของคนในย่าน', 'land prices and rents: not in this demo yet · not the income of the people here'))])}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้: แบรนด์หรู · ราคาประเมินที่ดินและค่าเช่า: ยังไม่มีในเดโมนี้', 'no data in this province yet: luxury brands · land prices and rents: not in this demo yet']),
    T('work', 'office', 'คนทำงาน', 'Workers', work ? `${work} ${esc(where)}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้: สำนักงาน', 'no data in this province yet: offices']),
    T('retail', 'segment', 'ร้านค้าเครือรอบตัว', 'Chain shops around', retailText, ['ยังไม่มีข้อมูลในจังหวัดนี้: ร้านค้าเครือ', 'no data in this province yet: chain shops']),
    T('biz', 'factory', 'กิจการรอบตัว', 'Businesses around', biz ? `${biz} ${esc(where)}${small([gap(['factory', 'industrialestate', 'bank'])])}` : '', ['ยังไม่มีข้อมูลในจังหวัดนี้: โรงงาน · นิคมอุตสาหกรรม · ธนาคาร', 'no data in this province yet: factories · industrial estates · banks']),
    T('rivals', 'compare', 'คู่แข่ง พันธมิตร สาขาของเรา', 'Rivals, partners, own branches', '', ['ยังไม่มีข้อมูล: ต้องเลือกประเภทธุรกิจและแบรนด์ก่อน ซึ่งหน้านี้ยังไม่มีตัวเลือก', 'no data yet: it needs a business type and brand to be picked, which this page does not offer yet']),
  ];
}

/** The rows of one axis as HTML (a list; a topic without data reads as such, in the same place). */
export function topicsHTML(axisId, ctx) {
  const rows = topicsOf(axisId, ctx);
  return `<ul class="tp-rows">${rows.map(t => `<li class="tp-row${t.text ? '' : ' is-wait'}" data-topic="${esc(t.id)}">${pic(t.icon)}<span class="tp-name">${esc(L(t.th, t.en))}</span><span class="tp-text">${t.text || esc(L(...t.wait))}</span></li>`).join('')}</ul>`;
}
