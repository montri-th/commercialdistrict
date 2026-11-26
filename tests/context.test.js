/**
 * What a reader finds the way by on the round maps (0.7.1; owner 2026-11-26 17:51, VERBATIM: “แผนที่รัศมีควรจะมี
 * โครงร่างถนน ทะเล ลำน้ำ กายภาพ ให้ดูแบบเดียวกับ shopping center ด้วยได้มั้ยครับ”; the OpenStreetMap file: “ดึงจาก Mac
 * ของผม (แนะนำ)”):
 *   source  the Shopping Center page's extract by SHA-256 (D-14), with its date, licence and attribution
 *   shape   map.ctx per neighbourhood: sea and water areas, rivers, four road classes, rail, stations, a few names
 *   draw    water under the cells, lines over them, never a data colour and never a change to a cell's colour
 *   words   the key names only what the map draws; the provenance line credits OpenStreetMap (ODbL) when it draws any
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {ROOT, load, readJSON} from './helpers.js';
import {decodeAround} from '../js/around.js';
import {buildNeighborhood} from '../js/profile.js';
import {renderNeighborhood} from '../js/panel.js';
import {mapSVG} from '../js/people.js';

const OSM_SHA = '62b496bf2383ddd266cfcd3456cd03064db1887399f2a4c869bbf953bfd12d24';
const KINDS = {sea: 1, river: 1, road: 4, station: 3};
const PATH = /^(?:M-?\d+ -?\d+(?:l-?\d+ -?\d+)+z?)*$/;
const people = id => readJSON(`data/people/${id}.json`);
const ctx = () => ({meta: load().model.meta, datasetCount: 16});

test('the context comes from the Shopping Center page’s OpenStreetMap extract, dated and credited', () => {
  const meta = readJSON('data/people/meta.json').context;
  assert.equal(meta.schema, 'citymeter-commercialdistrict-context/1');
  assert.equal(meta.source.osm.sha256, OSM_SHA, 'the same file by SHA-256 as the Shopping Center page (D-14)');
  assert.equal(meta.source.osm.file, 'thailand-261124.osm.pbf');
  assert.equal(meta.source.osm.timestamp, '2026-11-24T21:21:23Z');
  assert.equal(meta.source.osm.license, 'ODbL 1.0');
  assert.equal(meta.source.osm.attribution, '© OpenStreetMap contributors');
  assert.equal(meta.asOf, '2026-11-24');
  assert.equal(meta.frame, undefined, 'the frames stay in the build’s own file');
  assert.match(meta.source.stations.sha256, /^[0-9a-f]{64}$/);
  assert.equal(createHash('sha256').update(readFileSync(join(ROOT, 'data/rail.json'))).digest('hex'), meta.source.stations.sha256, 'the stations of this page’s rail file');
  assert.deepEqual(meta.counts.seaDropped, []);
});

test('every round map carries its context in the map’s own 25 m units, names within the limits', () => {
  const {model} = load();
  let sea = 0, named = 0;
  for (const r of model.rows) {
    const map = people(r.id).map, c = map.ctx;
    assert.ok(c, `${r.id}: no context`);
    assert.deepEqual(Object.keys(c).sort(), ['L', 'a', 'c', 'r', 's', 't', 'w'], r.id);
    assert.equal(c.r.length, 4, `${r.id}: motorway · trunk · primary · secondary`);
    for (const d of [c.c, c.a, c.w, c.t, ...c.r]) {
      assert.equal(typeof d, 'string');
      assert.match(d, PATH, `${r.id}: a path of integers in 25 m units`);
    }
    for (const p of c.s) assert.ok(Array.isArray(p) && p.length === 2 && p.every(Number.isInteger), `${r.id}: a station is a point`);
    const per = {};
    const {x0, y1, w, h} = map.cell;
    for (const [kind, x, y, align, th, en] of c.L) {
      assert.ok(kind in KINDS, `${r.id}: ${kind}`);
      assert.ok(['c', 'l', 'r'].includes(align), `${r.id}: ${align}`);
      assert.ok(th && typeof th === 'string' && typeof en === 'string', `${r.id}: a name`);
      assert.ok(x >= x0 * 10 && x <= (x0 + w) * 10 && y >= -(y1 + 1) * 10 && y <= (h - y1 - 1) * 10, `${r.id}: ${th} inside the map`);
      per[kind] = (per[kind] || 0) + 1;
      named++;
    }
    for (const [k, n] of Object.entries(per)) assert.ok(n <= KINDS[k], `${r.id}: ${n} ${k} names`);
    if (c.c) sea++;
  }
  assert.ok(sea > 100 && sea < 200, `${sea} maps reach the sea`);
  assert.ok(named > 1500, `${named} names`);
});

test('water lies under the cells and the lines over them; no cell changes its colour; nothing else is drawn in a data colour', () => {
  const {model} = load();
  for (const id of ['CMN-TH-AC4758F0BC', 'CMN-TH-0007', 'CMN-TH-0880830DE7']) {
    const r = model.byId.get(id), map = people(id).map;
    for (const tab of ['visit', 'work']) {
      const svg = mapSVG(r, map, tab), bare = mapSVG(r, {...map, ctx: undefined}, tab);
      const cells = s => [...s.matchAll(/<path d="[^"]+" fill="#[0-9A-F]{6}"[^>]*\/>/g)].map(m => m[0]);
      assert.deepEqual(cells(svg), cells(bare), `${id} ${tab}: the cells are the same with and without the context`);
      const clip = svg.slice(svg.indexOf('clip-path='), svg.indexOf('</g>', svg.indexOf('class="pm-ctx"')));
      const firstCell = clip.search(/ fill="#[0-9A-F]{6}"/), lastCell = clip.lastIndexOf(' fill="#');
      if (map.ctx.c) assert.ok(clip.indexOf('class="pm-sea"') < firstCell, `${id}: the sea under the cells`);
      if (map.ctx.a) assert.ok(clip.indexOf('class="pm-water"') < firstCell, `${id}: water under the cells`);
      assert.ok(clip.indexOf('class="pm-ctx"') > lastCell, `${id}: roads, rail, rivers and stations over the cells`);
      const ctxPart = svg.slice(svg.indexOf('class="pm-ctx"'), svg.indexOf('</g>', svg.indexOf('class="pm-ctx"')));
      assert.doesNotMatch(ctxPart, /fill="#|stroke="#|style=/, `${id}: the context takes its colours from the stylesheet only`);
      // within the clip of the 5 km ground, before the service lines and the outline
      assert.ok(svg.indexOf('class="pm-ctx"') < svg.indexOf('class="pm-edge"'));
      assert.ok(svg.indexOf('class="pm-ctx"') < svg.indexOf('class="pm-outline"'));
    }
  }
  const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
  const rules = css.split('\n').filter(l => /\.pm-(sea|water|ctx|road|rail|river|station|lab)\b/.test(l));
  assert.ok(rules.length >= 14, 'the context styles');
  for (const l of rules) assert.doesNotMatch(l, /#[0-9a-fA-F]{3,8}\b|rgba?\(|opacity/, `a token, never a value or an opacity: ${l}`);
  for (const token of ['--basemap-water', '--basemap-shore', '--area-label-bg', '--area-label-ink', '--map-active-layer']) {
    assert.ok(rules.some(l => l.includes(`var(${token})`)), token);
    assert.match(readFileSync(join(ROOT, 'assets/theme.css'), 'utf8'), new RegExp(`${token}:`), `${token} in the theme`);
  }
});

test('the key names only what the map draws; the provenance line credits OpenStreetMap when the map draws any of it', () => {
  const {model} = load();
  const around = decodeAround(readJSON('data/around.json'));
  const meta = readJSON('data/people/meta.json');
  const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const render = (id, p) => renderNeighborhood(buildNeighborhood(model, model.byId.get(id)), model, {ctx: ctx(), around, distance: 'in', people: p, peopleMeta: meta, reach: '1000', mapTab: 'visit'});
  const key = html => text(html.slice(html.indexOf('class="pm-key"'), html.indexOf('</p>', html.indexOf('class="pm-key"'))));
  const patong = render('CMN-TH-AC4758F0BC', people('CMN-TH-AC4758F0BC'));
  assert.match(key(patong), /ถนนสายหลัก/);
  assert.match(key(patong), /ทะเลและแหล่งน้ำ/);
  assert.doesNotMatch(key(patong), /รถไฟฟ้าและรถไฟ|สถานี /, 'Patong has no rail and no station within 5 km');
  const nimman = render('CMN-TH-FB55C19EF1', people('CMN-TH-FB55C19EF1'));
  assert.match(key(nimman), /แหล่งน้ำ/);
  assert.doesNotMatch(key(nimman), /ทะเล/, 'Chiang Mai is not on the sea');
  const mapSec = html => { const i = html.indexOf('id="nb-map"'); return html.slice(i, html.indexOf('</section>', i)); };
  const foot = html => { const s = mapSec(html); return text(s.slice(s.indexOf('class="hint panel-foot provenance"'))); };
  assert.match(foot(patong), /© ผู้ร่วมให้ข้อมูล OpenStreetMap \(ODbL\)/);
  assert.match(foot(patong), /OpenStreetMap 24 พ\.ย\. 2569/);
  // without the context the map says nothing of OpenStreetMap
  const p = people('CMN-TH-AC4758F0BC');
  const bare = render('CMN-TH-AC4758F0BC', {...p, map: {...p.map, ctx: undefined}});
  assert.doesNotMatch(foot(bare), /OpenStreetMap/);
  assert.doesNotMatch(key(bare), /ถนนสายหลัก|แหล่งน้ำ/);
  // a name is a chip over the map, set beside its point by the page as the build fitted it
  assert.match(patong, /<span class="pm-lab is-sea at-c" style="left:[\d.]+%;top:[\d.]+%">ทะเล<\/span>/);
});
