/**
 * Trial wider areas (0.3.0, js/extents.js, scripts/build-extents.py, DATA_METHOD.md §2c): built against the very
 * neighbourhood data this release ships, every core inside exactly one area, never fewer records than its core, the
 * core's figures untouched, and one provenance line for the area's figures.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {load, readJSON, readBytes, sha256, ROOT} from './helpers.js';
import {decodeExtents, extentOf, extentFeature, EXTENT_DASH} from '../js/extents.js';
import {buildOverview, buildNeighborhood} from '../js/profile.js';
import {renderOverview, renderNeighborhood} from '../js/panel.js';

const holes = /undefined|NaN|\[object Object\]|Infinity/;
const raw = () => readJSON('data/extents.json');
/** The shipped model with the wider areas beside it (a shallow copy: the cached model is never changed). */
const withExtents = () => ({...load().model, extents: decodeExtents(raw())});

test('the wider areas were built against this release\'s neighbourhood data and outlines', () => {
  const m = raw().meta;
  assert.equal(m.neighborhoodsSha256, sha256(readBytes('data/neighborhoods.json')));
  assert.equal(m.boundariesSha256, sha256(readBytes('data/boundaries.geojson')));
  assert.match(m.file, /^amendments\/extents-[\w-]+\.geojson$/, 'the drawn areas are kept in the repository');
  assert.equal(m.fileSha256, sha256(readBytes(m.file)));
  assert.ok(m.owner?.asked && m.owner?.go, 'the owner\'s words that started the trial');
  assert.equal(m.count, raw().items.length);
  assert.ok(m.count >= 1);
  for (const k of ['beach', 'walk']) assert.ok(m.rules[k].th && m.rules[k].en && m.rules[k].short.th && m.rules[k].short.en);
  assert.match(m.drawnOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(m.basemap.builtOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(m.datasets.length, 16);
  const {model} = load();
  for (const d of m.datasets) assert.equal(d.sha256, model.dsById.get(d.id).source.sha256, d.id);
});

test('every core lies in one wider area, with a drawn outline, and the area is larger than its cores', () => {
  const ext = decodeExtents(raw());
  const {model} = load();
  const seen = new Set();
  for (const it of ext.items) {
    assert.ok(extentFeature(ext, it.id), `${it.id} has an outline`);
    assert.ok(it.rule in raw().meta.rules, it.id);
    let core = 0;
    for (const c of it.cores) {
      assert.ok(!seen.has(c), `${c} in two areas`);
      seen.add(c);
      const r = model.byId.get(c);
      assert.ok(r, `${c} is a neighbourhood`);
      assert.equal(r.province, it.province);
      assert.equal(extentOf(ext, c), it);
      core += r.areaM2;
    }
    assert.ok(it.areaM2 > core, `${it.id} ${it.areaM2} > ${core}`);
  }
});

test('an area never holds fewer records than one of its cores, and keeps the cores\' scope (no key = no data)', () => {
  const ext = decodeExtents(raw());
  const {model} = load();
  for (const it of ext.items) {
    for (const c of it.cores) {
      const r = model.byId.get(c);
      assert.deepEqual(Object.keys(it.c).sort(), Object.keys(r.c).sort(), `${it.id} scope`);
      for (const [ds, n] of Object.entries(r.c)) assert.ok(it.c[ds] >= n, `${it.id} ${ds} ${it.c[ds]} < ${n}`);
    }
    for (const [ds, [sum, known]] of Object.entries(it.m || {})) assert.ok(known <= it.c[ds] && sum >= 0, `${it.id} ${ds}`);
  }
});

test('a core opens with its wider area; a neighbourhood without one shows none', () => {
  const model = withExtents();
  const ctx = {meta: model.meta, datasetCount: 16};
  for (const it of model.extents.items) {
    const r = model.byId.get(it.cores[0]);
    const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx});
    assert.ok(!holes.test(html), it.id);
    assert.match(html, /พื้นที่ย่าน \(ทดลอง\)/);
    assert.match(html, new RegExp(`data-action="fit-extent" data-id="${it.id}"`));
    const section = html.slice(html.indexOf('class="panel-section extent"'), html.indexOf('</section>', html.indexOf('class="panel-section extent"')));
    for (const part of ['dataset', 'source', 'date', 'boundary']) assert.equal((section.match(new RegExp(`data-prov="${part}"`, 'g')) || []).length, 1, `${it.id} ${part}`);
    assert.match(section, /#2c/);
  }
  const other = model.rows.find(r => !model.extents.byCore.has(r.id));
  assert.doesNotMatch(renderNeighborhood(buildNeighborhood(model, other), model, {ctx}), /พื้นที่ย่าน \(ทดลอง\)/);
});

test('the core\'s own figures do not change with the wider areas', () => {
  const {model} = load();
  const ctx = {meta: model.meta, datasetCount: 16};
  const r = model.byId.get(raw().items[0].cores[0]);
  const before = renderNeighborhood(buildNeighborhood(model, r), model, {ctx});
  const model2 = withExtents();
  const after = renderNeighborhood(buildNeighborhood(model2, r), model2, {ctx});
  const strip = h => h.replace(/<section class="panel-section extent">[\s\S]*?<\/section>/, '');
  assert.notEqual(after, before);
  assert.equal(strip(after), before);
});

test('the national view names the pilot places, each opening a core', () => {
  const model = withExtents();
  const html = renderOverview(buildOverview(model, {rows: model.rows}), model, {ctx: {meta: model.meta, datasetCount: 16}});
  for (const it of model.extents.items) assert.match(html, new RegExp(`data-id="${it.cores[0]}">${it.name}</button>`));
});

test('the page loads the module through the import map and carries the legend word in both languages', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /"\.\/js\/extents\.js": "\.\/js\/extents\.js\?v=/);
  assert.match(html, /id="legend-extent"[^>]*hidden/);
  const en = readFileSync(join(ROOT, 'js/lang-en.js'), 'utf8');
  assert.match(en, /'พื้นที่ย่าน \(ทดลอง\)': 'Wider area \(trial\)'/);
  assert.deepEqual([...EXTENT_DASH], [6, 2, 1, 2]);
});
