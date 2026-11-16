/**
 * Helpers of the focus tier (js/regions.js). Since 0.1.4 the focus is the open neighbourhood's outline only (owner
 * 2026-11-16 23:28); the camera's cell still tells when the reader has moved away from it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as regions from '../js/regions.js';

const {CAMERA_CELL_M, CAMERA_REACH_M, squareAround, ringsBox, cameraSquare} = regions;
const metres = ([w, s, e, n], lat) => [(e - w) * 111320 * Math.cos((lat * Math.PI) / 180), (n - s) * 110574];

test('no square of surroundings: the University helper is gone from this demo', () => {
  assert.equal(regions.siteContextRegions, undefined);
  assert.equal(regions.SITE_CONTEXT_MIN_M, undefined);
  const lat = 13.7458, lon = 100.5341;
  const [wide, high] = metres(ringsBox([squareAround(lon, lat, 250)]), lat);
  assert.ok(Math.abs(wide - 500) < 1 && Math.abs(high - 500) < 1, `${wide} × ${high}`);
});

test('the camera square: from the focus zoom in, snapped to its cell, never while the camera looks at the subject', () => {
  const lat = 16.4721, lon = 102.8236;
  assert.equal(cameraSquare([lon, lat], 11.9), null, 'below the zoom nothing is read');
  const a = cameraSquare([lon, lat], 12.5), b = cameraSquare([lon + 0.001, lat + 0.001], 15);
  assert.ok(a && b);
  assert.equal(a.key, b.key, 'a small pan (about 150 m) keeps the same cell');
  const far = cameraSquare([lon + 0.05, lat], 14);
  assert.notEqual(far.key, a.key, 'a move of about 5 km reads a new square');
  const [wide] = metres(ringsBox([a.ring]), lat);
  assert.ok(Math.abs(wide / 2 - CAMERA_REACH_M) < 5);
  const outline = [squareAround(lon, lat, 600)];
  assert.equal(cameraSquare([lon, lat], 15, {base: outline}), null, 'inside the neighbourhood’s box: the camera is at the subject');
  assert.ok(cameraSquare([lon + 0.05, lat], 15, {base: outline}), 'away from it: the camera’s cell is read');
  assert.ok(CAMERA_CELL_M < CAMERA_REACH_M, 'the square always covers the camera');
});
