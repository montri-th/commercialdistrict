/**
 * Trial wider areas, “พื้นที่ย่าน (ทดลอง)” (0.3.0). Owner 2026-11-24 08:15, VERBATIM: “ผมอยากให้ดูเรื่องขอบเขตย่าน …
 * ป่าตอง กะตะ กะรน น่าจะคลุมพื้นที่อาคารมากกว่านี้มั้ย … เราใช้ขอบเขตนั้นมาช่วยกำหนดขอบเขตย่านด้วยได้มั้ย … อยาก apply
 * กับที่อื่นๆ และย่านรูปแบบอื่นๆ ที่ relevant กันด้วยทั้ง dataset นี้”, 08:19 “อย่างป่าตองก็น่าได้ประมาณนี้มั้ย”, and at
 * 10:12, on the proposal of two layers of outline piloted on ten places: “ลุยเลย”.
 *
 * Two layers, never one replacing the other: the registry's outline stays the neighbourhood's core, and every count,
 * rank, highlight, share and density of the page still reads it. The wider area is the whole place the name refers to
 * (Patong the town, not only Bangla–Jungceylon), drawn by rule from the basemap (DATA_METHOD.md §2c) for a few pilot
 * places, with the 16 datasets counted inside it by scripts/build-extents.py into data/extents.json. The panel shows
 * those counts beside the core's (js/panel.js#extentSection); the map draws the area as a quiet dash-dot line.
 *
 * Quiet by role, never by opacity: a neutral ink (--text-muted; the open neighbourhood's area --text-secondary), a
 * dash-dot pattern no other line of the page uses (the registry's outlines are solid, the lodging drafts dotted, the
 * compared outlines long dashes, rail under construction short dashes), above the basemap's roads and under the
 * neighbourhoods' outlines, pins and records. It never takes a data colour and counts nothing on the map itself.
 */
import {GEOJSON_MAXZOOM} from './map-layers.js';

export const EXTENT_LAYERS = Object.freeze({line: 'nb-extent-line', open: 'nb-extent-open'});
const SRC = 'nb-extents';
/** Drawn from this zoom (a town-sized area reads from about here). */
export const EXTENT_MIN_ZOOM = 8;
/** Dash-dot, in line widths: dash 6 · gap 2 · dot 1 · gap 2. */
export const EXTENT_DASH = Object.freeze([6, 2, 1, 2]);

function cssVar(name, fallback) {
  if (typeof getComputedStyle !== 'function' || typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** data/extents.json → {meta, items, byId, byCore, geometry}. A core belongs to at most one wider area. */
export function decodeExtents(json) {
  const items = Array.isArray(json?.items) ? json.items : [];
  const byCore = new Map();
  for (const it of items) for (const c of it.cores || []) if (!byCore.has(c)) byCore.set(c, it);
  return {meta: json?.meta || {}, items, byId: new Map(items.map(it => [it.id, it])), byCore,
    geometry: json?.geometry?.type === 'FeatureCollection' ? json.geometry : {type: 'FeatureCollection', features: []}};
}

/** The wider area a neighbourhood (row id) is the core of, or null. */
export const extentOf = (ext, rowId) => ext?.byCore?.get(rowId) || null;

/** The area's outline as one feature (for framing). */
export const extentFeature = (ext, id) => (ext?.geometry?.features || []).find(f => f.properties?.id === id) || null;

/**
 * Add the wider areas to the map: every area quiet, the open neighbourhood's area a step darker. `before`: the layer
 * to stay under (the registry's outlines). Returns {setOpen(id)}.
 */
export function installExtentLayers(map, ext, {before, attribution = ''} = {}) {
  for (const id of Object.values(EXTENT_LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(SRC)) map.removeSource(SRC);
  map.addSource(SRC, {type: 'geojson', data: ext.geometry, maxzoom: GEOJSON_MAXZOOM, ...(attribution ? {attribution} : {})});
  const under = before && map.getLayer(before) ? before : undefined;
  const width = k => ['interpolate', ['linear'], ['zoom'], EXTENT_MIN_ZOOM, 1 * k, 12, 1.4 * k, 16, 2 * k];
  map.addLayer({id: EXTENT_LAYERS.line, type: 'line', source: SRC, minzoom: EXTENT_MIN_ZOOM, layout: {'line-join': 'round'},
    paint: {'line-color': cssVar('--text-muted', '#7B877D'), 'line-width': width(1), 'line-dasharray': [...EXTENT_DASH]}}, under);
  map.addLayer({id: EXTENT_LAYERS.open, type: 'line', source: SRC, minzoom: EXTENT_MIN_ZOOM, filter: ['==', ['get', 'id'], ''], layout: {'line-join': 'round'},
    paint: {'line-color': cssVar('--text-secondary', '#5F635A'), 'line-width': width(1.4), 'line-dasharray': [...EXTENT_DASH]}}, under);
  return {
    setOpen(id) { if (map.getLayer(EXTENT_LAYERS.open)) map.setFilter(EXTENT_LAYERS.open, ['==', ['get', 'id'], id || '']); },
  };
}
