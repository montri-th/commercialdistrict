/**
 * 0.5.0 — the registry's commercial screen. Owner 2026-11-25 01:04 (“ใช้ 3 กองเลย … ให้ได้จำนวนย่านครบสมบูรณ์ที่สุด ในมาตรฐานที่
 * Yolk MCP นำไปใช้งานได้ด้วย”) and 2026-11-26 06:09 (“ลุยตามพี่แนะนำเลยครับทุกข้อ” — “วาดขอบ 228 ย่านใหม่ตามหลักเกณฑ์ของพี่” and
 * “อัปเดตเว็บ”): the codes the registry admitted from the screen are neighbourhoods of this demo where the owner's rule of
 * 2026-11-24 drew them an outline from their reference point within 1 km; the others are searchable names. One code is
 * held until the owner decides (its name does not match the place its point marks) and is not on the page at all.
 * 0.5.2 — the owner's answers of 2026-11-26 10:02 (“1) ตามที่พี่แนะนำ” · “2) ใช้ Building v4” · “3) … อยากคงไว้ …”): the
 * outlines over 1 km he chose to use are neighbourhoods too, the codes without buildings were drawn again with CityMETER
 * Building V4, and ย่านตลาดไท is kept (no longer held); amendments/outline-new-2026-11-26-r2.geojson.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {load, readJSON, readBytes, sha256} from './helpers.js';
import {scopeRows, scopePending, kindMatch, KINDS} from '../js/model.js';
import {buildOverview, buildNeighborhood} from '../js/profile.js';
import {renderOverview, renderNeighborhood, tableRowHTML, thaiDates} from '../js/panel.js';

const holes = /undefined|NaN|\[object Object\]|Infinity/;
const ctx = model => ({meta: model.meta, datasetCount: 16});
const TALAD = 'CMN-TH-BAFFB5235F'; // ย่านตลาดไท: held in 0.5.0; kept by the owner on 2026-11-26 10:02 (“อยากคงไว้”)
const SCREEN = {admitted: 228, drawn: 74, review: 66, undrawn: 88, heldOwner: 0}; // 0.5.2 (0.5.0: 56, 17, 154, 1)

test('the screen\'s codes add up: drawn, waiting for the owner\'s tick, without an outline, held until he decides', () => {
  const {model} = load();
  const m = model.meta.screen;
  assert.equal(m.admitted, SCREEN.admitted);
  assert.deepEqual([m.drawn, m.review, m.undrawn, m.heldOwner], [SCREEN.drawn, SCREEN.review, SCREEN.undrawn, SCREEN.heldOwner]);
  assert.equal(m.drawn + m.review + m.undrawn + m.heldOwner, m.admitted);
  assert.deepEqual(m.admittedOn, ['2026-11-25', '2026-11-26']);
  assert.equal(m.outlinedOn, '2026-11-26');
  assert.equal(m.reviewM, 1000);
  const t = model.meta.totals;
  assert.equal(t.screenDrawn, m.drawn);
  assert.equal(t.screenUndrawn, m.review + m.undrawn);
  assert.equal(t.screenHeld, m.heldOwner);
  assert.equal(t.closed + t.lodgingDrawn + t.screenDrawn + t.held + t.collections + t.screenHeld, t.codes);
  assert.equal(t.outlined, t.closed + t.lodgingDrawn + t.screenDrawn);
});

test('the outlines file is the one the build read, byte for byte, and every drawn code is in it', () => {
  const {model, outlines} = load();
  const m = model.meta.screen;
  assert.equal(m.outlines.file, 'amendments/outline-new-2026-11-26-r2.geojson');
  assert.equal(sha256(readBytes(m.outlines.file)), m.outlines.sha256);
  const file = readJSON(m.outlines.file);
  assert.equal(file.drawing.buildingsV4.seedsSha256.length, 64);
  // the file of 0.5.0 and the owner's answers it was read with, byte for byte
  assert.equal(sha256(readBytes('amendments/' + file.drawing.prior.file)), file.drawing.prior.sha256);
  assert.equal(sha256(readBytes('amendments/' + file.drawing.answers.file)), file.drawing.answers.sha256);
  const applied = file.features.filter(f => f.properties.status === 'apply').map(f => f.properties.canonical_id).sort();
  const rows = model.rows.filter(r => r.kind === 'screen');
  assert.deepEqual(rows.map(r => r.id).sort(), applied);
  const answers = readJSON('amendments/' + file.drawing.answers.file);
  for (const f of file.features) {
    const p = f.properties, id = p.canonical_id;
    assert.ok(['apply', 'review'].includes(p.status), id);
    // over 1 km only where the owner chose it (“ตามที่พี่แนะนำ”): used as drawn
    if (p.status === 'apply' && p.reach_m > 1000) assert.ok(answers.ticks.use.includes(id) && p.decided.choice === 'use', id);
    if (p.status === 'review') assert.ok(p.reach_m > 1000, id);
    assert.ok(!answers.ticks.reject.includes(id), id);
  }
  for (const r of rows) assert.equal(outlines.features.find(f => f.properties.id === r.id)?.properties.kind, 'screen', r.id);
});

test('a drawn code of the screen is a neighbourhood like the others: its row, province, area, records, new and dotted', () => {
  const {model, shards} = load();
  const reachOver = new Set(readJSON('amendments/outline-new-choices-2026-11-26.json').ticks.use);
  for (const r of model.rows.filter(x => x.kind === 'screen')) {
    assert.match(r.id, /^CMN-TH-[0-9A-F]{10}$/);
    assert.ok(r.added, r.id);
    assert.equal(r.screen.on, '2026-11-26');
    assert.ok(r.screen.reachM <= 1000 || reachOver.has(r.id), r.id);
    assert.ok(r.areaM2 > 0 && /^[A-Z]{3}$/.test(r.province), r.id);
    assert.equal(r.nameStatus, 'draft_pending_local_name_validation');
    assert.equal(r.fieldVerified, false);
    assert.ok(shards[r.id], r.id);
    // the reference point is the registry's (05_REVIEW_QUEUE), inside the outline the rule drew from it
    const [w, s, e, n] = r.bbox;
    assert.ok(r.ref[0] >= w && r.ref[0] <= e && r.ref[1] >= s && r.ref[1] <= n, r.id);
  }
  assert.ok(model.rows.slice(0, model.meta.totals.closed).every(r => r.kind === 'registry'), 'the registry\'s outlines stay first');
});

test('ย่านตลาดไท is kept (0.5.2): no code is held; the codes without an outline on the map are searchable names that say why', () => {
  const {model} = load();
  assert.equal(model.meta.screen.heldOwner, 0);
  assert.equal(model.meta.totals.screenHeld, 0);
  // drawn from the market's own points (the registry's point is 2.8 km away): a neighbourhood, or a name waiting for his tick
  const row = model.byId.get(TALAD), name = model.pendingById.get(TALAD);
  assert.ok(Boolean(row) !== Boolean(name), 'ย่านตลาดไท is either a neighbourhood or a name');
  if (name) assert.equal(name.wait, 'review');
  const named = model.pending.filter(p => p.screen === 'commercial');
  assert.equal(named.length, SCREEN.review + SCREEN.undrawn);
  for (const p of named) {
    assert.equal(p.status, 'held');
    assert.ok(['review', 'undrawn'].includes(p.wait), p.id);
    assert.match(p.province, /^[A-Z]{3}$/, p.id);
  }
  assert.equal(named.filter(p => p.wait === 'review').length, SCREEN.review);
});

test('the kind filter has the screen: its outlines, and its names in a search', () => {
  const {model} = load();
  assert.ok(KINDS.includes('screen'));
  assert.equal(scopeRows(model, {kind: 'screen'}).length, SCREEN.drawn);
  assert.equal(scopeRows(model, {kind: 'registry'}).length + scopeRows(model, {kind: 'lodging'}).length + scopeRows(model, {kind: 'screen'}).length, model.rows.length);
  assert.ok(model.rows.every(r => kindMatch(r, '')));
  const p = model.pending.find(x => x.screen === 'commercial');
  assert.ok(scopePending(model, {search: p.name, kind: 'screen'}).some(x => x.id === p.id));
  assert.deepEqual(scopePending(model, {search: p.name, kind: 'registry'}).filter(x => x.id === p.id), []);
  assert.deepEqual(scopePending(model, {search: p.name, kind: 'lodging'}).filter(x => x.id === p.id), []);
});

test('the page words of the screen: badge, outline, area, provenance, the national list and the pending names', () => {
  const {model} = load();
  const r = model.rows.find(x => x.kind === 'screen');
  const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(model)});
  assert.doesNotMatch(html, holes);
  assert.match(html, /ผลคัดย่านการค้า · ขอบร่างตามหลักของเจ้าของ/);
  assert.match(html, /ขอบร่างตามหลักที่เจ้าของกำหนด วาดจากจุดอ้างอิงของผลคัดย่านการค้า 26 พ\.ย\. 2569/);
  assert.match(html, /ตามขอบร่างที่วาดตามหลักของเจ้าของ/);
  assert.doesNotMatch(tableRowHTML(r, model), holes);
  const o = buildOverview(model, {rows: model.rows});
  const page = renderOverview(o, model, {ctx: ctx(model)});
  assert.doesNotMatch(page, holes);
  assert.match(page, new RegExp(`ย่านจากผลคัดย่านการค้า ${SCREEN.drawn} ย่าน`));
  assert.match(page, /รหัสกลางที่ทะเบียนรับ 25–26 พ\.ย\. 2569/);
  assert.match(page, /data-value="screen"/);
  // the registry's codes on the page add up to all of them, the held one included, one space apart
  const t = model.meta.totals;
  assert.match(page, new RegExp(`ทะเบียนย่านกลาง ${t.codes} รหัส: ขอบปิดฉบับร่าง ${t.closed} ย่าน · ขอบร่างจากผลคัดย่านที่พัก ${t.lodgingDrawn} · ขอบร่างจากผลคัดย่านการค้า ${t.screenDrawn} · รอขอบ ${t.held} · ชื่อรวมหลายย่าน ${t.collections}${t.screenHeld ? ` · พักไว้รอเจ้าของตัดสิน ${t.screenHeld}` : '(?! · พักไว้)'}`));
  assert.doesNotMatch(page, /\S  ·/);
  const p = model.pending.find(x => x.screen === 'commercial' && x.wait === 'review');
  if (p) {
    const s = renderOverview({...buildOverview(model, {rows: [], pending: [p]}), searching: true, pending: [p]}, model, {ctx: ctx(model)});
    assert.match(s, /ขอบที่วาดไกลจากจุดอ้างอิงเกิน 1 กม\. รอเจ้าของตรวจ/);
  }
  assert.equal(thaiDates(['2026-11-25', '2026-11-26']), '25–26 พ.ย. 2569');
  assert.equal(thaiDates(['2026-11-26']), '26 พ.ย. 2569');
});

test('D-8: the glance ranks the screen\'s neighbourhoods against the reference set of 0.4.0, which does not grow', () => {
  const {model} = load();
  const around = readJSON('data/around.json');
  const ref = around.meta.referenceSet;
  assert.equal(ref.id, 'commercialdistrict-0.4.0-outlined');
  assert.equal(ref.n, 395);
  assert.equal(ref.added, SCREEN.drawn);
  const order = model.rows.filter(r => r.kind !== 'screen').map(r => r.id);
  assert.equal(sha256(Buffer.from(order.join('\n'))), ref.codesSha256);
  assert.equal(around.meta.glance.universe.centers.n, 395);
  for (const r of model.rows.filter(x => x.kind === 'screen')) assert.ok(around.rows[r.id], r.id);
});

test('0.5.2: the owner\'s answers of 26 Nov 10:02 — the outlines he chose to use are neighbourhoods, the ones he set aside are names, V4 says so', () => {
  const {model} = load();
  const answers = readJSON('amendments/outline-new-choices-2026-11-26.json');
  assert.equal(answers.owner.ticks_th, '1) ตามที่พี่แนะนำ');
  assert.equal(answers.owner.buildings_th, '2) ใช้ Building v4');
  for (const id of answers.ticks.use) assert.equal(model.byId.get(id)?.kind, 'screen', id);
  for (const id of answers.ticks.reject) {
    assert.ok(!model.byId.has(id), id);
    assert.equal(model.pendingById.get(id)?.wait, 'undrawn', id);
  }
  for (const id of answers.ticks.trimArms) assert.equal(model.pendingById.get(id)?.wait, 'review', id);
  const v4 = model.rows.filter(r => r.screen?.cm);
  assert.equal(v4.length, 5);
  const html = renderNeighborhood(buildNeighborhood(model, v4[0]), model, {ctx: ctx(model)});
  assert.match(html, /วาดจากจุดอ้างอิงของผลคัดย่านการค้า ด้วยอาคาร CityMETER \(Building V4\) 26 พ\.ย\. 2569/);
  const other = model.rows.find(r => r.kind === 'screen' && !r.screen?.cm);
  assert.doesNotMatch(renderNeighborhood(buildNeighborhood(model, other), model, {ctx: ctx(model)}), /Building V4\)/);
});
