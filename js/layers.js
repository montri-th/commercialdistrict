/**
 * Map layers of CityMETER · Commercial District: province frames (quiet, for the drill-down), the neighbourhood outlines
 * (filled by the reading), a pin per neighbourhood for the zooms where an outline is too small to see, and the
 * located records inside the open neighbourhood.
 *
 * Reading of the fills and pins (js/app.js#computeFills):
 *   highlights — the series of the pillar (Land · Location · Living) of the neighbourhood's first highlight, its pin in
 *                that series' shape (LDS DATAVIZ-05: the shape is the non-colour cue); a neighbourhood with none is an
 *                outline and a hollow pin (nothing stands out — not "0").
 *   a dataset  — density.area, the LUT sample of its density among the neighbourhoods in scope; measured zero = sample
 *                0 + the zero outline; out of scope (the dataset has no located record in the province) = no fill.
 * A data colour is never made paler (no opacity on a data fill): a neighbourhood outside the scope goes quiet as an
 * outline and a small hollow pin; the open neighbourhood shows its records instead of its fill.
 *
 * Outlines: data/boundaries.geojson — the registry's closed draft outlines simplified for display (shared edges kept).
 */
import {GEOJSON_MAXZOOM, firstLineLayerId} from './map-layers.js';
import {cueImage} from './cues.js';

export const LAYERS = Object.freeze({
  provinceLine: 'nb-province-line', provinceSelected: 'nb-province-selected',
  fill: 'nb-fill', edge: 'nb-edge', zero: 'nb-zero', line: 'nb-line', compare: 'nb-compare', hover: 'nb-hover', selected: 'nb-selected',
  pins: 'nb-pins', pinSelected: 'nb-pin-selected', poi: 'nb-poi',
});
const SRC = {provinces: 'nb-provinces', outlines: 'nb-outlines', pins: 'nb-pin-points', poi: 'nb-poi-points'};
const EMPTY = {type: 'FeatureCollection', features: []};
/** Outlines are drawn from this zoom; pins until PIN_MAX_ZOOM; the open neighbourhood's records from POI_MIN_ZOOM. */
export const OUTLINE_MIN_ZOOM = 9;
export const PIN_MAX_ZOOM = 13;
export const POI_MIN_ZOOM = 12;
/** Province frames are drawn below this zoom. */
export const PROVINCE_MAX_ZOOM = 11;
/**
 * Up close a fill would hide the streets and buildings that make the place readable: the fill stops at FILL_MAX_ZOOM
 * and the same colour, unchanged, draws the outline instead from EDGE_MIN_ZOOM (no opacity on a data colour).
 */
export const FILL_MAX_ZOOM = 14.5;
export const EDGE_MIN_ZOOM = 14;

function cssVar(name, fallback) {
  const value = typeof getComputedStyle === 'function' && typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';
  return value || fallback;
}
const fs = (key, on, off = 0) => ['case', ['boolean', ['feature-state', key], false], on, off];

/**
 * Icon names → how to draw them (js/cues.js#cueImage): `pin:s<series>` a pillar pin, `pin:l<index>` a density pin
 * (LUT sample), `pin:zero` measured zero, `pin:none` nothing stands out / out of scope, `pin:quiet` outside the scope,
 * `poi:s<series>` a record of the open neighbourhood, `poi:s<series>:big` a record of the dataset being read.
 */
export function iconSpec(name, {lut = [], zero = {}} = {}) {
  const ink = cssVar('--map-marker-stroke', '#182327');
  let m;
  if ((m = /^pin:s(\d+)$/.exec(name))) return {series: +m[1], size: 15, fill: cssVar(`--series-${m[1]}-fill`, '#8AA4AA'), stroke: ink, strokeWidth: 1.1};
  if ((m = /^pin:l(\d+)$/.exec(name))) return {series: 1, size: 13, fill: lut[+m[1]] || '#8AA4AA', stroke: ink, strokeWidth: 1.1};
  if (name === 'pin:zero') return {series: 1, size: 13, fill: zero.fill || '#FFF1D9', stroke: zero.outline || '#7D877F', strokeWidth: 2.2};
  if (name === 'pin:none') return {series: 8, size: 12, fill: cssVar('--surface-card', '#FCFCFA'), stroke: cssVar('--text-secondary', '#4E5B52'), strokeWidth: 1.1};
  if (name === 'pin:quiet') return {series: 1, size: 8, fill: cssVar('--surface-card', '#FCFCFA'), stroke: cssVar('--border-emphasis', '#7D877F'), strokeWidth: 1};
  if ((m = /^poi:s(\d+)(:big)?$/.exec(name))) return {series: +m[1], size: m[2] ? 14 : 10, fill: cssVar(`--series-${m[1]}-fill`, '#8AA4AA'), stroke: m[2] ? cssVar('--text-primary', '#182327') : cssVar('--surface-card', '#FCFCFA'), strokeWidth: m[2] ? 1.4 : 0.9};
  return null;
}

/** Pins: one point per neighbourhood at the registry's reference point (area focus, not an entrance). */
export function pinCollection(rows, iconOf = () => 'pin:none', sortOf = () => 0) {
  return {type: 'FeatureCollection', features: rows.map(r => ({type: 'Feature', id: r.index, geometry: {type: 'Point', coordinates: r.ref},
    properties: {id: r.id, icon: iconOf(r), sort: sortOf(r)}}))};
}

/** Records inside one neighbourhood: [[dataset index, lon, lat, subgroup]…] → points with the dataset's series icon. */
export function poiCollection(list, datasets, lensId = '') {
  return {type: 'FeatureCollection', features: (list || []).map(([d, lon, lat, s], i) => {
    const ds = datasets[d], series = ds?.series || 9, big = Boolean(lensId) && ds?.id === lensId;
    return {type: 'Feature', id: i, geometry: {type: 'Point', coordinates: [lon, lat]},
      properties: {d: ds?.id || '', s, icon: `poi:s${series}${big ? ':big' : ''}`, sort: big ? 1 : 0}};
  })};
}

export function installNeighborhoodLayers(map, {provinces, outlines, rows, iconOptions = () => ({})}) {
  const before = firstLineLayerId(map);
  map.addSource(SRC.provinces, {type: 'geojson', data: provinces || EMPTY, maxzoom: GEOJSON_MAXZOOM, promoteId: 'id'});
  map.addSource(SRC.outlines, {type: 'geojson', data: outlines, maxzoom: GEOJSON_MAXZOOM, promoteId: 'id'});
  map.addSource(SRC.pins, {type: 'geojson', data: pinCollection(rows), maxzoom: GEOJSON_MAXZOOM});
  map.addSource(SRC.poi, {type: 'geojson', data: EMPTY, maxzoom: GEOJSON_MAXZOOM});

  // Icons are drawn on demand (a missing image asks once; theme changes reload the style and clear them).
  const onMissing = e => {
    const spec = iconSpec(e.id, iconOptions());
    if (!spec || map.hasImage(e.id)) return;
    const {series, ...rest} = spec;
    map.addImage(e.id, cueImage(series, {...rest, pixelRatio: 2}), {pixelRatio: 2});
  };
  map.on('styleimagemissing', onMissing);

  map.addLayer({id: LAYERS.provinceLine, type: 'line', source: SRC.provinces, maxzoom: PROVINCE_MAX_ZOOM,
    paint: {'line-color': cssVar('--border-default', '#C9D0CB'), 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 9, 1.1]}}, before);
  map.addLayer({id: LAYERS.provinceSelected, type: 'line', source: SRC.provinces, maxzoom: 13,
    paint: {'line-color': cssVar('--map-selected-stroke', '#176B82'), 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.6, 9, 2.4],
      'line-opacity': fs('selected', 1)}});
  map.addLayer({id: LAYERS.fill, type: 'fill', source: SRC.outlines, minzoom: OUTLINE_MIN_ZOOM, maxzoom: FILL_MAX_ZOOM,
    paint: {'fill-color': ['coalesce', ['feature-state', 'fill'], '#000000'], 'fill-opacity': fs('filled', 1)}}, before);
  map.addLayer({id: LAYERS.edge, type: 'line', source: SRC.outlines, minzoom: EDGE_MIN_ZOOM,
    paint: {'line-color': ['coalesce', ['feature-state', 'fill'], '#000000'], 'line-width': ['interpolate', ['linear'], ['zoom'], EDGE_MIN_ZOOM, 3, 17, 5], 'line-opacity': fs('filled', 1)}});
  map.addLayer({id: LAYERS.zero, type: 'line', source: SRC.outlines, minzoom: OUTLINE_MIN_ZOOM,
    paint: {'line-color': cssVar('--data-zero-outline', '#7D877F'), 'line-width': 2, 'line-opacity': fs('zero', 1)}}, before);
  map.addLayer({id: LAYERS.line, type: 'line', source: SRC.outlines, minzoom: OUTLINE_MIN_ZOOM,
    paint: {'line-color': ['case', ['boolean', ['feature-state', 'quiet'], false], cssVar('--border-default', '#C9D0CB'), cssVar('--text-secondary', '#4E5B52')],
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.1, 16, 1.6]}});
  map.addLayer({id: LAYERS.compare, type: 'line', source: SRC.outlines,
    paint: {'line-color': cssVar('--map-focus-stroke', '#176B82'), 'line-width': 2.2, 'line-dasharray': [2, 1.4], 'line-opacity': fs('compare', 1)}});
  map.addLayer({id: LAYERS.hover, type: 'line', source: SRC.outlines, minzoom: OUTLINE_MIN_ZOOM,
    paint: {'line-color': cssVar('--map-hover-stroke', '#347DA8'), 'line-width': 2, 'line-opacity': fs('hover', 1)}});
  map.addLayer({id: LAYERS.selected, type: 'line', source: SRC.outlines,
    paint: {'line-color': cssVar('--map-selected-stroke', '#176B82'), 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 3.4], 'line-opacity': fs('selected', 1)}});
  map.addLayer({id: LAYERS.pins, type: 'symbol', source: SRC.pins, maxzoom: PIN_MAX_ZOOM,
    layout: {'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 9, 0.9, 12, 1.1],
      'icon-allow-overlap': true, 'icon-ignore-placement': true, 'symbol-sort-key': ['get', 'sort']}});
  map.addLayer({id: LAYERS.pinSelected, type: 'circle', source: SRC.pins, maxzoom: PIN_MAX_ZOOM,
    paint: {'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 8, 12, 12], 'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': cssVar('--map-selected-stroke', '#176B82'), 'circle-stroke-width': 2.4, 'circle-stroke-opacity': fs('selected', 1)}});
  map.addLayer({id: LAYERS.poi, type: 'symbol', source: SRC.poi, minzoom: POI_MIN_ZOOM,
    layout: {'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], POI_MIN_ZOOM, 0.75, 16, 1.15],
      'icon-allow-overlap': true, 'icon-ignore-placement': true, 'symbol-sort-key': ['get', 'sort']}});

  const ids = (outlines.features || []).map(f => String(f.properties.id));
  const locateOutline = outlineLocator(outlines);
  const pinIndex = new Map(rows.map(r => [r.id, r.index]));
  let selected = '', hovered = '', compare = [], province = '';

  /** fills: Map(id → {fill, zero, quiet, open}); the pins are set with setPins. */
  function paint(fills) {
    for (const id of ids) {
      const f = fills.get(id) || {};
      map.setFeatureState({source: SRC.outlines, id}, {fill: f.fill || null, filled: Boolean(f.fill) && !f.quiet && !f.open, zero: Boolean(f.zero) && !f.quiet && !f.open, quiet: Boolean(f.quiet)});
    }
  }
  const setPins = collection => map.getSource(SRC.pins)?.setData(collection);
  function select(id) {
    if (selected) { map.setFeatureState({source: SRC.outlines, id: selected}, {selected: false}); const p = pinIndex.get(selected); if (p != null) map.setFeatureState({source: SRC.pins, id: p}, {selected: false}); }
    selected = id || '';
    if (selected) { map.setFeatureState({source: SRC.outlines, id: selected}, {selected: true}); const p = pinIndex.get(selected); if (p != null) map.setFeatureState({source: SRC.pins, id: p}, {selected: true}); }
  }
  function hover(id) {
    if (hovered === (id || '')) return;
    if (hovered) map.setFeatureState({source: SRC.outlines, id: hovered}, {hover: false});
    hovered = id || '';
    if (hovered) map.setFeatureState({source: SRC.outlines, id: hovered}, {hover: true});
  }
  function setCompare(list = []) {
    for (const id of compare) map.setFeatureState({source: SRC.outlines, id}, {compare: false});
    compare = list.slice();
    for (const id of compare) map.setFeatureState({source: SRC.outlines, id}, {compare: true});
  }
  function setProvince(code = '') {
    if (province) map.setFeatureState({source: SRC.provinces, id: province}, {selected: false});
    province = code;
    if (province) map.setFeatureState({source: SRC.provinces, id: province}, {selected: true});
  }
  /** The located records of the open neighbourhood (poiCollection), or none. */
  const setPoints = collection => map.getSource(SRC.poi)?.setData(collection || EMPTY);
  /** The neighbourhood under a screen point: its pin below PIN_MAX_ZOOM, else its outline. */
  function hitTest(point) {
    const pad = 6;
    const pins = map.getLayer(LAYERS.pins) && map.getZoom() < PIN_MAX_ZOOM
      ? map.queryRenderedFeatures([[point.x - pad, point.y - pad], [point.x + pad, point.y + pad]], {layers: [LAYERS.pins]}) : [];
    if (pins.length) {
      let best = pins[0], bestD = Infinity;
      for (const h of pins) {
        const p = map.project(h.geometry.coordinates), d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
        if (d < bestD) { bestD = d; best = h; }
      }
      return best.properties.id;
    }
    const fill = map.getLayer(LAYERS.fill) && map.getZoom() < FILL_MAX_ZOOM ? map.queryRenderedFeatures(point, {layers: [LAYERS.fill]})[0] : null;
    if (fill) return String(fill.properties.id);
    // Above the fill's zoom: the outline under the point from its geometry (the fill layer is not drawn there).
    return locateOutline ? locateOutline(map.unproject(point).toArray()) : '';
  }
  function dispose() {
    map.off('styleimagemissing', onMissing);
    for (const id of Object.values(LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of Object.values(SRC)) if (map.getSource(id)) map.removeSource(id);
  }
  return {paint, setPins, select, hover, setCompare, setProvince, setPoints, hitTest, dispose, layerIds: LAYERS};
}

/** The outline under a lng/lat (point in polygon over the display outlines; boxes first), or ''. */
export function outlineLocator(collection) {
  const inRing = ([x, y], ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const items = (collection?.features || []).map(f => {
    const g = f.geometry;
    const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const p of polys) for (const [x, y] of p[0]) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    return {id: String(f.properties.id), polys, w, s, e, n};
  });
  return ([x, y]) => {
    for (const it of items) {
      if (x < it.w || x > it.e || y < it.s || y > it.n) continue;
      if (it.polys.some(p => inRing([x, y], p[0]) && !p.slice(1).some(h => inRing([x, y], h)))) return it.id;
    }
    return '';
  };
}
