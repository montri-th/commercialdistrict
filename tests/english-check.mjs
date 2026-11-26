/**
 * The English page's leftovers, for tests/english.test.js (run in its own process: the page's language is read once,
 * when js/shell/i18n.js loads). Renders the views of the panel as an English page builds them and passes every text
 * and every translated attribute through the shell's own translate(), the dictionaries of js/lang.js and the names it
 * keeps in Thai (neighbourhood names have no English in the registry). Prints JSON: {views, texts, missing: [...]}.
 *
 *   node tests/english-check.mjs [step]   (every step-th neighbourhood; 1 = all 451)
 */
globalThis.location = {search: '?lang=en', pathname: '/'};
globalThis.document = {querySelector: sel => (sel.includes('citymeter:languages') ? {getAttribute: () => 'th en'} : null)};

const step = Math.max(1, Number(process.argv[2]) || 1);
const {LANG, translate} = await import('../js/shell/i18n.js');
const {registerDataNames, registerPlaceNames} = await import('../js/lang.js');
const {load, readJSON} = await import('./helpers.js');
const {decodeAround} = await import('../js/around.js');
const {scopeRows} = await import('../js/model.js');
const {buildNeighborhood, buildOverview, buildCompare} = await import('../js/profile.js');
const {renderNeighborhood, renderOverview, renderCompare} = await import('../js/panel.js');
if (LANG !== 'en') throw new Error('the page did not read English');

const {model} = load();
registerDataNames(model);
const around = decodeAround(readJSON('data/around.json'));
const ctx = {meta: model.meta, datasetCount: model.datasets.length};
const THAI = /[ก-ฺเ-๎]/;
const ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt', 'aria-description', 'aria-roledescription', 'data-tooltip'];
const decode = t => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const missing = new Map();
let views = 0, texts = 0;
const check = (html, where) => {
  views++;
  const body = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
  const found = [
    ...body.split(/<[^>]+>/).map(decode),
    ...[...body.matchAll(new RegExp(`\\s(?:${ATTRIBUTES.join('|')})="([^"]*)"`, 'g'))].map(m => decode(m[1])),
  ];
  for (const t of found) {
    if (!THAI.test(t)) continue;
    texts++;
    if (translate(t) == null && !missing.has(t.trim())) missing.set(t.trim(), where);
  }
};

const peopleMeta = readJSON('data/people/meta.json');
model.rows.forEach((r, i) => {
  if (i % step) return;
  const d = buildNeighborhood(model, r);
  for (const [a, distance] of [[around, 'in'], [around, '400'], [around, '800'], [null, 'in']]) check(renderNeighborhood(d, model, {ctx, around: a, distance}), `${r.id} ${distance}${a ? '' : ' (no around)'}`);
  // 0.7.0: «ใครอยู่ตรงนี้» at every scale, every map, and the topic rows with the people file
  const people = readJSON(`data/people/${r.id}.json`);
  registerPlaceNames(people);   // 0.7.1: names on the round map OpenStreetMap gives only in Thai stay Thai, as the page keeps them
  for (const reach of ['in', '1000', '3000', '5000']) for (const mapTab of ['visit', 'work', 'res']) {
    if (mapTab !== 'visit' && reach !== '1000') continue;
    check(renderNeighborhood(d, model, {ctx, around, distance: 'in', people, peopleMeta, reach, mapTab}), `${r.id} people ${reach} ${mapTab}`);
  }
  for (const distance of ['400', '800']) check(renderNeighborhood(d, model, {ctx, around, distance, people, peopleMeta}), `${r.id} people ${distance}`);
});
for (const province of ['', ...new Set(model.rows.map(r => r.province))]) {
  for (const ds of [null, model.dsById.get('luxurybrands')]) check(renderOverview(buildOverview(model, {rows: scopeRows(model, {province}), province, ds}), model, {ctx, around}), `overview ${province || 'TH'} ${ds?.id || ''}`);
}
const siam = model.rows.find(r => r.name === 'สยาม');
check(renderCompare(buildCompare(model, [siam, ...buildNeighborhood(model, siam).similar.map(x => x.row)]), model, {around}), 'compare');
console.log(JSON.stringify({views, texts, missing: [...missing].slice(0, 30).map(([t, w]) => `${w} | ${t}`)}));
