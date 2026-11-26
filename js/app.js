/**
 * CityMETER · Commercial District — application orchestration (the CityMETER 3D demo family code base, through CityMETER ·
 * University 0.1.x, montri-th/university).
 *
 * One grain per dataset, never added across datasets (DATA_METHOD.md §3): a neighbourhood holds, for each of the 16
 * CityMETER demo datasets, the dataset's located records whose point lies inside its outline. Scopes:
 *   rows  — the neighbourhoods after the province (at) and the search: the panel, the table, the ramp of the lens.
 *   every other neighbourhood stays on the map as a quiet outline / pin (its data colour is never shown paler).
 * Readings of the map (the legend's switch, `m`): จุดเด่น (default — the pillar of each neighbourhood's first
 * highlight, LDS categorical series + shape) or one dataset (density per km², LDS density.area, all 41 samples).
 *
 * Panel views: overview (Thailand or a province) · neighbourhood. The compare tray (bottom of the map) holds up to four
 * neighbourhoods side by side; the table (รายชื่อ) is the reading without the map.
 * Map clicks: a record's pin (0.1.3) → its card; a neighbourhood's pin or outline → its view; elsewhere below the
 * neighbourhood zooms → the province. The open neighbourhood's records (js/records.js): the dataset bar on the map picks
 * one set (its pins larger with names, the others quiet dots), a pointer over a pin names it, a click opens its card.
 * URL state (own names, inside): province · search · neighborhood · show · metric · compare · view3d — written in the
 * shared grammar at · f.search · f.neighborhood · f.show · m · cmp · v3d by citymeter-shell (js/shell/url.js); opening a
 * province or a neighbourhood adds a browser history entry.
 */
import {registerDataNames} from './lang.js';
import {provinces as provinceList, provinceByCode, provinceCodeFrom, provinceName, setProvinces, decodeData, scopeRows, scopePending, KINDS, kindMatch, cell, rowsBounds, dsName, dsUnit, dsUnitN, num, PILLARS, PILLAR_SERIES} from './model.js';
import {buildOverview, buildNeighborhood, buildCompare} from './profile.js';
import {decodeAround, aroundDistance, aroundMatches} from './around.js';
import {renderOverview, renderNeighborhood, renderCompare, renderFilterChips, tableHeadHTML, tableRowHTML, esc, L, dens, sharePct, thaiDate} from './panel.js';
import {loadMapLibrary} from './shell/vendors.js';
import {installAreaLabels, installRecordLabels} from './map-layers.js';
import {installNeighborhoodLayers, pinCollection, poiCollection, pinScale, framePoints, OUTLINE_MIN_ZOOM, POI_MIN_ZOOM, PIN, PIN_CHOSEN, FIT_MAX_ZOOM} from './layers.js';
import {CONDO, ALL, resolveChosen, decodeRecords, condoDataset, decodeCondo, cellsIn, growBox, spotsOf, seriesOfDs, barSets, barHTML, labelItems, tipHTML, detailHTML, listHTML, panelListHTML, recordName} from './records.js';
import {provinceLocator} from './provinces.js';
import {buildMapStyle, basemapPalette, TILEJSON_URL, MASSING_BEFORE} from './shell/map-style.js';
import {installMassing, outerRings, FOCUS_MIN_ZOOM} from './massing.js';
import {decodeRail, installRailLayers, railTipHTML} from './rail.js';
import {ringsBox, cameraSquare} from './regions.js';
import {createBuildingUnitStore, cmTileUrl, CM_ATTRIBUTION} from './shell/building-units.js';
import {presetFor, applyPreset, fitPitched, fitBuilding, CAMERA} from './shell/camera.js';
import {guardRetainedTiles, guardElevationFreeze, mapBudget, budgetPixelRatio, watchContext} from './shell/maplibre-guard.js';
import {buildBreadcrumb, renderBreadcrumb, breadcrumbText, DATASET} from './breadcrumb.js';
import {buildDensityRamp, classify, rampLegendHTML} from './scales.js';
import {cueMarkup} from './cues.js';
import {createCodec, createNavigator} from './shell/url.js';
import {pageTitle} from './shell/title.js';
import {LANG} from './shell/i18n.js';

const $ = id => document.getElementById(id);
/** Release tag of this module (index.html import map) — also versions the data files fetched later. */
const RELEASE = (() => { try { return new URL(import.meta.url).searchParams.get('v') || ''; } catch { return ''; } })();
const THEME_KEY = 'citymeter-commercialdistrict-theme';
const COLLATOR = new Intl.Collator('th');
const COMPARE_MAX = 4;
const PAGE_SIZE = 50;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobilePortrait = () => matchMedia('(max-width: 760px) and (orientation: portrait)').matches;
const animate = () => !reduced();
const cssVar = (name, fallback = '') => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const theme = () => document.documentElement.dataset.theme;
const announce = text => { $('announcement').textContent = text; };

const state = {
  model: null, provincesGeo: null, outlines: null, outlineById: new Map(), locate: null,
  province: '', search: '', nb: '', lens: '', compare: [], view3d: true, page: 0,
  // records of the open neighbourhood (0.1.3): shards by neighbourhood id, the pins drawn (spots), the reader's pick
  // (`show`: a dataset id, 'condo', 'all', or '' = the default of resolveChosen), the condominium cells, the card and the tip
  records: new Map(), recordsLoading: new Set(), spots: [], focus: '', recordsOpen: false,
  condoDs: null, condoIndex: new Set(), condoCells: new Map(), condoSpots: [], condoNear: new Map(),
  poiPopup: null, poiCard: null, poiTip: null, poiTipKey: '', recordLabels: null,
  rows: [], pending: [], overview: null, ramp: null, fills: new Map(),
  // kind of neighbourhood shown (0.2.0, `f.kind`): '' every one · registry · lodging · screen (0.5.0) · added (js/model.js KINDS)
  kind: '',
  // «ขอบเดินถึง» (0.4.0, `f.around`): data/around.json decoded (null until it arrives or if it did not), the reading
  // (in · 400 · 800: the column the table stresses and the line the map draws) and the lines, one file per neighbourhood
  around: null, distance: 'in', rings: new Map(), ringsLoading: new Set(), frameOnRing: '',
  map: null, loaded: false, mapTheme: '', initialCameraDone: false, tileTemplate: '', budget: null,
  layers: null, provinceLabels: null, nbLabels: null, massing: null, buildingUnits: null,
  readerPitch: false, readerMovedAt: 0,
};

/* ---------- address (citymeter-shell, js/shell/url.js) ---------- */
const nav = createNavigator(createCodec({
  dataset: DATASET, levels: ['P'], place: {}, items: {}, filters: ['search', 'neighborhood', 'show', 'kind', 'around'], levelFilters: ['neighborhood'],
  rename: {metric: 'm', compare: 'cmp', view3d: 'v3d'},
}), {onPop: restoreFromHistory});

function saveURL() {
  const p = new URLSearchParams();
  if (state.province) p.set('province', state.province);
  if (state.search) p.set('search', state.search);
  if (state.kind) p.set('kind', state.kind);
  if (state.nb) p.set('neighborhood', state.nb);
  if (state.focus) p.set('show', state.focus);
  // the reading of «ขอบเดินถึง» belongs to an open neighbourhood; inside (the default) is never written
  if (state.nb && state.distance !== 'in') p.set('around', state.distance);
  if (state.lens) p.set('metric', state.lens);
  if (state.compare.length) p.set('compare', state.compare.join(','));
  if (!state.view3d) p.set('view3d', '0');
  nav.commit(p);
}

/* ---------- helpers ---------- */
const rowById = id => (id && state.model?.byId.get(id)) || null;
/** The words of a group filter (0.2.0; outline words 0.2.1, when the registry admitted the lodging areas). */
const kindLabel = kind => ({registry: L('ขอบตามหลักเกณฑ์ทะเบียน', 'Outlines by the registry\'s rules'), lodging: L('ขอบร่างจากผลคัดที่พัก', 'Draft outlines from the lodging screen'),
  screen: L('ขอบร่างจากผลคัดย่านการค้า', 'Draft outlines from the commercial screen'), added: L('ใหม่ในรุ่นนี้', 'New in this release')}[kind] || '');
const lensDs = () => (state.lens && state.model?.dsById.get(state.lens)) || null;
const openRow = () => rowById(state.nb);
const compareRows = () => state.compare.map(rowById).filter(Boolean);
/** The ramp colour of a row under the lens ('' without a lens or a value). */
const fillOfRow = r => state.fills.get(r.id)?.fill || '';
const bottomSpace = () => ($('insights')?.getBoundingClientRect().height ?? 0) + 12;
const labelBottomSpace = () => { const panel = document.querySelector('.map-panel'); return bottomSpace() + (panel ? parseFloat(getComputedStyle(panel).getPropertyValue('--attrib-height')) || 0 : 0); };
const cameraPreset = () => presetFor({view3d: state.view3d, mode: state.nb ? 'detail' : 'overview', twoPoint: false});

/* ---------- theme ---------- */
function applyTheme() {
  const value = $('theme').value;
  const next = value === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value;
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, value); } catch {}
  if (state.map && next !== state.mapTheme) {
    state.loaded = false;
    disposeSpatial();
    state.mapTheme = next;
    state.map.setStyle(buildMapStyle(next), {diff: false});
  }
  if (state.model) { computeFills(); renderLegend(); renderPanel(); }
}

function disposeSpatial() {
  closePoiCard(); hideTip();
  for (const k of ['massing', 'layers']) { try { state[k]?.dispose(); } catch (e) { console.warn('dispose', k, e); } state[k] = null; }
}

/* ---------- selection ---------- */
function refreshScope() {
  const key = `${state.province}|${state.search}|${state.kind}`;
  if (key === refreshScope.key) return;
  refreshScope.key = key;
  state.rows = scopeRows(state.model, {province: state.province, search: state.search, kind: state.kind});
  state.pending = scopePending(state.model, {province: state.province, search: state.search, kind: state.kind});
  state.page = 0;
  renderTable.stale = true;
}

/** Fill and pin of every neighbourhood under the current reading (js/layers.js). */
function computeFills() {
  const model = state.model, ds = lensDs();
  const inScope = new Set(state.rows.map(r => r.id));
  const fills = new Map();
  if (ds) {
    const values = state.rows.map(r => cell(r, ds)).filter(c => c.state === 'measured').map(c => c.density);
    state.ramp = buildDensityRamp(values, {unit: `${dsUnit(ds)} ${L('ต่อ ตร.กม.', 'per km²')}`});
    for (const r of model.rows) {
      const quiet = !inScope.has(r.id), c = cell(r, ds);
      if (c.state === 'out_of_scope') fills.set(r.id, {fill: null, quiet, icon: quiet ? 'pin:quiet' : 'pin:none'});
      else if (c.state === 'measured_zero') fills.set(r.id, {fill: state.ramp.zero.fill, zero: true, quiet, icon: quiet ? 'pin:quiet' : 'pin:zero'});
      else {
        const k = classify(c.density, state.ramp);
        fills.set(r.id, {fill: k.fill, quiet, icon: quiet ? 'pin:quiet' : `pin:l${k.index}`, sort: k.index});
      }
    }
  } else {
    state.ramp = null;
    for (const r of model.rows) {
      const quiet = !inScope.has(r.id), series = r.pillar ? PILLAR_SERIES[r.pillar] : 0;
      fills.set(r.id, {fill: series ? cssVar(`--series-${series}-fill`) : null, series, quiet, icon: quiet ? 'pin:quiet' : series ? `pin:s${series}` : 'pin:none', sort: series ? 10 + r.strong : 0});
    }
  }
  if (state.nb && fills.has(state.nb)) fills.set(state.nb, {...fills.get(state.nb), open: true});
  state.fills = fills;
}

function update({fit = false} = {}) {
  refreshScope();
  if (state.nb && !openRow()) state.nb = '';
  state.compare = state.compare.filter(id => rowById(id)).slice(0, COMPARE_MAX);
  if (!state.around && state.distance !== 'in') state.distance = 'in';
  computeFills();
  $('search').value = state.search;
  $('province').value = state.province;
  $('kind').value = state.kind;
  $('lens').value = state.lens;
  renderFilterSummary();
  renderPanel();
  renderLegend();
  renderCompareTray();
  if (!$('results').hidden) renderTable();
  updateSpatialLayers();
  saveURL();
  if (fit) fitMap();
}

/* ---------- breadcrumb ---------- */
function renderCrumbs() {
  const r = openRow();
  const crumbs = buildBreadcrumb({province: state.province, zone: r ? {id: r.id, name: r.name, province: r.province} : null});
  $('crumbs').innerHTML = renderBreadcrumb(crumbs);
  // Tab title: what the view shows, then the product, ≤ 60 characters (LDS FAVICON-01, js/shell/title.js).
  const ds = lensDs();
  const place = state.province ? provinceName(state.province) : L('ประเทศไทย', 'Thailand');
  document.title = pageTitle(r ? L(`ย่าน${r.name}`, r.name) : ds ? `${dsName(ds)} ${L('ในย่าน', 'in neighbourhoods,')} ${place}` : L(`ย่าน${place}`, `Neighbourhoods · ${place}`));
  return crumbs;
}

/* ---------- panel ---------- */
const panelCtx = () => ({meta: state.model.meta, datasetCount: state.model.datasets.length});

function renderPanel() {
  const view = $('panel-view');
  renderCrumbs();
  const r = openRow();
  let html;
  if (r) {
    html = renderNeighborhood(buildNeighborhood(state.model, r), state.model, {inCompare: state.compare.includes(r.id), compareFull: state.compare.length >= COMPARE_MAX,
      fillOf: ds => (state.lens === ds.id ? fillOfRow(r) : ''), ctx: panelCtx(), recordsHTML: panelListHTML(state.records.get(r.id) ?? null, {open: state.recordsOpen}),
      around: state.around, distance: state.distance});
    $('map-aha').hidden = true;
  } else {
    state.overview = buildOverview(state.model, {rows: state.rows, province: state.province, ds: lensDs(), pending: state.pending});
    state.overview.searching = Boolean(state.search || state.kind);
    html = renderOverview(state.overview, state.model, {fillOf: fillOfRow, ctx: panelCtx()});
    renderMapAha(state.overview);
  }
  view.innerHTML = html;
  const mode = r ? 'neighborhood' : 'overview';
  view.dataset.mode = mode;
  $('panel').dataset.mode = mode;
  $('sheet-back').hidden = !r && !state.province;
  // (0.4.0, D-5) a neighbourhood: the dataset heading, the search and the filters step aside (kept for screen
  // readers, styles.css) and the back button sits in the breadcrumb's row, as Shopping Center's venue panel
  $('panel-back').hidden = !r;
  const key = `${mode}:${state.nb}:${state.province}:${state.lens}`;
  if (key !== renderPanel.lastKey) { $('panel').scrollTop = 0; setSheet(restSheet()); state.readerPitch = false; state.readerMovedAt = 0; }
  renderPanel.lastKey = key;
}

/** The phone's first finding on the map (the dock): the overview's Aha in one line. */
function renderMapAha(o) {
  const el = $('map-aha');
  if (!o?.count || !(o.lens || o.lead)) { el.hidden = true; return; }
  el.hidden = $('panel').classList.contains('is-open');
  const crumb = `<p class="map-aha-crumb">${esc(breadcrumbText(buildBreadcrumb({province: state.province})))}</p>`;
  const where = state.province ? L(`ใน${provinceName(state.province)}`, ` in ${provinceName(state.province)}`) : L('ทั้งประเทศ', ' nationwide');
  if (o.lens) {
    const ds = o.lens.ds, best = o.lens.ranking[0];
    el.innerHTML = `<div>${crumb}<h2><span class="nowrap">${sharePct(o.lens.share)}</span> ${esc(L(`ของ${ds.nameTh}ที่มีพิกัด${where} อยู่ในย่าน`, `of ${dsName(ds)} records with a location${where} lie in neighbourhoods`))}</h2>${best ? `<p>${esc(L('แน่นที่สุด', 'Densest'))}: <span>${esc(best.row.name)}</span></p>` : ''}</div><button type="button" class="btn" data-action="open-sheet">${L('ดู', 'View')}</button>`;
    return;
  }
  el.innerHTML = `<div>${crumb}<h2><span class="nowrap">${sharePct(o.lead.share)}</span> ${esc(L(`ของ${o.lead.ds.nameTh}ที่มีพิกัด${where} อยู่ในย่าน ${num(o.count)} แห่ง`, `of ${dsName(o.lead.ds)} records with a location${where} lie in ${num(o.count)} neighbourhoods`))}</h2><p>${esc(L(`ย่านกินพื้นที่ ${sharePct(o.areaShare)}`, `covering ${sharePct(o.areaShare)} of the area`))}</p></div><button type="button" class="btn" data-action="open-sheet">${L('ดู', 'View')}</button>`;
}

/** Search and lens as chips under the filters (clear one by one). */
function renderFilterSummary() {
  const chips = [];
  if (state.search) chips.push({label: `“${state.search}”`, action: 'clear-search'});
  if (state.kind) chips.push({label: kindLabel(state.kind), action: 'clear-kind'});
  if (state.province) chips.push({label: provinceName(state.province), action: 'leave-province'});
  const ds = lensDs();
  if (ds) chips.push({label: dsName(ds), action: 'clear-lens'});
  $('filter-chips').innerHTML = renderFilterChips(chips);
  const active = [state.province, state.search, state.kind].filter(Boolean).length;
  $('filter-count').textContent = active ? `(${num(active)})` : '';
}

/* ---------- actions ---------- */
function selectNb(id, {fit = true} = {}) {
  const r = rowById(id);
  if (!r) return;
  // A neighbourhood opens on its own highlight (0.1.4): the pick made in another one does not follow.
  if (r.id !== state.nb) state.focus = '';
  state.nb = r.id;
  state.province = r.province;
  // The search found it: it gives way, so the province behind the neighbourhood reads whole (the browser's back button
  // returns to the search, which is in the address of the previous entry).
  state.search = '';
  // On a phone the sheet opens first, so the outline is fitted to the map the sheet leaves free (0.2.3).
  openMobilePanel({frame: false});
  update({fit});
  announce(`${L('ย่าน', 'Neighbourhood')} · ${r.name} · ${provinceName(r.province)}`);
}

function selectProvince(code) {
  const p = provinceByCode(code);
  if (!p) return;
  state.province = p.code; state.nb = '';
  update({fit: true});
  announce(provinceName(p.code));
}

function leaveProvince() {
  state.province = ''; state.nb = '';
  update({fit: true});
}

function goBack() {
  if (state.nb) { state.nb = ''; update({fit: true}); return; }
  if (state.province) leaveProvince();
}

/**
 * The reading of «ขอบเดินถึง» (0.4.0, NL-05): inside, or within 400 m or 800 m around. The table stresses that column,
 * the map draws the line at that distance and frames it whole; inside draws no line and frames the outline.
 */
function setDistance(value) {
  const next = aroundDistance(value);
  if (next === state.distance) return;
  state.distance = next;
  update();
  // the switch was redrawn with the panel: the focus goes back to the button just pressed
  document.querySelector(`#panel-view [data-action="set-around"][data-value="${next}"]`)?.focus({preventScroll: true});
  // one camera move: fitNb frames now when the line is known (or inside), else once it arrives (ensureRing)
  if (state.nb) { const r = openRow(); ensureRing(r); if (state.loaded) fitNb(r); }
  announce(next === 'in' ? L('ในย่าน', 'Inside') : L(`ขอบเดินถึง ${num(+next)} ม. · เส้นตรงจากขอบย่าน ไม่ใช่ระยะเดินจริง`, `Walkable edge ${num(+next)} m · a straight line from the outline, not a walking route`));
}

/** A glance tile goes to its dataset's row of the table and moves the focus there (the row's own button). */
function jumpToAround(dsId) {
  const el = document.getElementById(`around-${dsId}`);
  if (!el) return;
  el.scrollIntoView({block: 'center', behavior: reduced() ? 'auto' : 'smooth'});
  el.focus({preventScroll: true});
}

/** The line of the open neighbourhood at the chosen distance (data/rings/<id>.json, once per neighbourhood). */
function ensureRing(r) {
  if (!r || state.distance === 'in' || state.rings.has(r.id) || state.ringsLoading.has(r.id)) return;
  state.ringsLoading.add(r.id);
  // the open neighbourhood's line is framed when it arrives, unless the reader moves the map meanwhile (movestart)
  if (r.id === state.nb) state.frameOnRing = r.id;
  fetchJSON(`data/rings/${encodeURIComponent(r.id)}.json${V()}`)
    .then(json => { if (json?.id === r.id && json.rings) state.rings.set(r.id, json.rings); else throw new Error('Invalid ring file'); })
    .catch(e => { partial('rings'); console.warn('Surroundings line unavailable', r.id, e); state.rings.set(r.id, null); })
    .finally(() => {
      state.ringsLoading.delete(r.id);
      if (state.nb !== r.id) return;
      if (state.loaded) {
        updateSpatialLayers();
        if (state.frameOnRing === r.id) fitNb(r);
      }
      if (state.frameOnRing === r.id) state.frameOnRing = '';
      renderLegend();
    });
}
/** The ring geometry the map draws now (none inside, without a neighbourhood, or before its file arrives). */
const ringGeometry = () => (state.nb && state.distance !== 'in' ? state.rings.get(state.nb)?.[state.distance] || null : null);

function setLens(id) {
  state.lens = state.model.dsById.has(id) ? id : '';
  // With a neighbourhood open, the set being read is also the set its records show (resolveChosen; the bar follows).
  if (state.nb) state.focus = '';
  update();
  const ds = lensDs();
  announce(ds ? L(`ระบายสีย่านตาม${ds.nameTh}`, `Neighbourhoods coloured by ${dsName(ds)}`) : L('ระบายสีตามจุดเด่น', 'Coloured by highlights'));
}

function compareSet(ids, {open = true} = {}) {
  state.compare = [...new Set(ids)].filter(id => rowById(id)).slice(0, COMPARE_MAX);
  update();
  if (open) openInsights(true, {fit: false});
  if (state.compare.length > 1 && state.loaded && !state.nb) fitRows(compareRows(), {maxZoom: 14});
}

/** The top three of the view: under a lens the densest (ranked), else the most distinctive. */
function compareTop(dsId = '') {
  const ds = dsId ? state.model.dsById.get(dsId) : lensDs();
  const list = ds
    ? buildOverview(state.model, {rows: state.rows, province: state.province, ds}).lens.ranking.map(x => x.row)
    : (state.overview?.multi?.length ? state.overview.multi : [...state.rows].sort((a, b) => b.strong - a.strong));
  compareSet(list.slice(0, 3).map(r => r.id));
}

function onPanelAction(event) {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const {action, id, value} = el.dataset;
  if (el.tagName === 'A' && el.getAttribute('href')) return;
  event.preventDefault();
  if (action === 'select-nb') selectNb(id);
  else if (action === 'select-province' || action === 'crumb-province') { if (action === 'crumb-province' && !state.nb && state.province === id) return; selectProvince(id); }
  else if (action === 'crumb-country' || action === 'leave-province') leaveProvince();
  else if (action === 'crumb-zone') { if (state.nb) fitMap(); }
  else if (action === 'set-lens') { setLens(state.lens === value && el.closest('.share-list') ? '' : value); }
  else if (action === 'set-around') setDistance(value);
  else if (action === 'around-jump') jumpToAround(value);
  else if (action === 'clear-lens') setLens('');
  else if (action === 'clear-search') { state.search = ''; update({fit: true}); }
  else if (action === 'clear-kind') { state.kind = ''; update({fit: true}); }
  else if (action === 'set-kind') { state.kind = KINDS.includes(value) ? value : ''; state.nb = ''; update({fit: true}); announce(state.kind ? kindLabel(state.kind) : L('ทุกย่าน', 'Every neighbourhood')); }
  else if (action === 'cmp-add') compareSet([...state.compare, id]);
  else if (action === 'cmp-remove') compareSet(state.compare.filter(x => x !== id), {open: state.compare.length > 1});
  else if (action === 'cmp-clear') compareSet([], {open: false});
  else if (action === 'cmp-top') compareTop(value);
  else if (action === 'cmp-similar') { const r = rowById(id); if (r) compareSet([r.id, ...buildNeighborhood(state.model, r).similar.map(x => x.row.id)]); }
  else if (action === 'open-table') openTable();
  else if (action === 'open-record') openRecordFromList(+value);
  else if (action === 'open-compare') openInsights(true);
  else if (action === 'open-sheet') openMobilePanel();
  else if (action === 'back') goBack();
}

/* ---------- legend ---------- */
function renderLegend() {
  const ds = lensDs(), steps = $('legend-steps');
  $('legend-title').textContent = ds ? `${dsName(ds)} · ${dsUnit(ds)} ${L('ต่อ ตร.กม.', 'per km²')}` : L('ย่าน · เด่นเรื่องแรก', 'Neighbourhood · first highlight');
  if (ds) {
    const out = state.rows.filter(r => cell(r, ds).state === 'out_of_scope').length;
    const zero = state.rows.some(r => cell(r, ds).state === 'measured_zero');
    steps.innerHTML = state.ramp?.levels.length
      ? `${rampLegendHTML(state.ramp, {zero, zeroTitle: L(`0 ${dsUnit(ds)} ในขอบย่าน`, `0 ${dsUnit(ds)} inside the outline`)})}${out ? `<span class="legend-step legend-out" title="${esc(L('ชุดนี้ไม่มีข้อมูลในจังหวัดของย่าน', 'This dataset has no data in the neighbourhood’s province'))}"><i class="legend-outline" aria-hidden="true"></i>${L('ไม่มีข้อมูล', 'No data')}</span>` : ''}`
      : `<span class="hint">${esc(L(`ไม่มี${ds.nameTh}ในขอบย่าน`, `No ${dsName(ds)} inside the outlines`))}</span>`;
  } else {
    steps.innerHTML = `${PILLARS.map(p => `<span class="legend-cat">${cueMarkup(PILLAR_SERIES[p])}${esc(p)}</span>`).join('')}<span class="legend-cat" title="${esc(L('ยังไม่มีชุดข้อมูลไหนเด่นเกินเกณฑ์', 'No dataset stands out above the threshold'))}">${cueMarkup(8, {className: 'cue-none'})}${L('ยังไม่เด่น', 'None yet')}</span>`;
  }
  spaceTicks(steps);
  $('legend-areas').title = ds
    ? L(`สีย่าน = ${ds.nameTh}ต่อ ตร.กม. ของพื้นที่ขอบย่าน · 41 ระดับตามลำดับค่า สีเข้ม = แน่น`, `Colour = ${dsName(ds)} per km² of the outline area · 41 steps by rank, darker = denser`)
    : L('สีและรูปทรง = หมวดของจุดเด่นแรกของย่าน (Land · Location · Living)', 'Colour and shape = pillar of the neighbourhood’s first highlight (Land · Location · Living)');
  const poiItem = $('legend-poi');
  if (poiItem) poiItem.hidden = !state.nb;
  // (0.4.0) the line of «ขอบเดินถึง», named by its distance, drawn in the key as on the map
  const aroundItem = $('legend-around');
  if (aroundItem) {
    const on = Boolean(ringGeometry());
    aroundItem.hidden = !on;
    if (on) {
      $('legend-around-label').textContent = L(`แนวขอบเดินถึง ${num(+state.distance)} ม.`, `Walkable edge ${num(+state.distance)} m`);
      aroundItem.title = L(`เส้นตรงจากขอบย่าน ${num(+state.distance)} ม. ไม่ใช่ระยะเดินจริง · ตัวเลขอยู่ในตาราง «ขอบเดินถึง» ของแผงข้อมูล`, `Straight line ${num(+state.distance)} m from the outline's edge, not a walking route · the figures are in the panel's table “The walkable edge”`);
    }
  }
  const railItem = $('legend-rail'), rail = state.railData?.meta;
  if (railItem) {
    railItem.hidden = !rail;
    if (rail) {
      const date = rail.asOf ? thaiDate(rail.asOf) : '';
      railItem.title = L(`ระบบราง (บริบท ไม่นับรวมในย่าน): เส้นทึบ = เปิดให้บริการ · เส้นประ = กำลังก่อสร้าง · จุดโปร่ง = สถานีของโครงการที่กำลังก่อสร้าง · เส้นบาง = ทางรถไฟจาก OpenStreetMap · สี่เหลี่ยม = ที่หยุดรถไฟทางไกลที่มีเที่ยวตามตาราง · ${rail.dataset?.th || ''} · ${rail.linesSource || ''} · ข้อมูล ${date} · ${rail.boundary?.th || ''} และที่หยุดรถไฟทางไกล ${num(rail.counts?.srtStops || 0)} จุดทั่วประเทศ`,
        `Rail (context, never counted in a neighbourhood): solid = in service · dashed = under construction · hollow dot = station of a project under construction · thin line = railway from OpenStreetMap · square = conventional rail stop with scheduled trips · ${rail.dataset?.en || ''} · OTP GTFS (CC BY 4.0) and project alignments · data of ${date} · ${rail.boundary?.en || ''}, and ${num(rail.counts?.srtStops || 0)} conventional rail stops nationwide`);
    }
  }
  const panel = document.querySelector('.map-panel');
  panel.classList.toggle('is-3d', state.view3d);
  panel.dataset.reading = ds ? 'lens' : 'highlights';
}

/** Ramp tick labels on the ramp's actual width: a label that would touch the one before it steps aside. */
function spaceTicks(root) {
  for (const ramp of root?.querySelectorAll('.ramp-ticks') || []) {
    const ticks = [...ramp.querySelectorAll('.ramp-tick')];
    ticks.forEach(t => t.classList.remove('is-crowded'));
    if (ticks.length < 3 || !ramp.offsetWidth) continue;
    const shown = [ticks[0]];
    for (const t of ticks.slice(1)) {
      const last = t === ticks.at(-1);
      while (shown.length > 1 && shown.at(-1).getBoundingClientRect().right + 4 > t.getBoundingClientRect().left) {
        if (!last) break;
        shown.pop().classList.add('is-crowded');
      }
      if (shown.at(-1).getBoundingClientRect().right + 4 > t.getBoundingClientRect().left && !last) { t.classList.add('is-crowded'); continue; }
      shown.push(t);
    }
  }
}

/* ---------- compare tray ---------- */
function renderCompareTray() {
  const rows = compareRows();
  $('compare-count').textContent = rows.length ? `${num(rows.length)}/${num(COMPARE_MAX)}` : '';
  $('compare-clear').hidden = !rows.length;
  $('chart-scope').textContent = rows.length ? rows.map(r => r.name).join(' · ') : L('ยังไม่ได้เลือกย่าน', 'No neighbourhood chosen yet');
  $('compare-view').innerHTML = renderCompare(buildCompare(state.model, rows), state.model, {max: COMPARE_MAX});
  state.layers?.setCompare(rows.map(r => r.id));
}

function openInsights(open, {fit = true} = {}) {
  $('insight-content').hidden = !open;
  $('insights').classList.toggle('is-collapsed', !open);
  $('toggle-insights').setAttribute('aria-expanded', String(open));
  $('toggle-insights').textContent = open ? L('ย่อ', 'Collapse') : L('เปิด', 'Open');
  requestAnimationFrame(() => {
    syncBottomPanel();
    // Opened by the reader with two or more neighbourhoods in it: frame them above the tray (0.1.1).
    if (fit && open && state.compare.length > 1 && !state.nb && state.loaded && state.map) fitRows(compareRows(), {maxZoom: 14});
  });
}

function syncBottomPanel() {
  const tray = $('insights');
  if (!tray) return;
  document.documentElement.style.setProperty('--bottom-panel-height', `${tray.getBoundingClientRect().height}px`);
  state.provinceLabels?.layout();
  state.nbLabels?.layout();
}

/* ---------- table ---------- */
function openTable() {
  $('results').hidden = false;
  renderTable();
  closeMobilePanel();
  $('toggle-table').focus();
}

function tableOrder() {
  const ds = lensDs();
  const list = [...state.rows];
  if (ds) return list.sort((a, b) => (b.density[ds.id] ?? -1) - (a.density[ds.id] ?? -1) || COLLATOR.compare(a.name, b.name));
  return list.sort((a, b) => b.strong - a.strong || (b.hl?.length || 0) - (a.hl?.length || 0) || COLLATOR.compare(provinceName(a.province), provinceName(b.province)) || COLLATOR.compare(a.name, b.name));
}

function renderTable() {
  renderTable.stale = false;
  const list = tableOrder(), start = state.page * PAGE_SIZE;
  const ds = lensDs();
  $('results-title').textContent = state.province ? L(`ย่านใน${provinceName(state.province)}`, `Neighbourhoods in ${provinceName(state.province)}`) : L('ย่านทั้งประเทศ', 'Neighbourhoods nationwide');
  $('table-hint').textContent = ds
    ? L(`เรียงตาม${ds.nameTh}ต่อ ตร.กม. · ตัวเลข = จำนวนในขอบย่าน · — = ชุดนี้ไม่มีข้อมูลในจังหวัด`, `Sorted by ${dsName(ds)} per km² · figures = records inside the outline · — = no data in the province`)
    : L('เรียงตามจำนวนจุดเด่น · ตัวเลข = จำนวนในขอบย่าน · — = ชุดนี้ไม่มีข้อมูลในจังหวัด · กดชื่อเพื่อดูย่าน', 'Sorted by highlights · figures = records inside the outline · — = no data in the province · choose a name to open it');
  $('result-head').innerHTML = tableHeadHTML(state.model, state.lens);
  $('result-rows').innerHTML = list.slice(start, start + PAGE_SIZE).map(r => tableRowHTML(r, state.model)).join('')
    || `<tr><td colspan="${4 + state.model.datasets.length}">${L('ไม่พบย่านตามตัวกรอง', 'No neighbourhood matches')}</td></tr>`;
  $('page-label').textContent = list.length ? `${num(start + 1)}–${num(Math.min(start + PAGE_SIZE, list.length))} / ${num(list.length)}` : '0';
  $('prev-page').disabled = state.page === 0;
  $('next-page').disabled = start + PAGE_SIZE >= list.length;
}

/* ---------- map: camera ---------- */
function cameraPadding() {
  const height = $('map').clientHeight, tray = $('insights').getBoundingClientRect().height;
  const edge = Math.min(48, Math.max(12, (height - tray) / 6));
  const mapBox = $('map').getBoundingClientRect(), mapTop = mapBox.top, toolbar = document.querySelector('.map-toolbar').getBoundingClientRect();
  const aha = $('map-aha'), legend = $('map-legend');
  // The comparison open on a wide screen (0.1.1): the tray covers the bottom of the map and the legend floats above it
  // at the left, so the view frames the strip above the tray and right of the legend. Framing above the legend left too
  // thin a strip, and the legend moves up only after the tray has opened (syncBottomPanel).
  if (!$('insight-content').hidden && !mobilePortrait()) {
    const chrome = [aha, legend].filter(el => !el.hidden && el.offsetHeight).map(el => el.getBoundingClientRect().right - mapBox.left);
    return {top: Math.max(edge, toolbar.bottom - mapTop + 12 + barRoom()), left: Math.max(edge, ...chrome.map(x => x + 12)), right: edge, bottom: Math.min(height * 0.7, tray + edge)};
  }
  const chromeTop = !aha.hidden && aha.offsetHeight ? aha.getBoundingClientRect().top : legend.offsetHeight ? legend.getBoundingClientRect().top : null;
  let bottom = chromeTop != null ? height - (chromeTop - mapTop) + 12 : tray + edge;
  if (mobilePortrait() && $('panel').classList.contains('is-open')) bottom = Math.max(bottom, Math.round(sheetHeight()) - (window.innerHeight - height - mapTop) + 8);
  return {top: Math.max(edge, toolbar.bottom - mapTop + 12 + barRoom()), left: edge, right: edge, bottom: Math.min(height * 0.7, bottom)};
}
/**
 * The phone sheet's height at rest (0.2.3). Its max-height eases from the overview's 42 % to a neighbourhood's 34 %
 * (styles.css), and a fit made while that ran framed the view above the taller sheet: the easing of max-height is
 * dropped for the read (it settles at once), the slide of the sheet keeps going.
 */
function sheetHeight() {
  const panel = $('panel');
  panel.style.transitionProperty = 'transform';
  const height = panel.getBoundingClientRect().height;
  panel.style.transitionProperty = '';
  return height;
}
/** Room the dataset bar takes under the toolbar while a neighbourhood is open (0.1.3; kept before its records arrive). */
const barRoom = () => (state.nb ? 48 : 0);

function boundsOf(boxes) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const b of boxes) if (b) { w = Math.min(w, b[0][0]); s = Math.min(s, b[0][1]); e = Math.max(e, b[1][0]); n = Math.max(n, b[1][1]); }
  return Number.isFinite(w) ? new maplibregl.LngLatBounds([w, s], [e, n]) : null;
}
const countryBox = () => [[97.34, 5.61], [105.64, 20.47]];

function fitBox(box, {preset = 'plan', maxZoom = 12, minZoom = 4, instant = false} = {}) {
  const b = boundsOf([box]);
  if (!b || !state.map) return;
  fitPitched(state.map, b, {preset, padding: cameraPadding(), maxZoom, minZoom, animate: animate() && !instant, shift: mobilePortrait() ? -0.08 : null});
}

/** Rows framed flat (a province's neighbourhoods, a comparison), never closer than `maxZoom`. */
function fitRows(rows, {maxZoom = 13.5, instant = false} = {}) {
  const b = rowsBounds(rows);
  if (!b) return;
  fitBox([[b[0], b[1]], [b[2], b[3]]], {maxZoom, minZoom: 4.5, instant});
}

/**
 * A neighbourhood fitted to the free map (0.2.3, js/layers.js#framePoints): its outline with a margin is centred in the
 * map the toolbar, the dataset bar, the legend and the phone's sheet leave free, and fills FIT_FILL of it, in the model
 * preset (plan with 3D off). js/shell/camera.js#fitBuilding pans and zooms until it does (fitPitched kept the centre of
 * the outline's box, which a 60° camera shows low: 262 px were free above the largest outline, 36 px below it). On a
 * phone the outline's own margin replaces the 48 px sides of the map, and there is no floor at the phone's 3D focus
 * zoom any more: an outline wider than that view reads whole, its buildings rise when the reader comes closer.
 */
const FIT_FILL = 0.94;
function fitNb(r, {instant = false} = {}) {
  if (!r || !state.map) return;
  // (0.4.0) a distance chosen and its line not here yet: frame once, when the line arrives (ensureRing), never the
  // outline first and the line after — opening a neighbourhood, the switch and back/forward all come this way
  if (r.id === state.nb && state.distance !== 'in' && !state.rings.has(r.id)) { state.frameOnRing = r.id; ensureRing(r); return; }
  const [w, s, e, n] = r.bbox;
  // (0.4.0) with a distance of «ขอบเดินถึง» chosen, the line at that distance is framed whole (NL-05)
  const ring = r.id === state.nb ? ringGeometry() : null;
  const geometry = ring || state.outlineById?.get(r.id)?.geometry || {type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]]};
  const points = framePoints(geometry, ring ? {margin: 0.04} : {});
  if (!points.length) return;
  const map = state.map, pad = cameraPadding(), c = map.getContainer();
  const side = mobilePortrait() ? 12 : null;
  const box = {left: side ?? pad.left, top: pad.top, right: c.clientWidth - (side ?? pad.right), bottom: c.clientHeight - pad.bottom};
  const preset = state.view3d ? 'model' : 'plan';
  fitBuilding(map, points, {box, preset, bearing: CAMERA[preset].bearing, minZoom: 11, maxZoom: FIT_MAX_ZOOM, fill: FIT_FILL, animate: animate() && !instant});
}

function fitMap({instant = false} = {}) {
  if (!state.loaded) return;
  const r = openRow();
  if (r) { fitNb(r, {instant}); return; }
  // The comparison open: frame the neighbourhoods side by side.
  if (state.compare.length > 1 && !$('insight-content').hidden) { fitRows(compareRows(), {maxZoom: 14, instant}); return; }
  if (state.province) {
    if (state.rows.length) fitRows(state.rows, {instant});
    else { const p = provinceByCode(state.province); if (p?.bbox) fitBox([[p.bbox[0], p.bbox[1]], [p.bbox[2], p.bbox[3]]], {maxZoom: 9, instant}); }
    return;
  }
  if (state.search && state.rows.length && state.rows.length <= 40) { fitRows(state.rows, {instant}); return; }
  fitBox(countryBox(), {maxZoom: 7, instant});
}

/* ---------- map: layers ---------- */
/** Province chips below the neighbourhood zooms: provinces with neighbourhoods in scope, with their count. */
function provinceLabelItems() {
  const counts = new Map();
  for (const r of state.rows) counts.set(r.province, (counts.get(r.province) || 0) + 1);
  return [...counts].sort((a, b) => (b[0] === state.province) - (a[0] === state.province) || b[1] - a[1]).map(([code, n]) => {
    const p = provinceByCode(code);
    return p ? {id: code, name: provinceName(code), value: num(n), state: 'measured', selected: code === state.province, quiet: false, center: p.label,
      title: L(`${provinceName(code)} · ${num(n)} ย่าน`, `${provinceName(code)} · ${num(n)} neighbourhoods`)} : null;
  }).filter(Boolean);
}

/** Neighbourhood chips at the city zooms: name + the reading (the first highlight, or the density under the lens). */
function nbLabelItems() {
  const ds = lensDs();
  const inScope = state.rows;
  const items = inScope.map(r => {
    const c = ds ? cell(r, ds) : null;
    const first = !ds && r.hl?.[0] ? state.model.dsById.get(r.hl[0].d) : null;
    const value = ds ? (c.state === 'measured' ? dens(c.density) : c.state === 'measured_zero' ? '0' : '—') : first ? dsName(first) : '';
    const title = ds
      ? `${r.name} · ${c.state === 'out_of_scope' ? L('ไม่มีข้อมูลในจังหวัด', 'no data in the province') : `${num(c.count || 0)} ${dsUnitN(ds, c.count || 0)} · ${dens(c.density || 0)} ${L('ต่อ ตร.กม.', 'per km²')}`}`
      : `${r.name}${first ? ` · ${L('เด่นเรื่อง', 'stands out for')} ${dsName(first)}` : ''}`;
    const kind = ds ? (c.state === 'measured_zero' ? 'zero' : c.state === 'out_of_scope' ? 'out' : 'measured') : value ? 'text' : 'none';
    return {id: r.id, name: r.name, value, title, state: kind, selected: r.id === state.nb, quiet: false, center: r.ref,
      swatch: state.fills.get(r.id)?.fill || '', rank: r.id === state.nb ? 1e9 : state.compare.includes(r.id) ? 1e8 : ds ? (c.density || 0) : r.strong * 100 + (r.hl?.length || 0)};
  });
  return items.sort((a, b) => b.rank - a.rank);
}

function scheduleLabelView() {
  clearTimeout(scheduleLabelView.timer);
  // record names after the neighbourhood chips (they keep clear of the chips' final places)
  scheduleLabelView.timer = setTimeout(() => { if (state.loaded) { state.provinceLabels?.layout(); state.nbLabels?.layout(); state.recordLabels?.layout(); } }, 60);
}

/** Provinces whose building units the massing regions need: the open neighbourhood's, and those under each region. */
function massingProvinces(regions) {
  const codes = new Set([state.province, openRow()?.province].filter(Boolean));
  if (state.locate) {
    for (const ring of regions) {
      if (!ring.length) continue;
      const [w, s, e, n] = ringsBox([ring]);
      for (const p of [[(w + e) / 2, (s + n) / 2], [w, s], [e, s], [e, n], [w, n]]) { const code = state.locate(p); if (code) codes.add(code); }
    }
  }
  return [...codes];
}

/**
 * Where buildings are drawn in full (0.1.4): inside the open neighbourhood's outline only. Owner 2026-11-16 23:28,
 * VERBATIM: “กับอาคาร 3d ที่ขึ้นรอบๆผมว่ามันแปลกๆ” — the University square of surroundings (1 km and more round the
 * subject) rose round every neighbourhood as a block wider than the neighbourhood itself. Round it the basemap's
 * buildings stay quiet and fade with distance (js/massing.js SCENE and FADE_*), as in the Hotel demo.
 */
function subjectRegions() {
  const r = openRow();
  const f = r ? state.outlineById.get(r.id) : null;
  return f ? outerRings(f) : [];
}

/** The camera's square while it looks outside the subject's own focus, from FOCUS_MIN_ZOOM in (js/regions.js). */
function cameraContext(base = subjectRegions()) {
  const map = state.map;
  if (!map || typeof map.getZoom !== 'function') return null;
  return cameraSquare(map.getCenter().toArray(), map.getZoom(), {base, minZoom: FOCUS_MIN_ZOOM});
}

/**
 * The focus tier's regions: the open neighbourhood only. The camera's cell is still followed (cameraKey), so the quiet
 * buildings round the reader come back where the camera has gone (an anchor of the fade, updateSpatialLayers).
 */
function massingRegions() {
  const base = subjectRegions();
  const camera = cameraContext(base);
  state.cameraKey = camera?.key || '';
  state.cameraAway = !!camera;
  return base;
}

/** After a move: read again round the camera when it has left its cell or crossed FOCUS_MIN_ZOOM. */
function followCamera() {
  if (!state.loaded || !state.massing) return;
  if ((cameraContext()?.key || '') !== state.cameraKey) updateSpatialLayers();
}

function updateSpatialLayers() {
  if (!state.loaded || !state.layers) return;
  const L_ = state.layers;
  L_.paint(state.fills);
  L_.setPins(pinCollection(state.model.rows, r => state.fills.get(r.id)?.icon || 'pin:none', r => state.fills.get(r.id)?.sort || 0));
  L_.select(state.nb);
  L_.setCompare(state.compare);
  L_.setProvince(state.province);
  const r = openRow();
  if (r) { ensureRecords(r); ensureRing(r); }
  L_.setAround(ringGeometry());
  if (state.poiCard && state.poiCard.row?.id !== state.nb) closePoiCard();
  const recs = r ? state.records.get(r.id) : null, chosen = chosenSet();
  state.spots = recs ? spotsOf(recs) : [];
  L_.setPoints(recs ? poiCollection(state.spots, seriesOfDs, {chosen}) : null);
  refreshCondo();
  renderFocusBar();
  state.provinceLabels?.update(provinceLabelItems());
  state.nbLabels?.update(nbLabelItems());
  const regions = massingRegions();
  const codes = massingProvinces(regions);
  state.buildingUnits?.ensureMany(codes);
  if (!state.buildingUnits || codes.every(c => state.buildingUnits.settled(c))) {
    const zones = state.buildingUnits?.zonesFor(regions) || [];
    const centre = state.map.getCenter().toArray();
    const anchors = r ? (state.cameraAway ? [r.ref, centre] : [r.ref]) : [centre];
    state.massing?.update({regions, hosts: [], anchors, zones, enabled: true, city: state.view3d, zoom: state.map.getZoom(), latitude: state.map.getCenter().lat})?.catch(e => console.warn('Massing', e));
  }
}

function provinceAt(point) {
  if (!state.locate) return '';
  return state.locate(state.map.unproject(point).toArray());
}

function onMapClick(e) {
  // A record's pin first (0.1.3): its card; a click elsewhere closes an open card and reads the map as before.
  const spots = state.nb ? spotsAt(e.point) : [];
  if (spots.length) { openPoiCard(spots); return; }
  if (state.poiPopup) { closePoiCard(); return; }
  const id = state.layers?.hitTest(e.point);
  if (id) { if (id !== state.nb) selectNb(id); return; }
  if (state.map.getZoom() < OUTLINE_MIN_ZOOM) {
    const code = provinceAt(e.point);
    if (code && code !== state.province) selectProvince(code);
  }
}

function onMapMove(e) {
  onMapMove.point = e.point;
  if (onMapMove.frame) return;
  onMapMove.frame = requestAnimationFrame(() => {
    onMapMove.frame = 0;
    const map = state.map, p = onMapMove.point;
    if (!map || !state.loaded || !p) return;
    const spots = state.nb ? spotsAt(p) : [];
    if (spots.length) {
      state.layers?.hover('');
      hideRailTip();
      if (HOVER() && !state.poiPopup) showTip(spots);
      map.getCanvas().style.cursor = 'pointer';
      return;
    }
    hideTip();
    // A station or stop under the pointer: its name and lines (0.2.3); the neighbourhood under it still answers.
    const rails = HOVER() && !state.poiPopup && state.rail ? state.rail.hit(p) : [];
    if (rails.length) showRailTip(rails); else hideRailTip();
    const id = state.layers?.hitTest(p) || '';
    state.layers?.hover(id && id !== state.nb ? id : '');
    let over = Boolean(id) && id !== state.nb;
    if (!over && map.getZoom() < OUTLINE_MIN_ZOOM) { const code = provinceAt(p); over = Boolean(code) && code !== state.province; }
    map.getCanvas().style.cursor = over ? 'pointer' : '';
  });
}

/* ---------- map: records of the open neighbourhood (0.1.3) ---------- */
const HOVER = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const V = () => (RELEASE ? `?v=${RELEASE}` : '');

/** The set whose records stand out ('' = every set alike): js/records.js resolveChosen. */
function chosenSet() {
  const r = openRow();
  if (!r) return '';
  return resolveChosen(state.focus, {records: state.records.get(r.id) || [], highlights: (r.hl || []).map(h => h.d), lens: state.lens,
    condo: !!(state.condoDs && state.condoNear.get(r.id))});
}

/** The open neighbourhood's records (data/records/<id>.json), once; the map, the bar and the panel list follow. */
function ensureRecords(r) {
  if (!r || state.records.has(r.id) || state.recordsLoading.has(r.id)) return;
  state.recordsLoading.add(r.id);
  fetchJSON(`data/records/${encodeURIComponent(r.id)}.json${V()}`)
    .then(json => state.records.set(r.id, decodeRecords(json, state.model)))
    .catch(e => { partial('records'); console.warn('Records unavailable', r.id, e); state.records.set(r.id, []); })
    .finally(() => {
      state.recordsLoading.delete(r.id);
      if (state.nb !== r.id) return;
      if (state.loaded) updateSpatialLayers();
      refreshRecordsList();
    });
  // Whether condominium points lie round it: the cells of its box and 1 km round (the bar offers the set only then).
  if (state.condoDs && !state.condoNear.has(r.id)) {
    const near = growBox(r.bbox, 1000);
    loadCondoCells(cellsIn(near, state.condoDs.meta.cell, state.condoIndex)).then(rows => {
      state.condoNear.set(r.id, rows.some(x => x.lon >= near[0] && x.lon <= near[2] && x.lat >= near[1] && x.lat <= near[3]));
      if (state.nb === r.id) { renderFocusBar(); if (state.focus === CONDO && state.loaded) updateSpatialLayers(); }
    });
  }
}

/** The panel's list of names, swapped in place once the records arrive (the panel keeps its scroll). */
function refreshRecordsList() {
  const r = openRow(), el = document.querySelector('#panel-view .records-details');
  if (!r || !el) return;
  const html = panelListHTML(state.records.get(r.id) ?? null, {open: state.recordsOpen});
  if (html) el.outerHTML = html; else el.remove();
}

/** Condominium cells (data/condo/<cell>.json), each fetched once; resolves to the rows of the cells asked for. */
function loadCondoCells(keys) {
  return Promise.all(keys.map(k => {
    const have = state.condoCells.get(k);
    if (have) return have;
    const p = fetchJSON(`data/condo/${k}.json${V()}`).then(json => decodeCondo(json, state.condoDs))
      .catch(e => { partial('condo'); console.warn('Condominium cell unavailable', k, e); return []; });
    state.condoCells.set(k, p);
    p.then(rows => state.condoCells.set(k, rows));
    return p;
  })).then(parts => parts.flat());
}

/** The condominium points of the cells in view, drawn only while they are the chosen set and a neighbourhood is open. */
function refreshCondo() {
  const L_ = state.layers, map = state.map;
  if (!L_ || !map) return;
  if (chosenSet() !== CONDO || map.getZoom() < POI_MIN_ZOOM - 0.5) { state.condoSpots = []; L_.setCondo(null); updateRecordLabels(); return; }
  const b = map.getBounds(), keys = cellsIn([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], state.condoDs.meta.cell, state.condoIndex);
  const token = (refreshCondo.token = (refreshCondo.token || 0) + 1);
  loadCondoCells(keys).then(rows => {
    if (token !== refreshCondo.token || !state.layers || chosenSet() !== CONDO) return;
    state.condoSpots = spotsOf(rows);
    state.layers.setCondo(poiCollection(state.condoSpots, seriesOfDs, {chosen: CONDO, dashed: true}));
    updateRecordLabels();
  });
}

/** Names beside pins: the chosen set's (the records' or the condominium points'), or in the all view the venues' (0.4.1). */
function updateRecordLabels() {
  const chosen = chosenSet();
  state.recordLabels?.update(chosen === CONDO ? labelItems(state.condoSpots, CONDO).map(x => ({...x, id: `c${x.id}`}))
    : labelItems(state.spots, chosen));
}

/** The dataset bar on the map: “ทั้งหมด” and the sets of the open neighbourhood (owner 2026-11-16 “เลือกดูทีละชุด”). */
function renderFocusBar() {
  const bar = $('focus-bar'), r = openRow();
  const recs = r ? state.records.get(r.id) : null;
  const sets = recs ? barSets(recs, {highlights: (r.hl || []).map(h => h.d), condo: state.condoDs && state.condoNear.get(r.id) ? state.condoDs : null}) : [];
  const html = sets.length ? barHTML(sets, chosenSet()) : '';
  const fresh = bar.dataset.html !== html;
  if (fresh) {
    const scroll = bar.scrollLeft;
    bar.innerHTML = html;
    bar.dataset.html = html;
    bar.scrollLeft = scroll;
  }
  bar.hidden = !html;
  // the pressed set in sight (an address that opens with one chosen, or a choice made from the panel)
  const on = fresh && bar.querySelector(`[aria-pressed="true"]:not([data-focus="${ALL}"])`);
  if (on && (on.offsetLeft < bar.scrollLeft || on.offsetLeft + on.offsetWidth > bar.scrollLeft + bar.clientWidth)) bar.scrollLeft = on.offsetLeft - 8;
  document.querySelector('.map-panel')?.style.setProperty('--focus-bar-bottom', `${html ? Math.round(bar.getBoundingClientRect().bottom - $('map').getBoundingClientRect().top) : 0}px`);
  updateRecordLabels();
}

function setFocus(id) {
  state.focus = id || '';
  closePoiCard();
  updateSpatialLayers();
  saveURL();
  const ds = id === CONDO ? state.condoDs : state.model.dsById.get(id);
  announce(ds ? L(`แสดง${dsName(ds)}พร้อมชื่อ ชุดอื่นเป็นจุดเล็ก`, `Showing ${dsName(ds)} with names; the other sets as small dots`) : L('แสดงทุกชุดข้อมูลในย่าน', 'Showing every dataset in the neighbourhood'));
}

/**
 * The records' spots under a screen point, nearest first (pins of the neighbourhood, then condominium points). With one
 * set chosen, its pins answer first: the quiet dots answer only where none of its pins is under the pointer.
 */
function spotsAt(point) {
  const spots = (state.layers?.hitPoi(point) || []).map(h => (h.layer === 'condo' ? state.condoSpots[h.id] : state.spots[h.id])).filter(Boolean);
  const chosen = chosenSet(), mine = chosen ? spots.filter(g => g.ds.id === chosen) : [];
  return mine.length ? mine : spots;
}

function showTip(spots) {
  const key = spots.map(g => `${g.ds.id}|${g.lon}|${g.lat}`).join(';');
  if (state.poiTip && state.poiTipKey === key) return;
  hideTip();
  const html = tipHTML(spots);
  if (!html || !state.map) return;
  const el = document.createElement('div');
  el.className = 'poi-tip';
  el.innerHTML = html;
  state.poiTip = new maplibregl.Popup({closeButton: false, closeOnClick: false, closeOnMove: false, focusAfterOpen: false, offset: 14, maxWidth: '280px', className: 'poi-tip-popup'})
    .setLngLat([spots[0].lon, spots[0].lat]).setDOMContent(el).addTo(state.map);
  state.poiTipKey = key;
}
function hideTip() {
  state.poiTip?.remove();
  state.poiTip = null; state.poiTipKey = '';
}

/** The card of a spot (or of the spots under a click): one record → its details; several → their names, each a card. */
function openPoiCard(spots, {index = null} = {}) {
  const items = spots.flatMap(g => g.items);
  if (!items.length || !state.map) return;
  hideTip();
  state.poiCard = {items, at: [spots[0].lon, spots[0].lat], row: openRow()};
  renderPoiCard(index ?? (items.length === 1 ? 0 : -1));
}

function renderPoiCard(index) {
  const c = state.poiCard;
  if (!c || !state.map) return;
  const one = index >= 0 ? c.items[index] : null;
  const el = document.createElement('div');
  el.className = 'poi-card-wrap';
  el.innerHTML = one ? detailHTML(one, {row: c.row, back: c.items.length > 1}) : listHTML(c.items, {row: c.row});
  el.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-poi]');
    if (!b) return;
    ev.preventDefault();
    renderPoiCard(b.dataset.poi === 'list' ? -1 : +b.dataset.poi);
    state.poiPopup?.getElement()?.querySelector('.poi-card button, .poi-card a')?.focus({preventScroll: true});
  });
  const at = one ? [one.lon, one.lat] : c.at;
  state.layers?.markPoi(at);
  if (state.poiPopup) state.poiPopup.setLngLat(at).setDOMContent(el);
  else {
    const docked = mobilePortrait();
    state.poiPopup = new maplibregl.Popup({closeButton: true, closeOnClick: false, focusAfterOpen: true, offset: docked ? 0 : 16, maxWidth: docked ? 'none' : '320px',
      className: `poi-card-popup${docked ? ' is-docked' : ''}`}).setLngLat(at).setDOMContent(el).addTo(state.map);
    const popup = state.poiPopup;
    popup.on('close', () => { if (state.poiPopup !== popup) return; state.poiPopup = null; state.poiCard = null; state.layers?.markPoi(null); });
  }
  announce(one ? `${dsName(one.ds)} · ${recordName(one) || ''}` : L('รายชื่อที่จุดนี้', 'The names at this point'));
}

function closePoiCard() {
  const p = state.poiPopup;
  state.poiPopup = null; state.poiCard = null;
  p?.remove();
  state.layers?.markPoi(null);
}

/** A name of the panel's list: its card on the map (the sheet steps down on a phone so the card can be seen). */
function openRecordFromList(i) {
  const r = openRow(), rec = r && state.records.get(r.id)?.find(x => x.i === i);
  if (!rec) return;
  if (!state.map || !state.loaded) return;
  if (mobilePortrait()) setSheet('peek');
  const spot = state.spots.find(g => g.items.includes(rec));
  const c = state.map.getContainer(), p = state.map.project([rec.lon, rec.lat]);
  if (p.x < 40 || p.y < 80 || p.x > c.clientWidth - 40 || p.y > c.clientHeight - 80) state.map.easeTo({center: [rec.lon, rec.lat], duration: animate() ? 500 : 0});
  openPoiCard(spot ? [spot] : [{ds: rec.ds, lon: rec.lon, lat: rec.lat, items: [rec]}], {index: spot ? spot.items.indexOf(rec) : 0});
}

function installSpatialLayers() {
  const map = state.map;
  state.loaded = true;
  guardRetainedTiles(map, maplibregl.getVersion?.());
  guardElevationFreeze(map, maplibregl.getVersion?.());
  const palette = basemapPalette(theme());
  try {
    state.layers = installNeighborhoodLayers(map, {provinces: state.provincesGeo, outlines: state.outlines, rows: state.model.rows,
      iconOptions: () => ({lut: state.ramp?.lut || [], zero: state.ramp?.zero || {}})});
  } catch (e) { state.layers = null; console.warn('Neighbourhood layers unavailable', e); }
  state.massing = installMassing(map, {
    beforeId: MASSING_BEFORE,
    colors: {quiet: palette.massingQuiet, focus: palette.massingFocus, ground: palette.ground, venue: cssVar('--map-active-layer') || undefined},
    tileUrl: t => (state.tileTemplate ? state.tileTemplate.replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y) : ''),
    cmTileUrl, cmAttribution: CM_ATTRIBUTION,
    budget: state.budget.level === 'full' ? null : state.budget,
    onResult: result => {
      const status = $('map-status');
      status.dataset.massing = `${result.features || 0}`;
      status.dataset.cmBuildings = `${result.cm?.kept || 0}`;
    },
  });
  state.rail = null;
  installRail();
  updateSpatialLayers();
  if (!state.initialCameraDone) {
    state.initialCameraDone = true;
    const resume = state.resumeView; state.resumeView = null;
    if (resume) state.map.jumpTo(resume);
    else fitMap({instant: true});
  }
  scheduleLabelView();
}

/* ---------- map: rail context (0.2.3, js/rail.js) ---------- */
/** data/rail.json once, after the page reads (the map never waits for it); drawn on every style the map loads. */
function loadRail() {
  fetchJSON(`data/rail.json${V()}`)
    .then(json => { state.railData = decodeRail(json); installRail(); renderLegend(); })
    .catch(e => { partial('rail'); console.warn('Rail context unavailable', e); });
}
function installRail() {
  const map = state.map;
  if (!map || !state.loaded || !state.railData || state.rail) return;
  const meta = state.railData.meta, date = meta.asOf ? thaiDate(meta.asOf) : '';
  try {
    state.rail = installRailLayers(map, state.railData, {lang: LANG, basemapSource: 'openmaptiles',
      beforeGround: map.getStyle()?.layers?.find(l => l.type === 'fill-extrusion')?.id, beforeLabels: MASSING_BEFORE,
      attribution: L(`ระบบราง: CityMETER Transit ${date} จาก GTFS สนข. (CC BY 4.0) และ OpenStreetMap (ODbL)`, `Rail: CityMETER Transit ${date}, from OTP GTFS (CC BY 4.0) and OpenStreetMap (ODbL)`)});
  } catch (e) { state.rail = null; console.warn('Rail layers unavailable', e); }
}
function showRailTip(items) {
  const key = items.map(it => `${it.k}:${it.name}:${it.lines.join('.')}`).join(';');
  if (state.railTip && state.railTipKey === key) return;
  hideRailTip();
  const html = railTipHTML(items, state.railData, {lang: LANG});
  if (!html || !state.map) return;
  const el = document.createElement('div');
  el.className = 'poi-tip rail-tip';
  el.innerHTML = html;
  const at = state.map.unproject([onMapMove.point.x, onMapMove.point.y]);
  state.railTip = new maplibregl.Popup({closeButton: false, closeOnClick: false, closeOnMove: false, focusAfterOpen: false, offset: 12, maxWidth: '260px', className: 'poi-tip-popup rail-tip-popup'})
    .setLngLat(at).setDOMContent(el).addTo(state.map);
  state.railTipKey = key;
}
function hideRailTip() {
  state.railTip?.remove();
  state.railTip = null; state.railTipKey = '';
}

/** The attribution must stay readable: its live height becomes --attrib-height (the phone dock stays above it). */
function trackAttribution(map) {
  const panel = map.getContainer().closest('.map-panel');
  const el = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
  if (!panel || !el) return null;
  const set = () => {
    panel.style.setProperty('--attrib-height', `${Math.ceil(el.getBoundingClientRect().height) + 10}px`);
    panel.classList.toggle('is-attrib-compact', el.classList.contains('maplibregl-compact') && !el.classList.contains('maplibregl-compact-show'));
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(set) : null;
  observer?.observe(el);
  if (typeof MutationObserver === 'function') new MutationObserver(set).observe(el, {attributes: true, attributeFilter: ['class']});
  set();
  return observer;
}

/** The legend's height (--legend-height); its ticks are spaced again on resize. */
function trackLegend() {
  const panel = document.querySelector('.map-panel'), el = $('map-legend');
  if (!panel || !el) return null;
  const set = () => { panel.style.setProperty('--legend-height', `${Math.ceil(el.offsetParent ? el.getBoundingClientRect().height : 0)}px`); spaceTicks(el); };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(set) : null;
  observer?.observe(el);
  set();
  return observer;
}

const MAP_LOCALE = LANG === 'en' ? {} : {
  'Map.Title': 'แผนที่ย่านและสิ่งที่อยู่ในย่าน', 'NavigationControl.ZoomIn': 'ซูมเข้า', 'NavigationControl.ZoomOut': 'ซูมออก',
  'NavigationControl.ResetBearing': 'หมุนกลับทิศเหนือ (ลากเพื่อหมุนหรือเอียง)', 'Popup.Close': 'ปิด', 'AttributionControl.ToggleAttribution': 'แสดงหรือซ่อนที่มาของแผนที่',
};

function initMap() {
  if (!window.maplibregl) throw new Error('Map library is unavailable');
  try {
    state.mapTheme = theme();
    state.budget = mapBudget();
    state.map = new maplibregl.Map({container: 'map', pixelRatio: budgetPixelRatio(state.budget), maxTileCacheZoomLevels: state.budget.cacheZoomLevels, center: [100.53, 13.74], zoom: 5.4, pitch: 0, maxPitch: 85, attributionControl: {compact: true, customAttribution: L(state.model.meta.attribution || '', 'Neighbourhood outlines: CityMETER central registry (draft) · roads, waterways and buildings used to draw them © OpenStreetMap contributors (ODbL)')}, locale: MAP_LOCALE, style: buildMapStyle(state.mapTheme)});
    state.map.addControl(new maplibregl.NavigationControl({showCompass: true, visualizePitch: true}), 'top-right');
    state.attribObserver = trackAttribution(state.map);
    state.legendObserver ||= trackLegend();
    document.fonts?.ready?.then(() => spaceTicks($('map-legend')));
    state.provinceLabels = installAreaLabels(state.map, $('map'), {className: 'province-label', hostId: 'province-labels', hostLabel: L('จังหวัดบนแผนที่', 'Provinces on the map'), minZoom: 4, maxZoom: 8.5, verb: L('กดเพื่อดูจังหวัด', 'open the province'), onSelect: code => selectProvince(code), reservedBottom: labelBottomSpace, maxLabels: mobilePortrait() ? 10 : 18, avoid: '.focus-bar'});
    state.nbLabels = installAreaLabels(state.map, $('map'), {className: 'neighborhood-label', hostId: 'nb-labels', hostLabel: L('ย่านบนแผนที่', 'Neighbourhoods on the map'), minZoom: 11.5, maxZoom: 24, verb: L('กดเพื่อดูย่าน', 'open the neighbourhood'), onSelect: id => selectNb(id), reservedBottom: labelBottomSpace, maxLabels: 36, avoid: '#province-labels .area-label:not([hidden]), .focus-bar'});
    state.recordLabels = installRecordLabels(state.map, $('map'), {onSelect: id => {
      const spot = typeof id === 'string' && id.startsWith('c') ? state.condoSpots[+id.slice(1)] : state.spots[id];
      if (spot) openPoiCard([spot]);
    }, reservedBottom: labelBottomSpace, avoid: '#nb-labels .area-label:not([hidden])', pinRadius: () => ((chosenSet() ? PIN_CHOSEN : PIN) * pinScale(state.map?.getZoom() || 15)) / 2 + 1});
    state.map.on('moveend', scheduleLabelView);
    state.map.on('moveend', followCamera);
    state.map.on('moveend', () => { if (state.nb && chosenSet() === CONDO) refreshCondo(); });
    state.map.getCanvas().addEventListener('mouseleave', () => { hideTip(); hideRailTip(); });
    state.map.on('moveend', tiltWhenNear);
    state.map.on('style.load', installSpatialLayers);
    state.map.on('click', onMapClick);
    state.map.on('mousemove', onMapMove);
    state.map.on('pitchstart', e => { if (e.originalEvent) state.readerPitch = true; });
    // (0.4.0) a reader who moves the map while a line around loads keeps the view: no framing when it arrives
    state.map.on('movestart', e => { if (e.originalEvent) state.frameOnRing = ''; });
    for (const type of ['wheel', 'touchend', 'pointerup', 'dblclick']) state.map.getCanvasContainer().addEventListener(type, () => { state.readerMovedAt = Date.now(); }, {passive: true});
    state.map.on('error', e => { watchBasemap.error(e); console.warn('Map resource', e.error?.message || e); });
    state.map.on('sourcedata', watchBasemap.data);
    state.contextWatch = watchContext(state.map, () => restartMap('context-lost'));
    $('map').dataset.budget = state.budget.level;
    fetch(TILEJSON_URL).then(r => r.json()).then(j => { state.tileTemplate = j.tiles?.[0] || ''; if (state.loaded) updateSpatialLayers(); }).catch(e => { partial('basemap'); console.warn('TileJSON', e); });
  } catch (e) {
    dropMap();
    throw e;
  }
}

function dropMap() {
  state.loaded = false; state.initialCameraDone = false;
  for (const cleanup of [() => state.contextWatch?.(), () => state.attribObserver?.disconnect(), () => state.provinceLabels?.dispose(), () => state.nbLabels?.dispose(), () => state.recordLabels?.dispose(), disposeSpatial, () => state.map?.remove()]) { try { cleanup(); } catch (err) { console.warn('Map cleanup', err); } }
  state.map = null; state.provinceLabels = null; state.nbLabels = null; state.recordLabels = null; state.contextWatch = null; state.attribObserver = null;
  watchBasemap.reset();
}

/** The basemap's own tiles: when they fail and none has arrived, the page says so (`basemap` in PARTIAL). */
const watchBasemap = {
  errors: 0, loaded: false, told: false,
  reset() { this.errors = 0; this.loaded = false; },
  error: e => {
    const w = watchBasemap;
    if (w.loaded || e?.sourceId !== 'openmaptiles') return;
    if (++w.errors >= 3 && !w.told) { w.told = true; partial('basemap'); trouble('basemap-tiles'); }
  },
  data: e => {
    const w = watchBasemap;
    if (w.loaded || e?.sourceId !== 'openmaptiles' || !e.tile || e.tile.state !== 'loaded') return;
    w.loaded = true;
    if (w.told) { w.told = false; window.dispatchEvent(new CustomEvent('citymeter:partial', {detail: {id: 'basemap', resolved: true}})); }
  },
};
function trouble(kind, note = '') { window.dispatchEvent(new CustomEvent('citymeter:map-trouble', {detail: {kind, note}})); }

function restartMap(reason) {
  if (!state.map) return;
  const view = {center: state.map.getCenter(), zoom: state.map.getZoom(), pitch: state.map.getPitch(), bearing: state.map.getBearing()};
  state.mapRestarts = (state.mapRestarts || 0) + 1;
  trouble(reason, `restart ${state.mapRestarts}`);
  dropMap();
  if (state.mapRestarts > 2) {
    const el = $('map-failure');
    el.hidden = false;
    el.innerHTML = `<p>${L('แผนที่หยุดแสดงผล ข้อมูลในแผงและตารางยังใช้งานได้', 'The map stopped drawing; the panel and the table still work')}</p><button type="button" class="btn">${L('เปิดแผนที่อีกครั้ง', 'Open the map again')}</button>`;
    el.querySelector('button').onclick = event => { event.target.disabled = true; state.mapRestarts = 0; startMap(); };
    return;
  }
  state.resumeView = view;
  startMap();
}

async function startMap() {
  const el = $('map-failure');
  try { await loadMapLibrary(); el.hidden = true; initMap(); }
  catch (e) {
    el.hidden = false;
    el.innerHTML = `<p>${L('โหลดแผนที่ไม่สำเร็จ ข้อมูลในแผงและตารางยังใช้งานได้', 'The map did not load; the panel and the table still work')}</p><p class="hint">${esc(e.message || '')}</p><button type="button" class="btn">${L('ลองโหลดแผนที่ใหม่', 'Try the map again')}</button>`;
    el.querySelector('button').onclick = event => { event.target.disabled = true; startMap(); };
    console.warn(e);
  }
}

/** A phone's plan view turns 3D near the buildings once the reader has moved there (the University rule of 2026-11-11). */
const TILT_ZOOM = 14, FLAT_PITCH = 20;
function tiltWhenNear() {
  clearTimeout(state.tiltTimer);
  if (state.readerPitch || Date.now() - (state.readerMovedAt || 0) > 2500) return;
  state.tiltTimer = setTimeout(() => {
    const map = state.map;
    if (!map || state.readerPitch || !state.view3d || !mobilePortrait() || map.isMoving()) return;
    if (map.getZoom() < (state.budget?.focusZoom || TILT_ZOOM) || map.getPitch() >= FLAT_PITCH) return;
    applyPreset(map, 'model', {animate: animate(), duration: 600});
  }, 220);
}

function toggle3d() {
  state.view3d = !state.view3d;
  state.readerPitch = false;
  $('toggle-3d').setAttribute('aria-pressed', String(state.view3d));
  renderLegend();
  updateSpatialLayers();
  if (state.map) {
    if (state.nb) fitNb(openRow());
    else applyPreset(state.map, state.map.getZoom() >= 12 && state.view3d ? 'model' : cameraPreset(), {animate: animate()});
  }
  saveURL();
}

/* ---------- mobile sheet ---------- */
const restSheet = () => (state.nb ? 'peek' : 'half');
function setSheet(next) {
  const panel = $('panel'), grip = $('sheet-grip');
  if (!grip || panel.dataset.sheet === next) return;
  const full = next === 'full', words = full ? L('ย่อแผ่นข้อมูล', 'Shrink the sheet') : L('ขยายแผ่นข้อมูล', 'Expand the sheet');
  panel.dataset.sheet = next;
  grip.setAttribute('aria-expanded', String(full));
  grip.title = words;
  const label = grip.querySelector('.sr-only');
  if (label) label.textContent = words;
  if (!full) panel.scrollTop = 0;
}
const toggleSheet = () => setSheet($('panel').dataset.sheet === 'full' ? restSheet() : 'full');
function installSheetSwipe() {
  const bar = $('sheet-bar'), grip = $('sheet-grip');
  if (!bar || !grip) return;
  let startY = null, pointer = null, swipedAt = 0;
  bar.addEventListener('pointerdown', e => { if (!e.target.closest('#sheet-back, #close-mobile-panel')) { startY = e.clientY; pointer = e.pointerId; } });
  const end = e => {
    if (startY === null || e.pointerId !== pointer) return;
    const dy = e.clientY - startY;
    startY = null;
    if (Math.abs(dy) < 28) return;
    swipedAt = Date.now();
    if (dy < 0) setSheet('full');
    else if ($('panel').dataset.sheet === 'full') setSheet(restSheet());
    else closeMobilePanel();
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', () => { startY = null; });
  grip.addEventListener('click', () => { if (Date.now() - swipedAt > 350) toggleSheet(); });
}
function openMobilePanel({frame = true} = {}) {
  if (!mobilePortrait()) return;
  const wasOpen = $('panel').classList.contains('is-open');
  $('panel').classList.add('is-open');
  $('mobile-panel').setAttribute('aria-expanded', 'true');
  $('map-aha').hidden = true;
  if (frame && !wasOpen && state.loaded && state.nb) fitNb(openRow());
}
function closeMobilePanel() {
  const wasOpen = $('panel').classList.contains('is-open');
  $('panel').classList.remove('is-open');
  $('mobile-panel').setAttribute('aria-expanded', 'false');
  if (mobilePortrait()) {
    $('mobile-panel').focus({preventScroll: true});
    if (!state.nb) renderMapAha(state.overview);
    else if (wasOpen && state.loaded) fitNb(openRow());
  }
}

/* ---------- data loading ---------- */
function validFeatureCollection(value) {
  if (value?.type !== 'FeatureCollection' || !Array.isArray(value.features)) return false;
  const position = p => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
  const ring = r => Array.isArray(r) && r.length >= 4 && r.every(position);
  const polygon = p => Array.isArray(p) && p.length > 0 && p.every(ring);
  return value.features.every(f => {
    const g = f?.geometry, id = f?.id ?? f?.properties?.id;
    return f?.type === 'Feature' && (typeof id === 'string' || typeof id === 'number') && (g?.type === 'Polygon' ? polygon(g.coordinates) : g?.type === 'MultiPolygon' && g.coordinates.every(polygon));
  });
}

async function fetchJSON(resource, {timeout = 20000} = {}) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(resource, {signal: controller.signal, cache: 'no-cache'});
    if (!r.ok) { const e = new Error('โหลดข้อมูลไม่สำเร็จ'); e.status = r.status; throw e; }
    return await r.json();
  } catch (e) { e.resource = resource; e.phase = 'data'; throw e; }
  finally { clearTimeout(timer); }
}

function setOptions() {
  const counts = new Map();
  for (const r of state.model.rows) counts.set(r.province, (counts.get(r.province) || 0) + 1);
  const kinds = $('kind');
  for (const o of kinds.options) if (o.value) o.textContent = `${kindLabel(o.value)} (${num(state.model.rows.filter(r => kindMatch(r, o.value)).length)})`;
  const sel = $('province');
  while (sel.options.length > 1) sel.remove(1);
  for (const p of [...provinceList()].filter(p => counts.has(p.code)).sort((a, b) => COLLATOR.compare(provinceName(a.code), provinceName(b.code)))) {
    const o = document.createElement('option');
    o.value = p.code; o.textContent = `${provinceName(p.code)} (${num(counts.get(p.code))})`;
    sel.append(o);
  }
  const lens = $('lens');
  while (lens.options.length > 1) lens.remove(1);
  for (const pillar of PILLARS) {
    const group = document.createElement('optgroup');
    group.label = pillar;
    for (const ds of state.model.datasets.filter(d => d.group === pillar)) {
      const o = document.createElement('option');
      o.value = ds.id; o.textContent = dsName(ds);
      group.append(o);
    }
    lens.append(group);
  }
}

function restoreFromURL() {
  const p = nav.read();
  state.province = provinceCodeFrom(p.get('province') || '');
  state.search = (p.get('search') || '').slice(0, 80);
  state.kind = KINDS.includes(p.get('kind')) ? p.get('kind') : '';
  const nbParam = state.model.canonicalId(p.get('neighborhood') || '');
  state.nb = rowById(nbParam) ? nbParam : '';
  const show = p.get('show') || '';
  state.focus = show === CONDO || show === ALL || state.model.dsById.has(show) ? show : '';
  state.lens = state.model.dsById.has(p.get('metric')) ? p.get('metric') : '';
  state.distance = state.nb && state.around ? aroundDistance(p.get('around')) : 'in';
  state.compare = (p.get('compare') || '').split(',').map(id => state.model.canonicalId(id)).filter(id => rowById(id)).slice(0, COMPARE_MAX);
  state.view3d = p.get('view3d') !== '0';
  const r = openRow();
  if (r) state.province = r.province;
}

function restoreFromHistory() {
  restoreFromURL();
  $('toggle-3d').setAttribute('aria-pressed', String(state.view3d));
  update({fit: true});
}

function wireEvents() {
  let timer;
  $('search').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.search = $('search').value.trim().slice(0, 80); state.nb = ''; update({fit: true}); }, 400);
  });
  $('province').addEventListener('change', () => { state.province = $('province').value; state.nb = ''; update({fit: true}); });
  $('kind').addEventListener('change', () => { state.kind = KINDS.includes($('kind').value) ? $('kind').value : ''; state.nb = ''; update({fit: true}); });
  $('lens').addEventListener('change', () => setLens($('lens').value));
  $('filters').addEventListener('submit', e => e.preventDefault());
  $('filters').addEventListener('reset', () => setTimeout(() => { state.search = ''; state.province = ''; state.kind = ''; state.nb = ''; update({fit: true}); }, 0));
  for (const id of ['panel-view', 'filter-chips', 'map-aha', 'crumbs', 'compare-view', 'result-rows']) $(id).addEventListener('click', onPanelAction);
  $('focus-bar').addEventListener('click', e => { const b = e.target.closest('button[data-focus]'); if (b) setFocus(b.dataset.focus); });
  $('panel-view').addEventListener('toggle', e => { if (e.target.classList?.contains('records-details')) state.recordsOpen = e.target.open; }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.poiPopup) { closePoiCard(); state.map?.getCanvas().focus({preventScroll: true}); } });
  $('fit-map').onclick = () => fitMap();
  $('country-map').onclick = () => { state.province = ''; state.nb = ''; state.search = ''; state.kind = ''; update({fit: true}); announce(L('ทั้งประเทศ', 'Whole country')); };
  $('toggle-3d').onclick = toggle3d;
  $('mobile-panel').onclick = () => { $('panel').classList.contains('is-open') ? closeMobilePanel() : openMobilePanel(); };
  $('close-mobile-panel').onclick = closeMobilePanel;
  $('sheet-back').onclick = goBack;
  $('panel-back').onclick = goBack;
  installSheetSwipe();
  // the skip link lands on the view's own heading: the neighbourhood's name when one is open (the dataset heading is
  // kept for screen readers only in that view, 0.4.0 D-5)
  document.querySelector('.skip').onclick = e => { e.preventDefault(); openMobilePanel(); (state.nb && document.querySelector('#panel-view .nb-title') || $('dataset-title')).focus(); };
  $('toggle-insights').onclick = () => openInsights($('insight-content').hidden);
  $('compare-clear').onclick = () => compareSet([], {open: false});
  if (typeof ResizeObserver === 'function') new ResizeObserver(syncBottomPanel).observe($('insights')); else window.addEventListener('resize', syncBottomPanel);
  $('open-table').onclick = openTable;
  $('toggle-table').onclick = () => { $('results').hidden = true; $('open-table').focus(); };
  $('prev-page').onclick = () => { state.page--; renderTable(); };
  $('next-page').onclick = () => { state.page++; renderTable(); };
  $('theme').onchange = applyTheme;
  const colorMedia = matchMedia('(prefers-color-scheme: dark)');
  const onColorChange = () => { if ($('theme').value === 'auto') applyTheme(); };
  if (colorMedia.addEventListener) colorMedia.addEventListener('change', onColorChange); else colorMedia.addListener(onColorChange);
  matchMedia('(max-width: 760px) and (orientation: portrait)').addEventListener?.('change', () => { if (!mobilePortrait()) $('panel').classList.remove('is-open'); renderPanel(); });
}

/** A part of the data that did not load is said on the page (citymeter-shell js/shell/launch.js `citymeter:partial`). */
const PARTIAL = {
  'data/provinces.geojson': ['กรอบจังหวัด', 'แผนที่ไม่แสดงขอบจังหวัด ตัวเลขในแผงยังครบ', 'Province outlines', 'The map shows no province outlines; the panel figures are complete'],
  'data/boundaries.geojson': ['ขอบย่าน', 'แผนที่แสดงเฉพาะหมุดของย่าน ตัวเลขในแผงยังครบ', 'Neighbourhood outlines', 'The map shows pins only; the panel figures are complete'],
  'records': ['จุดในย่าน', 'แผนที่ไม่แสดงจุดของย่านนี้ ตัวเลขในแผงยังครบ', 'Records inside the neighbourhood', 'The map does not draw this neighbourhood’s records; the panel figures are complete'],
  'condo': ['จุดคอนโดมิเนียม', 'แผนที่อาจไม่แสดงจุดคอนโดมิเนียมบางส่วน', 'Condominium points', 'Some condominium points may be missing from the map'],
  'units': ['รูปอาคารของ CityMETER', 'อาคารบางจังหวัดแสดงจากแผนที่ฐานแทนชุดอาคารของ CityMETER', 'CityMETER building shapes', 'Buildings in some provinces come from the basemap instead of the CityMETER set'],
  'basemap': ['แผนที่ฐาน', 'ถนน แหล่งน้ำ และอาคารพื้นหลังอาจไม่แสดง ข้อมูลในแผงและตารางยังใช้ได้', 'Basemap', 'Roads, water and background buildings may be missing; the panel and the table still work'],
  'rail': ['ระบบราง', 'แผนที่ไม่แสดงแนวรถไฟฟ้าและสถานี ตัวเลขในแผงยังครบ', 'Rail', 'The map shows no rail lines or stations; the panel figures are complete'],
  'around': ['ตัวเลขขอบเดินถึง', 'แผงแสดงเฉพาะตัวเลขในย่าน ยังไม่มีตัวเลขขอบเดินถึงและระดับเทียบ', 'Walkable-edge figures', 'The panel shows the figures inside only, without the walkable edge or the levels'],
  'rings': ['แนวขอบเดินถึง', 'แผนที่ไม่แสดงแนวขอบเดินถึง ตัวเลขในแผงยังครบ', 'The walkable-edge line', 'The map does not draw the walkable-edge line; the panel figures are complete'],
};
function partial(key) {
  const words = PARTIAL[key];
  if (!words || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('citymeter:partial', {detail: {id: key, label: words[0], effect: words[1], labelEn: words[2], effectEn: words[3]}}));
}

async function init() {
  try {
    const v = RELEASE ? `?v=${RELEASE}` : '';
    const [dataJSON, provincesJSON, outlinesJSON, aroundJSON] = await Promise.all([
      fetchJSON(`data/neighborhoods.json${v}`, {timeout: 30000}),
      fetchJSON(`data/provinces.geojson${v}`, {timeout: 30000}).catch(e => { partial('data/provinces.geojson'); console.warn('Province frames unavailable', e); return null; }),
      fetchJSON(`data/boundaries.geojson${v}`, {timeout: 30000}).catch(e => { partial('data/boundaries.geojson'); console.warn('Outlines unavailable', e); return null; }),
      // (0.4.0) «ขอบเดินถึง»: without it the panel keeps the figures inside and says the rest did not load
      fetchJSON(`data/around.json${v}`, {timeout: 30000}).catch(e => { partial('around'); console.warn('Surroundings unavailable', e); return null; }),
    ]);
    try { state.around = aroundJSON ? decodeAround(aroundJSON) : null; } catch (e) { partial('around'); console.warn('Surroundings invalid', e); state.around = null; }
    state.provincesGeo = validFeatureCollection(provincesJSON) ? provincesJSON : {type: 'FeatureCollection', features: []};
    setProvinces(state.provincesGeo);
    state.locate = state.provincesGeo.features.length ? provinceLocator(state.provincesGeo) : null;
    state.model = decodeData(dataJSON);
    // the surroundings of another data release would put figures on the wrong neighbourhoods: drop them, say so
    if (state.around && !aroundMatches(state.around, state.model)) { partial('around'); console.warn('Surroundings belong to another data release'); state.around = null; }
    state.outlines = validFeatureCollection(outlinesJSON) ? outlinesJSON : {type: 'FeatureCollection', features: []};
    state.outlineById = new Map(state.outlines.features.map(f => [String(f.properties.id), f]));
    state.condoDs = condoDataset(state.model.meta.condo);
    state.condoIndex = new Set(state.model.meta.condo?.cells || []);
    registerDataNames(state.model);
    state.buildingUnits = createBuildingUnitStore({fetchJSON, version: RELEASE, onLoad: () => { if (state.loaded) updateSpatialLayers(); },
      onError: (code, e) => { partial('units'); console.warn('Building units unavailable', code, e); if (state.loaded) updateSpatialLayers(); }});
    state.buildingUnits.loadIndex();

    setOptions();
    restoreFromURL();
    $('toggle-3d').setAttribute('aria-pressed', String(state.view3d));
    try { $('theme').value = localStorage.getItem(THEME_KEY) || 'auto'; } catch {}
    applyTheme();
    wireEvents();
    update();
    if (state.compare.length) openInsights(true, {fit: false});
    if (state.nb) openMobilePanel({frame: false});
    window.dispatchEvent(new CustomEvent('citymeter:ready'));
    startMap();
    loadRail();
  } catch (e) {
    window.dispatchEvent(new CustomEvent('citymeter:load-error', {detail: {message: L('โหลดข้อมูลย่านไม่สำเร็จ กรุณาลองอีกครั้ง', 'The neighbourhood data did not load; please try again'), resource: e.resource, status: e.status, phase: e.phase || 'startup', diagnostic: e.message}}));
    console.error(e);
  }
}

// Developer hook for live tuning in a browser console (not an API; may change without notice).
window.__citymeter = {state, get map() { return state.map; }, update, fitMap, updateSpatialLayers, selectNb, selectProvince, setLens, setDistance, compareSet, applyPreset: (name, opts) => state.map && applyPreset(state.map, name, opts), fitPitched: (b, opts) => state.map && fitPitched(state.map, b, opts), cameraPadding};

init();
