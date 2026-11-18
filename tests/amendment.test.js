/**
 * Owner amendment of a registry outline (0.2.4). Owner 2026-11-18 17:05, VERBATIM: “ขอปรับย่าน นิมมาน-เมญ่า เชียงใหม่
 * ควรรวม ศูนย์การค้า Maya, กาดรินคำ, วิทยาลัยสารพัดช่างเชียงใหม่เข้าเป็นส่วนหนึ่งของย่านนี้ด้วย”.
 *
 * amendments/outline-amendments.geojson (scripts/draw-outline-amendment.py) replaces the registry outline of
 * CMN-TH-FB55C19EF1 in the build (scripts/build-data.py --outline-amendments); DATA_METHOD.md §2b.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT, readJSON, readBytes, sha256, load} from './helpers.js';
import {pointInRing} from '../js/shell/geometry.js';

const ID = 'CMN-TH-FB55C19EF1';
const WORDS = 'ขอปรับย่าน นิมมาน-เมญ่า เชียงใหม่ ควรรวม ศูนย์การค้า Maya, กาดรินคำ, วิทยาลัยสารพัดช่างเชียงใหม่เข้าเป็นส่วนหนึ่งของย่านนี้ด้วย';
// A point inside each OpenStreetMap way the amendment takes in (shapely representative_point of the way's ring).
const SITES = {
  'way/249154472': [98.967298, 18.802432], // เมญ่า (Maya Lifestyle Shopping Center)
  'way/470067655': [98.966493, 18.802899], // กาดรินคำ
  'way/580288757': [98.965221, 18.803182], // วิทยาลัยสารพัดช่างเชียงใหม่ (campus)
  'way/580288714': [98.965954, 18.802993], // The Wall, the retail ground between the campus and the market
};

const amendments = readJSON('amendments/outline-amendments.geojson');
const am = amendments.features[0];
const inside = (pt, geometry) => {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polys.some(([outer, ...holes]) => pointInRing(pt, outer) && !holes.some(h => pointInRing(pt, h)));
};

test('the amendment file: one outline, the owner\'s words, the places he named, drawn from the registry outline it replaces', () => {
  assert.equal(amendments.features.length, 1);
  const p = am.properties;
  assert.equal(p.canonical_id, ID);
  assert.equal(p.by, 'owner');
  assert.equal(p.amended_on, '2026-11-18');
  assert.equal(p.owner_words_th, WORDS, 'VERBATIM');
  assert.deepEqual(p.includes.map(x => x.source_id).sort(), Object.keys(SITES).sort());
  for (const name of ['เมญ่า', 'กาดรินคำ', 'วิทยาลัยสารพัดช่างเชียงใหม่']) assert.ok(p.includes.some(x => x.name_th === name), name);
  assert.match(p.registry_geometry_sha256, /^[0-9a-f]{64}$/, 'the registry outline it was drawn from');
  assert.ok(p.area_m2 > p.registry_area_m2, 'it only adds');
  assert.deepEqual(p.rules, ['CONTEXT', 'WHOLE', 'CROSSING', 'BAY', 'OVERLAP']);
  assert.match(p.osm, /ODbL/);
  assert.equal(am.geometry.type, 'Polygon');
  assert.equal(am.geometry.coordinates.length, 1, 'no hole');
  for (const [way, pt] of Object.entries(SITES)) assert.ok(inside(pt, am.geometry), way);
});

test('the shipped data use the amended outline: the row, its area, the display outline and the records inside', () => {
  const {raw, model, outlines, shards} = load();
  const meta = raw.meta.amendments;
  assert.equal(meta.file, 'amendments/outline-amendments.geojson');
  assert.equal(meta.sha256, sha256(readBytes('amendments/outline-amendments.geojson')), 'the build read this very file');
  const item = meta.items.find(x => x.id === ID);
  assert.ok(item);
  const row = raw.rows.find(r => r.id === ID);
  assert.equal(row.amended, '2026-11-18');
  assert.equal(row.areaM2, item.areaM2);
  assert.ok(Math.abs(row.areaM2 - am.properties.area_m2) < 0.05, 'the area measured in UTM 47N as the registry measures its own');
  assert.equal(item.registryAreaM2, am.properties.registry_area_m2);
  assert.equal(raw.rows.filter(r => r.amended).length, meta.items.length, 'only the amended rows carry the flag');
  assert.ok(model.rows.find(r => r.id === ID), 'decoded as any other row');
  const shown = outlines.features.find(f => f.properties.id === ID);
  for (const [way, pt] of Object.entries(SITES)) assert.ok(inside(pt, shown.geometry), `${way} inside the outline on the map`);
  assert.deepEqual(outlines.metadata.amended.ids, [ID]);
  const shard = shards[ID], F = Object.fromEntries(shard.fields.map((f, k) => [f, k]));
  const keys = new Set(shard.rows.map(x => x[F.key]));
  for (const key of ['SC-015705', 'CAM-O-0e17daca5f3e17', 'f22dde57', 'POS-a75590100646', 'PHO-48d82bc21b7dc7d2']) assert.ok(keys.has(key), `${key} (at Maya or Kad Rin Kham) is counted inside`);
  for (const x of shard.rows) assert.ok(inside([x[F.lon], x[F.lat]], am.geometry), `${x[F.key]} lies inside the amended outline`);
});

test('the screen says the outline was extended, from OpenStreetMap, and the area words no longer say "per the registry" for it', () => {
  const panel = readFileSync(join(ROOT, 'js/panel.js'), 'utf8'), app = readFileSync(join(ROOT, 'js/app.js'), 'utf8');
  assert.match(panel, /export function amendmentOf\(r, model\)/);
  assert.match(panel, /ปรับเพิ่ม \$\{thaiDate\(am\.on\)\} ให้รวม/, 'the outline line of the registry record');
  assert.match(panel, /ตามขอบที่ปรับเพิ่ม/, 'the area tile');
  assert.match(panel, /ขอบย่านฉบับร่าง ปรับเพิ่ม \$\{thaiDate\(am\.on\)\} จาก OpenStreetMap/, 'the boundary of the provenance line');
  assert.match(panel, /พื้นที่รวมของขอบย่าน/, 'a total that includes an amended outline is not the registry\'s');
  assert.match(app, /ต่อ ตร\.กม\. ของพื้นที่ขอบย่าน/, 'legend: density per km² of the outline area');
  assert.match(app, /used to draw them © OpenStreetMap contributors \(ODbL\)/, 'the map\'s credit line already names OpenStreetMap for the outlines (ODbL)');
});
