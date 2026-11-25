/**
 * Framing a chosen neighbourhood (0.2.3; owner 2026-11-18 15:43, VERBATIM: “เวลาเลือกย่านควรต้อง zoom to fit ในแผนที่ด้วย”).
 * The fit itself runs in a browser (js/shell/camera.js#fitBuilding); measured on the real map with the stubbed
 * basemap (handoff/VERIFICATION.md 0.2.3): every outline inside the free map, 73–78 % of it for every outline over
 * 200 m, desktop and 393 px, 3D and plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT, load} from './helpers.js';
import {framePoints, convexHull, FIT_MARGIN, FIT_MIN_SPAN, FIT_MAX_ZOOM} from '../js/layers.js';

const M = 110574;
const square = (cx, cy, metres) => {
  const hx = metres / 2 / (111320 * Math.cos((cy * Math.PI) / 180)), hy = metres / 2 / M;
  return {type: 'Polygon', coordinates: [[[cx - hx, cy - hy], [cx + hx, cy - hy], [cx + hx, cy + hy], [cx - hx, cy + hy], [cx - hx, cy - hy]]]};
};
const span = pts => {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return [(Math.max(...xs) - Math.min(...xs)) * 111320 * Math.cos((cy * Math.PI) / 180), (Math.max(...ys) - Math.min(...ys)) * M];
};
const inside = (p, hull) => hull.every((a, i) => { const b = hull[(i + 1) % hull.length]; return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-12; });

test('convexHull: the outer points, counter-clockwise, without the closing point', () => {
  const h = convexHull([[0, 0], [2, 0], [1, 1], [2, 2], [0, 2], [0, 0], [1, 0]]);
  assert.deepEqual(h, [[0, 0], [2, 0], [2, 2], [0, 2]]);
  assert.deepEqual(convexHull([[1, 1]]), [[1, 1]]);
});

test('an outline is framed by itself with FIT_MARGIN of its size on each side', () => {
  const g = square(100.53, 13.74, 1000), pts = framePoints(g);
  const [w, h] = span(pts);
  assert.ok(Math.abs(w - 1000 * (1 + 2 * FIT_MARGIN)) < 2, `width ${w}`);
  assert.ok(Math.abs(h - 1000 * (1 + 2 * FIT_MARGIN)) < 2, `height ${h}`);
  for (const p of g.coordinates[0]) assert.ok(inside(p, pts), 'every vertex of the outline is inside the frame');
});

test('the smallest keep FIT_MIN_SPAN m of street round them; a missing geometry gives no frame', () => {
  const pts = framePoints(square(100.53, 13.74, 68));
  const [w, h] = span(pts);
  assert.ok(Math.abs(w - FIT_MIN_SPAN) < 1 && Math.abs(h - FIT_MIN_SPAN) < 1, `${w} × ${h}`);
  assert.deepEqual(framePoints(null), []);
  assert.deepEqual(framePoints({type: 'Point', coordinates: [100, 13]}), []);
  assert.ok(FIT_MAX_ZOOM >= 18 && FIT_MAX_ZOOM <= 19.5, 'close enough for a 200 m view, never closer than the building view');
});

test('every shipped outline has a frame that holds all its vertices', () => {
  const {model, outlines} = load();
  const byId = new Map(outlines.features.map(f => [String(f.properties.id), f]));
  let n = 0;
  for (const r of model.rows) {
    const f = byId.get(r.id);
    if (!f) continue;
    const pts = framePoints(f.geometry);
    assert.ok(pts.length >= 3, r.id);
    const hull = convexHull(pts);
    const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map(p => p[0]);
    for (const ring of rings) for (const p of ring) assert.ok(inside(p, hull), `${r.id} ${p}`);
    n++;
  }
  assert.ok(n >= 395, `${n} outlines framed`);
});

test('the app fits a chosen neighbourhood with the shared fit, above the phone sheet, with no 880 m square any more', () => {
  const app = readFileSync(join(ROOT, 'js/app.js'), 'utf8');
  const fit = app.slice(app.indexOf('function fitNb('), app.indexOf('function fitMap('));
  // (0.4.0) the outline, or — with a distance of «ขอบเดินถึง» chosen — the line at that distance, a thinner margin round it
  assert.match(fit, /framePoints\(geometry, ring \? \{margin: 0\.04\} : \{\}\)/);
  assert.match(fit, /const ring = r\.id === state\.nb \? ringGeometry\(\) : null;/);
  assert.match(fit, /fitBuilding\(map, points, \{box, preset, bearing: CAMERA\[preset\]\.bearing, minZoom: 11, maxZoom: FIT_MAX_ZOOM, fill: FIT_FILL/);
  assert.doesNotMatch(fit, /320\) \+ 120/, 'the old square of at least 880 m is gone');
  const select = app.slice(app.indexOf('function selectNb('), app.indexOf('function selectProvince('));
  assert.ok(select.indexOf('openMobilePanel({frame: false})') < select.indexOf('update({fit})'), 'the sheet opens before the fit reads the free map');
  assert.match(app, /bottom = Math\.max\(bottom, Math\.round\(sheetHeight\(\)\)/, 'the sheet is read at rest');
});
