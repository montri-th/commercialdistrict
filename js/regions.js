/**
 * Pure lon/lat helpers for the focus tier of js/massing.js (js/app.js).
 *
 * The focus tier draws the open neighbourhood's outline only (0.1.4; owner 2026-11-16 23:28, VERBATIM: “กับอาคาร 3d
 * ที่ขึ้นรอบๆผมว่ามันแปลกๆ”). The University square of a campus's surroundings (siteContextRegions, 1 km and more round
 * the subject) is no longer used here: round a neighbourhood it rose as a block wider than the neighbourhood itself.
 * The camera's cell (cameraSquare, CAMERA_CELL_M) still tells js/app.js when the reader has moved away, so the quiet
 * buildings fade round the camera too; its square (CAMERA_REACH_M) is no longer drawn in full.
 */
export const CAMERA_CELL_M = 1500, CAMERA_REACH_M = 3000;

const KY = 110574;
const kx = lat => 111320 * Math.cos((lat * Math.PI) / 180);

/** A square (lon/lat ring) round a point, `metres` from its centre to each side. */
export function squareAround(lon, lat, metres = 250) {
  const dy = metres / KY, dx = metres / kx(lat);
  return [[lon - dx, lat - dy], [lon + dx, lat - dy], [lon + dx, lat + dy], [lon - dx, lat + dy], [lon - dx, lat - dy]];
}

/** [west, south, east, north] of lon/lat rings (no ring → an empty box: west = Infinity). */
export function ringsBox(rings) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return [w, s, e, n];
}

/**
 * The camera's square ({key, ring}) when it looks outside the subject's own focus (`base`, lon/lat rings): from
 * `minZoom` in, snapped to CAMERA_CELL_M; null below that zoom (no building is drawn there, so nothing is read) or
 * while the camera's centre is inside the box of `base`.
 */
export function cameraSquare(center, zoom, {base = [], minZoom = 12} = {}) {
  if (!Array.isArray(center) || !center.every(Number.isFinite) || !(zoom >= minZoom)) return null;
  const [lon, lat] = center;
  if (base.length) {
    const [w, s, e, n] = ringsBox(base);
    if (lon >= w && lon <= e && lat >= s && lat <= n) return null;
  }
  const cx = Math.round((lon * kx(lat)) / CAMERA_CELL_M), cy = Math.round((lat * KY) / CAMERA_CELL_M);
  return {key: `${cx},${cy}`, ring: squareAround((cx * CAMERA_CELL_M) / kx(lat), (cy * CAMERA_CELL_M) / KY, CAMERA_REACH_M)};
}
