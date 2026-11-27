import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeLogoShard, logoPlate, PLATES} from '../js/logos.js';
import {decodeRecords, labelItems, detailHTML, panelListHTML, spotsOf} from '../js/records.js';

// (0.5.1) Logos of the records and of the centres: data/logos/<id>.json, assets/logos/ and data/logos-report.json are
// written only by scripts/build-logos.py from files the family's demos already ship, joined by ids (DATA_METHOD.md §13).
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const report = read('data/logos-report.json');
const model = read('data/neighborhoods.json');
const around = read('data/around.json');
const sha256 = buf => createHash('sha256').update(buf).digest('hex');

test('every logo file is in the report with its bytes, display-sized, and nothing else is in the folder', () => {
  const files = readdirSync(new URL('assets/logos/', root)).sort();
  assert.deepEqual(files, Object.values(report.logos).map(x => x.file.split('/').pop()).sort());
  for (const [key, x] of Object.entries(report.logos)) {
    const bytes = readFileSync(new URL(x.file, root));
    assert.equal(sha256(bytes), x.sha256, key);
    assert.equal(key, `LG-${x.sha256.slice(0, 16)}`);
    assert.ok(PLATES.includes(x.plate), `${key}: a family plate`);
    if (x.mime !== 'image/svg+xml') assert.ok(Math.max(x.width, x.height) <= 512 && x.bytes <= 64 * 1024, `${key}: display-sized`);
    assert.ok(x.transformation === 'none' ? x.sourceSha256 === x.sha256 : x.sourceSha256 !== x.sha256, `${key}: a derived file keeps its source's SHA-256`);
  }
  assert.deepEqual(report.issues, [], 'every source file matched the SHA-256 of the record that ships it');
  assert.ok(!/google\.com|googleusercontent|localhost|file:/i.test(JSON.stringify(report.inputs)), 'inputs are repositories and files only');
});

test('one shard per records shard; every link points at a record of that neighbourhood or a centre it names', () => {
  const recordFiles = readdirSync(new URL('data/records/', root)).sort();
  assert.deepEqual(readdirSync(new URL('data/logos/', root)).sort(), recordFiles);
  const ids = model.datasets.map(d => d.id);
  let records = 0, venues = 0;
  for (const name of recordFiles) {
    const shard = read(`data/logos/${name}`), rec = read(`data/records/${name}`);
    assert.equal(shard.schema, 1);
    assert.equal(shard.id, rec.id);
    const F = Object.fromEntries(rec.fields.map((f, i) => [f, i]));
    const keys = new Set(rec.rows.map(r => `${ids[r[F.dataset]]}:${r[F.key]}`));
    for (const k of Object.keys(shard.records)) assert.ok(keys.has(k), `${name} ${k}`);
    const v = around.rows[rec.id]?.v || {};
    const named = new Set([...(v.in || []), ...(v.near || []).map(x => (Array.isArray(x) ? x[0] : x))]);
    for (const id of Object.keys(shard.venues)) assert.ok(named.has(id), `${name} ${id}`);
    for (const [k, x] of Object.entries(shard.logos)) assert.deepEqual(x, {file: report.logos[k].file, width: report.logos[k].width, height: report.logos[k].height, plate: report.logos[k].plate}, `${name} ${k}`);
    const used = new Set([...Object.values(shard.records), ...Object.values(shard.venues)]);
    assert.deepEqual(new Set(Object.keys(shard.logos)), used, `${name}: only the logos it uses`);
    records += Object.keys(shard.records).length;
    venues += Object.keys(shard.venues).length;
  }
  // snapshot of the 2026-11-27 build (fixtures, never UI constants)
  assert.equal(report.shards, 534); // 0.7.8 (469 in 0.6.1, 451 in 0.5.1)
  assert.equal(report.counts.grocery.own, report.counts.grocery.records, 'every grocery record is a brand with a logo');
  assert.equal(report.counts.shoppingcenter.venue_specific + report.counts.shoppingcenter.parent_complex, 58); // 0.6.1 (56 in 0.5.1)
  assert.ok(!report.counts.shoppingcenter.shared_chain_banner && !report.counts.shoppingcenter.shared_department_store_banner, 'a shared banner is never a centre\'s logo here');
  const linked = c => Object.entries(c).filter(([k]) => k !== 'records' && k !== 'venues' && !k.startsWith('none')).reduce((n, [, v]) => n + v, 0);
  assert.equal(records, Object.entries(report.counts).filter(([k]) => k !== 'around venues').reduce((n, [, c]) => n + linked(c), 0), 'the shards hold the links the report counts');
  assert.equal(venues, linked(report.counts['around venues']));
  assert.ok(venues > 0);
});

test('the loader refuses a logo outside the folder, a key that is not its file, an unknown plate or schema', () => {
  const name = readdirSync(new URL('data/logos/', root)).find(n => Object.keys(read(`data/logos/${n}`).logos).length);
  const shard = read(`data/logos/${name}`);
  const ok = decodeLogoShard(shard);
  assert.equal(ok.records.size, Object.keys(shard.records).length);
  const [k] = Object.keys(shard.logos);
  for (const mutate of [x => { x.logos[k].file = 'https://example.com/a.png'; }, x => { x.logos[k].plate = '#FF0000'; }, x => { x.logos[k].file = x.logos[k].file.replace(/[0-9a-f]{20}/, '0'.repeat(20)); }]) {
    const bad = structuredClone(shard);
    mutate(bad);
    const dec = decodeLogoShard(bad);
    assert.ok([...dec.records.values(), ...dec.venues.values()].every(x => x.key !== k), 'the record is dropped, the rest stay');
  }
  assert.equal(decodeLogoShard({...shard, schema: 2}), null);
  assert.equal(decodeLogoShard(null), null);
});

test('views: the card head, the spot label, the list and the panel names carry the record\'s plate; none without it', () => {
  const name = readdirSync(new URL('data/logos/', root)).find(n => Object.keys(read(`data/logos/${n}`).records).length);
  const shard = decodeLogoShard(read(`data/logos/${name}`));
  const recs = decodeRecords(read(`data/records/${name}`), model, shard);
  const withLogo = recs.find(r => r.logo), without = recs.find(r => !r.logo);
  assert.ok(withLogo);
  assert.match(detailHTML(withLogo), /<span class="logo-plate head-logo" style="background:#[0-9A-F]{6}"><img src="assets\/logos\/[0-9a-f]{20}\.\w+" alt="" width="\d+" height="32" style="height:32px"/);
  if (without) assert.doesNotMatch(detailHTML(without), /logo-plate/);
  assert.match(panelListHTML(recs), /class="link-button"[^>]*><span class="logo-plate inline-logo"/);
  assert.doesNotMatch(panelListHTML(decodeRecords(read(`data/records/${name}`), model, null)), /logo-plate/, 'no shard: names alone');
  const spots = spotsOf(recs);
  const items = labelItems(spots, withLogo.ds.id);
  assert.ok(items.some(x => x.logo), 'a spot of the chosen set carries its logo');
  assert.ok(items.filter(x => x.logo).every(x => spots[x.id].items.every(r => r.logo === x.logo)), 'only when every record of the spot has that logo');
  assert.equal(logoPlate(null), '');
});
