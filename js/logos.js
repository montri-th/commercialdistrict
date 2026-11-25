/**
 * CityMETER · Commercial District — logos of the records and of the centres (0.5.0; owner 2026-11-26 06:14, VERBATIM:
 * “เรื่องโลโก้นี้ ให้แสดงใน Commercial district ในลักษณะเดียวกับ venue ด้วย โดยเฉพาะ venue และ POI สำคัญ”).
 * data/logos/<neighbourhood id>.json is written only by scripts/build-logos.py: files the family's demos already ship,
 * joined by ids (DATA_METHOD.md §13). `records` maps "<dataset id>:<record key>" to a logo, `venues` a Shopping Center
 * venue id (the centres «รอบย่านนี้» names). A logo sits beside a name that stays the identity: decorative (`alt=""`),
 * on its family plate (the same in both themes), never recoloured. The shard is optional: without it, or for a record
 * without a logo, nothing is drawn — never an empty box. Pure: no DOM access.
 */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const PLATES = Object.freeze(['#FFFFFF', '#E5E9E6', '#182327']);
const FILE = /^assets\/logos\/[0-9a-f]{20}\.(svg|png|jpg|webp|gif)$/;

/** A shard → {records: Map, venues: Map} of frozen logos {file, width, height, plate}; null on a bad file. */
export function decodeLogoShard(json) {
  if (!json || json.schema !== 1 || typeof json.logos !== 'object' || typeof json.records !== 'object' || typeof json.venues !== 'object') return null;
  const logos = new Map();
  for (const [key, x] of Object.entries(json.logos)) {
    if (!/^LG-[0-9a-f]{16}$/.test(key) || !FILE.test(x?.file || '') || !x.file.includes(key.slice(3)) || !PLATES.includes(x.plate)) continue;
    if (!(x.width > 0 && x.height > 0)) continue;
    logos.set(key, Object.freeze({key, file: x.file, width: x.width, height: x.height, plate: x.plate}));
  }
  const pick = obj => new Map(Object.entries(obj).filter(([, k]) => logos.has(k)).map(([id, k]) => [id, logos.get(k)]));
  return {records: pick(json.records), venues: pick(json.venues)};
}

/** The width a logo takes at a height, at most 3.5 × the height. */
export const logoWidth = (logo, height) => Math.max(1, Math.round(Math.min(height * 3.5, (logo.width / logo.height) * height)));

/** A logo on its plate; '' without one. `height` 32 in a card head, 20 in a row, 16 inline. */
export function logoPlate(logo, {height = 20, cls = ''} = {}) {
  if (!logo) return '';
  return `<span class="logo-plate${cls ? ` ${cls}` : ''}" style="background:${esc(logo.plate)}"><img src="${esc(logo.file)}" alt="" width="${logoWidth(logo, height)}" height="${height}" style="height:${height}px" loading="lazy" decoding="async"></span>`;
}
