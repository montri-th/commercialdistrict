/**
 * «รอบย่านนี้» and «ในย่านนี้» (0.4.0; owner 2026-11-25 08:15 “พี่ช่วยปรับ web demo ตามที่แนะนำเลยครับ”, handoff/around/):
 * the shipped data/around.json pairs with the shipped inside counts, never adds two datasets or two neighbourhoods,
 * keeps out-of-scope datasets out, freezes its reference set, copies the level rule of «รอบศูนย์นี้» verbatim, and every
 * neighbourhood renders the glance and the table whole — with the file, and without it (a file that did not load).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT, load, readJSON, readBytes, sha256} from './helpers.js';
import {decodeAround, glanceTiles, aroundGroups, venuesOf, sharedBy, lowLocated, levelOf, LEVEL_WORDS, aroundDistance, DISTANCES, pctFill} from '../js/around.js';
import {buildNeighborhood} from '../js/profile.js';
import {renderNeighborhood, highlightWords} from '../js/panel.js';

const raw = () => readJSON('data/around.json');
const around = () => decodeAround(raw());
const holes = /undefined|NaN|\[object Object\]|Infinity/;
const ctx = () => ({meta: load().model.meta, datasetCount: 16});
const midPct = (x, values) => (100 * (values.filter(v => v < x).length + 0.5 * values.filter(v => v === x).length)) / values.length;

test('the surroundings file pairs with the shipped inside counts, outlines and records', () => {
  const {meta} = raw();
  assert.equal(meta.schema, 'citymeter-commercialdistrict-around/1');
  assert.deepEqual(meta.ringsM, [400, 800]);
  assert.equal(meta.inside.sha256, sha256(readBytes('data/neighborhoods.json')), 'built from the data/neighborhoods.json it ships with');
  assert.equal(meta.outlines.sha256, sha256(readBytes('data/boundaries.geojson')), 'measured on the outlines the map draws');
  const {model} = load();
  for (const d of model.datasets) assert.equal(meta.sources[d.id].sha256, d.source.sha256, `${d.id}: the pinned file`);
});

test('every neighbourhood: a figure pair for every dataset in scope and none out of scope (never 0 for out of scope)', () => {
  const {model} = load();
  const {rows} = raw();
  assert.deepEqual(Object.keys(rows).sort(), model.rows.map(r => r.id).sort());
  let cells = 0;
  for (const r of model.rows) {
    const a = rows[r.id].a;
    assert.deepEqual(Object.keys(a).sort(), Object.keys(r.c).sort(), r.id);
    for (const [ds, v] of Object.entries(a)) {
      cells++;
      assert.equal(v.length, 2, `${r.id} ${ds}: [r400, r800], no total`);
      assert.ok(v.every(Number.isInteger), `${r.id} ${ds}`);
      assert.ok(v[0] >= 0 && v[0] <= v[1], `${r.id} ${ds}: the 800 m figure holds the 400 m one`);
    }
  }
  assert.equal(cells, 5747); // 0.6.1: 469 outlines (5,533 for the 451 of 0.5.0; 4,806 for the 395 of 0.4.0)
  assert.ok(!/"total"|"sum"/i.test(JSON.stringify(rows)), 'no total or sum anywhere');
});

test('Siam: the figures around, the centres inside and near (joined by id), its glance', () => {
  const {model} = load();
  const A = around(), siam = model.rows.find(r => r.name === 'สยาม');
  const a = A.rows.get(siam.id).a;
  assert.deepEqual(a.hotel, [25, 105]);
  assert.deepEqual(a.restaurant, [52, 247]);
  assert.deepEqual(a.school, [4, 14]);
  const inside = venuesOf(siam, A, 'in');
  assert.deepEqual(inside.inside.map(v => v.name).sort(), ['สยามดิสคัฟเวอรี่', 'สยามพารากอน', 'สยามสแควร์', 'สยามเซ็นเตอร์', 'เอ็ม บี เค เซ็นเตอร์'].sort());
  assert.equal(inside.near.length, 0, 'inside reads no centre around');
  const near400 = venuesOf(siam, A, '400').near;
  assert.ok(near400.length > 0 && near400.every(v => v.m <= 400));
  assert.ok(venuesOf(siam, A, '800').near.length >= near400.length);
  const tiles = glanceTiles(siam, model, A);
  assert.deepEqual(tiles.map(t => t.id), ['residents', 'students', 'rooms', 'centers']);
  assert.equal(tiles[0].state, 'not_yet');
  assert.equal(tiles[1].state, 'measured_zero');
  assert.equal(tiles[1].star, true, 'the school dataset has points for 81% of its records');
  assert.equal(tiles[1].level, null);
  assert.equal(tiles[2].value, 1261);
  assert.equal(tiles[2].level, 5);
  assert.equal(tiles[3].value, 5);
});

test('levels: the rule of «รอบศูนย์นี้» verbatim, mid-rank percentiles among the frozen reference set', () => {
  const contracts = readJSON('handoff/around/contracts.json');
  const src = readFileSync(join(ROOT, 'js/around.js'), 'utf8').split('\n');
  assert.ok(src.includes(contracts.glance.levelRule.levelOf), 'levelOf is the line of montri-th/shoppingcenter js/venue-locale.js');
  assert.ok(src.includes(contracts.glance.levelRule.levelWords), 'LEVEL_WORDS likewise');
  assert.equal(levelOf(0.5, 1), 1); assert.equal(levelOf(19.9, 3), 1); assert.equal(levelOf(20, 3), 2); assert.equal(levelOf(99.9, 3), 5); assert.equal(levelOf(50, 0), 0);
  assert.equal(LEVEL_WORDS[0][0], 'ไม่พบ');
  const {model} = load();
  const {meta, rows} = raw();
  // D-8: the reference set of 0.4.0 stays (395 outlines, in order); the commercial screen's outlines of 0.5.0 take a level
  // against it without joining it
  const ref = model.rows.filter(r => r.kind !== 'screen');
  const codes = ref.map(r => r.id).join('\n');
  assert.equal(meta.referenceSet.n, 395);
  assert.equal(meta.referenceSet.id, 'commercialdistrict-0.4.0-outlined');
  assert.equal(meta.referenceSet.codesSha256, sha256(Buffer.from(codes, 'utf8')), 'the reference set is the outlined neighbourhoods of 0.4.0, in order');
  const roomOf = r => (!('hotel' in r.c) ? null : !r.c.hotel ? 0 : r.m?.hotel ? r.m.hotel[0] : null);
  const centerOf = r => ('shoppingcenter' in r.c ? r.c.shoppingcenter : null);
  const rooms = model.rows.map(roomOf), centers = model.rows.map(centerOf);
  const uRooms = ref.map(roomOf).filter(v => v != null), uCenters = ref.map(centerOf).filter(v => v != null);
  assert.equal(meta.glance.universe.rooms.n, uRooms.length);
  assert.equal(meta.glance.universe.centers.n, uCenters.length);
  assert.equal(meta.glance.universe.students.ranked, false, 'the school dataset is never ranked here (D-4)');
  model.rows.forEach((r, i) => {
    const g = rows[r.id].g || {};
    // the stored percentile is the exact mid-rank to 6 decimals, and the level and colour the page reads are the exact
    // ones (0.4.0 review: a rounding to 0.1 had moved 39.975 to 40.0, one level up)
    const same = (stored, value, all, label) => {
      const exact = midPct(value, all);
      assert.ok(Math.abs(stored - exact) < 5e-7, label);
      assert.equal(levelOf(stored, value), levelOf(exact, value), `${label}: level`);
      assert.equal(pctFill(stored), pctFill(exact), `${label}: colour`);
    };
    if (rooms[i] == null) assert.ok(!('rooms' in g), r.id); else same(g.rooms, rooms[i], uRooms, `${r.id} rooms`);
    if (centers[i] == null) assert.ok(!('centers' in g), r.id); else same(g.centers, centers[i], uCenters, `${r.id} centers`);
    assert.ok(!('students' in g), r.id);
  });
});

test('datasets with points for under 90% of their records are starred, never ranked or levelled in the new layer (D-4)', () => {
  const {model} = load();
  const low = model.datasets.filter(lowLocated).map(d => d.id).sort();
  assert.deepEqual(low, ['factory', 'fitness', 'hospital', 'industrialestate', 'office', 'pharmacy', 'school']);
  assert.deepEqual(raw().meta.lowLocated.datasets, low);
  const A = around();
  for (const r of model.rows.slice(0, 60)) {
    const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(), around: A});
    const table = html.slice(html.indexOf('class="around-table"'), html.indexOf('</table>'));
    for (const id of low) {
      const row = table.slice(table.indexOf(`id="around-${id}"`), table.indexOf('</tr>', table.indexOf(`id="around-${id}"`)));
      assert.ok(!/(แน่น|มาก)อันดับ/.test(row), `${r.id} ${id}: no rank`);
      if ((r.c[id] ?? null) !== null) assert.match(row, /<sup aria-hidden="true">\*<\/sup>/, `${r.id} ${id}: starred`);
    }
  }
});

test('centres with a «รอบศูนย์นี้» page: one outline at most, near ones sorted within 800 m, every id named', () => {
  const A = raw();
  const seen = new Map();
  for (const [id, x] of Object.entries(A.rows)) {
    if (!x.v) continue;
    for (const v of x.v.in) { assert.ok(!seen.has(v), `${v} inside two outlines`); seen.set(v, id); assert.ok(A.venues[v]?.[0], v); }
    let last = -1;
    for (const [v, m] of x.v.near) { assert.ok(Number.isInteger(m) && m >= 0 && m <= 800, `${id} ${v}`); assert.ok(m >= last); last = m; assert.ok(A.venues[v]?.[0], v); assert.ok(!x.v.in.includes(v)); }
  }
  for (const [v, b] of Object.entries(A.byVenue)) if (b.in) assert.equal(seen.get(v), b.in, v);
  // a centre is inside an outline only when the data build counted it there, or when the pinned Shopping Center file has
  // no point for it (meta.venues.notInPinnedFile): so the inside and the around never hold the same centre
  const notPinned = new Set(A.meta.venues.notInPinnedFile);
  for (const [v, id] of seen) {
    const keys = new Set(readJSON(`data/records/${id}.json`).rows.map(rec => String(rec[4])));
    assert.ok(keys.has(v) || notPinned.has(v), `${v} listed inside ${id} but not counted there`);
  }
  assert.equal(seen.size, 180); // 0.6.1 (176 in 0.5.0, 166 in 0.4.0)
  assert.equal(Object.values(A.rows).reduce((s, x) => s + (x.v?.near.length || 0), 0), 363); // 0.6.1 (361 in 0.5.0, 356 in 0.4.0)
  assert.equal(A.meta.venues.n, 492);
});

test('the lines of the map: one file per neighbourhood, 400 m inside 800 m, both round the outline', () => {
  const {model} = load();
  const box = g => { let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity; const walk = c => { if (typeof c[0] === 'number') { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); } else c.forEach(walk); }; walk(g.coordinates); return [w, s, e, n]; };
  for (const r of model.rows) {
    const path = `data/rings/${r.id}.json`;
    assert.ok(existsSync(join(ROOT, path)), path);
    const f = readJSON(path);
    assert.equal(f.id, r.id);
    const b4 = box(f.rings['400']), b8 = box(f.rings['800']);
    assert.ok(['Polygon', 'MultiPolygon'].includes(f.rings['400'].type) && ['Polygon', 'MultiPolygon'].includes(f.rings['800'].type), r.id);
    const kx = 111320 * Math.cos((r.ref[1] * Math.PI) / 180), ky = 110574;
    // about 400 m beyond the outline's box on every side (the buffer of the drawn outline), and the 800 m line beyond it
    assert.ok(Math.abs((r.bbox[0] - b4[0]) * kx - 400) < 12 && Math.abs((b4[2] - r.bbox[2]) * kx - 400) < 12, `${r.id} 400 m east-west`);
    assert.ok(Math.abs((r.bbox[1] - b4[1]) * ky - 400) < 12 && Math.abs((b4[3] - r.bbox[3]) * ky - 400) < 12, `${r.id} 400 m north-south`);
    assert.ok(b8[0] < b4[0] && b8[1] < b4[1] && b8[2] > b4[2] && b8[3] > b4[3], `${r.id}: 800 m outside 400 m`);
  }
});

test('ties: a count highlight says how many neighbourhoods share its rank (363 of 467 have at least 3)', () => {
  const {model} = load();
  // the file's own highlights (hlBuild); since 0.6.0 the page draws them again without the starred datasets (D-V2)
  let count = 0, three = 0;
  for (const r of model.rows) for (const h of r.hlBuild || []) if (h.k === 'count') { count++; if (sharedBy(model, r, h) >= 3) three++; }
  assert.equal(count, 467); // 0.6.1: 469 outlines (437 in 0.5.0 and 0.6.0, 390 in 0.4.0)
  assert.equal(three, 363); // 0.6.1 (336 in 0.5.0 and 0.6.0, 289 in 0.4.0)
  const siam = model.rows.find(r => r.name === 'สยาม'), fit = siam.hlBuild.find(h => h.d === 'fitness');
  assert.ok(!siam.hl.some(h => h.d === 'fitness'), 'fitness, a starred dataset, is no highlight on the page (D-V2)');
  const t = sharedBy(model, siam, fit);
  assert.ok(t > 1);
  const w = highlightWords(fit, model.dsById.get('fitness'), siam, 3, t);
  assert.equal(w.value, `มากอันดับ ${fit.v} ร่วม ${t} ย่าน`);
  assert.equal(highlightWords(fit, model.dsById.get('fitness'), siam).value, `มากอันดับ ${fit.v}`, 'without the count, the old words');
});

test('every neighbourhood renders the glance and «ขอบเดินถึง» whole, with the file and without it', () => {
  const {model} = load();
  const A = around();
  for (const r of model.rows) {
    const d = buildNeighborhood(model, r);
    for (const [a, distance] of [[A, 'in'], [A, '400'], [A, '800'], [null, 'in']]) {
      const html = renderNeighborhood(d, model, {ctx: ctx(), around: a, distance});
      assert.ok(!holes.test(html), `${r.id} ${distance} ${a ? '' : 'no file'}`);
      assert.equal((html.match(/class="glance-tile /g) || []).length, 4, r.id);
      assert.equal((html.match(/class="around-ds"/g) || []).length, 16, r.id);
      assert.match(html, new RegExp(`data-around="${distance}"`));
      if (a) assert.match(html, /data-value="in" aria-pressed="(true|false)"/);
      // one row group per pillar (each pillar header heads its own rows)
      assert.equal((html.match(/<tbody><tr class="pillar-row">/g) || []).length, 3, r.id);
      // out of scope: the dash and the scope words, never 0
      for (const ds of model.datasets) if (!(ds.id in r.c)) assert.match(html, new RegExp(`id="around-${ds.id}"[\\s\\S]*?— นอกขอบเขตข้อมูล`), `${r.id} ${ds.id}`);
      // the section ends with its own provenance line: dataset · source · date · boundary · method
      const section = html.slice(html.indexOf('id="nb-around"'));
      for (const part of ['dataset', 'source', 'date', 'boundary']) assert.match(section, new RegExp(`data-prov="${part}"`), `${r.id} ${part}`);
      if (!a) {
        // without the file: no switch, no column around, no version or build date in the provenance line
        assert.ok(!/data-action="set-around"/.test(html) && !/col-400|col-800/.test(section), r.id);
        assert.ok(!/ขอบเดินถึง รุ่น/.test(section), r.id);
      } else {
        assert.equal((section.match(/class="num col-400/g) || []).length, 1 + Object.keys(r.c).length, `${r.id}: a 400 m cell for every dataset in scope`);
      }
    }
  }
});

test('the reading of the address: in · 400 · 800, anything else reads inside', () => {
  assert.deepEqual(DISTANCES, ['in', '400', '800']);
  for (const v of ['400', '800', 'in']) assert.equal(aroundDistance(v), v);
  for (const v of ['', '500', null, undefined, '1000']) assert.equal(aroundDistance(v), 'in');
  const app = readFileSync(join(ROOT, 'js/app.js'), 'utf8');
  assert.match(app, /filters: \['search', 'neighborhood', 'show', 'kind', 'around'\]/, 'f.around in the shared grammar');
  assert.match(app, /if \(state\.nb && state\.distance !== 'in'\) p\.set\('around', state\.distance\);/, 'inside is never written');
});

test('handoff/around: the plan byte for byte, the owner’s words verbatim, the invariants as the brief holds them', () => {
  assert.equal(sha256(readBytes('handoff/around/plan.json')), 'd5d37c7c3cbea3ddefb72f14e27cd989fe758f7a2e83ac2fa33de62a51f54f94');
  const dec = readJSON('handoff/around/decisions.json');
  assert.equal(dec.ownerWords[0].verbatim, 'พี่ช่วยปรับ web demo ตามที่แนะนำเลยครับ');
  assert.deepEqual(dec.decisions.map(d => [d.id, d.status, d.decision]), ['D-1', 'D-2', 'D-3', 'D-4', 'D-5', 'D-6', 'D-7', 'D-8', 'D-9', 'D-10', 'D-11'].map(id => [id, 'decided', 'ก']));
  assert.equal(dec.ownerWords.at(-1).verbatim, 'ทำตามที่พี่เสนอเลยครับ', 'D-10 and D-11 (2026-11-25 23:01)');
  const inv = readJSON('handoff/around/contracts.json').invariants.items;
  assert.deepEqual(inv, readJSON('handoff/product-brief.json').invariants);
});

test('a neighbourhood with no highlight says what there is, inside and within 800 m, by numbers of datasets (0.6.0: the fingerprint’s key)', () => {
  const {model} = load();
  const A = around();
  const thin = model.rows.filter(r => !(r.hl || []).length);
  assert.equal(thin.length, 198); // 0.6.1: 469 outlines (196 in 0.6.0), D-V2: highlights only on datasets with points for ≥ 90 % (183 with every dataset in 0.5.0)
  for (const r of thin) {
    const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(), around: A});
    const head = html.slice(0, html.indexOf('</section>'));
    const key = head.match(/<p class="fp-key">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, ' ');
    const n = {in: Object.values(r.c).filter(v => v > 0).length, out: model.datasets.filter(d => !(d.id in r.c)).length};
    assert.match(key, new RegExp(`ในย่าน ${n.in} ชุด`), r.id);
    const edge = model.datasets.filter(d => r.c[d.id] === 0 && A.rows.get(r.id).a[d.id][1] > 0).length;
    if (edge) assert.match(key, new RegExp(`เฉพาะขอบเดินถึง 800 ม\\. ${edge}`), r.id);
    if (n.out) assert.match(key, new RegExp(`ไม่มีข้อมูลในจังหวัด ${n.out}`), r.id);
    assert.ok(!/aha-copy|ยังไม่มีชุดข้อมูลไหนเด่นเกินเกณฑ์/.test(head), r.id);
  }
});
