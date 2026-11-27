/**
 * 0.2.0 — the registry of 2026-11-17 (358 closed outlines) and its lodging screen (268 proposals, model only). Owner
 * 2026-11-18, VERBATIM: “2 และ update เป็นย่านในทะเบียน”: the 79 new lodging areas are neighbourhoods of this demo (37 drawn
 * with their review draft, 42 searchable). Their walking figures are published; origins, evidence, links, reviewers and
 * field questions are not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from './helpers.js';
import {scopeRows, scopePending, kindMatch} from '../js/model.js';
import {buildOverview, buildNeighborhood} from '../js/profile.js';
import {renderOverview, renderNeighborhood, tableRowHTML} from '../js/panel.js';

const holes = /undefined|NaN|\[object Object\]|Infinity/;
const ctx = model => ({meta: model.meta, datasetCount: 16});

test('the lodging screen: 268 proposals, 193 supported, 75 held; its 79 new areas admitted as central codes on 2026-11-18', () => {
  const {model} = load();
  const lm = model.meta.lodging;
  assert.equal(lm.proposals, 268);
  assert.equal(lm.supported + lm.held, lm.proposals);
  assert.equal(lm.supported, 193);
  assert.equal(lm.onRegistry + lm.newAreas, lm.proposals);
  assert.equal(lm.newAreas, 79);
  assert.equal(lm.newAreasDrawn, 37);
  // (0.2.1) owner 2026-11-18 “ทั้ง 79”: every new area is a central code now, its 0.2.0 id an alias of it
  assert.equal(lm.admitted, 79);
  assert.equal(lm.admittedOn, '2026-11-18');
  assert.equal(Object.keys(lm.aliases).length, 79);
  for (const [old, now] of Object.entries(lm.aliases)) {
    assert.equal(now, old.replace(/^LP-NEW-/, 'CMN-TH-'));
    assert.ok(model.byId.has(now) || model.pendingById.has(now), now);
    assert.equal(model.canonicalId(old), now);
  }
  assert.equal(model.canonicalId('CMN-TH-0001'), 'CMN-TH-0001');
  assert.equal(model.pending.filter(p => p.screen === 'lodging').length, 42);
  assert.ok(model.pending.filter(p => p.screen === 'lodging').every(p => p.status === 'held'));
  assert.equal(lm.revision, 'lodging-held78-recovery-2026-11-18-r1');
  assert.deepEqual(lm.walkM, [400, 800]);
  const withLodging = [...model.rows, ...model.pending].filter(x => x.lodging);
  assert.equal(withLodging.length, lm.proposals, 'every proposal lands on one neighbourhood or one searchable name');
  assert.equal(model.rows.filter(r => r.lodging && r.kind === 'registry').length, lm.onRegistry);
  for (const x of withLodging) {
    const l = x.lodging;
    assert.ok(Object.keys(lm.statuses).includes(l.st), x.id);
    for (const k of ['h4', 'h8', 'ru', 'rx']) assert.ok(l[k] === null || (Number.isInteger(l[k]) && l[k] >= 0), `${x.id} ${k}`);
    if (l.h4 !== null && l.h8 !== null) assert.ok(l.h4 <= l.h8, x.id);
    for (const c of [...l.sv4, ...l.sv8]) assert.ok(c in lm.services, `${x.id} ${c}`);
    assert.ok(l.bd === null || (l.bd >= 0 && l.bd < lm.boundaries.length), x.id);
    assert.equal(lm.boundariesEn.length, lm.boundaries.length);
  }
  // every lodging area of the demo has its screen; the drawn ones have a draft, the others none
  for (const r of model.rows.filter(r => r.kind === 'lodging')) assert.ok(r.lodging?.draft, r.id);
  const undrawn = model.pending.filter(p => p.screen === 'lodging');
  assert.equal(undrawn.length, 42);
  for (const p of undrawn) { assert.ok(p.lodging && !p.lodging.draft, p.id); assert.match(p.id, /^CMN-TH-[0-9A-F]{10}$/); assert.match(p.province, /^[A-Z]{3}$/, p.id); }
});

test('what is new since the data of 16 Nov: 15 newly closed registry outlines, the 37 drawn lodging areas and the commercial screen\'s 139 (0.5.0: 56; 0.6.1: 74)', () => {
  const {model} = load();
  const added = model.rows.filter(r => r.added);
  assert.equal(added.length, model.meta.totals.added);
  assert.equal(added.filter(r => r.kind === 'registry').length, 15);
  assert.equal(added.filter(r => r.kind === 'lodging').length, 37);
  assert.equal(added.filter(r => r.kind === 'screen').length, 139);
  for (const id of ['CMN-TH-50A0A3D023', 'CMN-TH-C87FDE144B', 'CMN-TH-F61C48CB7C']) assert.ok(model.byId.get(id)?.added, id);
  assert.ok(!model.byId.get('CMN-TH-0001').added, 'Siam was drawn before');
});

test('the kind filter: registry, lodging, screen, added; pending names follow it', () => {
  const {model} = load();
  assert.equal(scopeRows(model, {kind: 'registry'}).length, 358);
  assert.equal(scopeRows(model, {kind: 'lodging'}).length, 37);
  assert.equal(scopeRows(model, {kind: 'added'}).length, 191);   // 15 + 37 + 139 (0.6.1: 126)
  assert.equal(scopeRows(model).length, 534);   // 0.6.1: 469
  assert.ok(model.rows.every(r => kindMatch(r, '')));
  const lp = model.pending.find(p => p.screen === 'lodging');
  assert.deepEqual(scopePending(model, {search: lp.name, kind: 'registry'}).filter(p => p.id === lp.id), []);
  assert.ok(scopePending(model, {search: lp.name, kind: 'lodging'}).some(p => p.id === lp.id));
});

test('a lodging area and a registry neighbourhood with a screen render whole, with the four-part provenance of the screen', () => {
  const {model} = load();
  const lod = model.rows.find(r => r.kind === 'lodging' && r.lodging.h4 != null);
  const reg = model.rows.find(r => r.kind === 'registry' && r.lodging);
  for (const r of [lod, reg]) {
    const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(model)});
    assert.ok(!holes.test(html), r.id);
    assert.match(html, /ผลคัดย่านที่พักของทะเบียน/);
    assert.match(html, /ที่พักที่เดินถึงใน <span class="nowrap">400 ม\.<\/span>/);
    assert.match(html, /ทะเบียนที่พัก 30,730 รายการ/);
    assert.match(html, /data-prov="boundary">[^]*ระยะเดิน/);
    // (0.2.1) never the 0.2.0 claim that the registry has no code for the area
    assert.ok(!/ยังไม่ออกรหัสกลาง/.test(html), r.id);
  }
  assert.match(renderNeighborhood(buildNeighborhood(model, lod), model, {ctx: ctx(model)}), /ย่านที่พัก · ขอบร่างจากผลคัด/);
  assert.match(tableRowHTML(lod, model), /kind-word/);
  // a blank figure is unknown, never 0
  const blank = [...model.rows].find(r => r.lodging && r.lodging.ru === null);
  if (blank) assert.match(renderNeighborhood(buildNeighborhood(model, blank), model, {ctx: ctx(model)}), /ยังไม่ทราบ/);
});

test('an admitted lodging area says so where its outline is described', () => {
  const {model} = load();
  const lod = model.rows.find(r => r.kind === 'lodging');
  const html = renderNeighborhood(buildNeighborhood(model, lod), model, {ctx: ctx(model)});
  assert.match(html, /ขอบร่างจากผลคัดย่านที่พัก รับเป็นรหัสกลาง 18 พ\.ย\. 2569 รอตรวจตามหลักเกณฑ์ขอบย่าน/);
  assert.match(html, new RegExp(lod.id));
});

test('the national overview names what is new and offers the filter', () => {
  const {model} = load();
  const html = renderOverview(buildOverview(model, {rows: model.rows}), model, {ctx: ctx(model)});
  assert.match(html, /ย่านใหม่ในข้อมูลรุ่นนี้/);
  assert.match(html, /ขอบปิดใหม่ในทะเบียน 15 ย่าน/);
  assert.match(html, /ย่านที่พักรับเข้าทะเบียน 37 ย่าน/);
  assert.match(html, /รับเป็นรหัสกลาง 18 พ\.ย\. 2569/);
  assert.match(html, /data-action="set-kind" data-value="added"/);
  assert.ok(!holes.test(html));
});

test('nothing internal of the lodging screen is published: no origin, evidence, link, reviewer or field question', () => {
  const text = readFileSync(new URL('../data/neighborhoods.json', import.meta.url), 'utf8');
  for (const w of ['"origin', 'hotel_evidence', 'evidence_links', 'docs.google', 'drive.google', 'reviewer', 'field_question', 'source_url', 'openstreetmap.org/way', 'node_id', 'guest_door', 'owner_notes']) {
    assert.ok(!text.includes(w), w);
  }
});
