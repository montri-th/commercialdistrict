/*
 * CityMETER · Commercial District — redraw neighbourhood outlines by the owner's rule (0.3.0), from the demo's own basemap.
 *
 * Owner 2026-11-24 13:00 ICT: replace the outline (one layer); a name stays the registry's; neighbourhoods whose
 * built-up ground joins stay separate; line B (tight to the buildings) with line A (the dark ground) as its outer limit.
 * Run in the live demo (https://citymeter.pages.dev/commercialdistrict/), whose page serves the outlines and the hotels
 * on its own origin: paste this file, then  await window.__rule.run(ids)  and read  window.__rule.exportText(from, to).
 * Read only: it moves the map and reads the vector tiles the page loads (OpenFreeMap, OpenMapTiles schema, zoom 14).
 * Options of run(ids, options): lightLanduse — land-use classes taken as light ground too (e.g. ['industrial']: an
 * industrial estate is not a commercial district); limits — {id: [limit]} the owner's limits for a place: a road
 * ('lines') the outline does not cross, an area ('poly') it does not take, a corridor ('near', d metres) it stays in,
 * and 'passWater' (metres): within the owner's limits a canal narrower than that no longer stops the outline.
 * 'take' (a ring): an area the owner names as part of the place, e.g. the strip between a beach and the road behind it —
 * its land joins the area whatever the buildings, still inside his other limits.
 * redo — draw again places already drawn in this page (otherwise a place drawn once is kept).
 * cm — (0.5.2, owner 2026-11-26 10:02 “ใช้ Building v4”) inside a CityMETER unit of the demo's map (an อปท., in Bangkok a
 * เขต, where CityMETER Building V4 holds at least 1.15 × the OpenStreetMap buildings; data/building-units) the buildings
 * are CityMETER Building V4's, read from the production tiles the map reads (js/shell/building-units.js), in place of
 * the OpenStreetMap buildings whose interior point stands in the unit — the buildings the map draws there. Ground (A)
 * stays the basemap's. A drawing records it (opts.cm) and counts both kinds (osmBuildings, cmBuildings).
 * addSeeds([[code, lat, lon] | [code, [[lat, lon], …]]], radiusM) — a code without an outline grows from a 24-gon of
 * radiusM round its point (or round each of its points), the seed of scripts/rule-outlines.py seed_polygon vertex for vertex.
 * addCores(featureCollection) — outlines the build will draw that the page does not show yet (they keep their ground).
 *
 * Grid 0.0001° (about 11 m). For a neighbourhood and every outline within reach (registry outlines and lodging drafts):
 *   A — the dark ground: what the basemap leaves free of forest, grassland, farmland, rock, wetland, sand, an urban park,
 *       sports and green land use, and water (ocean, lake, river, pond); a national park or protected area is not used;
 *       opened by 2 cells (a road's verge does not join two places), the part continuous with an outline, widened back
 *       by 2 cells, water removed, holes filled.
 *   B — the buildings that reach an outline, joined across gaps up to about 90 m (dilation 4 cells), trimmed back 3 cells
 *       (about 11 m round the outermost buildings), water removed, holes filled.
 *   area — (B ∩ A) ∪ the outlines, holes filled; the part continuous with this neighbourhood's outline. Where that part
 *       reaches other outlines, it is split between them halfway along the ground (each cell to the outline it is the
 *       shorter way from, inside the area; at an equal distance, the outline earlier in the registry's order): each keeps
 *       its share, its own outline included. Every share is exported, so the outlines of one area come from one drawing.
 *   grid — cells on one lattice for every drawing (multiples of 0.0001°), so two drawings of one place agree cell for cell.
 *   reach — the drawing box is the outline ± 2 km; an area touching it is drawn again within 5 km, unless the built-up
 *       ground already fills more than 35 % of the box (a city's continuous fabric). An area that touches the box again
 *       runs on beyond a town: it is reported, never applied.
 */
window.__rule = (() => {
  const m = window.__citymeter.map;
  const S = {tiles: {}, done: new Set(), out: {}, status: 'idle', err: []};
  const LC = new Set(['wood', 'grass', 'farmland', 'rock', 'wetland', 'sand']);
  const PARK = new Set(['park']);
  const WAT = new Set(['ocean', 'lake', 'river', 'pond']);
  const GREEN = new Set(['pitch', 'playground', 'zoo', 'stadium', 'garden', 'cemetery']);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const waitIdle = () => new Promise(res => { let d = false; const t = setTimeout(() => { if (!d) { d = true; res('timeout'); } }, 9000); m.once('idle', () => { if (!d) { d = true; clearTimeout(t); res('idle'); } }); });
  const tb = (x, y, z) => { const n = 2 ** z; const la = yy => Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) * 180 / Math.PI; return [x / n * 360 - 180, la(y + 1), (x + 1) / n * 360 - 180, la(y)]; };

  async function sweep(bbox) {
    m.jumpTo({center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2], zoom: 14.02, pitch: 0, bearing: 0}); await waitIdle();
    const b = m.getBounds(); const sx = (b.getEast() - b.getWest()) * 0.85, sy = (b.getNorth() - b.getSouth()) * 0.85;
    const cs = []; for (let la = bbox[3] - sy / 2; la > bbox[1] - sy / 2; la -= sy) for (let lo = bbox[0] + sx / 2; lo < bbox[2] + sx / 2; lo += sx) cs.push([lo, la]);
    for (const c of cs) {
      m.jumpTo({center: c, zoom: 14.02, pitch: 0, bearing: 0}); await waitIdle(); await sleep(200);
      const fresh = new Set();
      for (const sl of ['landcover', 'park', 'water', 'landuse', 'building']) for (const f of m.querySourceFeatures('openmaptiles', {sourceLayer: sl})) {
        if (!f.tile || f.tile.z !== 14) continue; const k = f.tile.x + '/' + f.tile.y; if (S.done.has(k)) continue;
        fresh.add(k); const T = S.tiles[k] || (S.tiles[k] = {x: f.tile.x, y: f.tile.y, landcover: [], park: [], water: [], landuse: [], building: []});
        const p = f.properties; T[sl].push({c: p.class || '', br: p.brunnel || '', g: f.geometry});
      }
      for (const k of fresh) S.done.add(k);
    }
    return cs.length;
  }
  const grid = bbox => { const res = 1e-4, lon0 = Math.floor(bbox[0] * 1e4) / 1e4, lat1 = Math.ceil(bbox[3] * 1e4) / 1e4;
    return {lon0, lat1, res, W: Math.ceil((bbox[2] - lon0) / res), H: Math.ceil((lat1 - bbox[1]) / res)}; };
  const cv = G => { const c = new OffscreenCanvas(G.W, G.H); const ctx = c.getContext('2d', {willReadFrequently: true}); ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; return ctx; };
  const pathG = (G, ctx, g) => { const ring = r => r.forEach(([lo, la], i) => { const x = (lo - G.lon0) / G.res, y = (G.lat1 - la) / G.res; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (g.type === 'Polygon') g.coordinates.forEach(r => { ring(r); ctx.closePath(); }); else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => { ring(r); ctx.closePath(); })); };
  const fillG = (G, ctx, g) => { ctx.beginPath(); pathG(G, ctx, g); ctx.fill('evenodd'); };
  const maskOf = (G, ctx) => { const d = ctx.getImageData(0, 0, G.W, G.H).data; const N = G.W * G.H; const o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = d[i * 4 + 3] >= 128 ? 1 : 0; return o; };
  const tilesIn = bbox => Object.values(S.tiles).filter(T => { const b = tb(T.x, T.y, 14); return b[2] > bbox[0] && b[0] < bbox[2] && b[3] > bbox[1] && b[1] < bbox[3]; });
  /** The owner's limits for one place, as light ground: 'poly' (a ring of [lon, lat]) fills an area the outline may not take,
   * 'lines' (parts of a road, w metres wide) cut the dark ground along it, 'near' keeps only the ground within d metres of
   * the given lines (a corridor). Each limit names what it stands for in 'label'. */
  const strokeG = (G, ctx, parts, wCells) => { ctx.lineWidth = Math.max(1, wCells); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const part of parts) { ctx.beginPath(); part.forEach(([lo, la], i) => { const x = (lo - G.lon0) / G.res, y = (G.lat1 - la) / G.res; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); } };
  function limitsInto(G, lc, limits) { const cellM = G.res * 110574;
    for (const L of limits) {
      if (L.poly) fillG(G, lc, {type: 'Polygon', coordinates: [L.poly]});
      else if (L.lines) strokeG(G, lc, L.lines, (L.w || 22) / cellM);
      else if (L.near) { const c = new OffscreenCanvas(G.W, G.H), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, G.W, G.H);
        x.globalCompositeOperation = 'destination-out'; x.strokeStyle = '#000'; strokeG(G, x, L.near, 2 * L.d / cellM); lc.drawImage(c, 0, 0); } } }
  /** 'hard' ground is kept out after every hole is filled: the land uses of the option lightLanduse (an industrial estate
   * inside a town would otherwise come back as a hole) and the owner's limits. */
  function base(G, bbox, X = {}) { const lc = cv(G), wa = cv(G), bd = cv(G), hd = cv(G), tk = cv(G), light = X.light || new Set();
    for (const T of tilesIn(bbox)) {
      for (const f of T.landcover) if (LC.has(f.c)) fillG(G, lc, f.g);
      for (const f of T.park) if (PARK.has(f.c)) fillG(G, lc, f.g);
      for (const f of T.landuse) { if (GREEN.has(f.c)) fillG(G, lc, f.g); if (light.has(f.c)) fillG(G, hd, f.g); }
      for (const f of T.water) if (WAT.has(f.c) && f.br !== 'tunnel') fillG(G, wa, f.g);
      for (const f of T.building) fillG(G, bd, f.g);
    }
    limitsInto(G, hd, X.limits || []);
    for (const L of X.limits || []) if (L.take) fillG(G, tk, {type: 'Polygon', coordinates: [L.take]});  // the owner's own area for the place
    const pass = Math.max(0, ...(X.limits || []).map(L => L.passWater || 0));  // metres of water a place within the owner's limits may cross
    return {lc: maskOf(G, lc), water: maskOf(G, wa), bld: maskOf(G, bd), hard: maskOf(G, hd), take: maskOf(G, tk), passCells: Math.round(pass / 2 / (G.res * 110574))}; }
  function morph(G) { const {W, H} = G, N = W * H;
    const dil = (a, r) => { const t = new Uint8Array(N), o = new Uint8Array(N), ps = new Int32Array(Math.max(W, H) + 1);
      for (let y = 0; y < H; y++) { const row = y * W; ps[0] = 0; for (let x = 0; x < W; x++) ps[x + 1] = ps[x] + a[row + x]; for (let x = 0; x < W; x++) t[row + x] = ps[Math.min(W, x + r + 1)] - ps[Math.max(0, x - r)] > 0 ? 1 : 0; }
      for (let x = 0; x < W; x++) { ps[0] = 0; for (let y = 0; y < H; y++) ps[y + 1] = ps[y] + t[y * W + x]; for (let y = 0; y < H; y++) o[y * W + x] = ps[Math.min(H, y + r + 1)] - ps[Math.max(0, y - r)] > 0 ? 1 : 0; }
      return o; };
    const not = a => { const o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = a[i] ? 0 : 1; return o; };
    const and = (a, b) => { const o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = a[i] && b[i] ? 1 : 0; return o; };
    const or = (a, b) => { const o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = a[i] || b[i] ? 1 : 0; return o; };
    const minus = (a, b) => { const o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = a[i] && !b[i] ? 1 : 0; return o; };
    const ero = (a, r) => not(dil(not(a), r));
    const comp = (a, seed) => { const o = new Uint8Array(N), q = new Int32Array(N); let h = 0, t = 0; for (let i = 0; i < N; i++) if (seed[i] && a[i]) { o[i] = 1; q[t++] = i; }
      while (h < t) { const i = q[h++], x = i % W; if (x > 0 && a[i - 1] && !o[i - 1]) { o[i - 1] = 1; q[t++] = i - 1; } if (x < W - 1 && a[i + 1] && !o[i + 1]) { o[i + 1] = 1; q[t++] = i + 1; } if (i >= W && a[i - W] && !o[i - W]) { o[i - W] = 1; q[t++] = i - W; } if (i < N - W && a[i + W] && !o[i + W]) { o[i + W] = 1; q[t++] = i + W; } } return o; };
    const fill = a => { const bg = not(a), s = new Uint8Array(N); for (let x = 0; x < W; x++) { s[x] = 1; s[(H - 1) * W + x] = 1; } for (let y = 0; y < H; y++) { s[y * W] = 1; s[y * W + W - 1] = 1; } return not(comp(bg, s)); };
    const sum = a => { let s = 0; for (let i = 0; i < N; i++) s += a[i]; return s; };
    return {dil, ero, not, and, or, minus, comp, fill, sum}; }
  const areaM2 = (G, a) => { let s = 0; for (let y = 0; y < G.H; y++) { const la = G.lat1 - (y + 0.5) * G.res; const ca = (G.res * 111320 * Math.cos(la * Math.PI / 180)) * (G.res * 110574); let n = 0; const row = y * G.W; for (let x = 0; x < G.W; x++) n += a[row + x]; s += n * ca; } return s; };
  const cellOf = (G, lo, la) => { const x = Math.floor((lo - G.lon0) / G.res), y = Math.floor((G.lat1 - la) / G.res); return (x < 0 || y < 0 || x >= G.W || y >= G.H) ? -1 : y * G.W + x; };
  const pip = (pt, g) => { const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; for (const p of polys) { let inP = false; for (const r of p) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inP = !inP; } if (inP) return true; } return false; };
  const bboxOf = g => { let a = [180, 90, -180, -90]; const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; for (const p of polys) for (const [lo, la] of p[0]) a = [Math.min(a[0], lo), Math.min(a[1], la), Math.max(a[2], lo), Math.max(a[3], la)]; return a; };

  // ----- outline of a mask: cell edges into rings, Douglas–Peucker at 1.2 cells, rings smaller than 30 cells dropped
  function trace(G, mask) { const {W, H} = G; const edges = new Map(); const add = (x1, y1, x2, y2) => { const k = x1 + ',' + y1; let a = edges.get(k); if (!a) { a = []; edges.set(k, a); } a.push([x2, y2]); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!mask[i]) continue;
      if (y === 0 || !mask[i - W]) add(x, y, x + 1, y); if (x === W - 1 || !mask[i + 1]) add(x + 1, y, x + 1, y + 1);
      if (y === H - 1 || !mask[i + W]) add(x + 1, y + 1, x, y + 1); if (x === 0 || !mask[i - 1]) add(x, y + 1, x, y); }
    const rings = []; for (const [k, arr] of edges) { while (arr.length) { const [sx, sy] = k.split(',').map(Number); const ring = [[sx, sy]]; let [cx, cy] = arr.pop(); let g = 0;
      while (!(cx === sx && cy === sy) && g++ < 5e6) { ring.push([cx, cy]); const a = edges.get(cx + ',' + cy); if (!a || !a.length) break; [cx, cy] = a.pop(); } ring.push([sx, sy]); rings.push(ring); } }
    return rings; }
  function dp(pts, tol) { if (pts.length < 4) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
    while (st.length) { const [a, b] = st.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b]; const dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy) || 1; let md = 0, mi = -1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L; if (d > md) { md = d; mi = i; } } if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
    return pts.filter((_, i) => keep[i]); }
  const ringArea = r => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(s) / 2; };
  const rings = (G, mask) => trace(G, mask).filter(r => ringArea(r) >= 30).map(r => { const s = dp(r.slice(0, -1), 1.2); s.push(s[0]); return s; });
  const enc = rs => rs.map(r => r.map(([x, y]) => x.toString(36).padStart(3, '0') + y.toString(36).padStart(3, '0')).join('')).join('|');

  class Heap { constructor() { this.k = []; this.v = []; } get size() { return this.k.length; }
    push(k, v) { const K = this.k, V = this.v; let i = K.length; K.push(k); V.push(v); while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= K[i]) break; [K[p], K[i]] = [K[i], K[p]]; [V[p], V[i]] = [V[i], V[p]]; i = p; } }
    pop() { const K = this.k, V = this.v; const tk = K[0], tv = V[0]; const lk = K.pop(), lv = V.pop(); if (K.length) { K[0] = lk; V[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < K.length && K[l] < K[s]) s = l; if (r < K.length && K[r] < K[s]) s = r; if (s === i) break; [K[s], K[i]] = [K[i], K[s]]; [V[s], V[i]] = [V[i], V[s]]; i = s; } } return [tk, tv]; } }
  /** Multi-source spread on the grid (8 neighbours, metres per step): every cell reached within 'limit' takes the label of
   * the seed it is nearest to (at an equal distance, the smaller label); 'allowed' (a mask or null) is where it may go. */
  function spread(G, labels, allowed, limit) { const {W, H} = G, N = W * H, d2r = Math.PI / 180;
    const latm = G.lat1 - H * G.res / 2, dx = G.res * 111320 * Math.cos(latm * d2r), dy = G.res * 110574, dd = Math.hypot(dx, dy);
    const steps = [[1, 0, dx], [-1, 0, dx], [0, 1, dy], [0, -1, dy], [1, 1, dd], [1, -1, dd], [-1, 1, dd], [-1, -1, dd]];
    const D = new Float64Array(N).fill(Infinity), L = new Int32Array(N).fill(-1), h = new Heap();
    for (let i = 0; i < N; i++) if (labels[i] >= 0) { D[i] = 0; L[i] = labels[i]; h.push(0, i); }
    while (h.size) { const [d, u] = h.pop(); if (d > D[u]) continue; const ux = u % W, uy = (u - ux) / W;
      for (const [sx, sy, c] of steps) { const x = ux + sx, y = uy + sy; if (x < 0 || y < 0 || x >= W || y >= H) continue; const v = y * W + x;
        if (allowed && !allowed[v]) continue; const nd = d + c; if (nd > limit) continue;
        if (nd < D[v] - 1e-6) { D[v] = nd; L[v] = L[u]; h.push(nd, v); } else if (nd <= D[v] + 1e-6 && L[u] < L[v]) L[v] = L[u]; } }
    return {D, L}; }
  // ----- the rule
  function draw(P) { const G = P.G, M = morph(G), B0 = P.base, N = G.W * G.H;
    let all = new Uint8Array(N); for (const c of P.coreMasks) all = M.or(all, c.mask);
    const hard = B0.hard || new Uint8Array(N);
    // where the owner set the limits, a canal narrower than 'passWater' no longer stops the outline: only wider water does
    const wat = B0.passCells ? M.dil(M.ero(B0.water, B0.passCells), B0.passCells) : B0.water;
    const dark = M.and(M.and(M.not(B0.lc), M.not(wat)), M.not(hard));
    const A = M.minus(M.fill(M.and(M.dil(M.or(M.comp(M.dil(M.ero(dark, 2), 2), all), all), 2), M.not(wat))), hard);
    const B = M.fill(M.and(M.ero(M.comp(M.dil(B0.bld, 4), all), 3), M.not(wat)));
    const take = B0.take ? M.and(B0.take, M.not(wat)) : new Uint8Array(N);  // the owner's own area, land only
    const E0 = M.or(M.minus(M.fill(M.or(M.or(M.and(A, B), take), all)), hard), all);
    const part = M.comp(E0, P.seed);
    const sh = P.coreMasks.map((c, j) => j).filter(j => M.sum(M.and(P.coreMasks[j].mask, part)) > 0);
    const me = P.coreMasks.findIndex(c => c.own), shares = {};
    if (sh.length > 1) {
      const labels = new Int32Array(N).fill(-1);
      for (const j of sh) { const mk = P.coreMasks[j].mask; for (let i = 0; i < N; i++) if (mk[i] && labels[i] < 0) labels[i] = j; }
      const sp = spread(G, labels, part, Infinity);
      for (const j of sh) { const mk = P.coreMasks[j].mask, mine = new Uint8Array(N); for (let i = 0; i < N; i++) if (sp.L[i] === j || mk[i]) mine[i] = 1; shares[P.coreMasks[j].id] = M.comp(mine, mk); }
    } else shares[P.coreMasks[me].id] = part;
    const edgeOf = a => { let e = 0; for (let x = 0; x < G.W; x++) e += a[x] + a[(G.H - 1) * G.W + x]; for (let y = 0; y < G.H; y++) e += a[y * G.W] + a[y * G.W + G.W - 1]; return e; };
    const E = shares[P.coreMasks[me].id];
    return {E, part, shares, edge: edgeOf(part), edgeOwn: edgeOf(E), fill: M.sum(part) / N, sharers: sh.filter(j => j !== me).map(j => P.coreMasks[j].id)}; }

  // ----- CityMETER Building V4 (option cm): the footprints the map draws inside a CityMETER unit
  const meets = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
  const centre = g => { const q = g.type === 'MultiPolygon' ? g.coordinates[0][0] : g.coordinates[0]; let sx = 0, sy = 0; for (const v of q) { sx += v[0]; sy += v[1]; } return [sx / q.length, sy / q.length]; };
  async function cmZones(O) { if (S.cmZones) return S.cmZones;
    const [bu, mvt] = await Promise.all([import(O.unitsModule), import(O.mvtModule)]), idx = await getJSON(O.unitsBase + 'index.json'), zones = [];
    const provs = idx.provinces.map(p => p.province);
    for (let i = 0; i < provs.length; i += 6) for (const j of await Promise.all(provs.slice(i, i + 6).map(p => getJSON(O.unitsBase + p + '.json').catch(() => null)))) if (j && bu.validUnitFile(j)) zones.push(...bu.zonesOf(j));
    S.cm = {bu, mvt}; S.cmZones = zones; return zones; }
  async function cmTile(url) { for (let k = 0; ; k++) { try { const r = await fetch(url); if (!r.ok) throw new Error('' + r.status); const u8 = new Uint8Array(await r.arrayBuffer());
      return u8.byteLength ? (S.cm.mvt.parseVectorTile(u8, {only: ['building-detail']}).layers['building-detail'] || {extent: 4096, features: []}) : {extent: 4096, features: []}; }
    catch (e) { if (k >= 2) throw new Error('V4 tile ' + url.split('?')[0] + ': ' + e.message); await sleep(800); } } }
  /** Read the V4 footprints of every tile of bbox that meets a CityMETER unit: a building once, from the tile that holds
   * its interior point (the production tiles send every building that touches a tile whole), outer rings by the sign of
   * their area in tile units (the vector-tile rule), holes after their outer ring. */
  async function cmFill(bbox, O) { const zones = await cmZones(O), {bu, mvt} = S.cm;
    for (const T of tilesIn(bbox)) { if (T.cm) continue; const t = {x: T.x, y: T.y, z: 14}, b = tb(T.x, T.y, 14), here = zones.filter(z => meets(z.bbox, b)), feats = [], seen = new Set();
      for (const z of here) for (const u of z.tileUnits) { if (!meets(u.bbox, b)) continue; const url = bu.cmTileUrl(t, u, z.tileType); if (!url) continue;
        const L = await cmTile(url), ext = L.extent || 4096;
        for (const f of L.features) { if (f.type !== 3) continue; const polys = [];
          for (const ring of f.rings()) { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
            if (a > 0) polys.push([ring]); else if (polys.length) polys[polys.length - 1].push(ring); }
          for (const p of polys) { const o = p[0]; let sx = 0, sy = 0; for (const v of o) { sx += v[0]; sy += v[1]; } const ix = sx / o.length, iy = sy / o.length;
            if (!(ix >= 0 && ix < ext && iy >= 0 && iy < ext)) continue;
            const ll = p.map(r => r.map(([px, py]) => mvt.tileToLonLat(px, py, t, ext))), q = ll[0], key = q.length + '|' + q[0][0].toFixed(7) + ',' + q[0][1].toFixed(7) + '|' + (q[1] || q[0])[0].toFixed(7);
            if (seen.has(key)) continue; seen.add(key); feats.push({c: '', br: '', g: {type: 'Polygon', coordinates: ll}, cm: 1}); } } }
      T.osm = T.osm || T.building; T.cmB = feats; T.cmZ = here; T.cm = true; } }
  /** The buildings of the tiles of bbox: the map's (V4 inside a CityMETER unit, OSM elsewhere) with cm, OSM only without. */
  function useCm(bbox, on) { for (const T of tilesIn(bbox)) { if (!T.osm) continue;
    T.building = on ? T.osm.filter(f => !(T.cmZ.length && S.cm.bu.zoneAt(T.cmZ, centre(f.g)))).concat(T.cmB) : T.osm; } }

  // ----- run: sweep each neighbourhood's tiles, draw, check, trace
  const DEFAULTS = {coresUrl: '/commercialdistrict/data/boundaries.geojson', hotelsUrl: '/hotel/data/hotels.json', tileJsonUrl: 'https://tiles.openfreemap.org/planet',
                    reachM: [2000, 5000], denseFill: 0.35, keepTiles: 160,
                    unitsBase: '/commercialdistrict/data/building-units/', unitsModule: '/commercialdistrict/js/shell/building-units.js', mvtModule: '/commercialdistrict/js/shell/mvt.js'};
  const getJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  const tileRange = bbox => { const n = 2 ** 14, tx = lo => Math.floor((lo + 180) / 360 * n), ty = la => Math.floor((1 - Math.log(Math.tan(la * Math.PI / 180) + 1 / Math.cos(la * Math.PI / 180)) / Math.PI) / 2 * n);
    const out = []; for (let x = tx(bbox[0]); x <= tx(bbox[2]); x++) for (let y = ty(bbox[3]); y <= ty(bbox[1]); y++) out.push(x + '/' + y); return out; };
  async function one(F, O, reach) {
    const g = F.geometry, cb = bboxOf(g), ky = 1 / 111000, kx = 1 / (111000 * Math.cos((cb[1] + cb[3]) / 2 * Math.PI / 180));
    const bbox = [cb[0] - reach * kx, cb[1] - reach * ky, cb[2] + reach * kx, cb[3] + reach * ky];
    if (Object.keys(S.tiles).length > O.keepTiles) { for (const k of Object.keys(S.tiles)) { const T = S.tiles[k], b = tb(T.x, T.y, 14); if (!(b[2] > bbox[0] && b[0] < bbox[2] && b[3] > bbox[1] && b[1] < bbox[3])) { delete S.tiles[k]; S.done.delete(k); } } }
    const need = tileRange(bbox), positions = need.every(k => S.done.has(k)) ? 0 : await sweep(bbox);
    if (O.cm) await cmFill(bbox, O);
    useCm(bbox, !!O.cm);
    const P = {bbox, G: grid(bbox)}; const G = P.G, M = morph(G);
    P.base = base(G, bbox, {light: new Set(O.lightLanduse || []), limits: (O.limits || {})[F.properties.id] || []});
    const ras = gg => { const ctx = cv(G); fillG(G, ctx, gg); return maskOf(G, ctx); };
    // (0.5.2) a seed covers about one cell and can fall between cells (none half covered): it keeps the cell of its point
    // (in 0.5.0, 18 of the 228 seeds of 8 m vanished so, and their codes were drawn from the 40 m seed)
    const rasSeed = (gg, kind) => { const mk = ras(gg); if (kind !== 'seed' || mk.some(v => v)) return mk;
      for (const p of (gg.type === 'Polygon' ? [gg.coordinates] : gg.coordinates)) { const q = p[0].slice(0, -1); const c = cellOf(G, q.reduce((s, v) => s + v[0], 0) / q.length, q.reduce((s, v) => s + v[1], 0) / q.length); if (c >= 0) mk[c] = 1; }
      return mk; };
    P.seed = rasSeed(g, F.properties.kind);
    P.coreMasks = []; for (const C of S.cores) { const b = C.bbox; if (b[2] < bbox[0] || b[0] > bbox[2] || b[3] < bbox[1] || b[1] > bbox[3]) continue; P.coreMasks.push({id: C.id, kind: C.kind, own: C.id === F.properties.id, mask: C.id === F.properties.id ? P.seed : rasSeed(C.g, C.kind)}); }
    const r = draw(P);
    const cents = [], cmCents = []; for (const T of tilesIn(bbox)) { const b = tb(T.x, T.y, 14); for (const f of T.building) { const polys = f.g.type === 'MultiPolygon' ? f.g.coordinates : [f.g.coordinates]; for (const p of polys) { const q = p[0]; let sx = 0, sy = 0; for (const v of q) { sx += v[0]; sy += v[1]; } const cx = sx / q.length, cy = sy / q.length; if (cx < b[0] || cx >= b[2] || cy < b[1] || cy >= b[3]) continue; (f.cm ? cmCents : cents).push(cellOf(G, cx, cy)); } } }
    const count = (mk, cs = cents) => { let k = 0; for (const c of cs) if (c >= 0 && mk[c]) k++; return k; };
    const hot = mk => { let k = 0; for (const [lo, la] of S.hot) { const c = cellOf(G, lo, la); if (c >= 0 && mk[c]) k++; } return k; };
    return {P, r, positions, stats: {reachM: reach, areaM2: Math.round(areaM2(G, r.E)), coreM2: Math.round(areaM2(G, P.seed)), partM2: Math.round(areaM2(G, r.part)),
      edgeCells: r.edge, edgeOwn: r.edgeOwn, fill: +r.fill.toFixed(3), sharers: r.sharers, osmBuildings: count(r.E), osmBuildingsCore: count(P.seed), hotels: hot(r.E), hotelsCore: hot(P.seed), positions,
      ...(O.cm ? {cmBuildings: count(r.E, cmCents), cmBuildingsCore: count(P.seed, cmCents)} : {})}};
  }
  async function run(ids, options = {}) { const O = {...DEFAULTS, ...options}; S.status = 'loading'; S.err = [];
    if (!S.cores) { const gj = await getJSON(O.coresUrl); S.cores = gj.features.map(f => ({id: f.properties.id, kind: f.properties.kind, g: f.geometry, bbox: bboxOf(f.geometry), f})); }
    if (!S.hot) { const hj = await getJSON(O.hotelsUrl); const c = hj.cols; S.hot = []; for (let i = 0; i < c.key.length; i++) if (c.lat[i] != null && c.lon[i] != null) S.hot.push([c.lon[i], c.lat[i]]); }
    if (!S.tilesBuild) { try { const tj = await getJSON(O.tileJsonUrl); S.tilesBuild = ((tj.tiles || [''])[0].split('/').find(x => /^\d{8}_/.test(x))) || ''; } catch { S.tilesBuild = ''; } }
    const byId = new Map(S.cores.map(C => [C.id, C.f]));
    for (const id of ids) { if (S.out[id] && !O.redo) continue; try { S.status = 'place ' + id + ' (' + Object.keys(S.out).length + '/' + ids.length + ')';
      const F = byId.get(id); if (!F) throw new Error('no outline');
      let res = await one(F, O, O.reachM[0]);
      if (res.stats.edgeCells && res.stats.fill <= O.denseFill) res = await one(F, O, O.reachM[1]);
      const st = res.stats, grows = st.areaM2 > st.coreM2 * 1.02 + 200, apply = grows && !st.edgeCells;
      const shares = {}; if (apply && st.sharers.length) for (const [k, mk] of Object.entries(res.r.shares)) shares[k] = enc(rings(res.P.G, mk));
      const lim = (O.limits || {})[id] || [], opts = {};
      if ((O.lightLanduse || []).length) opts.lightLanduse = O.lightLanduse;
      if (O.cm) opts.cm = 'CityMETER Building V4';
      if (lim.length) opts.limits = lim.map(L => L.label || (L.take ? 'own area' : L.poly ? 'area' : L.near ? 'corridor' : L.passWater ? 'water to cross' : 'line'));
      S.out[id] = {id, kind: F.properties.kind, grid: [+res.P.G.lon0.toFixed(4), +res.P.G.lat1.toFixed(4), res.P.G.res], check: st, rings: apply ? enc(rings(res.P.G, res.r.E)) : '', shares, ...(Object.keys(opts).length ? {opts} : {})};
    } catch (e) { S.err.push(id + ': ' + (e && e.stack ? e.stack.slice(0, 300) : e)); } }
    S.status = 'done'; }
  /** Seeds: a 24-gon of radiusM round a code's point, or round each of its points (scripts/rule-outlines.py seed_polygon). */
  function addSeeds(list, radiusM) { if (!S.cores) throw new Error('run([]) first: the outlines load with it');
    const gon = (lat, lon) => { const ky = 1 / 111320, kx = 1 / (111320 * Math.cos(lat * Math.PI / 180)), q = [];
      for (let k = 0; k <= 24; k++) { const a = 2 * Math.PI * (k % 24) / 24; q.push([+(lon + radiusM * kx * Math.cos(a)).toFixed(7), +(lat + radiusM * ky * Math.sin(a)).toFixed(7)]); } return [q]; };
    for (const s of list) { const pts = Array.isArray(s[1]) ? s[1] : [[s[1], s[2]]];
      const g = pts.length === 1 ? {type: 'Polygon', coordinates: gon(...pts[0])} : {type: 'MultiPolygon', coordinates: pts.map(p => gon(...p))};
      const C = {id: s[0], kind: 'seed', g, bbox: bboxOf(g), f: {type: 'Feature', properties: {id: s[0], kind: 'seed'}, geometry: g}};
      const i = S.cores.findIndex(c => c.id === s[0]); if (i >= 0) S.cores[i] = C; else S.cores.push(C); }
    return S.cores.length; }
  /** Outlines the next build draws that the page does not show yet: they keep their ground (split halfway, never taken). */
  function addCores(fc) { if (!S.cores) throw new Error('run([]) first: the outlines load with it');
    for (const f of fc.features) { const id = f.properties.canonical_id || f.properties.id, C = {id, kind: f.properties.kind || 'screen', g: f.geometry, bbox: bboxOf(f.geometry), f: {type: 'Feature', properties: {id, kind: f.properties.kind || 'screen'}, geometry: f.geometry}};
      const i = S.cores.findIndex(c => c.id === id); if (i >= 0) S.cores[i] = C; else S.cores.push(C); }
    return S.cores.length; }
  /** The export, in parts: places [from, to) of the order run went through. */
  const exportText = (from = 0, to = Infinity) => JSON.stringify({drawnOn: new Date().toISOString().slice(0, 10), tilesBuild: S.tilesBuild, places: Object.values(S.out).slice(from, to), errors: S.err});
  /** A drawing's rings as GeoJSON (cell corners back to degrees; rings of one share by even–odd, as drawn). */
  const geo = (grid, s) => ({type: 'MultiLineString', coordinates: s ? s.split('|').map(r => { const q = []; for (let i = 0; i < r.length; i += 6) q.push([+(grid[0] + parseInt(r.slice(i, i + 3), 36) * grid[2]).toFixed(7), +(grid[1] - parseInt(r.slice(i + 3, i + 6), 36) * grid[2]).toFixed(7)]); return q; }) : []});
  /** Draw a place's new outline (and its registry outline) over the demo's map, for looking at it. */
  function show(ids) { const fs = []; for (const id of [].concat(ids)) { const o = S.out[id]; if (!o) continue; fs.push({type: 'Feature', properties: {k: 'new'}, geometry: geo(o.grid, o.rings)}); const C = S.cores.find(c => c.id === id); if (C) fs.push({type: 'Feature', properties: {k: 'old'}, geometry: C.g}); }
    const fc = {type: 'FeatureCollection', features: fs}; if (m.getSource('rule-preview')) m.getSource('rule-preview').setData(fc); else { m.addSource('rule-preview', {type: 'geojson', data: fc});
      m.addLayer({id: 'rule-preview-old', type: 'line', source: 'rule-preview', filter: ['==', ['get', 'k'], 'old'], paint: {'line-color': '#ffffff', 'line-width': 1.5, 'line-dasharray': [2, 1.5]}});
      m.addLayer({id: 'rule-preview-new', type: 'line', source: 'rule-preview', filter: ['==', ['get', 'k'], 'new'], paint: {'line-color': '#ffd23f', 'line-width': 2.5}}); }
    let b = [180, 90, -180, -90]; for (const f of fs) for (const l of (f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : (f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map(p => p[0])))) for (const [lo, la] of l) b = [Math.min(b[0], lo), Math.min(b[1], la), Math.max(b[2], lo), Math.max(b[3], la)];
    if (b[0] < 180) m.fitBounds([[b[0], b[1]], [b[2], b[3]]], {padding: 60, duration: 0}); return fs.length; }
  /** The export as gzip, base64, in parts of 'size' characters, with the SHA-256 of the JSON text. */
  async function exportGz(from = 0, to = Infinity, size = 18000) { const t = exportText(from, to), u8 = new TextEncoder().encode(t);
    const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map(x => x.toString(16).padStart(2, '0')).join('');
    const gz = new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let b64 = ''; for (let i = 0; i < gz.length; i += 0x8000) b64 += String.fromCharCode.apply(null, gz.subarray(i, i + 0x8000)); b64 = btoa(b64);
    const parts = []; for (let i = 0; i < b64.length; i += size) parts.push(b64.slice(i, i + size)); S.gz = {sha, bytes: u8.length, parts}; return {sha, bytes: u8.length, gzBytes: gz.length, parts: parts.length}; }
  return {S, run, exportText, exportGz, show, geo, sweep, grid, morph, draw, rings, one, addSeeds, addCores, cmFill};
})();
