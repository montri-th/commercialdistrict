/*
 * CityMETER · Commercial District — draw the trial wider areas (พื้นที่ย่าน, 0.3.0) from the demo's own basemap.
 *
 * Two ways to run it, the same script either way:
 *   - headless, from this repository: python3 -I scripts/draw-extents.py draw --out <export.json> (needs the network to
 *     reach tiles.openfreemap.org; the registry outlines, hotels and subdistrict outlines come pinned from GitHub);
 *   - in the console of the live demo (https://citymeter.pages.dev/commercialdistrict/), which serves the same files on
 *     its own origin: paste this file, then  await window.__ext.run(window.__ext.PLACES)  and copy window.__ext.exportText().
 * Then: python3 -I scripts/extents-from-export.py <export.json> amendments/extents-<date>.geojson
 * Read only: it moves the map and reads the vector tiles the page already loads (OpenFreeMap, OpenMapTiles schema, zoom 14).
 *
 * Grid: 0.0001° (about 11 m). Rules (DATA_METHOD.md §2c):
 *   beach — dark = not (forest, grassland, farmland, rock, wetland, sand, an urban park, sports and green land use) and
 *           not water (ocean, lake, river, pond); a national park or protected area is not used (its forest is land cover
 *           already, and its legal edge can take in a whole town); the dark ground continuous with the core after an
 *           opening of 2 cells (narrow gaps along roads do not join two places), widened back by 2 cells, water removed,
 *           holes filled = A; the buildings joined across up to ~90 m (dilation 4 cells), the cluster(s) touching the
 *           core, trimmed back 3 cells, water removed, holes filled = B; area = (A ∩ within 130 m of B) ∪ core, cut to the
 *           core's subdistrict(s), the part continuous with the core, holes filled.
 *   walk  — the basemap's streets and paths (expressways, railways and transit lines left out) drawn on the grid; from
 *           every registry outline in reach at once, an 800 m walk along them, each street cell going to the core it is
 *           the shorter walk from (two walks meet halfway); 40 m either side of this core's streets (a cell going to the
 *           core of its nearest street) ∪ the core, holes filled, other cores and water taken out, the part continuous
 *           with the core.
 *   choice — a beach town is drawn by both; the walk rule is used instead when the beach area takes in another registry
 *           outline (the built-up ground runs into another neighbourhood), reaches 5 km from the core (it runs on beyond
 *           a town) or is smaller than the walk area (the map's buildings are too sparse to follow).
 * Distances of 130 m and more are measured in metres on the grid (8-neighbour chamfer), so an edge does not run square
 * with the grid; the small joins (4, 3 and 2 cells) are square.
 */
window.__ext = (() => {
  const m = window.__citymeter.map;
  const S = {tiles: {}, done: new Set(), out: {}, status: 'idle', err: []};
  const LC = new Set(['wood', 'grass', 'farmland', 'rock', 'wetland', 'sand']);
  const PARK = new Set(['park']);
  const WAT = new Set(['ocean', 'lake', 'river', 'pond']);
  const GREEN = new Set(['pitch', 'playground', 'zoo', 'stadium', 'garden', 'cemetery']);
  const NOWALK = new Set(['motorway', 'rail', 'transit', 'ferry', 'raceway', 'busway', 'bus_guideway', 'aerialway']);
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
      for (const sl of ['landcover', 'park', 'water', 'landuse', 'building', 'transportation']) for (const f of m.querySourceFeatures('openmaptiles', {sourceLayer: sl})) {
        if (!f.tile || f.tile.z !== 14) continue; const k = f.tile.x + '/' + f.tile.y; if (S.done.has(k)) continue;
        fresh.add(k); const T = S.tiles[k] || (S.tiles[k] = {x: f.tile.x, y: f.tile.y, landcover: [], park: [], water: [], landuse: [], building: [], transportation: []});
        const p = f.properties; T[sl].push({c: p.class || '', br: p.brunnel || '', g: f.geometry});
      }
      for (const k of fresh) S.done.add(k);
    }
    return cs.length;
  }
  const grid = bbox => { const res = 1e-4; return {lon0: bbox[0], lat1: bbox[3], res, W: Math.ceil((bbox[2] - bbox[0]) / res), H: Math.ceil((bbox[3] - bbox[1]) / res)}; };
  const cv = G => { const c = new OffscreenCanvas(G.W, G.H); const ctx = c.getContext('2d', {willReadFrequently: true}); ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; return ctx; };
  const pathG = (G, ctx, g) => { const ring = r => r.forEach(([lo, la], i) => { const x = (lo - G.lon0) / G.res, y = (G.lat1 - la) / G.res; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (g.type === 'Polygon') g.coordinates.forEach(r => { ring(r); ctx.closePath(); }); else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(r => { ring(r); ctx.closePath(); })); };
  const fillG = (G, ctx, g) => { ctx.beginPath(); pathG(G, ctx, g); ctx.fill('evenodd'); };
  const maskOf = (G, ctx) => { const d = ctx.getImageData(0, 0, G.W, G.H).data; const N = G.W * G.H; const o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = d[i * 4 + 3] >= 128 ? 1 : 0; return o; };
  const tilesIn = bbox => Object.values(S.tiles).filter(T => { const b = tb(T.x, T.y, 14); return b[2] > bbox[0] && b[0] < bbox[2] && b[3] > bbox[1] && b[1] < bbox[3]; });
  function base(G, bbox) { const lc = cv(G), wa = cv(G), bd = cv(G);
    for (const T of tilesIn(bbox)) {
      for (const f of T.landcover) if (LC.has(f.c)) fillG(G, lc, f.g);
      for (const f of T.park) if (PARK.has(f.c)) fillG(G, lc, f.g);
      for (const f of T.landuse) if (GREEN.has(f.c)) fillG(G, lc, f.g);
      for (const f of T.water) if (WAT.has(f.c) && f.br !== 'tunnel') fillG(G, wa, f.g);
      for (const f of T.building) fillG(G, bd, f.g);
    }
    return {lc: maskOf(G, lc), water: maskOf(G, wa), bld: maskOf(G, bd)}; }
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

  // ----- rules
  /** Cells within `metres` of a mask: an 8-neighbour chamfer distance in metres (two passes). */
  function within(G, mask, metres) { const {W, H} = G, N = W * H, d2r = Math.PI / 180;
    const latm = G.lat1 - H * G.res / 2, dx = G.res * 111320 * Math.cos(latm * d2r), dy = G.res * 110574, dd = Math.hypot(dx, dy);
    const D = new Float64Array(N); for (let i = 0; i < N; i++) D[i] = mask[i] ? 0 : Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; let d = D[i];
      if (x > 0) d = Math.min(d, D[i - 1] + dx); if (y > 0) { d = Math.min(d, D[i - W] + dy); if (x > 0) d = Math.min(d, D[i - W - 1] + dd); if (x < W - 1) d = Math.min(d, D[i - W + 1] + dd); } D[i] = d; }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; let d = D[i];
      if (x < W - 1) d = Math.min(d, D[i + 1] + dx); if (y < H - 1) { d = Math.min(d, D[i + W] + dy); if (x < W - 1) d = Math.min(d, D[i + W + 1] + dd); if (x > 0) d = Math.min(d, D[i + W - 1] + dd); } D[i] = d; }
    const o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = D[i] <= metres ? 1 : 0; return o; }
  function beach(P) { const G = P.G, M = morph(G), B = P.base, seed = P.seed;
    const dark = M.and(M.not(B.lc), M.not(B.water)); const darkO = M.dil(M.ero(dark, 2), 2);
    let compA = M.comp(darkO, seed); if (M.sum(compA) < M.sum(seed)) compA = M.or(compA, seed);
    const A = M.fill(M.and(M.dil(compA, 2), M.not(B.water)));
    const Bm = M.fill(M.and(M.ero(M.comp(M.dil(B.bld, 4), seed), 3), M.not(B.water)));
    const pre = M.or(M.and(A, within(G, Bm, 130)), seed);
    const capd = M.or(M.and(pre, P.cap), seed);
    const E = M.fill(M.comp(capd, seed));
    return {E, info: {preM2: Math.round(areaM2(G, pre)), outsideCapM2: Math.round(areaM2(G, M.minus(pre, P.cap))), capM2: Math.round(areaM2(G, P.cap))}}; }
  class Heap { constructor() { this.k = []; this.v = []; } get size() { return this.k.length; }
    push(k, v) { const K = this.k, V = this.v; let i = K.length; K.push(k); V.push(v); while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= K[i]) break; [K[p], K[i]] = [K[i], K[p]]; [V[p], V[i]] = [V[i], V[p]]; i = p; } }
    pop() { const K = this.k, V = this.v; const tk = K[0], tv = V[0]; const lk = K.pop(), lv = V.pop(); if (K.length) { K[0] = lk; V[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < K.length && K[l] < K[s]) s = l; if (r < K.length && K[r] < K[s]) s = r; if (s === i) break; [K[s], K[i]] = [K[i], K[s]]; [V[s], V[i]] = [V[i], V[s]]; i = s; } } return [tk, tv]; } }
  /** Multi-source spread on the grid (8 neighbours, metres per step): every cell reached within `limit` takes the label of
   * the seed it is nearest to; `allowed` (a mask or null) is where the spread may go. */
  function spread(G, labels, allowed, limit) { const {W, H} = G, N = W * H, d2r = Math.PI / 180;
    const latm = G.lat1 - H * G.res / 2, dx = G.res * 111320 * Math.cos(latm * d2r), dy = G.res * 110574, dd = Math.hypot(dx, dy);
    const steps = [[1, 0, dx], [-1, 0, dx], [0, 1, dy], [0, -1, dy], [1, 1, dd], [1, -1, dd], [-1, 1, dd], [-1, -1, dd]];
    const D = new Float64Array(N).fill(Infinity), L = new Int32Array(N).fill(-1), h = new Heap();
    for (let i = 0; i < N; i++) if (labels[i] >= 0) { D[i] = 0; L[i] = labels[i]; h.push(0, i); }
    while (h.size) { const [d, u] = h.pop(); if (d > D[u]) continue; const ux = u % W, uy = (u - ux) / W;
      for (const [sx, sy, c] of steps) { const x = ux + sx, y = uy + sy; if (x < 0 || y < 0 || x >= W || y >= H) continue; const v = y * W + x;
        if (allowed && !allowed[v]) continue; const nd = d + c; if (nd < D[v] && nd <= limit) { D[v] = nd; L[v] = L[u]; h.push(nd, v); } } }
    return {D, L}; }
  /* The walk is measured on the grid along the streets as drawn (two cells wide), not on a graph of their vertices: pieces
   * of one street cut at a tile's edge overlap there and join, whether or not they share a vertex. A street crossing
   * another on a bridge joins it where they cross (expressways, railways and transit lines are left out). */
  function walk(P, maxM = 800, halfW = 40) { const G = P.G, M = morph(G), N = G.W * G.H;
    const ctx = cv(G); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); let pieces = 0;
    for (const T of tilesIn(P.bbox)) for (const f of T.transportation) { if (NOWALK.has(f.c)) continue; const g = f.g;
      const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const ln of lines) { ln.forEach(([lo, la], i) => { const x = (lo - G.lon0) / G.res, y = (G.lat1 - la) / G.res; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); pieces++; } }
    ctx.stroke(); const net = maskOf(G, ctx);
    // 1. from every registry outline in reach at once: each street cell goes to the core it is the shortest walk from
    const seeds = new Int32Array(N).fill(-1);
    P.coreMasks.forEach((cm, j) => { const dm = M.dil(cm.mask, 2); for (let i = 0; i < N; i++) if (dm[i] && net[i] && seeds[i] < 0) seeds[i] = j; });
    const w = spread(G, seeds, net, maxM);
    // 2. 40 m either side of the reached streets: a cell goes to the core of the street it is nearest to
    const band = spread(G, w.L, null, halfW);
    const own = new Set(P.coreMasks.map((cm, j) => (cm.own ? j : -1)).filter(j => j >= 0));
    const mine = new Uint8Array(N); let streets = 0;
    for (let i = 0; i < N; i++) { if (own.has(band.L[i])) mine[i] = 1; if (net[i] && own.has(w.L[i])) streets++; }
    let others = new Uint8Array(N); P.coreMasks.forEach(cm => { if (!cm.own) others = M.or(others, cm.mask); });
    const E = M.fill(M.comp(M.minus(M.minus(M.fill(M.or(mine, P.seed)), others), M.minus(P.base.water, P.seed)), P.seed));
    return {E, info: {pieces, streetCells: streets, neighbours: P.coreMasks.filter(c => !c.own).length}}; }

  // ----- run every place: sweep its tiles, rasterise, apply its rule, check, trace
  // Where the three inputs are read: the live demo's own origin by default; the headless runner passes its local paths.
  const DEFAULTS = {coresUrl: '/commercialdistrict/data/boundaries.geojson', hotelsUrl: '/hotel/data/hotels.json', framesBase: '/pharmacy/data/frames/', tileJsonUrl: 'https://tiles.openfreemap.org/planet'};
  const getJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  async function run(places, options = {}) { const O = {...DEFAULTS, ...options}; S.status = 'loading'; S.err = [];
    if (!S.cores) { const g = await getJSON(O.coresUrl); S.cores = new Map(g.features.map(f => [f.properties.id, f.geometry])); }
    if (!S.hot) { const hj = await getJSON(O.hotelsUrl); const c = hj.cols; S.hot = []; for (let i = 0; i < c.key.length; i++) if (c.lat[i] != null && c.lon[i] != null) S.hot.push([c.lon[i], c.lat[i]]); }
    if (!S.tilesBuild) { try { const tj = await getJSON(O.tileJsonUrl); S.tilesBuild = ((tj.tiles || [''])[0].split('/').find(s => /^\d{8}_/.test(s))) || ''; } catch { S.tilesBuild = ''; } }
    S.frames = S.frames || {};
    for (const P of places) { try { S.status = 'place ' + P.key;
      if (!S.frames[P.prov]) { const t = await getJSON(O.framesBase + P.prov + '.json'); S.frames[P.prov] = (t.areas || t).features; }
      const cg = P.cores.map(id => S.cores.get(id)); let cb = [180, 90, -180, -90]; for (const g of cg) { const b = bboxOf(g); cb = [Math.min(cb[0], b[0]), Math.min(cb[1], b[1]), Math.max(cb[2], b[2]), Math.max(cb[3], b[3])]; }
      const ky = 1 / 111000, kx = 1 / (111000 * Math.cos((cb[1] + cb[3]) / 2 * Math.PI / 180));
      const caps = []; let bbox;
      if (P.rule === 'beach') { for (const g of cg) { const r0 = (g.type === 'Polygon' ? g.coordinates : g.coordinates[0])[0]; const c = r0.reduce((s, p) => [s[0] + p[0] / r0.length, s[1] + p[1] / r0.length], [0, 0]); for (const f of S.frames[P.prov]) if (pip(c, f.geometry) && !caps.includes(f)) caps.push(f); }
        let tbx = [180, 90, -180, -90]; for (const f of caps) { const b = bboxOf(f.geometry); tbx = [Math.min(tbx[0], b[0]), Math.min(tbx[1], b[1]), Math.max(tbx[2], b[2]), Math.max(tbx[3], b[3])]; }
        bbox = [Math.max(cb[0] - 5000 * kx, tbx[0] - 0.002), Math.max(cb[1] - 5000 * ky, tbx[1] - 0.002), Math.min(cb[2] + 5000 * kx, tbx[2] + 0.002), Math.min(cb[3] + 5000 * ky, tbx[3] + 0.002)]; }
      else bbox = [cb[0] - 1400 * kx, cb[1] - 1400 * ky, cb[2] + 1400 * kx, cb[3] + 1400 * ky];
      P.bbox = bbox; P.positions = await sweep(bbox); const G = grid(bbox); P.G = G; const M = morph(G);
      P.base = base(G, bbox);
      const ras = g => { const ctx = cv(G); fillG(G, ctx, g); return maskOf(G, ctx); };
      P.seed = new Uint8Array(G.W * G.H); for (const g of cg) P.seed = M.or(P.seed, ras(g));
      P.cap = new Uint8Array(G.W * G.H); for (const f of caps) P.cap = M.or(P.cap, ras(f.geometry));
      P.coreMasks = []; for (const [id, g] of S.cores) { const b = bboxOf(g); if (b[2] < bbox[0] || b[0] > bbox[2] || b[3] < bbox[1] || b[1] > bbox[3]) continue; P.coreMasks.push({id, own: P.cores.includes(id), mask: ras(g)}); }
      const edgeOf = E => { let e = 0; for (let x = 0; x < G.W; x++) e += E[x] + E[(G.H - 1) * G.W + x]; for (let y = 0; y < G.H; y++) e += E[y * G.W] + E[y * G.W + G.W - 1]; return e; };
      const othersIn = E => P.coreMasks.filter(c => !c.own && M.sum(M.and(c.mask, E)) > 3).map(c => c.id);
      let res, rule = P.rule, choice = null;
      if (P.rule === 'beach') {
        const b = beach(P), w = walk(P), aB = areaM2(G, b.E), aW = areaM2(G, w.E), ob = othersIn(b.E), eb = edgeOf(b.E);
        const why = ob.length ? 'takes in another outline' : eb ? 'reaches 5 km from the core' : aB < aW ? 'smaller than the walk area' : '';
        choice = {beachM2: Math.round(aB), walkM2: Math.round(aW), beachOtherCores: ob, beachEdgeCells: eb, walkInstead: why};
        if (why) { res = w; rule = 'walk'; } else res = {E: b.E, info: {...b.info, walkStreetCells: w.info.streetCells}};
      } else res = walk(P);
      const E = res.E;
      const cents = []; for (const T of tilesIn(bbox)) { const b = tb(T.x, T.y, 14); for (const f of T.building) { const polys = f.g.type === 'MultiPolygon' ? f.g.coordinates : [f.g.coordinates]; for (const p of polys) { const r = p[0]; let sx = 0, sy = 0; for (const q of r) { sx += q[0]; sy += q[1]; } const cx = sx / r.length, cy = sy / r.length; if (cx < b[0] || cx >= b[2] || cy < b[1] || cy >= b[3]) continue; cents.push(cellOf(G, cx, cy)); } } }
      const count = mk => { let k = 0; for (const c of cents) if (c >= 0 && mk[c]) k++; return k; };
      const hot = mk => { let k = 0; for (const [lo, la] of S.hot) { const c = cellOf(G, lo, la); if (c >= 0 && mk[c]) k++; } return k; };
      const others = othersIn(E), edge = edgeOf(E);
      const rs = rings(G, E);
      S.out[P.key] = {key: P.key, name: P.name, prov: P.prov, cores: P.cores, rule, asked: P.rule, caps: rule === 'beach' ? caps.map(f => String(f.properties.id)) : [],
        grid: [+G.lon0.toFixed(6), +G.lat1.toFixed(6), G.res],
        check: {areaM2: Math.round(areaM2(G, E)), coreM2: Math.round(areaM2(G, P.seed)), capM2: P.rule === 'beach' ? Math.round(areaM2(G, P.cap)) : null,
          osmBuildings: count(E), osmBuildingsCore: count(P.seed), osmBuildingsCap: P.rule === 'beach' ? count(P.cap) : null,
          hotels: hot(E), hotelsCore: hot(P.seed), hotelsCap: P.rule === 'beach' ? hot(P.cap) : null, otherCores: others, edgeCells: edge, positions: P.positions, choice, ...res.info},
        rings: enc(rs)};
      P.rings = rs; delete P.base; delete P.coreMasks;
    } catch (e) { S.err.push(P.key + ': ' + (e && e.stack ? e.stack.slice(0, 300) : e)); } }
    S.status = 'done'; }

  const PLACES = [
    {key: 'patong', name: 'ป่าตอง', prov: 'PKT', cores: ['CMN-TH-AC4758F0BC'], rule: 'beach'},
    {key: 'karon-kata', name: 'กะรน–กะตะ', prov: 'PKT', cores: ['CMN-TH-EC14CFAC8E', 'CMN-TH-B481C8B92C'], rule: 'beach'},
    {key: 'kamala', name: 'กมลา', prov: 'PKT', cores: ['CMN-TH-AB1DF8544E'], rule: 'beach'},
    {key: 'rawai', name: 'ราไวย์', prov: 'PKT', cores: ['CMN-TH-2732F4AF02'], rule: 'beach'},
    {key: 'ao-nang', name: 'อ่าวนาง', prov: 'KBI', cores: ['CMN-TH-66B6B6DBE3'], rule: 'beach'},
    {key: 'chaweng', name: 'เฉวง', prov: 'SNI', cores: ['CMN-TH-5838F0E55F'], rule: 'beach'},
    {key: 'jomtien', name: 'จอมเทียน', prov: 'CBI', cores: ['CMN-TH-50C251DFD1'], rule: 'beach'},
    {key: 'hua-hin', name: 'หัวหิน', prov: 'PKN', cores: ['CMN-TH-0880830DE7'], rule: 'beach'},
    {key: 'phuket-old-town', name: 'เมืองเก่าภูเก็ต', prov: 'PKT', cores: ['CMN-TH-0005'], rule: 'walk'},
    {key: 'siam', name: 'สยาม', prov: 'BKK', cores: ['CMN-TH-0001'], rule: 'walk'},
  ];
  /** The export the repository keeps: one line of JSON per run. */
  const exportText = () => JSON.stringify({drawnOn: new Date().toISOString().slice(0, 10), tilesBuild: S.tilesBuild, places: Object.values(S.out), errors: S.err});
  return {S, PLACES, run, exportText, sweep, grid, morph, beach, walk, within, rings};
})();
