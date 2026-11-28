/**
 * Records of the open neighbourhood and the condominium display points (0.1.3, js/records.js): what the shards hold,
 * how a record links to its own demo, the one-set-at-a-time bar, and that no tip, list or card adds two datasets'
 * counts or shows a figure without dataset · source · date · boundary.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {load, readJSON, ROOT} from './helpers.js';
import {DEMOS} from '../js/shell/datasets.js';
import {CONDO, ALL, resolveChosen, decodeRecords, condoDataset, decodeCondo, cellsIn, growBox, spotsOf, barSets, barHTML, labelItems, tipHTML, detailHTML, listHTML,
  panelListHTML, recordHref, measureLabel, byDataset} from '../js/records.js';

const SIAM = 'CMN-TH-0001';
// The `e` kind each demo's own address opens a record with (its createCodec `items`, read 2026-11-16).
const ITEM_KINDS = {hotel: 'hotel', industrialestate: 'estate', office: 'office', shoppingcenter: 'venue', camera: 'store', factory: 'factory',
  fitness: 'store', grocery: 'store', luxurybrands: 'store', pharmacy: 'store', restaurant: 'store', governmentoffice: 'office', hospital: 'facility',
  school: 'school', transit: 'station', university: 'site', housingestate: 'record', tourism: 'attraction'};   // (0.8.0) the two demos added

const strip = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('one shard per closed outline, holding exactly the fields the build declares, a key and a name for every record', () => {
  const {model, shards} = load();
  const files = readdirSync(join(ROOT, 'data/records')).filter(f => f.endsWith('.json')).sort();
  assert.deepEqual(files, model.rows.map(r => `${r.id}.json`).sort());
  for (const r of model.rows) {
    const shard = shards[r.id];
    assert.equal(shard.id, r.id);
    assert.deepEqual(shard.fields, model.meta.records.fields);
    for (const row of shard.rows) {
      assert.equal(row.length, shard.fields.length, r.id);
      assert.ok(typeof row[4] === 'string' && row[4].length, `${r.id}: a key`);
    }
  }
  // (0.8.0) Housing Estate's permits without a project name stay nameless, as the demo shows them (“ไม่มีชื่อโครงการในระเบียน”)
  const he = model.dsById.get('housingestate').index;
  const all = Object.values(shards).flatMap(s => s.rows);
  const named = all.filter(x => x[5]).length, nameless = all.filter(x => !x[5] && x[0] === he).length;
  assert.ok(named / (model.meta.totals.insidePoints - nameless) > 0.99, `names for ${named} of ${model.meta.totals.insidePoints - nameless}`);
});

test('a record opens in its own demo at its own key (citymeter-shell `e`), in English only where the demo has English', () => {
  const {model} = load();
  // (0.8.0) a counted-only dataset has no demo and no record to open (its points stay private)
  for (const ds of model.datasets) assert.equal(ds.item, ds.aggregate ? null : ITEM_KINDS[ds.id], ds.id);
  const recs = decodeRecords(readJSON(`data/records/${SIAM}.json`), model);
  const hotel = recs.find(x => x.ds.id === 'hotel');
  assert.equal(recordHref(hotel), `https://montri-th.github.io/hotel/?e=hotel:${encodeURIComponent(hotel.key).replace(/%3A/gi, ':').replace(/%2F/gi, '/')}`);
  const station = recs.find(x => x.ds.id === 'transit');
  assert.match(recordHref(station), /^https:\/\/montri-th\.github\.io\/transit\/\?e=station:RAILCAT:/);
  // Industrial Estate lives inside Factory on GitHub Pages
  const estate = {kind: 'record', key: 'EST-IEAT-2677', ds: model.dsById.get('industrialestate')};
  assert.equal(recordHref(estate), 'https://montri-th.github.io/factory/industrialestate/?e=estate:EST-IEAT-2677');
  for (const ds of model.datasets) if (!ds.aggregate) assert.ok(DEMOS.some(d => d.path === ds.path), ds.id);
  assert.equal(recordHref({kind: CONDO, ds: condoDataset(model.meta.condo)}), '');
});

test('one pin per dataset and exact point; a pile keeps every record', () => {
  const {model} = load();
  const recs = decodeRecords(readJSON(`data/records/${SIAM}.json`), model);
  const spots = spotsOf(recs);
  assert.equal(spots.reduce((t, g) => t + g.items.length, 0), recs.length);
  for (const g of spots) for (const r of g.items) assert.ok(r.ds === g.ds && r.lon === g.lon && r.lat === g.lat);
  assert.ok(spots.some(g => g.items.length > 1), 'Siam has piles (malls)');
});

test('the bar: “ทั้งหมด” first, the highlights next, condominiums last when near; no number on it', () => {
  const {model} = load();
  const row = model.byId.get(SIAM);
  const recs = decodeRecords(readJSON(`data/records/${SIAM}.json`), model);
  const condo = condoDataset(model.meta.condo);
  const sets = barSets(recs, {highlights: row.hl.map(h => h.d), condo});
  // (0.8.0) a highlight of a counted-only dataset has no records to pick, so it is not on the bar
  const withRecords = row.hl.map(h => h.d).filter(d => recs.some(r => r.ds.id === d));
  assert.deepEqual(sets.slice(0, withRecords.length).map(d => d.id), withRecords);
  assert.equal(sets.at(-1).id, CONDO);
  assert.equal(new Set(sets.map(d => d.id)).size, sets.length);
  const html = barHTML(sets, 'luxurybrands');
  assert.match(html, /data-focus="all" aria-pressed="false"/);
  assert.match(html, /data-focus="luxurybrands" aria-pressed="true"/);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.ok(!/\d/.test(strip(html)), 'no number on the bar');
  const all = barHTML(sets, '');
  assert.match(all, /data-focus="all" aria-pressed="true"/);
  assert.equal((all.match(/aria-pressed="true"/g) || []).length, 1);
});

test('a neighbourhood opens on its first highlight (0.1.4); the reader’s pick, the dataset read and “ทั้งหมด” come first', () => {
  const {model} = load();
  const row = model.byId.get(SIAM);
  const records = decodeRecords(readJSON(`data/records/${SIAM}.json`), model);
  const highlights = row.hl.map(h => h.d);
  assert.equal(highlights[0], 'luxurybrands', 'Siam: luxury brands first');
  // Nothing picked: the first highlight with records.
  assert.equal(resolveChosen('', {records, highlights}), 'luxurybrands');
  // A highlight without records here is passed over.
  assert.equal(resolveChosen('', {records, highlights: ['nosuchset', ...highlights]}), 'luxurybrands');
  // The dataset the map is read by, when the neighbourhood has it.
  const other = records.map(r => r.ds.id).find(id => !highlights.includes(id));
  assert.ok(other);
  assert.equal(resolveChosen('', {records, highlights, lens: other}), other);
  assert.equal(resolveChosen('', {records, highlights, lens: 'nosuchset'}), 'luxurybrands');
  // The reader's own pick wins; one the neighbourhood lacks falls back to the default.
  assert.equal(resolveChosen(highlights[1], {records, highlights, lens: other}), highlights[1]);
  assert.equal(resolveChosen('nosuchset', {records, highlights}), 'luxurybrands');
  // “ทั้งหมด”: every set alike.
  assert.equal(resolveChosen(ALL, {records, highlights, lens: other}), '');
  // Condominiums only when they lie round the neighbourhood.
  assert.equal(resolveChosen(CONDO, {records, highlights, condo: true}), CONDO);
  assert.equal(resolveChosen(CONDO, {records, highlights, condo: false}), 'luxurybrands');
  // No records yet (still loading) or none at all: nothing chosen.
  assert.equal(resolveChosen('', {records: [], highlights}), '');
});

test('names go beside the chosen set only, or in the all view beside the venues (0.4.1, D-11); a pile says so in words, never with a count', () => {
  const {model} = load();
  const spots = spotsOf(decodeRecords(readJSON(`data/records/${SIAM}.json`), model));
  const all = labelItems(spots, '');
  assert.ok(all.length && all.every(x => spots[x.id].ds.item === 'venue'), 'the all view names the centres and markets only');
  assert.equal(all.length, spots.filter(g => g.ds.item === 'venue').length);
  const items = labelItems(spots, 'luxurybrands');
  assert.ok(items.length && items.every(x => spots[x.id].ds.id === 'luxurybrands'));
  const pile = items.find(x => spots[x.id].items.length > 1);
  assert.ok(pile && pile.name.endsWith('ฯลฯ'));
});

test('the tip names records (never a total across datasets); a figure on a card comes with dataset · source · date · boundary', () => {
  const {model} = load();
  const row = model.byId.get(SIAM);
  const recs = decodeRecords(readJSON(`data/records/${SIAM}.json`), model);
  const spots = spotsOf(recs);
  const mixed = [spots.find(g => g.ds.id === 'luxurybrands' && g.items.length > 1), spots.find(g => g.ds.id === 'restaurant')];
  const tip = strip(tipHTML(mixed));
  for (const g of mixed) assert.ok(tip.includes(g.items[0].name), g.ds.id);
  assert.ok(!/\b\d+\s*(ร้าน|แห่ง|รายการ|จุดขาย)/.test(tip), 'no count in the tip');
  const hotel = recs.find(x => x.ds.id === 'hotel' && x.measure != null);
  const card = detailHTML(hotel, {row});
  for (const part of ['dataset', 'source', 'date', 'boundary']) assert.match(card, new RegExp(`data-prov="${part}"`), part);
  assert.ok(strip(card).includes(`${hotel.measure.toLocaleString('th-TH')} ห้อง`));
  assert.equal(measureLabel(hotel.ds.measure), 'ห้องที่แหล่งบันทึก');
  const list = listHTML(mixed.flatMap(g => g.items), {row});
  assert.ok(!/ที่จุดนี้\s*\d/.test(strip(list)));
  assert.equal((list.match(/class="poi-item"/g) || []).length, mixed.reduce((t, g) => t + g.items.length, 0));
});

test('the panel lists every name by dataset, in the pillar order, each opening its card', () => {
  const {model} = load();
  const recs = decodeRecords(readJSON(`data/records/${SIAM}.json`), model);
  const html = panelListHTML(recs);
  assert.equal((html.match(/data-action="open-record"/g) || []).length, recs.length);
  const order = byDataset(recs).map(g => g.ds.group);
  assert.deepEqual(order, [...order].sort((a, b) => ['Land', 'Location', 'Living'].indexOf(a) - ['Land', 'Location', 'Living'].indexOf(b)));
  assert.match(panelListHTML(null), /data-records="loading"/);
});

test('condominium points: the cells the index names, each point inside its cell, only the published fields, never counted', () => {
  const {model} = load();
  const meta = model.meta.condo;
  assert.equal(meta.group, 'Land');
  assert.ok(meta.shown > 7000 && meta.held > 0 && meta.noPoint > 0);
  const files = readdirSync(join(ROOT, 'data/condo')).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.slice(0, -5)).sort();
  assert.deepEqual(files, [...meta.cells].sort());
  assert.deepEqual(readJSON('data/condo/index.json').cells, meta.cells);
  const ds = condoDataset(meta);
  let total = 0;
  for (const key of meta.cells) {
    const cell = readJSON(`data/condo/${key}.json`);
    assert.deepEqual(cell.fields, meta.fields);
    const [cx, cy] = key.split('_').map(Number);
    for (const r of decodeCondo(cell, ds)) {
      total++;
      assert.ok(Math.floor(r.lon / meta.cell) === cx && Math.floor(r.lat / meta.cell) === cy, key);
      assert.ok(r.name, key);
    }
    // no internal ids or addresses (UUIDs, observation ids, API links) in a published cell
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-|CM-CONDO|https?:/.test(JSON.stringify(cell)), key);
  }
  assert.equal(total, meta.shown);
  assert.ok(!model.datasets.some(d => d.id === CONDO), 'never a counted dataset');
  assert.ok(model.rows.every(r => !(CONDO in (r.c || {}))));
  const near = growBox(model.byId.get(SIAM).bbox, 1000);
  assert.ok(cellsIn(near, meta.cell, new Set(meta.cells)).length > 0);
  const card = detailHTML(decodeCondo(readJSON(`data/condo/${cellsIn(near, meta.cell, new Set(meta.cells))[0]}.json`), ds)[0]);
  for (const part of ['dataset', 'source', 'date', 'boundary']) assert.match(card, new RegExp(`data-prov="${part}"`), part);
  assert.match(strip(card), /ไม่นับในตัวเลขของย่าน/);
});
