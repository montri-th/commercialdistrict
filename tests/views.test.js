/**
 * The panel views (js/panel.js) over the whole shipped data: every neighbourhood, every province, every lens renders
 * without a hole, ends with its provenance line, and names the numerator and denominator of every share.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {scopeRows} from '../js/model.js';
import {buildOverview, buildNeighborhood, buildCompare, similarRows} from '../js/profile.js';
import {renderOverview, renderNeighborhood, renderCompare, sharePct, tableRowHTML} from '../js/panel.js';

const holes = /undefined|NaN|\[object Object\]|Infinity/;
const ctx = () => ({meta: load().model.meta, datasetCount: 16});

test('the overview of Thailand: the first finding is the most concentrated dataset, against the neighbourhoods’ share of the area', () => {
  const {model} = load();
  const o = buildOverview(model, {rows: model.rows});
  assert.equal(o.lead.ds.id, 'luxurybrands');
  assert.equal(sharePct(o.lead.share), '69%');
  assert.equal(sharePct(o.areaShare), '0.04%'); // 0.3.0: 235 outlines redrawn by the owner's rule (0.018% before)
  const html = renderOverview(o, model, {ctx: ctx()});
  assert.ok(!holes.test(html));
  assert.match(html, /239 จาก 345 จุดขาย/); // 0.2.4: GENTLEWOMAN at Maya inside the extended นิมมาน–เมญ่า (237 before); 0.3.0: one more inside a redrawn outline
  for (const part of ['dataset', 'source', 'date', 'boundary']) assert.match(html, new RegExp(`data-prov="${part}"`));
});

test('every province overview and every lens renders whole', () => {
  const {model} = load();
  const provinces = [...new Set(model.rows.map(r => r.province))];
  for (const province of provinces) {
    const rows = scopeRows(model, {province});
    for (const ds of [null, ...model.datasets]) {
      const html = renderOverview(buildOverview(model, {rows, province, ds}), model, {fillOf: () => '#E6AB30', ctx: ctx()});
      assert.ok(!holes.test(html), `${province} ${ds?.id || ''}`);
    }
  }
});

test('every neighbourhood renders whole: highlights with their universe, every dataset by pillar, provenance', () => {
  const {model} = load();
  for (const r of model.rows) {
    const d = buildNeighborhood(model, r);
    const html = renderNeighborhood(d, model, {ctx: ctx()});
    assert.ok(!holes.test(html), r.id);
    // (0.4.0) every dataset is a row of «ขอบเดินถึง» (its button sets the lens)
    assert.equal((html.match(/class="around-ds"/g) || []).length, 16, r.id);
    assert.match(html, /data-prov="boundary"/);
    for (const x of d.highlights) if (x.h.k !== 'share') assert.match(html, /จาก [\d,]+ ย่าน/, r.id);
    assert.ok(!holes.test(tableRowHTML(r, model)), r.id);
  }
});

test('similar mixes: correlation of centred log density, never the row itself, best first', () => {
  const {model} = load();
  const siam = model.rows.find(r => r.name === 'สยาม');
  const list = similarRows(model, siam);
  assert.ok(list.length > 0 && list.length <= 3);
  for (let i = 0; i < list.length; i++) {
    assert.notEqual(list[i].row.id, siam.id);
    assert.ok(list[i].sim > 0 && list[i].sim <= 1 + 1e-9);
    if (i) assert.ok(list[i - 1].sim >= list[i].sim);
  }
});

test('the compare matrix marks the densest cell per dataset and never shows an out-of-scope cell as 0', () => {
  const {model} = load();
  const rows = [model.rows.find(r => r.province === 'BKK'), model.rows.find(r => r.province === 'CMI'), model.rows.find(r => r.province === 'PKT')];
  const c = buildCompare(model, rows);
  const html = renderCompare(c, model);
  assert.ok(!holes.test(html));
  for (const g of c.groups) for (const x of g.items) {
    x.cells.forEach((cell, i) => { if (i === x.best) assert.equal(cell.density, x.max); });
    const restaurant = g.items.find(y => y.ds.id === 'restaurant');
    if (restaurant) assert.equal(restaurant.cells.filter(cell => cell.state === 'out_of_scope').length, rows.filter(r => !('restaurant' in r.c)).length);
  }
  assert.match(renderCompare(buildCompare(model, []), model), /เพิ่มในการเปรียบเทียบ/);
});
