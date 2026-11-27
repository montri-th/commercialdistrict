/**
 * Across a river through the crossings (0.7.5, V7-09; DATA_METHOD.md §17).
 *
 * Owner 2026-11-27 06:51, VERBATIM: “ระยะ 400/800 ม. จะคิดเรื่องสิ่งกีดขวางด้วยไหม / คิดด้วย”; 07:09, on ปุณณวิถี's map of
 * residents: “คนอยู่ไม่น่าจะข้ามแม่น้ำจากบางกระเจ้ามาที่ปุณณวิถีได้นะครับ”. D-13: 1 · 3 · 5 km from the edge, the Shopping
 * Center page's rule (D70) on its very OpenStreetMap file (D-14). The files say they were built with the rule; the counts
 * through the crossings never exceed the straight ones; the maps keep every cell within 5 km and mark the ones beyond.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {load, readJSON} from './helpers.js';
import {decodeAround} from '../js/around.js';
import {buildNeighborhood} from '../js/profile.js';
import {renderNeighborhood} from '../js/panel.js';
import {REACHES, mapModel, mapSectors, crossOutPath, crossingWords} from '../js/people.js';

const OSM_SHA256 = '62b496bf2383ddd266cfcd3456cd03064db1887399f2a4c869bbf953bfd12d24';
const PUNNAWITHI = 'CMN-TH-FC9F0B73B3';
const KINDS = new Set(['bridge', 'road', 'tunnel', 'foot', 'ford', 'metro', 'ferry']);
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const ctx = model => ({meta: model.meta, datasetCount: model.datasets.length});

test('the people, residents and around files were built with one rule, on the pinned OpenStreetMap file', () => {
  const pm = readJSON('data/people/meta.json');
  const am = readJSON('data/around.json').meta;
  // the «ขอบเดินถึง» provenance line names the release of the counts it shows (review 2026-11-27: it read 0.6.1)
  assert.equal(am.release, readJSON('package.json').version);
  for (const [what, c] of [['people', pm.crossing], ['around', am.crossing], ['residents', pm.residents?.crossing]]) {
    assert.ok(c, `${what}: meta.crossing`);
    assert.equal(c.osm.sha256, OSM_SHA256, `${what}: D-14, the Shopping Center page's file`);
    assert.ok(['all', 'no-ferry'].includes(c.kinds), what);
    assert.match(c.rule.th, /ทางข้าม/, what);
    assert.match(c.rule.en, /crossing/, what);
    assert.match(c.cacheSha256, /^[0-9a-f]{64}$/, what);
  }
  assert.equal(pm.crossing.cacheSha256, am.crossing.cacheSha256, 'people and around read the same rivers');
  assert.equal(pm.crossing.cacheSha256, pm.residents.crossing.cacheSha256, 'people and residents read the same rivers');
  assert.equal(pm.crossing.kinds, am.crossing.kinds);
  assert.equal(pm.crossing.kinds, pm.residents.crossing.kinds);
  assert.ok(pm.crossing.neighbourhoods.acrossInMap > 0 && pm.crossing.neighbourhoods.figuresChanged > 0);
  assert.ok(am.crossing.datasetCountsMoved > 0);
  assert.match(am.crossing.owner, /คิดด้วย/);
});

test('every river record of a map is well formed, and band 4 is exactly a cell within 5 km in a straight line and beyond it through the crossings', () => {
  const {model} = load();
  let withX = 0;
  for (const r of model.rows) {
    const p = readJSON(`data/people/${r.id}.json`);
    const x = p.map.x;
    const {w, h} = p.map.cell;
    for (const tab of ['visit', 'work', 'res']) {
      const cells = p.map[tab] || [];
      const four = cells.filter(c => c[2] === 4);
      if (!x) { assert.equal(four.length, 0, `${r.id} ${tab}: band 4 without a river record`); continue; }
      const across = new Map(x.k.map(([k, d10, s10]) => [k, [d10, s10]]));
      // band 4 ⇔ across, within 5 km in a straight line and beyond it through the crossings — the hatch's own test at 5 km
      // (review 2026-11-27: one rounded test for both; a rim cell past 5 km in a straight line stays band 3)
      for (const [k, , band] of cells) {
        const a = across.get(k);
        const hatched = Boolean(a) && (a[0] < 0 || a[0] > 500) && a[1] <= 500;
        assert.equal(band === 4, hatched, `${r.id} ${tab} ${k}: band ${band}, across ${JSON.stringify(a)}`);
      }
    }
    if (!x) continue;
    withX++;
    assert.ok(x.k.length > 0, r.id);
    for (const [k, d10, s10] of x.k) {
      assert.ok(Number.isInteger(k) && k >= 0 && k < w * h && Number.isInteger(d10) && d10 >= -1 && Number.isInteger(s10) && s10 >= 0, `${r.id} ${k}`);
      if (d10 >= 0) assert.ok(d10 >= s10, `${r.id} ${k}: never nearer than the straight line`);
    }
    assert.ok(x.c.length <= 12, r.id);
    let last = -1;
    for (const c of x.c) {
      assert.equal(c.length, 6, r.id);
      assert.ok(KINDS.has(c[2]), `${r.id} ${c[2]}`);
      assert.ok(c[5] >= last && c[5] <= 5000, `${r.id}: crossings nearest first, within 5 km`);
      last = c[5];
    }
    for (const [th, en] of x.r) assert.ok(th || en, r.id);
    // one entry per river (review 2026-11-27: the Noi River listed twice, once without its Thai name)
    const ths = x.r.map(([th]) => th).filter(Boolean), ens = x.r.map(([, en]) => en).filter(Boolean);
    assert.equal(new Set(ths).size, ths.length, `${r.id}: a river twice by its Thai name`);
    assert.equal(new Set(ens).size, ens.length, `${r.id}: a river twice by its English name`);
    for (const v of Object.values(x.a || {})) assert.ok(v >= 0 && v <= 100, r.id);
    for (const [i, share] of Object.values(x.u || {})) assert.ok(i >= -1 && i < x.c.length && share >= 0 && share <= 100, r.id);
  }
  assert.ok(withX > 100, `${withX} maps with a river`);
});

test('through the crossings never counts more than the straight line, and the inside never moves', () => {
  const {model} = load();
  let differ = 0;
  for (const r of model.rows) {
    const p = readJSON(`data/people/${r.id}.json`);
    if (!p.st) continue;
    differ++;
    for (const [reach, st] of Object.entries(p.st)) {
      const s = p.s[reach];
      for (const f of ['res', 'com', 'gst']) if (f in st && st[f] != null && s[f] != null) assert.ok(st[f] >= s[f], `${r.id} ${reach} ${f}`);
      if ('ctr' in st && st.ctr != null) assert.ok(st.ctr >= s.n.shoppingcenter, `${r.id} ${reach} ctr`);
    }
    assert.ok(!('in' in p.st), `${r.id}: the inside is not a distance`);
  }
  assert.ok(differ > 0);
});

test('ปุณณวิถี: the river line names the Chao Phraya and the ferry, the fold compares, the map hatches by the distance', () => {
  const {model} = load();
  const around = decodeAround(readJSON('data/around.json'));
  const meta = readJSON('data/people/meta.json');
  const p = readJSON(`data/people/${PUNNAWITHI}.json`);
  const r = model.byId.get(PUNNAWITHI);
  const d = buildNeighborhood(model, r);
  const at = reach => renderNeighborhood(d, model, {ctx: ctx(model), around, people: p, peopleMeta: meta, reach, mapTab: 'res'});
  const html5 = at('5000');
  const sec = html5.slice(html5.indexOf('id="nb-people"'), html5.indexOf('id="nb-map"'));
  assert.match(text(sec), /อีกฝั่ง ?แม่น้ำเจ้าพระยา 4\.1% ของคนอยู่ใน 5 กม\./);
  assert.match(text(sec), /วัดระยะผ่าน เรือข้ามฟากวัดบางน้ำผึ้งนอก - วัดบางนานอก \(2\.1 กม\.\)/);
  assert.doesNotMatch(text(sec), /· ข้ามที่ |พาคน|crossing at /, 'a distance measured through a crossing, never people it carries (owner 2026-11-27 08:57)');
  assert.match(sec, /<summary>ข้ามแม่น้ำ: เทียบกับนับแบบเส้นตรง<\/summary>/);
  assert.match(sec, /<th scope="col">ผ่านทางข้าม<\/th><th scope="col">เส้นตรง<\/th>/);
  // inside: no river line (a distance from the edge is not read)
  const htmlIn = at('in');
  assert.ok(!/people-river/.test(htmlIn.slice(htmlIn.indexOf('id="nb-people"'), htmlIn.indexOf('id="nb-map"'))));
  // the hatch follows the distance the tiles read: a cell within it in a straight line and beyond it through the crossings
  // (review 2026-11-27: a cell already beyond it in a straight line is not the river's doing and stays plain)
  const count = d_ => (d_.match(/h10v10h-10z/g) || []).length;
  for (const R of [1000, 3000, 5000]) {
    const expected = p.map.x.k.filter(([, d10, s10]) => s10 * 10 <= R && (d10 < 0 || d10 * 10 > R)).length;
    assert.equal(count(crossOutPath(p.map, String(R))), expected, `${R}`);
  }
  assert.ok(count(crossOutPath(p.map, '5000')) > 0, 'Bang Krachao has cells within 5 km in a straight line and beyond it through the crossings');
  assert.equal(crossOutPath(p.map, 'in'), crossOutPath(p.map, '5000'), 'inside reads the map’s own 5 km');
  const map5 = html5.slice(html5.indexOf('id="nb-map"'));
  assert.match(map5, /class="pm-cross-out"/);
  assert.match(map5, /class="pm-crossings"/);
  assert.match(text(map5), /อีกฝั่งแม่น้ำ เกิน 5 กม\. เมื่อนับผ่านทางข้าม/);
  assert.match(text(map5), /ทางข้ามแม่น้ำ/);
});

test('the table and the direction line leave out what lies beyond 5 km through the crossings', () => {
  const {model} = load();
  let seen = 0;
  for (const r of model.rows) {
    const p = readJSON(`data/people/${r.id}.json`);
    if (!p.map.x) continue;
    for (const tab of ['visit', 'work', 'res']) {
      if (!p.map[tab]) continue;
      const {cells} = mapModel(p.map, tab);
      const four = cells.filter(c => c.band === 4);
      if (!four.length) continue;
      seen++;
      const sec = mapSectors(p.map, tab);
      const kept = cells.filter(c => c.band <= 3).reduce((s, c) => s + c.v, 0);
      assert.ok(Math.abs(sec.total - kept) < 1e-6, `${r.id} ${tab}`);
    }
  }
  assert.ok(seen > 0);
});

test('a neighbourhood no river parts draws no hatch and writes no river line', () => {
  const {model} = load();
  const around = decodeAround(readJSON('data/around.json'));
  const meta = readJSON('data/people/meta.json');
  const r = model.rows.find(row => !readJSON(`data/people/${row.id}.json`).map.x);
  const p = readJSON(`data/people/${r.id}.json`);
  const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(model), around, people: p, peopleMeta: meta, reach: '5000', mapTab: 'res'});
  assert.ok(!/people-river|pm-cross-out|pm-crossings|people-cross/.test(html), r.id);
  // the words still say how the distance is read
  assert.match(text(html), /อีกฝั่งแม่น้ำนับผ่านทางข้าม/);
});

test('a crossing in words: its own name, else the road it carries, else the kind', () => {
  assert.deepEqual(crossingWords([0, 0, 'ferry', 'เรือข้ามฟากสาทร-ตากสิน', '']), ['เรือข้ามฟากสาทร-ตากสิน', 'เรือข้ามฟากสาทร-ตากสิน']);
  assert.deepEqual(crossingWords([0, 0, 'ferry', 'เรือข้ามฟาก', '']), ['เรือข้ามฟาก', 'a ferry'], 'the kind’s own word is no name');
  assert.deepEqual(crossingWords([0, 0, 'bridge', 'ถนนเพชรเกษม', 'Phet Kasem Road']), ['สะพานถนนเพชรเกษม', 'the bridge of Phet Kasem Road']);
  assert.deepEqual(crossingWords([0, 0, 'bridge', 'สะพานพระราม 8', 'Rama VIII Bridge']), ['สะพานพระราม 8', 'Rama VIII Bridge']);
  assert.deepEqual(crossingWords([0, 0, 'foot', '', '']), ['สะพานคนเดิน', 'a footbridge']);
  assert.deepEqual(REACHES, ['in', '1000', '3000', '5000']);
});

test('the river line names every river it lists, on the Thai page too (a river OpenStreetMap names only in English)', () => {
  const {model} = load();
  const around = decodeAround(readJSON('data/around.json'));
  const meta = readJSON('data/people/meta.json');
  let lines = 0;
  for (const r of model.rows) {
    const p = readJSON(`data/people/${r.id}.json`);
    if (!p.map?.x) continue;
    const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(model), around, people: p, peopleMeta: meta, reach: '5000', mapTab: 'res'});
    const m = /<p class="people-river">([\s\S]*?)<\/p>/.exec(html);
    if (!m) continue;
    lines++;
    const t = text(m[1]);
    assert.doesNotMatch(t, /อีกฝั่ง\s*(และ|\d)|และ\s*\d/, `${r.id}: a river without a name: ${t}`);
  }
  assert.ok(lines > 100, `${lines} river lines`);
});
