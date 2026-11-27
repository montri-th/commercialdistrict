/**
 * Commercial District · page language (citymeter-shell, js/shell/i18n.js). js/app.js imports this module first, so an English
 * page is translated before anything renders. The fixed words are in js/lang-en.js; the sentences built from data are
 * written in English where they are built (js/panel.js). Names come from the data's own English and are never
 * translated here (demo-platform-review §5.8): provinces from the CityMETER production outlines (data/provinces.geojson
 * nameEn), datasets from their demo's English name. The central neighbourhood registry carries no English names, so
 * neighbourhood names and their other names stay Thai (keepThai).
 */
import {LANG, registerDictionary, registerNames, keepThai, startTranslation} from './shell/i18n.js';
import {provinces} from './model.js';
import NEIGHBORHOOD_EN from './lang-en.js';

const THAI = /[ก-ฺเ-๎]/;

if (LANG === 'en') {
  registerDictionary(NEIGHBORHOOD_EN);
  startTranslation();
  // The English is a draft until reviewed (demo-platform-review §5.8): the help dialog says so.
  const note = () => {
    const intro = document.querySelector('.usage-dialog .help-intro');
    if (!intro || document.getElementById('draft-english-note')) return;
    const p = document.createElement('p');
    p.id = 'draft-english-note';
    p.className = 'help-intro';
    p.textContent = 'English is a draft translation from the Thai. Neighbourhood names, other names and the registry’s notes have no English in the registry and stay in Thai. The product statement is in Thai.';
    intro.after(p);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', note, {once: true}); else note();
}

/**
 * The names on a round map that OpenStreetMap gives only in Thai (0.7.1, map.ctx.L): names, not sentences, so they stay
 * Thai on the English page as «รอบศูนย์นี้» keeps them.
 */
export function registerPlaceNames(rec) {
  if (LANG !== 'en') return;
  const thai = (rec?.map?.ctx?.L || []).filter(l => !l[5] && THAI.test(l[4] || '')).map(l => l[4]);
  // (0.7.5) a crossing or a river OpenStreetMap names only in Thai stays Thai in the English line under the tiles
  for (const c of rec?.map?.x?.c || []) if (!c[4] && THAI.test(c[3] || '')) thai.push(c[3]);
  for (const r of rec?.map?.x?.r || []) if (!r[1] && THAI.test(r[0] || '')) thai.push(r[0]);
  if (thai.length) keepThai(thai);
}

/** Register the English the data carries (model = js/model.js#decodeData, after setProvinces). */
export function registerDataNames(model) {
  if (LANG !== 'en') return;
  const pairs = [];
  for (const p of provinces()) if (p.en) pairs.push([p.th, p.en], [`จังหวัด${p.th}`, p.en]);
  const bangkok = provinces().find(p => p.code === 'BKK')?.en;
  if (bangkok) pairs.push(['กรุงเทพฯ', bangkok]);
  for (const ds of model?.datasets || []) pairs.push([ds.nameTh, ds.name]);
  registerNames(pairs);
  const exact = {};
  for (const r of model?.roles || []) if (r.th && r.en) exact[r.th] = r.en;
  registerDictionary({exact});
  const thai = [];
  for (const r of model?.rows || []) thai.push(r.name, ...(r.aliases || []));
  for (const p of model?.pending || []) thai.push(p.name);
  keepThai(thai.filter(v => v && THAI.test(v)));
}
