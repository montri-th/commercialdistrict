/**
 * Outlines redrawn by the owner's rule (0.3.0). Owner 2026-11-24 13:00, VERBATIM: “แทนขอบเดิมไปเลย เรียบง่ายกว่า” ·
 * “ใช้ชื่อป่าตอง” · “แบ่งเป็น 2 ย่าน” · “เลือกใช้แบบ B โดยมี A เป็นขอบนอกสุดอีกชั้นนึงกั้นไว้ไม่ให้เกิน ยกเว้นถ้ามีกรณีพิเศษให้มาถาม” ·
 * “ดูย่านอื่นๆทั่วประเทศด้วย ว่าสามารถ apply หลักเดียวกันได้มั้ย ติดตรงไหนให้มาถาม”.
 *
 * amendments/outline-amendments.geojson carries them (`rule` set; scripts/draw-outline-rule.browser.js drew them in the
 * live demo, scripts/rule-outlines.py amend wrote them); the build applies them like the 0.2.4 amendment
 * (scripts/build-data.py --outline-amendments); DATA_METHOD.md §2c.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT, readJSON, readBytes, sha256, load} from './helpers.js';

const amendments = readJSON('amendments/outline-amendments.geojson');
const rule = amendments.features.filter(f => f.properties.rule);
const WORDS = /แทนขอบเดิมไปเลย เรียบง่ายกว่า.*ใช้ชื่อป่าตอง.*แบ่งเป็น 2 ย่าน.*เลือกใช้แบบ B โดยมี A เป็นขอบนอกสุด/;

test('the drawing script and the amend step are in the repository, the trial is gone', () => {
  const js = readFileSync(join(ROOT, 'scripts/draw-outline-rule.browser.js'), 'utf8');
  assert.match(js, /window\.__rule = /);
  assert.match(js, /line B \(tight to the buildings\) with line A \(the dark ground\) as its outer limit/);
  const py = readFileSync(join(ROOT, 'scripts/rule-outlines.py'), 'utf8');
  for (const cmd of ['decode', 'review', 'amend']) assert.match(py, new RegExp(`'${cmd}'`));
  for (const gone of ['js/extents.js', 'data/extents.json']) assert.throws(() => readBytes(gone), `${gone} (the two-layer trial) never shipped`);
});

test('every rule amendment: the owner\'s words, the rule, the registry outline it was drawn from, only adding area', {skip: !rule.length && 'no outline redrawn by the rule yet'}, () => {
  const seen = new Set();
  for (const f of rule) {
    const p = f.properties;
    assert.ok(!seen.has(p.canonical_id), `${p.canonical_id} once`); seen.add(p.canonical_id);
    assert.equal(p.by, 'owner');
    assert.match(p.owner_words_th, WORDS, 'VERBATIM');
    assert.match(p.registry_geometry_sha256, /^[0-9a-f]{64}$/);
    assert.ok(p.area_m2 > p.registry_area_m2, `${p.canonical_id} only adds`);
    assert.deepEqual(p.includes, [], 'no named places: the rule');
    assert.ok(p.rules.includes('BUILDINGS') && p.rules.includes('DARK-GROUND'));
    assert.match(p.osm, /OpenFreeMap.*ODbL/);
    assert.ok(p.rule.th && p.rule.en && typeof p.rule.shared === 'boolean');
    assert.ok(['Polygon', 'MultiPolygon'].includes(f.geometry.type));
  }
});

test('the shipped data use the redrawn outlines, and the screen says how they were drawn', {skip: !rule.length && 'no outline redrawn by the rule yet'}, () => {
  const {raw, outlines} = load();
  const meta = raw.meta.amendments;
  assert.equal(meta.sha256, sha256(readBytes('amendments/outline-amendments.geojson')), 'the build read this very file');
  for (const f of rule) {
    const id = f.properties.canonical_id, item = meta.items.find(x => x.id === id), row = raw.rows.find(r => r.id === id);
    assert.ok(item?.rule, `${id} in meta.amendments with its rule`);
    assert.equal(row.amended, f.properties.amended_on);
    assert.ok(Math.abs(row.areaM2 - f.properties.area_m2) < 0.05, `${id}: the area measured in UTM as the registry measures its own`);
    assert.ok(outlines.metadata.amended.ids.includes(id));
  }
  const panel = readFileSync(join(ROOT, 'js/panel.js'), 'utf8');
  assert.match(panel, /ให้คลุมกลุ่มอาคารที่ต่อจากขอบเดิม ภายในพื้นที่ที่แผนที่ฐานไม่ได้ระบุเป็นป่า ทุ่ง หรือน้ำ/);
  assert.match(panel, /to the buildings that run on from the old outline, within ground the basemap does not mark as forest, field or water/);
});

test('ป่าตอง keeps its name for the whole town; กะรน and กะตะ stay two neighbourhoods', {skip: !rule.some(f => f.properties.canonical_id === 'CMN-TH-AC4758F0BC') && 'Patong not redrawn yet'}, () => {
  const {raw} = load();
  const row = id => raw.rows.find(r => r.id === id);
  assert.equal(row('CMN-TH-AC4758F0BC').name, 'ป่าตอง');
  assert.ok(row('CMN-TH-AC4758F0BC').areaM2 > 2e6, 'the town between the beach and the hills');
  assert.equal(row('CMN-TH-EC14CFAC8E').name, 'กะรน');
  assert.equal(row('CMN-TH-B481C8B92C').name, 'กะตะ');
});

test('the owner\'s picks: the drawing they read, one group per code, and only the picked codes redrawn', () => {
  const ch = readJSON('amendments/outline-rule-choices-2026-11-24.json');
  assert.equal(sha256(readBytes(ch.drawing.file)), ch.drawing.sha256, 'the stored drawing is the one the picks were made on');
  const drawing = readJSON(ch.drawing.file);
  assert.equal(drawing.places.length, 395);
  const groups = ['apply', 'applyTicked', 'applyNoted', 'trimArms', 'pending', 'keep', 'unchanged'];
  const all = groups.flatMap(g => ch[g]);
  assert.equal(new Set(all).size, all.length, 'a code in one group only');
  assert.deepEqual(new Set(all), new Set(drawing.places.map(p => p.id)), 'every drawn code has a group');
  for (const id of ch.apply) assert.ok(ch.reachM[id] <= ch.reachLimitM, `${id} reaches within ${ch.reachLimitM} m`);
  assert.ok(ch.owner.some(o => /ให้ผมติ๊กรายย่าน/.test(o.chose?.['the 45 that reach beyond 1 km'] ?? '')));
  for (const id of ch.applyTicked) assert.ok(!ch.apply.includes(id), `${id} ticked row by row, outside the automatic group`);
  assert.ok(ch.owner.some(o => o.when === '2026-11-24 17:00 ICT' && /google sheet/.test(o.verbatim.join(' '))), 'the row-by-row ticks are his');
  const lim = readJSON(ch.redraw.limits);
  for (const id of ch.applyNoted) assert.ok(lim.places[id], `${id} noted by the owner, its limits recorded`);
  assert.ok(ch.owner.some(o => o.when === '2026-11-24 17:43 ICT' && o.verbatim.includes('ย่านที่เหลือตามที่พี่เสนอได้เลย')), 'the noted places accepted in his words');
  const picked = new Set([...ch.apply, ...ch.applyTicked, ...ch.applyNoted, ...ch.trimArms]);
  for (const f of rule) assert.ok(picked.has(f.properties.canonical_id), `${f.properties.canonical_id} redrawn only on the owner's pick`);
});
