/**
 * 0.5.0 — the registry's commercial screen. Owner 2026-11-25 01:04 (“ใช้ 3 กองเลย … ให้ได้จำนวนย่านครบสมบูรณ์ที่สุด ในมาตรฐานที่
 * Yolk MCP นำไปใช้งานได้ด้วย”) and 2026-11-26 06:09 (“ลุยตามพี่แนะนำเลยครับทุกข้อ” — “วาดขอบ 228 ย่านใหม่ตามหลักเกณฑ์ของพี่” and
 * “อัปเดตเว็บ”): the codes the registry admitted from the screen are neighbourhoods of this demo where the owner's rule of
 * 2026-11-24 drew them an outline from their reference point within 1 km; the others are searchable names. One code is
 * held until the owner decides (its name does not match the place its point marks) and is not on the page at all.
 * 0.6.1 — the owner's answers of 2026-11-26 10:02 (“1) ตามที่พี่แนะนำ” · “2) ใช้ Building v4” · “3) … อยากคงไว้ …”): the
 * outlines over 1 km he chose to use are neighbourhoods too, the codes without buildings were drawn again with CityMETER
 * Building V4, and ย่านตลาดไท is kept (no longer held); amendments/outline-new-2026-11-26-r2.geojson.
 * 0.7.8 — the owner's ticks of 2026-11-27 10:44 (“1 แก้แล้วในช่องสีเหลือง / 2 รับ / 3 แก้ / 4 ลบ”) on the 66 outlines 0.6.1
 * left waiting: 13 used as drawn (ย่านตลาดไท among them), 11 with their narrow arms off, 41 cut to the part within 1 km of
 * their reference point (the rule he accepted), and CMN-TH-33E737E0D0 taken off the screen — neither drawn nor listed;
 * amendments/outline-new-2026-11-27-r3.geojson. The 0.5.0 drawing exports are deleted from the repository (“4 ลบ”).
 */
import {existsSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {load, readJSON, readBytes, sha256} from './helpers.js';
import {scopeRows, scopePending, kindMatch, KINDS} from '../js/model.js';
import {buildOverview, buildNeighborhood} from '../js/profile.js';
import {renderOverview, renderNeighborhood, tableRowHTML, thaiDates} from '../js/panel.js';

const holes = /undefined|NaN|\[object Object\]|Infinity/;
const ctx = model => ({meta: model.meta, datasetCount: 16});
const TALAD = 'CMN-TH-BAFFB5235F'; // ย่านตลาดไท: held in 0.5.0; kept by the owner on 2026-11-26 10:02 (“อยากคงไว้”)
const REMOVED = 'CMN-TH-33E737E0D0'; // ชุมชนซอยพหลโยธิน 94: “ไม่นับเป็นย่านการค้า ลบทิ้ง” (owner's tick, 2026-11-27)
// 0.8.0: the registry's national review of 28 Nov drew 21 of the 88 left without an outline (0.7.8: 139, 0, 88, 0, 1 ·
// 0.6.1: 74, 66, 88, 0, 0 · 0.5.0: 56, 17, 154, 1, 0); those 21 are on the page as the review's neighbourhoods
const SCREEN = {admitted: 228, drawn: 139, review: 0, undrawn: 67, byReview: 21, heldOwner: 0, removedOwner: 1};
const usedAsDrawn = () => new Set([...readJSON('amendments/outline-new-choices-2026-11-26.json').ticks.use,
  ...readJSON('amendments/outline-new-choices-2026-11-27.json').ticks.use]);

test('the screen\'s codes add up: drawn, waiting for the owner\'s tick, without an outline, held, taken off by him', () => {
  const {model} = load();
  const m = model.meta.screen;
  assert.equal(m.admitted, SCREEN.admitted);
  assert.deepEqual([m.drawn, m.review, m.undrawn, m.drawnByReview, m.heldOwner, m.removedOwner],
    [SCREEN.drawn, SCREEN.review, SCREEN.undrawn, SCREEN.byReview, SCREEN.heldOwner, SCREEN.removedOwner]);
  assert.equal(m.drawn + m.review + m.undrawn + m.drawnByReview + m.heldOwner + m.removedOwner, m.admitted);
  assert.equal(model.rows.filter(r => r.kind === 'review' && r.review?.was === 'commercial').length, SCREEN.byReview);
  assert.deepEqual(m.admittedOn, ['2026-11-25', '2026-11-26']);
  assert.equal(m.outlinedOn, '2026-11-26');
  assert.equal(m.reviewM, 1000);
  const t = model.meta.totals;
  assert.equal(t.screenDrawn, m.drawn);
  assert.equal(t.screenUndrawn, m.review + m.undrawn);
  assert.equal(t.screenHeld, m.heldOwner);
  assert.equal(t.screenRemoved, m.removedOwner);
  assert.equal(t.closed + t.lodgingDrawn + t.screenDrawn + t.reviewDrawn + t.held + t.collections + t.screenHeld + t.screenRemoved, t.codes);
  assert.equal(t.outlined, t.closed + t.lodgingDrawn + t.screenDrawn + t.reviewDrawn);
});

test('the outlines file is the one the build read, byte for byte, and every drawn code is in it', () => {
  const {model, outlines} = load();
  const m = model.meta.screen;
  assert.equal(m.outlines.file, 'amendments/outline-new-2026-11-27-r3.geojson');
  assert.equal(sha256(readBytes(m.outlines.file)), m.outlines.sha256);
  const file = readJSON(m.outlines.file);
  // the outlines of 0.6.1 it was ticked on and the owner's ticks, byte for byte; and before them 0.5.0 and his answers
  assert.equal(sha256(readBytes('amendments/' + file.drawing.prior.file)), file.drawing.prior.sha256);
  assert.equal(sha256(readBytes('amendments/' + file.drawing.ticks.file)), file.drawing.ticks.sha256);
  const r2 = file.drawing.prior.drawing;
  assert.equal(r2.buildingsV4.seedsSha256.length, 64);
  assert.equal(sha256(readBytes('amendments/' + r2.prior.file)), r2.prior.sha256);
  assert.equal(sha256(readBytes('amendments/' + r2.answers.file)), r2.answers.sha256);
  const applied = file.features.filter(f => f.properties.status === 'apply').map(f => f.properties.canonical_id).sort();
  const rows = model.rows.filter(r => r.kind === 'screen');
  assert.deepEqual(rows.map(r => r.id).sort(), applied);
  assert.equal(applied.length, file.features.length, 'no outline waits for a tick any more');
  const answers = readJSON('amendments/' + r2.answers.file), used = usedAsDrawn();
  for (const f of file.features) {
    const p = f.properties, id = p.canonical_id;
    // over 1 km only where the owner chose it, on 26 Nov (“ตามที่พี่แนะนำ”) or by his tick of 27 Nov: used as drawn
    if (p.reach_m > 1000) assert.ok(used.has(id), id);
    assert.ok(!answers.ticks.reject.includes(id), id);
  }
  for (const r of rows) assert.equal(outlines.features.find(f => f.properties.id === r.id)?.properties.kind, 'screen', r.id);
});

test('a drawn code of the screen is a neighbourhood like the others: its row, province, area, records, new and dotted', () => {
  const {model, shards} = load();
  const reachOver = usedAsDrawn();
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

test('ย่านตลาดไท is a neighbourhood (0.7.8): no code is held; the codes without an outline on the map are searchable names that say why', () => {
  const {model} = load();
  assert.equal(model.meta.screen.heldOwner, 0);
  assert.equal(model.meta.totals.screenHeld, 0);
  // drawn from the market's own points; used as drawn by his tick of 27 Nov, and its point is the registry's since then (“3 แก้”)
  const row = model.byId.get(TALAD);
  assert.equal(row?.kind, 'screen');
  assert.ok(!model.pendingById.has(TALAD));
  const file = readJSON(model.meta.screen.outlines.file);
  const f = file.features.find(x => x.properties.canonical_id === TALAD);
  assert.deepEqual(row.ref, f.properties.reference_point.map(v => Math.round(v * 1e6) / 1e6));
  assert.equal(f.properties.ticked.choice, 'use');
  assert.match(f.properties.reference_point_th, /ทะเบียนใช้เป็นจุดอ้างอิงของย่านตั้งแต่ 27 พ\.ย\. 2569/);
  const named = model.pending.filter(p => p.screen === 'commercial');
  assert.equal(named.length, SCREEN.review + SCREEN.undrawn);
  for (const p of named) {
    assert.equal(p.status, 'held');
    assert.equal(p.wait, 'undrawn', p.id);
    assert.match(p.province, /^[A-Z]{3}$/, p.id);
  }
});

test('the kind filter has the screen: its outlines, and its names in a search', () => {
  const {model} = load();
  assert.ok(KINDS.includes('screen'));
  assert.equal(scopeRows(model, {kind: 'screen'}).length, SCREEN.drawn);
  assert.equal(['registry', 'lodging', 'screen', 'review'].reduce((n, kind) => n + scopeRows(model, {kind}).length, 0), model.rows.length);
  assert.ok(model.rows.every(r => kindMatch(r, '')));
  const p = model.pending.find(x => x.screen === 'commercial');
  assert.ok(scopePending(model, {search: p.name, kind: 'screen'}).some(x => x.id === p.id));
  assert.deepEqual(scopePending(model, {search: p.name, kind: 'registry'}).filter(x => x.id === p.id), []);
  assert.deepEqual(scopePending(model, {search: p.name, kind: 'lodging'}).filter(x => x.id === p.id), []);
});

test('the page words of the screen: badge, outline, area, provenance, the national list and the pending names', () => {
  const {model} = load();
  // drawn over the basemap's buildings and used as drawn (V4 and the owner's ticks have their own words, tests below)
  const r = model.rows.find(x => x.kind === 'screen' && !x.screen?.cm && !x.screen?.tick);
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
  const n = v => v.toLocaleString('en-US');   // (0.8.0) 1,012 codes: the page groups thousands
  assert.match(page, new RegExp(`ทะเบียนย่านกลาง ${n(t.codes)} รหัส: ขอบปิดฉบับร่าง ${n(t.closed)} ย่าน · ขอบร่างจากผลคัดย่านที่พัก ${n(t.lodgingDrawn)} · ขอบร่างจากผลคัดย่านการค้า ${n(t.screenDrawn)} · ขอบจากผลตรวจของทะเบียน ${n(t.reviewDrawn)} · รอขอบ ${n(t.held)} · ชื่อรวมหลายย่าน ${n(t.collections)}${t.screenHeld ? ` · พักไว้รอเจ้าของตัดสิน ${n(t.screenHeld)}` : '(?! · พักไว้)'}${t.screenRemoved ? ` · เจ้าของให้ไม่นับเป็นย่านการค้า ${n(t.screenRemoved)}` : ''}`));
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
  // (0.8.0) the review's outlines are new to the page too, so they join the screen's outside the frozen set
  assert.equal(ref.added, SCREEN.drawn + model.meta.totals.reviewDrawn);
  const order = model.rows.filter(r => r.kind !== 'screen' && r.kind !== 'review').map(r => r.id);
  assert.equal(sha256(Buffer.from(order.join('\n'))), ref.codesSha256);
  assert.equal(around.meta.glance.universe.centers.n, 395);
  for (const r of model.rows.filter(x => x.kind === 'screen' || x.kind === 'review')) assert.ok(around.rows[r.id], r.id);
});

test('0.6.1: the owner\'s answers of 26 Nov 10:02 — the outlines he chose to use are neighbourhoods, the ones he set aside are names, V4 says so', () => {
  const {model} = load();
  const answers = readJSON('amendments/outline-new-choices-2026-11-26.json');
  assert.equal(answers.owner.ticks_th, '1) ตามที่พี่แนะนำ');
  assert.equal(answers.owner.buildings_th, '2) ใช้ Building v4');
  for (const id of answers.ticks.use) assert.equal(model.byId.get(id)?.kind, 'screen', id);
  for (const id of answers.ticks.reject) {
    // (0.8.0) the drawing he set aside stays off; the registry's national review of 28 Nov may have drawn the code since
    const row = model.byId.get(id);
    if (row) { assert.equal(row.kind, 'review', id); assert.equal(row.review?.was, 'commercial', id); continue; }
    assert.equal(model.pendingById.get(id)?.wait, 'undrawn', id);
  }
  // the one he wanted to see with its narrow arms off is the one he took off the screen on 27 Nov (0.7.8)
  assert.deepEqual(answers.ticks.trimArms, [REMOVED]);
  assert.ok(!model.byId.has(REMOVED) && !model.pendingById.has(REMOVED));
  const v4 = model.rows.filter(r => r.screen?.cm);
  assert.equal(v4.length, 70);   // 0.6.1: 5, and the 65 he ticked on 27 Nov, all drawn with Building V4
  const html = renderNeighborhood(buildNeighborhood(model, v4[0]), model, {ctx: ctx(model)});
  assert.match(html, /วาดจากจุดอ้างอิงของผลคัดย่านการค้า ด้วยอาคาร CityMETER \(Building V4\) 26 พ\.ย\. 2569/);
  const other = model.rows.find(r => r.kind === 'screen' && !r.screen?.cm);
  assert.doesNotMatch(renderNeighborhood(buildNeighborhood(model, other), model, {ctx: ctx(model)}), /Building V4\)/);
});

test('0.7.8: the owner\'s ticks of 27 Nov 10:44 — each outline once; cut ones within 1 km of their point; the one he took off is nowhere', () => {
  const {model} = load();
  const ticks = readJSON('amendments/outline-new-choices-2026-11-27.json');
  assert.equal(ticks.owner.words_th, '1 แก้แล้วในช่องสีเหลือง\n2 รับ\n3 แก้\n4 ลบ');
  assert.equal(ticks.rule.cut1km.accepted_th, '2 รับ');
  assert.equal(ticks.rule.cut1km.metres, 1000);
  const t = ticks.ticks;
  const named = [...t.use, ...t.trimArms, ...t.cut1km, ...t.remove.map(x => x.code)];
  assert.deepEqual([t.use.length, t.trimArms.length, t.cut1km.length, t.remove.length], [13, 11, 41, 1]);
  assert.equal(new Set(named).size, named.length, 'each code once');
  assert.equal(t.ownerWords[REMOVED], 'ไม่นับเป็นย่านการค้า ลบทิ้ง');
  for (const id of [...t.use, ...t.trimArms, ...t.cut1km]) assert.equal(model.byId.get(id)?.kind, 'screen', id);
  const rows = model.rows.filter(r => r.kind === 'screen');
  const cut = rows.filter(r => r.screen.tick === 'cut1km'), trim = rows.filter(r => r.screen.tick === 'trimArms');
  assert.deepEqual(cut.map(r => r.id).sort(), [...t.cut1km].sort());
  assert.deepEqual(trim.map(r => r.id).sort(), [...t.trimArms].sort());
  for (const r of [...cut, ...trim]) {
    assert.equal(r.screen.tickedOn, '2026-11-27', r.id);
    assert.ok(r.screen.reachM <= 1000, r.id);
  }
  assert.ok(rows.filter(r => t.use.includes(r.id)).every(r => r.screen.tick == null), 'used as drawn: the row says nothing of a tick');
  // the code he took off: not drawn, not listed, counted apart so the registry's codes still add up
  const file = readJSON(model.meta.screen.outlines.file);
  assert.deepEqual(file.removed.map(x => [x.canonical_id, x.owner_th]), [[REMOVED, 'ไม่นับเป็นย่านการค้า ลบทิ้ง']]);
  assert.ok(!file.features.some(f => f.properties.canonical_id === REMOVED));
  assert.ok(!model.byId.has(REMOVED) && !model.pendingById.has(REMOVED));
  assert.equal(model.meta.totals.screenRemoved, 1);
  // the page says how his tick changed the drawing, in both languages
  for (const [r, th] of [[cut[0], 'ตัดเหลือในวง 1 กม\\. จากจุดอ้างอิง ตามที่เจ้าของติ๊ก 27 พ\\.ย\\. 2569'], [trim[0], 'ตัดแขนแคบ ตามที่เจ้าของติ๊ก 27 พ\\.ย\\. 2569']]) {
    const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(model)});
    assert.doesNotMatch(html, holes);
    assert.match(html, new RegExp(th), r.id);
  }
  const used = rows.find(r => t.use.includes(r.id));
  assert.doesNotMatch(renderNeighborhood(buildNeighborhood(model, used), model, {ctx: ctx(model)}), /ตามที่เจ้าของติ๊ก/);
  // “4 ลบ”: the 0.5.0 drawing exports are gone; their SHA-256 stay in the 0.5.0 file
  for (const x of ticks.exports.removed) assert.ok(!existsSync(x), x);
  const r0 = readJSON('amendments/outline-new-2026-11-26.geojson');
  assert.deepEqual(r0.drawing.exports.map(x => 'amendments/' + x.file).sort(), [...ticks.exports.removed].sort());
});
