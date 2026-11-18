/**
 * Rail context of the map (0.2.3): data/rail.json as Transit publishes it, drawn quiet and never counted.
 * Owner 2026-11-18 15:32, VERBATIM: “ในแผนที่อยากให้แสดง สถานีและแนวเส้นทางระบบรางเพิ่มเติม เพื่อให้เห็น context และการเชื่อมโยง
 * รอบๆและระหว่างแต่ละย่านการค้า ใน visual อาจจะให้ quiet กว่าตัวย่านการค้าเล็กน้อย”.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {readJSON, ROOT} from './helpers.js';
import {decodeRail, railTipHTML, installRailLayers, RAIL_LAYERS, HIDDEN_BASEMAP, RAIL_MIN_ZOOM, STATION_MIN_ZOOM, NAME_MIN_ZOOM} from '../js/rail.js';
import {OUTLINE_MIN_ZOOM} from '../js/layers.js';

const rail = readJSON('data/rail.json');
const TH = [97.3, 5.6, 105.7, 20.5];
const inThailand = ([x, y]) => x >= TH[0] && x <= TH[2] && y >= TH[1] && y <= TH[3];

test('rail.json names its dataset, source, date and boundary, and the Transit commit and files it was copied from', () => {
  const m = rail.meta;
  assert.ok(m.dataset?.th && m.dataset?.en);
  assert.match(m.release, /^transit-data-\d{4}-\d{2}-\d{2}-r\d+$/);
  assert.match(m.asOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(m.boundary?.th && m.boundary?.en);
  assert.match(m.linesSource, /CC BY 4\.0/);
  assert.match(m.osmLicence, /ODbL/);
  assert.equal(m.from.repo, 'montri-th/transit');
  assert.match(m.from.commit, /^[0-9a-f]{40}$/);
  for (const f of ['data/transit.json', 'data/rail-lines.geojson', 'data/layer-srt.json']) assert.match(m.from.files[f], /^[0-9a-f]{64}$/, f);
  assert.ok(m.srt.grain && m.srt.boundary && m.srt.licence, 'the national stops carry their own grain, boundary and licence');
});

test('rail.json counts match its rows, every index points somewhere, every point is in Thailand', () => {
  const c = rail.meta.counts;
  assert.equal(rail.lines.length, c.lines);
  assert.equal(rail.lines.filter(l => l.status === 'operating').length, c.linesInService);
  assert.equal(rail.lines.filter(l => l.status === 'construction').length, c.linesUnderConstruction);
  assert.equal(rail.stations.length, c.stations);
  assert.equal(rail.srt.length, c.srtStops);
  assert.equal(rail.links.length, c.links);
  assert.deepEqual(Object.values(c.stationsByStatus).reduce((a, b) => a + b, 0), c.stations);
  for (const l of rail.lines) assert.ok(l.id && l.name && l.nameEn && ['operating', 'construction'].includes(l.status), l.id);
  const drawn = new Set();
  for (const f of rail.geo.features) {
    const {l, s} = f.properties;
    assert.ok(rail.lines[l], `line ${l}`);
    assert.ok(s === 0 || s === 1);
    assert.equal(s === 0, rail.lines[l].status === 'operating', `${rail.lines[l].id}: a part's status is its line's`);
    assert.equal(f.geometry.type, 'MultiLineString');
    for (const part of f.geometry.coordinates) { assert.ok(part.length >= 2); for (const p of part) assert.ok(inThailand(p), String(p)); }
    drawn.add(l);
  }
  assert.equal(drawn.size, c.linesDrawn);
  for (const [lng, lat, name, nameEn, lines, s] of rail.stations) {
    assert.ok(inThailand([lng, lat]) && name, name);
    assert.equal(typeof nameEn, 'string');
    assert.ok(lines.length && lines.every(i => rail.lines[i]), name);
    assert.ok([0, 1, 2].includes(s), name);
  }
  for (const [name, rows] of rail.links) assert.ok(name && rows.length >= 2 && rows.every(i => rail.stations[i]), name);
  for (const [lng, lat, name, area] of rail.srt) assert.ok(inThailand([lng, lat]) && name && typeof area === 'string', name);
});

test('the rail data is context only: no module that counts, ranks or writes the panel reads it', () => {
  for (const m of ['js/model.js', 'js/panel.js', 'js/records.js', 'js/layers.js']) {
    assert.doesNotMatch(readFileSync(join(ROOT, m), 'utf8'), /rail\.js|rail\.json/, m);
  }
  assert.doesNotMatch(readFileSync(join(ROOT, 'scripts/build-data.py'), 'utf8'), /rail\.json/, 'the neighbourhood build never reads the rail context');
  const app = readFileSync(join(ROOT, 'js/app.js'), 'utf8');
  assert.match(app, /fetchJSON\(`data\/rail\.json\$\{V\(\)\}`\)/, 'fetched relative to the page with the release tag');
});

test('the stations on the map are the file the dataset สถานีราง counts: same Transit release, same bytes', () => {
  const ds = readJSON('data/neighborhoods.json').datasets.find(d => d.id === 'transit');
  assert.ok(ds, 'the Transit dataset');
  assert.equal(ds.source.file, 'data/transit.json');
  assert.equal(rail.meta.from.files['data/transit.json'], ds.source.sha256, 'rail.json was built from the bytes the dataset counts');
  assert.equal(rail.meta.release, ds.dates.release);
  // The dataset leaves the stations whose status is not confirmed out; the map draws them hollow, never as counted.
  assert.equal(rail.meta.counts.stations - rail.meta.counts.stationsByStatus.unverified, ds.records);
});

test('decodeRail: one point per station row and per national stop; interchange groups by station row', () => {
  const d = decodeRail(rail);
  assert.equal(d.points.features.length, rail.stations.length + rail.srt.length);
  assert.equal(d.points.features.filter(f => f.properties.k === 'stop').length, rail.srt.length);
  for (const [g, [, rows]] of rail.links.entries()) for (const r of rows) assert.equal(d.linkOf.get(r), g);
  assert.throws(() => decodeRail({lines: []}), /expected shape/);
});

test('the tip names a station, its lines as published, a status other than in service, and what it connects with', () => {
  const d = decodeRail(rail);
  const linked = rail.links.find(([, rows]) => new Set(rows.map(i => rail.stations[i][2])).size > 1);
  const i = linked[1][0], st = rail.stations[i];
  const item = {k: 'station', i, name: st[2], nameEn: st[3], lines: st[4], s: st[5], area: ''};
  const th = railTipHTML([item], d, {lang: 'th'}), en = railTipHTML([item], d, {lang: 'en'});
  assert.match(th, new RegExp(st[2]));
  assert.match(th, new RegExp(rail.lines[st[4][0]].name));
  assert.match(th, /เชื่อมกับ .+ ตามผังเครือข่าย/);
  assert.match(en, /Connects with .+ on the network map/);
  assert.match(en, new RegExp(rail.lines[st[4][0]].nameEn.replace(/[()]/g, '.')));
  const build = rail.stations.findIndex(r => r[5] === 1), b = rail.stations[build];
  assert.match(railTipHTML([{k: 'station', i: build, name: b[2], nameEn: b[3], lines: b[4], s: 1}], d), /กำลังก่อสร้าง/);
  const unsure = rail.stations.findIndex(r => r[5] === 2), u = rail.stations[unsure];
  assert.match(railTipHTML([{k: 'station', i: unsure, name: u[2], nameEn: u[3], lines: u[4], s: 2}], d, {lang: 'en'}), /Status not confirmed/);
  assert.doesNotMatch(railTipHTML([item], d), /เปิดให้บริการ/, 'in service is the default and is not written');
  const stop = rail.srt[0];
  assert.match(railTipHTML([{k: 'stop', i: 0, name: stop[2], nameEn: stop[2], lines: [], s: 0, area: stop[3]}], d), new RegExp(`${stop[2]}[\\s\\S]*${stop[3]}`));
  assert.doesNotMatch(railTipHTML([{...item, name: '<img src=x onerror=1>'}], d), /<img/, 'names are escaped');
});

/** A recording stand-in for a MapLibre map with a basemap style loaded. */
function fakeMap() {
  const layers = [{id: 'background'}, {id: 'road-major'}, {id: 'rail', layout: {}}, {id: 'transit', layout: {}}, {id: 'massing-city', type: 'fill-extrusion'}, {id: 'water-name', type: 'symbol'}];
  const sources = new Map([['openmaptiles', {}]]), images = new Map();
  const at = id => layers.findIndex(l => l.id === id);
  return {
    layers, sources,
    getLayer: id => layers.find(l => l.id === id),
    getSource: id => sources.get(id),
    addSource: (id, s) => sources.set(id, s),
    removeSource: id => sources.delete(id),
    addLayer: (l, before) => { const i = before ? at(before) : -1; if (i < 0) layers.push(l); else layers.splice(i, 0, l); },
    removeLayer: id => layers.splice(at(id), 1),
    getLayoutProperty: (id, k) => layers[at(id)].layout?.[k],
    setLayoutProperty: (id, k, v) => { const l = layers[at(id)]; l.layout = {...l.layout, [k]: v}; },
    hasImage: id => images.has(id), addImage: (id, img) => images.set(id, img),
    queryRenderedFeatures: () => [], project: () => ({x: 0, y: 0}),
  };
}

test('drawn quiet: one neutral ink, no identity or series colour, no opacity; lines and dots under the 3D buildings, squares and names under the labels', () => {
  const map = fakeMap();
  const handle = installRailLayers(map, decodeRail(rail), {beforeGround: 'massing-city', beforeLabels: 'water-name', attribution: 'Rail: test'});
  const ids = map.layers.map(l => l.id);
  const pos = id => ids.indexOf(id);
  for (const id of [RAIL_LAYERS.osm, RAIL_LAYERS.casing, RAIL_LAYERS.build, RAIL_LAYERS.line, RAIL_LAYERS.station]) assert.ok(pos(id) > pos('road-major') && pos(id) < pos('massing-city'), id);
  for (const id of [RAIL_LAYERS.stop, RAIL_LAYERS.name, RAIL_LAYERS.stopName]) assert.ok(pos(id) > pos('massing-city') && pos(id) < pos('water-name'), id);
  assert.ok(pos(RAIL_LAYERS.build) < pos(RAIL_LAYERS.line), 'lines in service over the dashed ones');
  const lineColours = new Set(rail.lines.map(l => l.color).filter(Boolean));
  const rail_ = map.layers.filter(l => Object.values(RAIL_LAYERS).includes(l.id));
  const text = JSON.stringify(rail_.map(l => l.paint));
  assert.doesNotMatch(text, /opacity/, 'quiet by role, never by opacity');
  assert.doesNotMatch(text, /series-|#65B724|#1E398D/i, 'no identity or categorical colour');
  for (const c of lineColours) assert.ok(!text.includes(c), c);
  for (const l of rail_) assert.ok((l.minzoom ?? 0) >= RAIL_MIN_ZOOM, `${l.id} from zoom ${l.minzoom}`);
  assert.equal(RAIL_MIN_ZOOM, OUTLINE_MIN_ZOOM, 'the rail appears with the outlines');
  assert.ok(STATION_MIN_ZOOM > RAIL_MIN_ZOOM && NAME_MIN_ZOOM > STATION_MIN_ZOOM);
  assert.equal(map.getLayer(RAIL_LAYERS.build).paint['line-dasharray'].join(), '2,1.6', 'the Transit demo\'s dash for construction');
  assert.ok(String(JSON.stringify(map.getLayer(RAIL_LAYERS.osm).filter)).includes('service'), 'sidings and yards left out');
  for (const id of HIDDEN_BASEMAP) assert.equal(map.getLayoutProperty(id, 'visibility'), 'none', `${id} would draw the lines twice`);
  assert.equal(map.getSource('rail-lines').attribution, 'Rail: test');
  for (const [id, s] of map.sources) if (id !== 'openmaptiles') assert.equal(s.maxzoom, 24, id);
  handle.dispose();
  for (const id of Object.values(RAIL_LAYERS)) assert.equal(map.getLayer(id), undefined, id);
  for (const id of HIDDEN_BASEMAP) assert.equal(map.getLayoutProperty(id, 'visibility'), 'visible', id);
});

test('the legend item, the method and the attribution carry the rail provenance from the data, not from constants', () => {
  const app = readFileSync(join(ROOT, 'js/app.js'), 'utf8'), html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<span id="legend-rail" class="legend-rail-item" hidden>/, 'hidden until the data arrives');
  assert.match(app, /railItem\.title = L\(`ระบบราง \(บริบท ไม่นับรวมในย่าน\)/);
  assert.match(app, /rail\.boundary\?\.th/);
  assert.match(app, /thaiDate\(rail\.asOf\)|thaiDate\(meta\.asOf\)/);
  assert.doesNotMatch(app, /31 ต\.ค\. 2569/, 'no snapshot date as a UI constant');
  const method = readFileSync(join(ROOT, 'DATA_METHOD.md'), 'utf8');
  assert.match(method, /## 9b\. Rail context/);
  assert.match(method, /scripts\/build-rail\.py/);
});
