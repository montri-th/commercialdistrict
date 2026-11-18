/**
 * Rail context of the map (0.2.3; owner 2026-11-18 15:32, VERBATIM: “ในแผนที่อยากให้แสดง สถานีและแนวเส้นทางระบบรางเพิ่มเติม
 * เพื่อให้เห็น context และการเชื่อมโยงรอบๆและระหว่างแต่ละย่านการค้า ใน visual อาจจะให้ quiet กว่าตัวย่านการค้าเล็กน้อย”).
 *
 * data/rail.json (scripts/build-rail.py): the urban rail lines and stations of CityMETER · Transit, and the stops of
 * conventional rail with scheduled trips nationwide, as that demo publishes them. The stations are the very file the
 * dataset สถานีราง counts (tests/rail.test.js); this layer itself counts nothing — no share, rank, role or density reads
 * it (DATA_METHOD.md §9b).
 *
 * Quiet by role, never by opacity: one neutral ink (--text-muted) for every line and station — never a line's identity
 * colour or a categorical series, which mark the pillars here — under the neighbourhoods' outlines, pins and records
 * (js/layers.js). Line and shape tell the kinds apart:
 *   in service          solid line on a ground-coloured casing · filled dot
 *   under construction  dashed line (the Transit demo's dash) · hollow dot (also the stations whose status the source
 *                       could not confirm: an existing junction a project names)
 *   national rail       the basemap's railway (OpenStreetMap main lines, sidings and yards left out) as a thin solid line
 *                       · stops with scheduled trips as small squares (the Transit demo's shape for them)
 * The basemap's own rail and transit layers are hidden while this is drawn: they drew the same lines a second time.
 * Lines and dots stand under the 3D buildings; the squares and the names sit above them, under the basemap's labels.
 * Lines from RAIL_MIN_ZOOM (the outlines' zoom), stations from STATION_MIN_ZOOM, names from NAME_MIN_ZOOM (stops from
 * STOP_NAME_MIN_ZOOM). A pointer resting on a station shows its name, its lines and a status other than in service.
 */
import {GEOJSON_MAXZOOM} from './map-layers.js';

export const RAIL_LAYERS = Object.freeze({
  osm: 'rail-osm', casing: 'rail-casing', line: 'rail-line', build: 'rail-build', station: 'rail-station', stop: 'rail-stop',
  name: 'rail-name', stopName: 'rail-stop-name',
});
const SRC = Object.freeze({lines: 'rail-lines', points: 'rail-points', names: 'rail-names'});
export const RAIL_MIN_ZOOM = 9, STATION_MIN_ZOOM = 11, NAME_MIN_ZOOM = 14, STOP_NAME_MIN_ZOOM = 12;
/** The basemap's own layers this replaces (js/shell/map-style.js). */
export const HIDDEN_BASEMAP = Object.freeze(['rail', 'transit']);
export const STATUS = Object.freeze(['operating', 'construction', 'unverified']);
const STOP_ICON = 'rail-stop-square';
const FONT = ['Noto Sans Regular'];
const HIT = 7;

function cssVar(name, fallback) {
  const value = typeof getComputedStyle === 'function' && typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';
  return value || fallback;
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

/**
 * data/rail.json → {meta, lines, geo, points, stations, links, linkOf}: `points` is one GeoJSON point per station of a
 * line (k 'station', its line indexes, status 0 in service · 1 under construction · 2 not confirmed) and per national
 * stop (k 'stop'); `links` are Transit's interchange groups ([name, [station rows]]: stations a current network map
 * connects, walkways not confirmed), `linkOf` a station row → its group.
 */
export function decodeRail(json) {
  if (!json || !Array.isArray(json.lines) || json.geo?.type !== 'FeatureCollection' || !Array.isArray(json.stations) || !Array.isArray(json.srt)) {
    throw new Error('rail.json is not in the expected shape');
  }
  const points = [];
  json.stations.forEach(([lng, lat, name, nameEn, lines, s], i) => {
    points.push({type: 'Feature', id: points.length, geometry: {type: 'Point', coordinates: [lng, lat]},
      properties: {k: 'station', i, name, nameEn: nameEn || name, lines: (lines || []).join(','), s: Number(s) || 0}});
  });
  json.srt.forEach(([lng, lat, name, area], i) => {
    points.push({type: 'Feature', id: points.length, geometry: {type: 'Point', coordinates: [lng, lat]},
      properties: {k: 'stop', i, name, nameEn: name, area: area || '', s: 0}});
  });
  const links = Array.isArray(json.links) ? json.links : [], linkOf = new Map();
  links.forEach(([, rows], g) => { for (const r of rows || []) linkOf.set(r, g); });
  return {meta: json.meta || {}, lines: json.lines, geo: json.geo, points: {type: 'FeatureCollection', features: points}, stations: json.stations, links, linkOf};
}

/**
 * The hover tip of the stations and stops under the pointer (`items` from hit()); names as published. A station of an
 * interchange group names the stations it connects with, in Transit's words (a network map, not a confirmed walkway).
 */
export function railTipHTML(items, rail, {lang = 'th'} = {}) {
  const en = lang === 'en', L = (th, e) => (en ? e : th);
  const seen = new Set(), rows = [];
  for (const it of items) {
    const key = `${it.k}|${it.name}|${it.s}`;
    if (seen.has(key)) {
      const row = rows.find(r => r.key === key);
      if (row) { for (const l of it.lines) if (!row.lines.includes(l)) row.lines.push(l); row.ids.push(it.i); }
      continue;
    }
    seen.add(key);
    rows.push({key, ...it, lines: [...it.lines], ids: [it.i]});
    if (rows.length >= 3) break;
  }
  return rows.map(r => {
    const title = en ? r.nameEn || r.name : r.name;
    if (r.k === 'stop') {
      const where = [L(rail.meta?.srt?.label || 'รถไฟทางไกล (รฟท.)', 'Conventional rail stop (SRT)'), r.area].filter(Boolean).join(' · ');
      return `<div class="poi-tip-row rail-tip-row"><i class="rail-tip-mark is-stop" aria-hidden="true"></i><span class="poi-tip-text"><strong>${esc(title)}</strong><small>${esc(where)}</small></span></div>`;
    }
    const names = r.lines.map(i => rail.lines[i]).filter(Boolean).map(l => (en ? l.nameEn || l.name : l.name));
    const status = r.s === 1 ? L('กำลังก่อสร้าง', 'Under construction') : r.s === 2 ? L('สถานะยังยืนยันไม่ได้', 'Status not confirmed') : '';
    const small = [names.join(' · '), status].filter(Boolean).join(' · ');
    const link = linkWords(r, rail, en);
    return `<div class="poi-tip-row rail-tip-row"><i class="rail-tip-mark${r.s ? ' is-hollow' : ''}" aria-hidden="true"></i><span class="poi-tip-text"><strong>${esc(title)}</strong>${small ? `<small>${esc(small)}</small>` : ''}${link ? `<small class="rail-tip-link">${esc(link)}</small>` : ''}</span></div>`;
  }).join('');
}

/** “เชื่อมกับ …” for a tip row: the other stations of its interchange group with their lines (none outside a group). */
function linkWords(row, rail, en) {
  const groups = new Set(row.ids.map(i => rail.linkOf?.get(i)).filter(g => g != null));
  const others = [], seen = new Set();
  for (const g of groups) {
    for (const i of rail.links[g][1]) {
      const st = rail.stations?.[i];
      if (!st || st[2] === row.name) continue;
      const lines = (st[4] || []).map(l => rail.lines[l]).filter(Boolean).map(l => (en ? l.nameEn || l.name : l.name)).join(', ');
      const words = `${en ? st[3] || st[2] : st[2]}${lines ? ` (${lines})` : ''}`;
      if (!seen.has(words)) { seen.add(words); others.push(words); }
    }
  }
  if (!others.length) return '';
  return en ? `Connects with ${others.join(' · ')} on the network map` : `เชื่อมกับ ${others.join(' · ')} ตามผังเครือข่าย`;
}

/** A small square for the national stops, drawn per theme (pixel ratio 2). */
function stopImage(ink, halo) {
  if (typeof document === 'undefined') return null;
  const size = 22, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return null;
  g.beginPath(); g.rect(5, 5, 12, 12);
  g.lineWidth = 4; g.strokeStyle = halo; g.stroke();
  g.fillStyle = ink; g.fill();
  return g.getImageData(0, 0, size, size);
}

/**
 * Draw the rail context on a loaded style. `basemapSource`: the basemap's vector source (its railway lines);
 * `beforeGround`: the first 3D building layer (lines and dots go under it); `beforeLabels`: the first basemap label
 * layer (squares and names go under it). Returns {hit(point) → items under a screen point, dispose()}.
 */
export function installRailLayers(map, rail, {lang = 'th', basemapSource = 'openmaptiles', beforeGround, beforeLabels, attribution = ''} = {}) {
  const ink = cssVar('--text-muted', '#7B877D');
  const ground = cssVar('--basemap-ground', '#EEF1EE');
  const labelInk = cssVar('--basemap-label-quiet', '#7B877D');
  const halo = cssVar('--basemap-halo', '#F6F7F3');
  const under = beforeGround && map.getLayer(beforeGround) ? beforeGround : beforeLabels && map.getLayer(beforeLabels) ? beforeLabels : undefined;
  const above = beforeLabels && map.getLayer(beforeLabels) ? beforeLabels : undefined;
  const hidden = HIDDEN_BASEMAP.filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
  for (const id of hidden) map.setLayoutProperty(id, 'visibility', 'none');

  map.addSource(SRC.lines, {type: 'geojson', data: rail.geo, maxzoom: GEOJSON_MAXZOOM, ...(attribution ? {attribution} : {})});
  map.addSource(SRC.points, {type: 'geojson', data: rail.points, maxzoom: GEOJSON_MAXZOOM});
  // Names get their own source: a tile whose label font fails drops every layer of its source (the Transit demo's rule).
  map.addSource(SRC.names, {type: 'geojson', data: rail.points, maxzoom: GEOJSON_MAXZOOM});
  const img = !map.hasImage?.(STOP_ICON) ? stopImage(ink, halo) : null;
  if (img) map.addImage(STOP_ICON, img, {pixelRatio: 2});

  const width = k => ['interpolate', ['exponential', 1.4], ['zoom'], RAIL_MIN_ZOOM, 1 * k, 12, 1.6 * k, 15, 2.2 * k, 18, 3.2 * k];
  const casingWidth = ['interpolate', ['exponential', 1.4], ['zoom'], RAIL_MIN_ZOOM, 3, 12, 3.6, 15, 4.2, 18, 5.2];
  if (map.getSource(basemapSource)) {
    map.addLayer({id: RAIL_LAYERS.osm, type: 'line', source: basemapSource, 'source-layer': 'transportation', minzoom: RAIL_MIN_ZOOM,
      filter: ['all', ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false], ['==', ['get', 'class'], 'rail'],
        ['!', ['has', 'service']], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: {'line-join': 'round'},
      paint: {'line-color': ink, 'line-width': ['interpolate', ['linear'], ['zoom'], RAIL_MIN_ZOOM, 0.6, 12, 0.9, 15, 1.3, 18, 2]}}, under);
  }
  map.addLayer({id: RAIL_LAYERS.casing, type: 'line', source: SRC.lines, minzoom: RAIL_MIN_ZOOM, filter: ['==', ['get', 's'], 0],
    layout: {'line-cap': 'round', 'line-join': 'round'}, paint: {'line-color': ground, 'line-width': casingWidth}}, under);
  map.addLayer({id: RAIL_LAYERS.build, type: 'line', source: SRC.lines, minzoom: RAIL_MIN_ZOOM, filter: ['!=', ['get', 's'], 0],
    layout: {'line-cap': 'butt', 'line-join': 'round'}, paint: {'line-color': ink, 'line-width': width(0.8), 'line-dasharray': [2, 1.6]}}, under);
  map.addLayer({id: RAIL_LAYERS.line, type: 'line', source: SRC.lines, minzoom: RAIL_MIN_ZOOM, filter: ['==', ['get', 's'], 0],
    layout: {'line-cap': 'round', 'line-join': 'round'}, paint: {'line-color': ink, 'line-width': width(1)}}, under);
  const open = ['==', ['get', 's'], 0];
  map.addLayer({id: RAIL_LAYERS.station, type: 'circle', source: SRC.points, minzoom: STATION_MIN_ZOOM, filter: ['==', ['get', 'k'], 'station'],
    paint: {'circle-radius': ['interpolate', ['linear'], ['zoom'], STATION_MIN_ZOOM, 1.8, 13, 2.6, 15, 3.4, 18, 4.6],
      'circle-color': ['case', open, ink, ground], 'circle-stroke-color': ['case', open, ground, ink],
      'circle-stroke-width': ['case', open, 1, 1.3], 'circle-pitch-alignment': 'viewport'}}, under);
  map.addLayer({id: RAIL_LAYERS.stop, type: 'symbol', source: SRC.points, minzoom: RAIL_MIN_ZOOM, filter: ['==', ['get', 'k'], 'stop'],
    layout: {'icon-image': STOP_ICON, 'icon-size': ['interpolate', ['linear'], ['zoom'], RAIL_MIN_ZOOM, 0.55, 12, 0.75, 16, 1],
      'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-pitch-alignment': 'viewport'}}, above);
  const label = en => ['get', en ? 'nameEn' : 'name'];
  const text = (minzoom, kind, id) => map.addLayer({id, type: 'symbol', source: SRC.names, minzoom, filter: ['==', ['get', 'k'], kind],
    layout: {'text-field': label(lang === 'en'), 'text-font': FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], minzoom, 10.5, 17, 12],
      'text-anchor': 'top', 'text-offset': [0, 0.8], 'text-max-width': 8, 'text-padding': 2},
    paint: {'text-color': labelInk, 'text-halo-color': halo, 'text-halo-width': 1.2}}, above);
  text(NAME_MIN_ZOOM, 'station', RAIL_LAYERS.name);
  text(STOP_NAME_MIN_ZOOM, 'stop', RAIL_LAYERS.stopName);

  /** Stations and stops within HIT px of a screen point, nearest first: {k, name, nameEn, lines: [index], s, area}. */
  function hit(point) {
    const layers = [RAIL_LAYERS.station, RAIL_LAYERS.stop].filter(id => map.getLayer(id));
    if (!layers.length) return [];
    const found = map.queryRenderedFeatures([[point.x - HIT, point.y - HIT], [point.x + HIT, point.y + HIT]], {layers});
    const seen = new Set(), out = [];
    for (const f of found) {
      const p = f.properties, key = `${p.k}:${p.i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const at = map.project(f.geometry.coordinates), d = Math.hypot(at.x - point.x, at.y - point.y);
      if (d > HIT) continue;
      out.push({k: p.k, i: Number(p.i), name: p.name, nameEn: p.nameEn, lines: String(p.lines || '').split(',').filter(Boolean).map(Number), s: Number(p.s) || 0, area: p.area || '', d});
    }
    return out.sort((a, b) => a.d - b.d);
  }
  function dispose() {
    for (const id of Object.values(RAIL_LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of Object.values(SRC)) if (map.getSource(id)) map.removeSource(id);
    for (const id of hidden) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
  }
  return {hit, dispose, layerIds: RAIL_LAYERS};
}
