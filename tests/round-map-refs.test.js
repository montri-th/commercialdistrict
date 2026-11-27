/**
 * The round maps refer to nothing by url(#…) (0.7.9; owner 2026-11-27 16:10, VERBATIM: “heatmap นี้ไม่ขึ้นใน mobile นะครับ
 * (safari) เช็คที่ citymeter.pages.dev”, then his choice «แก้แบบกันไว้ก่อนเลย»). Chrome draws the map at 393 px; Safari on
 * his phone showed none. A guard against the references Safari most often gets wrong — the cause is not confirmed:
 *   frame  what lies past the 5 km line is covered by one path in the panel's own paper (an outer square and the 5 km
 *          line, even-odd), never a <clipPath>
 *   hatch  the cells across a river carry 45° lines cut at each cell's sides, never a <pattern>
 *   size   the map carries a width and a height equal to its viewBox
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT, load, readJSON} from './helpers.js';
import {decodeAround} from '../js/around.js';
import {buildNeighborhood} from '../js/profile.js';
import {renderNeighborhood} from '../js/panel.js';
import {MAP_TABS, mapSVG, crossOutPath, hatchSquare, HATCH} from '../js/people.js';

const people = id => readJSON(`data/people/${id}.json`);
const REFS = /url\(#|<clipPath|<pattern|<mask|<defs|<use[\s>]|clip-path=|href="#/;
const near = (a, b) => Math.abs(a - b) < 0.011;

test('no round map refers to anything by url(#…): every neighbourhood, every tab, with and without the hatch', () => {
  const {model} = load();
  let maps = 0, hatched = 0;
  for (const r of model.rows) {
    const map = people(r.id).map;
    for (const tab of MAP_TABS) {
      if (!map?.[tab]?.length) continue;
      for (const reach of map.x ? ['in', '1000', '5000'] : ['5000']) {
        const svg = mapSVG(r, map, tab, {reach});
        assert.doesNotMatch(svg, REFS, `${r.id} ${tab} ${reach}`);
        const size = svg.match(/<svg class="pm-map" viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
        assert.ok(size && size[3] === size[5] && size[4] === size[6], `${r.id}: width and height equal the viewBox`);
        const frame = svg.match(/<path class="pm-frame" d="M([-\d.]+) ([-\d.]+)h([\d.]+)v([\d.]+)h(-[\d.]+)z(M[^"]+)" fill-rule="evenodd"\/>/);
        assert.ok(frame, `${r.id} ${tab}: the frame`);
        assert.equal(frame[6], map.lines.s5, `${r.id}: the frame's hole is the 5 km line`);
        assert.ok(+frame[1] < +size[1] && +frame[2] < +size[2] && +frame[1] + +frame[3] > +size[1] + +size[3] && +frame[2] + +frame[4] > +size[2] + +size[4], `${r.id}: the frame covers the whole map`);
        const at = cls => svg.indexOf(`class="${cls}"`);
        assert.ok(at('pm-bg') < at('pm-cells') && at('pm-cells') < at('pm-frame') && at('pm-frame') < at('pm-edge'), `${r.id}: background, cells, frame, then the lines`);
        assert.ok(svg.lastIndexOf(' fill="#') < at('pm-frame') && svg.lastIndexOf('class="pm-ctx"') < at('pm-frame'), `${r.id}: every cell and the context under the frame`);
        maps++;
        const out = svg.match(/<path class="pm-cross-out" d="([^"]+)"\/>/);
        const squares = new Set([...crossOutPath(map, reach).matchAll(/M(-?\d+) (-?\d+)h10v10h-10z/g)].map(m => `${m[1]} ${m[2]}`));
        assert.equal(Boolean(out), squares.size > 0, `${r.id} ${reach}: a hatch exactly where cells are crossed out`);
        if (!out) continue;
        hatched++;
        const seen = new Set();
        for (const m of out[1].matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)) {
          const [ax, ay, bx, by] = m.slice(1).map(Number);
          assert.ok(near(ax + ay, bx + by) && bx > ax, `${r.id}: a 45° line, ${m[0]}`);
          const X = Math.floor((ax + bx) / 20) * 10, Y = Math.floor((ay + by) / 20) * 10;
          assert.ok(squares.has(`${X} ${Y}`), `${r.id}: a line in a crossed-out cell, ${m[0]}`);
          for (const [x, y] of [[ax, ay], [bx, by]]) assert.ok(near(x, X) || near(x, X + 10) || near(y, Y) || near(y, Y + 10), `${r.id}: cut at the cell's sides, ${m[0]}`);
          seen.add(`${X} ${Y}`);
        }
        assert.equal(seen.size, squares.size, `${r.id} ${reach}: every crossed-out cell is hatched`);
      }
    }
  }
  assert.ok(maps > 1500, `${maps} maps`);
  assert.ok(hatched > 200, `${hatched} hatched maps`);
});

test('the hatch lines are the 0.7.5 pattern\'s: 4.2 units apart on the map, 3 in the key, one square of each', () => {
  const lines = d => [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)].map(m => m.slice(1).map(Number));
  const map = lines(hatchSquare(0, 0, 10, HATCH.map));
  assert.deepEqual(map.map(([ax, ay]) => +(ax + ay).toFixed(2)), [2.97, 8.91, 14.85]);
  for (const [ax, ay, bx, by] of map) assert.ok(near(ax + ay, bx + by) && [ax, ay, bx, by].every(v => v >= 0 && v <= 10));
  const key = lines(hatchSquare(0, 0, 12, HATCH.key));
  assert.deepEqual(key.map(([ax, ay]) => +(ax + ay).toFixed(2)), [2.12, 6.36, 10.61, 14.85, 19.09, 23.33]);
  for (const [ax, ay, bx, by] of key) assert.ok(near(ax + ay, bx + by) && [ax, ay, bx, by].every(v => v >= 0 && v <= 12));
  // a square anywhere takes the same family of lines, x + y = 2.97 + 5.94 n, so neighbouring cells join up
  for (const [ax, ay] of lines(hatchSquare(130, -270, 10, HATCH.map))) {
    const n = (ax + ay - HATCH.map.c0) / HATCH.map.step;
    assert.ok(Math.abs(n - Math.round(n)) < 0.01, `${ax} ${ay}`);
  }
});

test('the key and the panel carry no reference either; the frame takes the panel\'s own paper', () => {
  const {model} = load();
  const meta = readJSON('data/people/meta.json');
  const around = decodeAround(readJSON('data/around.json'));
  const ctx = {meta: model.meta, datasetCount: 16};
  const r = model.rows.find(row => people(row.id).map?.x);
  const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx, around, distance: 'in', people: people(r.id), peopleMeta: meta, reach: '5000', mapTab: 'res'});
  const sec = html.slice(html.indexOf('id="nb-map"'));
  assert.doesNotMatch(sec, REFS, `${r.id}: the map section`);
  assert.match(sec, /<svg class="pm-key-cell"[^>]*><rect class="pm-bg"[^>]*\/><path class="pm-cross-out" d="M[^"]+"\/><\/svg>/, `${r.id}: the key's hatch as lines`);
  const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
  const paper = css.match(/^\.panel \{[^}]*background: var\((--[\w-]+)\)/m)?.[1];
  assert.equal(paper, '--surface-card');
  assert.match(css, new RegExp(`\\.pm-map \\.pm-frame \\{ fill: var\\(${paper}\\); stroke: none; \\}`), 'the frame in the panel\'s paper');
  assert.match(css, /\.pm-map \.pm-cross-out, \.pm-key-cell \.pm-cross-out \{ fill: none; stroke: var\(--area-label-ink\); stroke-width: 1\.1px; vector-effect: non-scaling-stroke; \}/);
});
