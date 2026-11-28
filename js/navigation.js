/**
 * This demo's navigation on the shared header code: the titles of its controls and its pictogram subset. The
 * nav-7 glyphs and the help dialog are js/shell/navigation.js, the dataset picker js/shell/header.js
 * (citymeter-shell: edit those in every repository at once, js/shell/manifest.json).
 */
import {installNavigation, NAV_GLYPHS, NAV_ICON_CONTRACT} from './shell/navigation.js';
import {installHeader} from './shell/header.js';

export {NAV_GLYPHS, NAV_ICON_CONTRACT};

/**
 * Metric-tile pictograms (test exception approved by the owner 2026-10-22 for the Luxury Brands demo; the subset of
 * CityMETER · School 0.6.0, built from the same source font with scripts/build-pictogram-font.py and copied unchanged;
 * to be registered in LDS if it proves itself). Same family and axes as nav-7, a separate subset so the approved nav-7
 * bytes stay unchanged. Glyph → meaning in Commercial District: maps (location_on) = ย่าน · area (map) = พื้นที่ ตร.กม. / ขอบ ·
 * province (location_city) = จังหวัด · dataset = ชุดข้อมูล · rank = จุดเด่นและอันดับ · compare (compare_arrows) = อะไรมา
 * ด้วยกัน / เปรียบเทียบ · history = ชื่อที่ยังไม่มีขอบ · date · ai · streetview for short copy. No star glyph: it would read
 * as a rating, which this product never shows.
 */
export const PICTOGRAM_CONTRACT = Object.freeze({
  family: 'LDS Material Symbols Rounded Pictogram',
  file: 'assets/icons/material-pictogram-300.woff2', bytes: 9724,
  sha256: 'f825f423b17476c3a40d3ac7c1e8018a9c8f96134d13cae3e1a247f74ce84951',
  manifest: 'assets/icons/material-pictogram-300.json',
  axes: Object.freeze({FILL: 0, wght: 300, GRAD: 0, opsz: 24}),
  glyphs: Object.freeze({area: '\uE55B', province: '\uE7F1', segment: '\uE72C', ai: '\uE65F', streetview: '\uE56E', maps: '\uE0C8',
    building: '\uEA40', school: '\uE80C', students: '\uF233', teacher: '\uEAF0', classroom: '\uEB4F', level: '\uF1A9',
    fee: '\uEF63', quality: '\uEF76', programme: '\uEA19', history: '\uE8E5', aff: '\uE97A', closed: '\uE615',
    rail: '\uE570', compare: '\uE915', sea: '\uE176', elevation: '\uE564', relief: '\uEA16', forest: '\uEA99',
    rank: '\uF20C', date: '\uE878', distance: '\uE41C', construction: '\uEA3C', dataset: '\uF20E', learning: '\uE666',
    tutor: '\uE745', language: '\uE8E2', arts: '\uE40A', child: '\uEB41', hotel: '\uEFDF', estate: '\uEBB8',
    office: '\uF1D0', venue: '\uE54C', camera: '\uE412', factory: '\uEBBC', fitness: '\uEB43', grocery: '\uE8CC',
    brand: '\uEAD5', pharmacy: '\uE550', restaurant: '\uE56C', gov: '\uE84F', hospital: '\uE548', university: '\uEA3E',
    home: '\uE9B2', luggage: '\uF235', trade: '\uEF63',
    // (0.8.0) parks, the registry's research datasets without a demo web, Housing Estate and Tourism
    park: '\uEA63', bank: '\uE2EB', optical: '\uF6EE', salon: '\uE14E', nail: '\uE764', pet: '\uE91D', car: '\uEA56', services: '\uE326',
    furniture: '\uEFED', gold: '\uE8E0', apparel: '\uEF7B', beauty: '\uEF9D', sport: '\uEA26', hobby: '\uE7C8', clinic: '\uE0A7',
    massage: '\uEB4C', playground: '\uEA52', museum: '\uEA36', cinema: '\uE404', temple: '\uEAB3', housing: '\uE58A', tour: '\uEF75'}),
  status: 'test exception to LDS nav-7 (owner 2026-10-22; action and building glyphs 2026-10-29; terrain glyphs 2026-11-01; rank, date, distance, construction and dataset glyphs 2026-11-01 for short copy; school glyphs 2026-11-05; learning glyphs 2026-11-06; dataset and axis glyphs 2026-11-26, D-V4 B of the visual-first panel; 0.8.0 glyphs of the datasets added 2026-11-28)',
  fallback: 'Text labels carry the meaning; pictograms stay hidden until the font has loaded.',
});
const TITLES = {
  'fit-map': 'ปรับแผนที่ให้เห็นย่านที่เลือก หรือย่านในจังหวัดที่เลือก',
  'country-map': 'ดูทั้งประเทศ ล้างจังหวัด ย่าน และคำค้น',
  'toggle-3d': 'สลับ 3 มิติ / 2 มิติ',
  'close-mobile-panel': 'กลับไปแผนที่',
  'sheet-back': 'กลับไปหน้าก่อน',
  'mobile-panel': 'เปิดแผงข้อมูลและตัวกรอง',
  'open-help': 'เปิดวิธีใช้',
  'open-help-sheet': 'เปิดวิธีใช้',
  'toggle-insights': 'เปิดหรือย่อแถบเปรียบเทียบย่าน',
  'compare-clear': 'ล้างย่านที่เปรียบเทียบทั้งหมด',
  'open-table': 'เปิดตารางทุกย่านกับทุกชุดข้อมูล',
  'toggle-table': 'ปิดตารางและกลับไปแผนที่',
  'search': 'ค้นหาชื่อย่าน ชื่ออื่นของย่าน รหัสย่าน หรือจังหวัด',
  'province': 'ดูเฉพาะย่านในจังหวัดนี้',
  'lens': 'ระบายสีย่านตามจุดเด่น หรือตามความหนาแน่นของชุดข้อมูลหนึ่ง',
  'prev-page': 'ดูหน้าก่อนหน้าของตาราง',
  'next-page': 'ดูหน้าถัดไปของตาราง',
};

if (typeof document !== 'undefined') {
  installNavigation({titles: TITLES, pictogramProbe: PICTOGRAM_CONTRACT.glyphs.maps});
  installHeader();
}
