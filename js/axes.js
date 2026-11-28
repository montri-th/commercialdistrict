/**
 * CityMETER · Commercial District — the three axes น่าอยู่ · น่าเที่ยว · น่าค้าขาย and the pictogram of each dataset (0.6.0; names 0.7.0; pure).
 *
 * Owner 2026-11-26 07:56 (VERBATIM): “ปรับเพิ่มอีกหน่อย / แกนหลักในการอธิบายแต่ละย่าน / อยากในเริ่มอธิบายใน 3 แกน แบบนี้จะดีมั้ย /
 * 1) น่าอยู่ / 2) น่าเที่ยว / 3) น่าค้าขาย / …”; 09:56 D-V6: the words on screen are อยู่ · เที่ยว · ค้าขาย (“ค้าขาย”, not
 * “ค้า”); 11:43 D-V7 A: one main axis per dataset, by the proposal's table (§4.9); 14:03 D-V6b: the words go back to
 * น่าอยู่ · น่าเที่ยว · น่าค้าขาย, and every axis answers its “น่า” with topics in numbers (js/indicators.js). Placing a dataset on an axis is this
 * demo's reading (an Inference, DATA_METHOD.md §14), not a definition of the source. An axis has no score and no total
 * (INV-01): it lists its datasets, each in its own unit, and names in a closed part the indicators it has no data for
 * yet — a mark that says “not yet”, never a promise, and only open or CityMETER sources by name.
 */

/** Dataset → pictogram role (assets/icons/material-pictogram-300.json; D-V4 B: the five shops have glyphs of their own). */
export const DS_ICON = Object.freeze({
  hotel: 'hotel', industrialestate: 'estate', office: 'office', shoppingcenter: 'venue',
  camera: 'camera', factory: 'factory', fitness: 'fitness', grocery: 'grocery', luxurybrands: 'brand', pharmacy: 'pharmacy', restaurant: 'restaurant',
  governmentoffice: 'gov', hospital: 'hospital', school: 'school', transit: 'rail', university: 'university',
  // (0.8.0) parks, the registry's research datasets without a demo web, Housing Estate and Tourism
  housingestate: 'housing', tourism: 'tour', park: 'park', bank: 'bank', optical: 'optical', salon: 'salon', nail: 'nail', pet: 'pet',
  car: 'car', services: 'services', furniture: 'furniture', gold: 'gold', apparel: 'apparel', beauty: 'beauty', sport: 'sport', hobby: 'hobby',
  clinic: 'clinic', massage: 'massage', playground: 'playground', arts: 'museum', cinema: 'cinema', temple: 'temple',
});
export const dsIcon = ds => DS_ICON[ds?.id || ds] || 'dataset';

/** The axes, in the order the panel reads them; every dataset of the demo sits on exactly one (tests/visual.test.js). */
export const AXES = Object.freeze([
  {id: 'live', th: 'น่าอยู่', en: 'Liveable', icon: 'home', meaning: ['สิ่งที่คนในย่านเจอทุกวัน', 'What people living here meet every day'],
    // (0.8.0, owner 2026-11-28 20:12: parks weigh more in น่าอยู่ than gyms) parks first, then the daily needs and homes
    datasets: ['park', 'grocery', 'pharmacy', 'hospital', 'school', 'transit', 'governmentoffice', 'bank', 'salon', 'services', 'pet', 'car', 'housingestate', 'fitness'],
    pending: [
      {th: 'รถเมล์และเรือ', en: 'Buses and boats', source: ['ข้อมูลเส้นทางแบบเปิดของผู้ให้บริการ (GTFS)', 'operators’ open route data (GTFS)']},
      {th: 'น้ำท่วมซ้ำซาก', en: 'Repeated flooding', source: ['GISTDA', 'GISTDA']},
      {th: 'PM2.5', en: 'PM2.5', source: ['กรมควบคุมมลพิษ (Air4Thai) · กรุงเทพมหานคร (AirBKK)', 'Pollution Control Department (Air4Thai) · Bangkok (AirBKK)']},
    ]},
  {id: 'visit', th: 'น่าเที่ยว', en: 'Worth visiting', icon: 'luggage', meaning: ['ของให้เที่ยวหลายแบบ', 'Many kinds of things to do'],
    datasets: ['hotel', 'tourism', 'shoppingcenter', 'restaurant', 'apparel', 'beauty', 'luxurybrands', 'massage', 'arts', 'cinema', 'playground', 'temple'],
    pending: [
      {th: 'ที่พักแบบบ้าน', en: 'Home stays', source: ['Inside Airbnb', 'Inside Airbnb']},
      {th: 'พิกัดโรงภาพยนตร์และโรงละคร', en: 'Points of cinemas and theatres', source: ['ทะเบียนวิจัย CityMETER (มีรายชื่อ ยังไม่มีพิกัด)', 'CityMETER research register (listed, no points yet)']},
      {th: 'โบราณสถาน', en: 'Historic sites', source: ['กรมศิลปากร', 'Fine Arts Department']},
    ]},
  {id: 'trade', th: 'น่าค้าขาย', en: 'Good for trade', icon: 'trade', meaning: ['ผู้ซื้อ กำลังจ่าย และกิจการรอบตัว', 'Buyers, spending and businesses around'],
    datasets: ['office', 'university', 'factory', 'industrialestate', 'gold', 'optical', 'sport', 'hobby', 'furniture', 'clinic', 'nail', 'camera'],
    pending: [
      {th: 'กิจการเปิด–ปิด', en: 'Businesses opened and closed', source: ['กรมพัฒนาธุรกิจการค้า', 'Department of Business Development']},
      {th: 'ผู้โดยสารรายสถานี', en: 'Passengers by station', source: ['กรมการขนส่งทางราง', 'Department of Rail Transport']},
      {th: 'ราคาประเมินที่ดิน', en: 'Appraised land prices', source: ['กรมธนารักษ์', 'Treasury Department']},
    ]},
]);

/** The axis a dataset sits on. */
export const axisOf = id => AXES.find(a => a.datasets.includes(id)) || null;

/** The level from which a dataset is named on its axis's “ระดับสูง:” line (the mean of the two levels, D-V1). */
export const AXIS_LEAD_MIN = 75;
