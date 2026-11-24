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

/** The trial wider areas' names stay Thai on an English page, as the neighbourhoods' names do (0.3.0). */
export function registerExtentNames(ext) {
  if (LANG !== 'en') return;
  keepThai((ext?.items || []).map(it => it.name).filter(v => v && THAI.test(v)));
}
