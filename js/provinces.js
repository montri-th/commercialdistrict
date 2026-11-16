/**
 * Province frames (data/provinces.geojson: the CityMETER production outlines, id = production code) — the lookups the
 * page needs from them: the province under a point (the map's click below the neighbourhood zooms, and the provinces
 * whose CityMETER building units the 3D focus reads, js/app.js#massingProvinces).
 */

/** Province code under a point (lng/lat) from the province frames, or ''. */
export function provinceLocator(provincesGeo) {
  const inRing = ([x, y], ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const items = (provincesGeo?.features || []).map(f => {
    const g = f.geometry;
    const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
    const [w, s, e, n] = f.properties?.bbox || [-180, -90, 180, 90];
    return {id: String(f.id ?? f.properties?.id), polys, w, s, e, n};
  });
  return ([x, y]) => {
    for (const it of items) {
      if (x < it.w || x > it.e || y < it.s || y > it.n) continue;
      if (it.polys.some(p => inRing([x, y], p[0]) && !p.slice(1).some(h => inRing([x, y], h)))) return it.id;
    }
    return '';
  };
}
