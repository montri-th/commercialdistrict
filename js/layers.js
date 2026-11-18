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
 *
 * Records (0.1.3, owner 2026-11-16 “เลือกดูทีละชุด”): one pin per spot (js/records.js#spotsOf) in its pillar's shape and
 * series colour; a spot holding more records of its dataset has a second outline behind (no number). With one dataset
 * chosen (the map's dataset bar, `f.show`) its pins are larger and on top, with their names beside them (HTML labels,
 * js/map-layers.js#installRecordLabels), and every other record is a small neutral dot that still answers the pointer.
 * Condominium display points (never counted) are drawn only when they are the chosen set: Land's diamond with a dashed
 * outline, round the open neighbourhood. A ring marks the record whose card is open.
 */
import {GEOJSON_MAXZOOM, firstLineLayerId} from './map-layers.js';
import {cueImage} from './cues.js';

export const LAYERS = Object.freeze({
  provinceLine: 'nb-province-line', provinceSelected: 'nb-province-selected',
  fill: 'nb-fill', edge: 'nb-edge', zero: 'nb-zero', line: 'nb-line', lodging: 'nb-line-lodging', compare: 'nb-compare', hover: 'nb-hover', selected: 'nb-selected',
  pins: 'nb-pins', pinSelected: 'nb-pin-selected', condo: 'nb-condo', poi: 'nb-poi', poiSelected: 'nb-poi-selected',
});
const SRC = {provinces: 'nb-provinces', outlines: 'nb-outlines', pins: 'nb-pin-points', poi: 'nb-poi-points', condo: 'nb-condo-points', poiSelected: 'nb-poi-selected-point'};
const EMPTY = {type: 'FeatureCollection', features: []};
/** Outlines are drawn from this zoom; pins until PIN_MAX_ZOOM; the open neighbourhood's records from POI_MIN_ZOOM. */
export const OUTLINE_MIN_ZOOM = 9;
export const PIN_MAX_ZOOM = 13;
export const POI_MIN_ZOOM = 12;
/** Province frames are drawn below this zoom. */
export const PROVINCE_MAX_ZOOM = 11;
/** Record pins (CSS px at icon-size 1): every set · the chosen set · the others while one is chosen; scaled by zoom. */
export const PIN = 14, PIN_CHOSEN = 20, PIN_QUIET = 7;
const PIN_STOPS = [[POI_MIN_ZOOM, 0.7], [15, 1], [18, 1.25]];
const PIN_SCALE = ['interpolate', ['linear'], ['zoom'], ...PIN_STOPS.flat()];
/** The pins' icon-size at a zoom (the same stops as PIN_SCALE), for hit tests and the names' room. */
export function pinScale(zoom) {
  if (zoom <= PIN_STOPS[0][0]) return PIN_STOPS[0][1];
  for (let i = 1; i < PIN_STOPS.length; i++) {
    const [z0, v0] = PIN_STOPS[i - 1], [z1, v1] = PIN_STOPS[i];
    if (zoom <= z1) return v0 + ((zoom - z0) / (z1 - z0)) * (v1 - v0);
  }
  return PIN_STOPS.at(-1)[1];
}
/** Screen distance (px) within which the pointer is on a pin (a little more than the chosen pin's half, for touch). */
export const POI_HIT = 12;
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
 * `poi:s<series>[:big][:stack][:dash]` a record pin (0.1.3: `big` the chosen set, `stack` more records at the point,
 * `dash` an unconfirmed display point), `poi:quiet` a record of another set while one is chosen.
 */
export function iconSpec(name, {lut = [], zero = {}} = {}) {
  const ink = cssVar('--map-marker-stroke', '#182327');
  let m;
  if ((m = /^pin:s(\d+)$/.exec(name))) return {series: +m[1], size: 15, fill: cssVar(`--series-${m[1]}-fill`, '#8AA4AA'), stroke: ink, strokeWidth: 1.1};
  if ((m = /^pin:l(\d+)$/.exec(name))) return {series: 1, size: 13, fill: lut[+m[1]] || '#8AA4AA', stroke: ink, strokeWidth: 1.1};
  if (name === 'pin:zero') return {series: 1, size: 13, fill: zero.fill || '#FFF1D9', stroke: zero.outline || '#7D877F', strokeWidth: 2.2};
  if (name === 'pin:none') return {series: 8, size: 12, fill: cssVar('--surface-card', '#FCFCFA'), stroke: cssVar('--text-secondary', '#4E5B52'), strokeWidth: 1.1};
  if (name === 'pin:quiet') return {series: 1, size: 8, fill: cssVar('--surface-card', '#FCFCFA'), stroke: cssVar('--border-emphasis', '#7D877F'), strokeWidth: 1};
  if (name === 'poi:quiet') return {series: 1, size: PIN_QUIET, fill: cssVar('--text-muted', '#7D877F'), stroke: cssVar('--surface-card', '#FCFCFA'), strokeWidth: 1};
  if ((m = /^poi:s(\d+)((?::big|:stack|:dash)*)$/.exec(name))) {
    const flags = m[2] || '', big = flags.includes(':big');
    return {series: +m[1], size: big ? PIN_CHOSEN : PIN, fill: cssVar(`--series-${m[1]}-fill`, '#8AA4AA'), stroke: ink, strokeWidth: big ? 1.4 : 1.1,
      stacked: flags.includes(':stack'), dashed: flags.includes(':dash')};
  }
  return null;
}

/** A record pin's icon name (iconSpec). */
export const pinIcon = (series, {chosen = false, stacked = false, dashed = false} = {}) => `poi:s${series}${chosen ? ':big' : ''}${stacked ? ':stack' : ''}${dashed ? ':dash' : ''}`;

/** Pins: one point per neighbourhood at the registry's reference point (area focus, not an entrance). */
export function pinCollection(rows, iconOf = () => 'pin:none', sortOf = () => 0) {
  return {type: 'FeatureCollection', features: rows.map(r => ({type: 'Feature', id: r.index, geometry: {type: 'Point', coordinates: r.ref},
    properties: {id: r.id, icon: iconOf(r), sort: sortOf(r)}}))};
}

/**
 * Spots (js/records.js#spotsOf) → one pin each; `seriesOf(ds)` gives the pillar's series. Feature id = the spot's index
 * (the app keeps the spots to read the records back). `chosen`: the set the reader picked ('' = every set alike): its
 * pins larger and on top, every other a quiet dot. `dashed`: unconfirmed display points (the condominium layer).
 */
export function poiCollection(spots, seriesOf, {chosen = '', dashed = false} = {}) {
  return {type: 'FeatureCollection', features: (spots || []).map((g, i) => {
    const isChosen = Boolean(chosen) && g.ds.id === chosen, quiet = Boolean(chosen) && !isChosen;
    return {type: 'Feature', id: i, geometry: {type: 'Point', coordinates: [g.lon, g.lat]},
      properties: {d: g.ds.id, icon: quiet ? 'poi:quiet' : pinIcon(seriesOf(g.ds), {chosen: isChosen, stacked: g.items.length > 1, dashed}), sort: isChosen ? 3 : quiet ? 1 : 2}};
  })};
}

export function installNeighborhoodLayers(map, {provinces, outlines, rows, iconOptions = () => ({})}) {
  const before = firstLineLayerId(map);
  map.addSource(SRC.provinces, {type: 'geojson', data: provinces || EMPTY, maxzoom: GEOJSON_MAXZOOM, promoteId: 'id'});
  map.addSource(SRC.outlines, {type: 'geojson', data: outlines, maxzoom: GEOJSON_MAXZOOM, promoteId: 'id'});
  map.addSource(SRC.pins, {type: 'geojson', data: pinCollection(rows), maxzoom: GEOJSON_MAXZOOM});
  map.addSource(SRC.poi, {type: 'geojson', data: EMPTY, maxzoom: GEOJSON_MAXZOOM});
  map.addSource(SRC.condo, {type: 'geojson', data: EMPTY, maxzoom: GEOJSON_MAXZOOM});
  map.addSource(SRC.poiSelected, {type: 'geojson', data: EMPTY, maxzoom: GEOJSON_MAXZOOM});

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
  // The outline of a lodging area of the registry's lodging screen is the screen's review draft (0.2.0; a central code of
  // the registry since 0.2.1, its outline still a draft): dotted, so it reads apart from the outlines closed by the
  // registry's rules (solid) and from the compared ones (long dashes).
  const lineColor = ['case', ['boolean', ['feature-state', 'quiet'], false], cssVar('--border-default', '#C9D0CB'), cssVar('--text-secondary', '#4E5B52')];
  map.addLayer({id: LAYERS.line, type: 'line', source: SRC.outlines, minzoom: OUTLINE_MIN_ZOOM, filter: ['!=', ['get', 'kind'], 'lodging'],
    paint: {'line-color': lineColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.1, 16, 1.6]}});
  map.addLayer({id: LAYERS.lodging, type: 'line', source: SRC.outlines, minzoom: OUTLINE_MIN_ZOOM, filter: ['==', ['get', 'kind'], 'lodging'],
    layout: {'line-cap': 'round'},
    paint: {'line-color': lineColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 13, 1.6, 16, 2.2], 'line-dasharray': [0.1, 2]}});
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
  // Every pin drawn (overlap allowed: a hidden record would read as absent); the condominium points under the records.
  const pinLayout = {'icon-image': ['get', 'icon'], 'icon-size': PIN_SCALE, 'icon-allow-overlap': true, 'icon-ignore-placement': true,
    'symbol-sort-key': ['get', 'sort'], 'icon-pitch-alignment': 'viewport'};
  map.addLayer({id: LAYERS.condo, type: 'symbol', source: SRC.condo, minzoom: POI_MIN_ZOOM, layout: pinLayout});
  map.addLayer({id: LAYERS.poi, type: 'symbol', source: SRC.poi, minzoom: POI_MIN_ZOOM, layout: pinLayout});
  map.addLayer({id: LAYERS.poiSelected, type: 'circle', source: SRC.poiSelected, minzoom: POI_MIN_ZOOM,
    paint: {'circle-radius': ['interpolate', ['linear'], ['zoom'], POI_MIN_ZOOM, 10, 15, 14, 18, 17.5], 'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': cssVar('--map-selected-stroke', '#176B82'), 'circle-stroke-width': 2.6, 'circle-pitch-alignment': 'viewport'}});

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
  /** The condominium display points round the open neighbourhood (poiCollection of their spots), or none. */
  const setCondo = collection => map.getSource(SRC.condo)?.setData(collection || EMPTY);
  /** The ring round the record whose card is open ([lon, lat]), or none. */
  const markPoi = at => map.getSource(SRC.poiSelected)?.setData(at ? {type: 'FeatureCollection', features: [{type: 'Feature', geometry: {type: 'Point', coordinates: at}, properties: {}}]} : EMPTY);
  /**
   * Pins under a screen point, nearest first: [{layer: 'poi' | 'condo', id, d}] — every pin within POI_HIT px (scaled
   * with the zoom like the pins), so a pile at one point and its close neighbours read together.
   */
  function hitPoi(point, {pad = POI_HIT} = {}) {
    const layers = [LAYERS.poi, LAYERS.condo].filter(id => map.getLayer(id));
    if (!layers.length || map.getZoom() < POI_MIN_ZOOM) return [];
    const r = Math.max(8, pad * pinScale(map.getZoom()));
    const hits = map.queryRenderedFeatures([[point.x - r, point.y - r], [point.x + r, point.y + r]], {layers});
    const seen = new Set(), out = [];
    for (const h of hits) {
      const layer = h.layer.id === LAYERS.condo ? 'condo' : 'poi', key = `${layer}:${h.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const p = map.project(h.geometry.coordinates), d = Math.hypot(p.x - point.x, p.y - point.y);
      if (d <= r) out.push({layer, id: h.id, d: h.properties.d, dist: d});
    }
    return out.sort((a, b) => a.dist - b.dist || (a.layer === 'poi' ? -1 : 1));
  }
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
  return {paint, setPins, select, hover, setCompare, setProvince, setPoints, setCondo, markPoi, hitPoi, hitTest, dispose, layerIds: LAYERS};
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
