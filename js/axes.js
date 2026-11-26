/**
 * CityMETER · Commercial District — the three axes อยู่ · เที่ยว · ค้าขาย and the pictogram of each dataset (0.6.0; pure).
 *
 * Owner 2026-11-26 07:56 (VERBATIM): “ปรับเพิ่มอีกหน่อย / แกนหลักในการอธิบายแต่ละย่าน / อยากในเริ่มอธิบายใน 3 แกน แบบนี้จะดีมั้ย /
 * 1) น่าอยู่ / 2) น่าเที่ยว / 3) น่าค้าขาย / …”; 09:56 D-V6: the words on screen are อยู่ · เที่ยว · ค้าขาย (“ค้าขาย”, not
 * “ค้า”); 11:43 D-V7 A: one main axis per dataset, by the proposal's table (§4.9). Placing a dataset on an axis is this
 * demo's reading (an Inference, DATA_METHOD.md §14), not a definition of the source. An axis has no score and no total
 * (INV-01): it lists its datasets, each in its own unit, and names in a closed part the indicators it has no data for
 * yet — a mark that says “not yet”, never a promise, and only open or CityMETER sources by name.
 */

/** Dataset → pictogram role (assets/icons/material-pictogram-300.json; D-V4 B: the five shops have glyphs of their own). */
export const DS_ICON = Object.freeze({
  hotel: 'hotel', industrialestate: 'estate', office: 'office', shoppingcenter: 'venue',
  camera: 'camera', factory: 'factory', fitness: 'fitness', grocery: 'grocery', luxurybrands: 'brand', pharmacy: 'pharmacy', restaurant: 'restaurant',
  governmentoffice: 'gov', hospital: 'hospital', school: 'school', transit: 'rail', university: 'university',
});
export const dsIcon = ds => DS_ICON[ds?.id || ds] || 'dataset';

/** The axes, in the order the panel reads them; every dataset of the demo sits on exactly one (tests/visual.test.js). */
export const AXES = Object.freeze([
  {id: 'live', th: 'อยู่', en: 'Live', icon: 'home', meaning: ['ชีวิตประจำวัน', 'Daily life'],
    datasets: ['grocery', 'pharmacy', 'hospital', 'school', 'governmentoffice', 'transit', 'fitness'],
    pending: [
      {th: 'คนในทะเบียนบ้าน', en: 'Registered residents', source: ['CityMETER (แบบจำลองรายอาคาร)', 'CityMETER (per-building model)']},
      {th: 'น้ำท่วมซ้ำซาก', en: 'Repeated flooding', source: ['GISTDA', 'GISTDA']},
      {th: 'PM2.5', en: 'PM2.5', source: ['กรมควบคุมมลพิษ (Air4Thai) · กรุงเทพมหานคร (AirBKK)', 'Pollution Control Department (Air4Thai) · Bangkok (AirBKK)']},
    ]},
  {id: 'visit', th: 'เที่ยว', en: 'Visit', icon: 'luggage', meaning: ['คนมาเยือน', 'Visitors'],
    datasets: ['hotel', 'shoppingcenter', 'restaurant', 'luxurybrands'],
    pending: [
      {th: 'ที่พักแบบบ้าน', en: 'Home stays', source: ['Inside Airbnb', 'Inside Airbnb']},
      {th: 'แหล่งท่องเที่ยว', en: 'Attractions', source: ['Thailand Tourism Directory', 'Thailand Tourism Directory']},
      {th: 'โรงภาพยนตร์', en: 'Cinemas', source: ['CityMETER Yolk', 'CityMETER Yolk']},
    ]},
  {id: 'trade', th: 'ค้าขาย', en: 'Trade', icon: 'trade', meaning: ['คนทำงานและกิจการ', 'Workers and businesses'],
    datasets: ['office', 'university', 'camera', 'factory', 'industrialestate'],
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
