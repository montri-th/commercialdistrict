/**
 * Every number with its dataset · source · date · boundary (0.8.2): the lines that read parks and places of worship
 * name OpenStreetMap and the extract's day, never CityMETER, and the comparison tray ends with its own provenance line.
 * Found by the registry's 30_DEMO_DATAVIZ_METHODS (ChatGPT, 2026-11-29, DV-25: the rows of parks and places of worship
 * gave no date of OpenStreetMap; DV-24: the comparison had no provenance line).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {load, readJSON} from './helpers.js';
import {decodeAround} from '../js/around.js';
import {buildOverview, buildNeighborhood, buildCompare} from '../js/profile.js';
import {renderOverview, renderNeighborhood, renderCompare, osmSourceWords} from '../js/panel.js';

const ctx = () => ({meta: load().model.meta, datasetCount: load().model.datasets.length});
const A = () => decodeAround(readJSON('data/around.json'));
const lines = html => [...html.matchAll(/<p class="hint panel-foot provenance">([\s\S]*?)<\/p>/g)].map(m => m[1]);
const part = (line, k) => (line.match(new RegExp(`data-prov="${k}">([\\s\\S]*?)</span>(?=\\s*<span class="prov-part|$)`)) || [])[1] || '';
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('the data names the OpenStreetMap extract the parks and places of worship were counted from, and its day', () => {
  const {model} = load();
  const osm = model.meta.osm;
  assert.equal(osm.file, 'thailand-261124.osm.pbf');
  assert.equal(osm.date, '2026-11-24', 'Geofabrik writes the day in the name: -YYMMDD');
  assert.equal(osm.sha256, '62b496bf2383ddd266cfcd3456cd03064db1887399f2a4c869bbf953bfd12d24', 'the file of D-14 (Shopping Center D70) and §17');
  assert.deepEqual(osm.datasets.map(x => x.id), ['park', 'temple']);
  for (const ds of model.datasets) {
    const mine = osm.datasets.some(x => x.id === ds.id);
    assert.equal(Boolean(ds.source?.osm), mine, ds.id);
    if (!mine) continue;
    assert.deepEqual(ds.source.osm, {file: osm.file, date: osm.date}, ds.id);
    assert.equal(ds.dates.asOf, osm.date, `${ds.id}: the data's day is the extract's`);
    assert.equal(ds.source.sha256, osm.sha256, ds.id);
  }
  assert.equal(osmSourceWords(model.meta), 'สวนสาธารณะ · ศาสนสถาน: OpenStreetMap (Geofabrik 24 พ.ย. 2569) © ผู้ร่วมให้ข้อมูล OpenStreetMap (ODbL)');
  assert.equal(osmSourceWords(model.meta, ['temple']), 'ศาสนสถาน: OpenStreetMap (Geofabrik 24 พ.ย. 2569) © ผู้ร่วมให้ข้อมูล OpenStreetMap (ODbL)');
  assert.equal(osmSourceWords({}), '');
});

test('a neighbourhood: its last line counts the CityMETER datasets apart from OpenStreetMap, its surroundings line names OpenStreetMap', () => {
  const {model} = load();
  const around = A();
  const cm = model.datasets.length - model.meta.osm.datasets.length;
  let named = 0;
  for (const r of model.rows) {
    const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(), around});
    const all = lines(html);
    const last = text(part(all.at(-1), 'source'));
    assert.ok(last.includes(`${cm} ชุดข้อมูล CityMETER`), `${r.id}: ${last}`);
    assert.ok(last.includes('OpenStreetMap (Geofabrik 24 พ.ย. 2569)'), `${r.id}: ${last}`);
    assert.ok(!/\b38 ชุดข้อมูล CityMETER/.test(text(html)), `${r.id}: never 38 CityMETER datasets`);
    const here = model.meta.osm.datasets.filter(x => x.id in r.c);
    const surroundings = all.map(l => text(l)).find(l => l.includes('ขอบเดินถึง รุ่น'));
    if (!surroundings) continue;
    if (here.length) {
      assert.ok(surroundings.includes(`${here.map(x => x.th).join(' · ')}: OpenStreetMap (Geofabrik 24 พ.ย. 2569)`), `${r.id}: ${surroundings}`);
      named++;
    } else assert.ok(!surroundings.includes('OpenStreetMap ('), r.id);
  }
  assert.ok(named > 700, `the surroundings line of nearly every neighbourhood names OpenStreetMap (${named})`);
});

test('the lens of an OpenStreetMap dataset names OpenStreetMap and its day, never “CityMETER Parks”', () => {
  const {model} = load();
  for (const id of ['park', 'temple']) {
    const ds = model.dsById.get(id);
    const html = renderOverview(buildOverview(model, {rows: model.rows, ds}), model, {ctx: ctx()});
    const line = lines(html).at(-1);
    assert.ok(text(part(line, 'source')).includes(`${ds.nameTh}: OpenStreetMap (Geofabrik 24 พ.ย. 2569)`), id);
    assert.ok(!text(line).includes(`CityMETER ${ds.name}`), id);
    assert.ok(text(part(line, 'date')).includes('24 พ.ย. 2569'), `${id}: the extract's day`);
  }
  const hotel = renderOverview(buildOverview(model, {rows: model.rows, ds: model.dsById.get('hotel')}), model, {ctx: ctx()});
  assert.ok(text(part(lines(hotel).at(-1), 'source')).includes('CityMETER Hotel'), 'a CityMETER dataset keeps its name');
});

test('the comparison ends with one provenance line of four parts; the empty one shows no number and has none', () => {
  const {model} = load();
  const around = A();
  const rows = [model.rows.find(r => r.name === 'สยาม'), model.rows.find(r => r.province === 'CMI'), model.rows.find(r => r.province === 'PKT')];
  const html = renderCompare(buildCompare(model, rows), model, {around});
  const all = lines(html);
  assert.equal(all.length, 1, 'one line');
  assert.ok(html.trimEnd().endsWith('</p>') && html.lastIndexOf('panel-foot provenance') > html.lastIndexOf('compare-table'), 'it comes last');
  for (const k of ['dataset', 'source', 'date', 'boundary']) assert.ok(text(part(all[0], k)), `${k} is written`);
  assert.ok(text(part(all[0], 'boundary')).includes(`${rows.map(r => r.name).join(' · ')} · ขอบย่านฉบับร่าง`), 'the boundary names the neighbourhoods compared');
  assert.ok(text(part(all[0], 'date')).includes('2569'), 'a date');
  assert.equal(lines(renderCompare(buildCompare(model, []), model)).length, 0);
});
