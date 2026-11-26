/**
 * Map helpers shared by the layers of this page, and the HTML area labels (the province and neighbourhood chips).
 */
import {logoWidth} from './logos.js';
/**
 * maxzoom of every GeoJSON source the page adds. MapLibre 5.6.2 throws in SourceCache._updateRetainedTiles
 * (“reading 'key'”) when a pitched camera sits between maxzoom − 1 and maxzoom of a GeoJSON source and a near
 * tile of the level-of-detail cover reaches maxzoom before it has data (CityMETER · Shopping centers, seen
 * 2026-10-25 with the two-point camera at zoom 17.7 and the default maxzoom 18). Under the eye preset the near
 * tiles of the cover sit up to about half a level above the camera (calculateTileZoom), so every building camera
 * zoom (≤ js/shell/camera.js#BUILDING_MAX_ZOOM, 21) stays two levels below 24 — the most geojson-vt allows.
 */
export const GEOJSON_MAXZOOM = 24;
/** Lowest zoom of the province view (the country fit never goes below 4). */
export const PROVINCE_VIEW_MIN_ZOOM = 4;
/** From this zoom the map panel reads `is-detail-zoom` (labels and pins take the site scale). */
export const DETAIL_ZOOM = 10.5;

/** First basemap line layer id, so data fills stay under roads and labels. */
export function firstLineLayerId(map) {
  const layers = map.getStyle()?.layers || [];
  return (layers.find(l => l.type === 'line') || layers.find(l => l.type === 'symbol'))?.id;
}

export function featureBounds(feature, LngLatBounds) {
  const b = new LngLatBounds();
  const walk = v => { if (typeof v[0] === 'number') b.extend(v); else v.forEach(walk); };
  walk(feature.geometry.coordinates);
  return b;
}

/**
 * HTML labels (ink chips: name + value badge), collision-managed against each
 * other and the map chrome. Used for เขต/อำเภอ (a bounded set: the focus, the
 * selection and the frames with the most branches in view) and for the province frames.
 */
export function installAreaLabels(map, container, {onSelect, reservedBottom = () => 0, className = 'area-label', hostId = 'area-labels', hostLabel = 'พื้นที่บนแผนที่', minZoom = 0, maxZoom = Infinity, verb = 'กดเพื่อสำรวจ', detailZoomClass = true, maxLabels = 40, avoid = ''} = {}) {
  const host = document.createElement('div');
  host.id = hostId;
  host.className = 'area-labels';
  host.setAttribute('aria-label', hostLabel);
  container.append(host);
  let labels = [], frame = 0;
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  function layout() {
    const width = container.clientWidth, height = container.clientHeight - reservedBottom();
    const panel = container.closest('.map-panel'), rect = container.getBoundingClientRect();
    // `avoid`: chips of another label host this one must not cover (province chips keep clear of district chips).
    const chrome = [...panel.querySelectorAll(`.map-toolbar, .map-legend, .map-status, .map-aha, .maplibregl-ctrl-top-right${avoid ? `, ${avoid}` : ''}`)]
      .filter(e => e.offsetWidth && e.offsetHeight)
      .map(e => { const b = e.getBoundingClientRect(); return {left: b.left - rect.left - 4, right: b.right - rect.left + 4, top: b.top - rect.top - 4, bottom: b.bottom - rect.top + 4}; });
    const placed = [];
    const zoom = map.getZoom();
    if (detailZoomClass) panel.classList.toggle('is-detail-zoom', zoom >= DETAIL_ZOOM);
    const inWindow = zoom >= minZoom && zoom < maxZoom;
    let shown = 0;
    for (const e of labels) {
      const p = map.project(e.center);
      e.button.hidden = !(e.visible && inWindow && shown < maxLabels && p.x > 0 && p.x < width && p.y > 48 && p.y < height);
      if (e.button.hidden) continue;
      // A chip's size never changes after it is built: measure once (no forced layout on every frame of a move).
      if (!e.size) e.size = {w: e.button.offsetWidth, h: e.button.offsetHeight};
      const {w, h} = e.size;
      let position = null;
      for (const [dx, dy] of [[0, 0], [0, -26], [0, 26], [-36, 0], [36, 0]]) {
        const x = p.x + dx, y = p.y + dy;
        const box = {left: x - w / 2 - 4, right: x + w / 2 + 4, top: y - h / 2 - 3, bottom: y + h / 2 + 3};
        if (box.left < 4 || box.right > width - 4 || box.top < 48 || box.bottom > height || placed.some(b => overlaps(box, b)) || chrome.some(b => overlaps(box, b))) continue;
        position = {x, y, box};
        break;
      }
      e.button.hidden = !position;
      if (position) { e.button.style.left = `${position.x}px`; e.button.style.top = `${position.y}px`; placed.push(position.box); shown++; }
    }
  }
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layout); };

  /** items: [{id, name, value, title, state, quiet, selected, swatch?, center:[lng,lat]}] in priority order. */
  function update(items, {visible = true} = {}) {
    host.replaceChildren();
    labels = [];
    for (const a of items) {
      if (!Array.isArray(a.center)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `area-label ${className} is-${a.state || 'measured'}${a.selected ? ' is-selected' : ''}${a.quiet ? ' is-quiet' : ''}`;
      button.innerHTML = '<span class="label-name"></span><span class="label-count data-number" aria-hidden="true"></span>';
      button.querySelector('.label-name').textContent = a.name;
      button.querySelector('.label-count').textContent = a.value;
      button.setAttribute('aria-label', `${a.title} · ${verb}`);
      button.title = a.title;
      button.setAttribute('aria-pressed', String(Boolean(a.selected)));
      if (a.swatch) button.style.setProperty('--label-swatch', a.swatch);
      button.onclick = () => onSelect?.(a.id);
      host.append(button);
      labels.push({button, center: a.center, visible});
    }
    schedule();
  }
  map.on('move', schedule);
  map.on('resize', schedule);
  return {update, layout: schedule, dispose() { cancelAnimationFrame(frame); map.off('move', schedule); map.off('resize', schedule); host.remove(); }};
}

/**
 * Names beside the chosen set's pins (0.1.3): HTML buttons (Thai shapes correctly, and keyboard reachable), one per
 * pin, beside it to the right — else left, above or below — never over another name, a neighbourhood chip or the map
 * chrome; a name that finds no room waits for a closer zoom. A name opens the same card as its pin.
 * items: [{id, name, title, center: [lng, lat]}] in priority order.
 */
export function installRecordLabels(map, container, {onSelect, reservedBottom = () => 0, minZoom = 13.5, maxLabels = 60, avoid = '', gap = 11, pinRadius = () => 10} = {}) {
  const host = document.createElement('div');
  host.id = 'record-labels';
  host.className = 'record-labels';
  container.append(host);
  let labels = [], frame = 0;
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  function layout() {
    const width = container.clientWidth, height = container.clientHeight - reservedBottom();
    const panel = container.closest('.map-panel'), rect = container.getBoundingClientRect();
    const boxOf = e => { const b = e.getBoundingClientRect(); return {left: b.left - rect.left - 3, right: b.right - rect.left + 3, top: b.top - rect.top - 3, bottom: b.bottom - rect.top + 3}; };
    const chrome = [...panel.querySelectorAll(`.map-toolbar, .map-legend, .map-status, .map-aha, .focus-bar, .maplibregl-ctrl-top-right, .maplibregl-popup${avoid ? `, ${avoid}` : ''}`)]
      .filter(e => e.offsetWidth && e.offsetHeight).map(boxOf);
    const show = map.getZoom() >= minZoom;
    // every pin of the set stays in sight: a name never covers one (its own sits beside it)
    const r = pinRadius();
    const pins = labels.map(e => { const p = map.project(e.center); return {left: p.x - r, right: p.x + r, top: p.y - r, bottom: p.y + r}; });
    const placed = [];
    let shown = 0;
    labels.forEach((e, k) => {
      e.button.hidden = true;
      if (!show || shown >= maxLabels) return;
      const p = map.project(e.center);
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) return;
      e.button.hidden = false;
      if (!e.size) e.size = {w: e.button.offsetWidth, h: e.button.offsetHeight};
      const {w, h} = e.size;
      let position = null;
      for (const [x, y] of [[p.x + gap, p.y - h / 2], [p.x - gap - w, p.y - h / 2], [p.x - w / 2, p.y - gap - h], [p.x - w / 2, p.y + gap]]) {
        const box = {left: x - 2, right: x + w + 2, top: y - 1, bottom: y + h + 1};
        if (box.left < 4 || box.right > width - 4 || box.top < 4 || box.bottom > height || placed.some(b => overlaps(box, b)) || chrome.some(b => overlaps(box, b))
          || pins.some((b, j) => j !== k && overlaps(box, b))) continue;
        position = {x, y, box};
        break;
      }
      e.button.hidden = !position;
      if (!position) return;
      e.button.style.left = `${position.x}px`;
      e.button.style.top = `${position.y}px`;
      placed.push(position.box);
      shown++;
    });
  }
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layout); };

  function update(items = []) {
    host.replaceChildren();
    labels = [];
    for (const a of items) {
      if (!Array.isArray(a.center)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'record-label';
      button.setAttribute('translate', 'no');
      if (a.logo) {
        // (0.5.1) the record's logo on its plate before the name, as Shopping Center names its venues; decorative
        button.classList.add('has-logo');
        const plate = document.createElement('span'), img = document.createElement('img'), text = document.createElement('span');
        plate.className = 'logo-plate label-logo';
        plate.style.background = a.logo.plate;
        Object.assign(img, {src: a.logo.file, alt: '', width: logoWidth(a.logo, 14), height: 14, decoding: 'async'});
        img.style.height = '14px';
        plate.append(img);
        text.className = 'label-text';
        text.textContent = a.name;
        button.append(plate, text);
      } else button.textContent = a.name;
      button.title = a.title || a.name;
      button.hidden = true;
      button.onclick = () => onSelect?.(a.id);
      host.append(button);
      labels.push({button, center: a.center});
    }
    schedule();
  }
  map.on('move', schedule);
  map.on('resize', schedule);
  return {update, layout: schedule, dispose() { cancelAnimationFrame(frame); map.off('move', schedule); map.off('resize', schedule); host.remove(); }};
}
