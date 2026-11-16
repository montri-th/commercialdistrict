/**
 * Contextual outbound actions: the next question a reader has at each view, answered outside the demo.
 *
 *  - ถาม Google AI — Google Search with a question written for the view: a neighbourhood (what it is known for, who
 *    goes there, what is changing), a comparison of neighbourhoods, or the country/province overview. Google answers at
 *    the top of the results (AI Overview). Never a link straight into AI Mode (`udm=50`): Google stops one that comes
 *    from another site at “Continue with this search?” (Hotel 0.3.3, measured 2026-11-02).
 *  - Street View — only where the view has a point: the neighbourhood's reference point (the registry's area focus,
 *    not an entrance).
 *  - Google Maps — a search by the neighbourhood's name and province.
 *
 * Pure: builds labels and https URLs from public names only (no user data, no internal ids). An English page asks in
 * English with the English province names (js/lang.js); neighbourhood names stay as the registry writes them.
 */
import {LANG, englishName} from './shell/i18n.js';

const enc = encodeURIComponent;
export const googleAskURL = q => `https://www.google.com/search?q=${enc(q)}`;
export const mapsSearchURL = q => `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
export const streetViewURL = (lat, lon) => (Number.isFinite(lat) && Number.isFinite(lon)
  ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}` : '');

const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * ctx: {kind: 'neighborhood' | 'compare' | 'overview', name?, province? (Thai name), names? (compare), point?: {lat, lon}}
 * → [{id, label, href}] in display order (only the actions that apply).
 */
export function contextActions(ctx = {}, lang = LANG) {
  const out = [];
  const add = (id, label, href) => { if (href) out.push({id, label, href}); };
  const en = lang === 'en';
  const province = en ? englishName(clean(ctx.province)) : clean(ctx.province);
  if (ctx.kind === 'neighborhood' && ctx.name) {
    const name = clean(ctx.name);
    add('ai', 'ถาม Google AI', googleAskURL(en
      ? `${name}${province ? `, ${province}` : ''} (Thailand): what is this neighbourhood known for, who goes there, which new projects are coming, and how do people get there?`
      : `ย่าน${name}${province ? ` ${province}` : ''} มีอะไรเด่น คนกลุ่มไหนมาใช้ มีโครงการใหม่อะไรกำลังมา และเดินทางไปอย่างไร`));
    add('maps', 'Google Maps', mapsSearchURL([name, province].filter(Boolean).join(' ')));
  } else if (ctx.kind === 'compare' && ctx.names?.length > 1) {
    const names = ctx.names.map(clean);
    add('ai', 'ถาม Google AI', googleAskURL(en
      ? `Compare these neighbourhoods in Thailand: ${names.join(', ')} — what each is known for, who goes there and what is changing`
      : `เปรียบเทียบย่าน ${names.join(' กับ ')} แต่ละย่านเด่นเรื่องอะไร คนกลุ่มไหนมาใช้ และกำลังเปลี่ยนไปอย่างไร`));
  } else if (ctx.kind === 'overview') {
    const place = province || (en ? 'Thailand' : 'ประเทศไทย');
    add('ai', 'ถาม Google AI', googleAskURL(en
      ? `Which neighbourhoods of ${place} are the main shopping, office and tourist areas today, and which are growing fastest?`
      : `ย่านไหนใน${place}เป็นย่านการค้า สำนักงาน และท่องเที่ยวหลักตอนนี้ และย่านไหนกำลังโตเร็วที่สุด`));
  }
  const p = ctx.point;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) add('streetview', 'Street View', streetViewURL(p.lat, p.lon));
  return out;
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/** The action bar (icon + short label). '' when nothing applies. */
export function actionBar(ctx) {
  const list = contextActions(ctx);
  if (!list.length) return '';
  return `<div class="ask-bar" role="group" aria-label="ค้นต่อใน Google">${list.map(a => `<a class="ask-link ask-${esc(a.id)}" href="${esc(a.href)}" target="_blank" rel="noopener noreferrer"><i class="pictogram pic-${a.id === 'ai' ? 'ai' : a.id === 'streetview' ? 'streetview' : 'maps'}" aria-hidden="true"></i><span>${esc(a.label)}</span></a>`).join('')}</div>`;
}
