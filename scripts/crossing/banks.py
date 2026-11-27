"""
CityMETER · Commercial District — the banks of a river round a neighbourhood and the distance through its crossings
(0.7.5, V7-09; the Shopping Center page's D70 as written in montri-th/shoppingcenter DATA_METHOD.md §32).

The land of a window is drawn on a 20 m raster: the barrier river lines 8-connected, the land labelled 4-connected, so a
river line always parts it. Each crossing joins the land on its two sides where it meets the river line (the point where
the crossing's line meets the river's — the point the Shopping Center publishes for its crossings). A place on a bank the
origin holds keeps its straight distance; a place on another bank counts by its distance through the crossings: origin →
crossing → place, each leg a straight line, chained through several crossings where a river forks; never less than the
straight distance. The origin is a neighbourhood's outline (distance from its edge, 0 inside) or a point.

The window is the origin's extent and 10 km round it, so a way round a river that leaves the window is at least 15 km
long and cannot bring a place within 5 km (the Shopping Center's argument for its ±10 km window round a point).
Coordinates are metres in the caller's projection (the builders' azimuthal equidistant one, centred on the reference
point); `fwd` projects lon/lat into it.
"""
import heapq
import math

import numpy as np
import shapely
from scipy import ndimage
from shapely.strtree import STRtree

PX = 20.0
MARGIN = 10000.0
FOUR = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], dtype=bool)
DEG_M = 111320.0


class Rivers:
    """The cache of scripts/crossing/rivers.py with a spatial index; `kinds` picks the crossings that count."""

    def __init__(self, cache, kinds=None):
        self.lines = cache['lines']
        self.tree = STRtree([shapely.LineString(c) for _w, c, _n in self.lines])
        cr = cache['crossings']
        self.crossings = [c for c in cr if kinds is None or c[0] in kinds]
        self.cbox = np.array([[c[3][:, 0].min(), c[3][:, 1].min(), c[3][:, 0].max(), c[3][:, 1].max()] for c in self.crossings]) if self.crossings else np.zeros((0, 4))


def _raster(lines_xy, x0, y1, nx, ny):
    river = np.zeros((ny, nx), dtype=bool)
    for c in lines_xy:
        if len(c) < 2:
            continue
        cx, cy = (c[:, 0] - x0) / PX, (y1 - c[:, 1]) / PX
        j0, i0 = np.floor(cx[:-1]).astype(np.int64), np.floor(cy[:-1]).astype(np.int64)
        j1, i1 = np.floor(cx[1:]).astype(np.int64), np.floor(cy[1:]).astype(np.int64)
        keep = ~(((j0 < 0) & (j1 < 0)) | ((j0 >= nx) & (j1 >= nx)) | ((i0 < 0) & (i1 < 0)) | ((i0 >= ny) & (i1 >= ny)))
        j0, i0, j1, i1 = j0[keep], i0[keep], j1[keep], i1[keep]
        if not len(j0):
            continue
        n = np.maximum(np.abs(j1 - j0), np.abs(i1 - i0))
        reps = n + 1
        s = np.arange(reps.sum()) - np.repeat(np.cumsum(reps) - reps, reps)
        nn = np.repeat(np.maximum(n, 1), reps)
        jj = np.rint(np.repeat(j0, reps) + s * np.repeat(j1 - j0, reps) / nn).astype(np.int64)
        ii = np.rint(np.repeat(i0, reps) + s * np.repeat(i1 - i0, reps) / nn).astype(np.int64)
        ok = (jj >= 0) & (jj < nx) & (ii >= 0) & (ii < ny)
        river[ii[ok], jj[ok]] = True
    return river


class Banks:
    def __init__(self, rivers, fwd, origin, lonlat_bounds, margin=MARGIN):
        """rivers: Rivers · fwd(lon, lat) -> (x, y) · origin: shapely geometry in metres (polygon or point) ·
        lonlat_bounds: the origin's lon/lat box (to pick the lines and crossings near the window)."""
        self.origin = origin
        ox0, oy0, ox1, oy1 = origin.bounds
        self.x0, self.y1 = math.floor((ox0 - margin) / PX) * PX, math.ceil((oy1 + margin) / PX) * PX
        x1, y0 = math.ceil((ox1 + margin) / PX) * PX, math.floor((oy0 - margin) / PX) * PX
        self.nx, self.ny = int(round((x1 - self.x0) / PX)), int(round((self.y1 - y0) / PX))
        lo0, la0, lo1, la1 = lonlat_bounds
        dla = (margin + 3000) / DEG_M
        dlo = dla / max(0.2, math.cos(math.radians((la0 + la1) / 2)))
        box = shapely.box(lo0 - dlo, la0 - dla, lo1 + dlo, la1 + dla)
        hit = rivers.tree.query(box, predicate='intersects')
        self.lines_xy, self.line_names = [], []
        for h in hit:
            w, c, nm = rivers.lines[h]
            x, y = fwd(c[:, 0], c[:, 1])
            self.lines_xy.append(np.column_stack([np.asarray(x), np.asarray(y)]))
            self.line_names.append(nm)
        self.river = _raster(self.lines_xy, self.x0, self.y1, self.nx, self.ny)
        self.lab, self.nlab = ndimage.label(~self.river, structure=FOUR)
        self.riv_geom = shapely.MultiLineString([c for c in self.lines_xy if len(c) >= 2]) if self.lines_xy else None
        cb = rivers.cbox
        near = np.nonzero((cb[:, 2] >= box.bounds[0]) & (cb[:, 0] <= box.bounds[2]) & (cb[:, 3] >= box.bounds[1]) & (cb[:, 1] <= box.bounds[3]))[0] if len(cb) else []
        self.cross = []
        for k in near:
            kind, th, en, c, wid = rivers.crossings[k]
            x, y = fwd(c[:, 0], c[:, 1])
            self.cross.append((int(k), kind, th, en, np.column_stack([np.asarray(x), np.asarray(y)]), wid))
        self.links = self._links() if self.has_river else []
        self.home = self._home()
        self._chain()

    @property
    def has_river(self):
        return bool(self.river.any())

    def label_at(self, x, y, search=0):
        x, y = np.atleast_1d(np.asarray(x, dtype='f8')), np.atleast_1d(np.asarray(y, dtype='f8'))
        j = np.floor((x - self.x0) / PX).astype(np.int64)
        i = np.floor((self.y1 - y) / PX).astype(np.int64)
        inside = (j >= 0) & (j < self.nx) & (i >= 0) & (i < self.ny)
        out = np.full(x.shape, -1, dtype=np.int64)
        out[inside] = self.lab[i[inside], j[inside]]
        if search:
            for idx in np.nonzero(inside & (out == 0))[0]:
                ii, jj = i[idx], j[idx]
                for r in range(1, search + 1):
                    sub = self.lab[max(0, ii - r):ii + r + 1, max(0, jj - r):jj + r + 1]
                    v = sub[sub > 0]
                    if len(v):
                        out[idx] = int(np.bincount(v).argmax())
                        break
        return out

    def _links(self, step=5.0):
        """[(crossing index in rivers.crossings, (x, y), label a, label b)]: each change of bank along a crossing, at the
        point where the crossing's line meets the river's (the nearest to that change)."""
        out = []
        for k, kind, th, en, c, wid in self.cross:
            seg = np.hypot(np.diff(c[:, 0]), np.diff(c[:, 1]))
            n = np.maximum(1, np.ceil(seg / step)).astype(np.int64)
            pts, par = [c[:1]], [np.zeros(1)]
            run = np.concatenate([[0], np.cumsum(seg)])
            for a, b, m, s0, L in zip(c[:-1], c[1:], n, run[:-1], seg):
                f = np.arange(1, m + 1) / m
                pts.append(a + f[:, None] * (b - a))
                par.append(s0 + f * L)
            p, t = np.vstack(pts), np.concatenate(par)
            lab = self.label_at(p[:, 0], p[:, 1])
            ipts = []
            if self.riv_geom is not None:
                line = shapely.LineString(c)
                inter = line.intersection(self.riv_geom)
                if not inter.is_empty:
                    geoms = [inter] if inter.geom_type == 'Point' else [g for g in getattr(inter, 'geoms', []) if g.geom_type == 'Point']
                    ipts = [(line.project(g), float(g.x), float(g.y)) for g in geoms]
            last = last_i = None
            for idx in range(len(p)):
                v = lab[idx]
                if v <= 0:
                    continue
                if last is not None and v != last:
                    q = (p[last_i] + p[idx]) / 2
                    if ipts:
                        tm = (t[last_i] + t[idx]) / 2
                        s_i, gx, gy = min(ipts, key=lambda e: abs(e[0] - tm))
                        if abs(s_i - tm) <= 60 + (t[idx] - t[last_i]) / 2:
                            q = np.array([gx, gy])
                    out.append((k, (float(q[0]), float(q[1])), int(last), int(v)))
                last, last_i = v, idx
        return out

    def _home(self):
        """The banks the origin holds: the labels of the pixels whose centre lies inside it, and the label at its edge
        and at a point of it (a thin outline or a point holds at least one)."""
        g = self.origin
        labs = set()
        if g.geom_type in ('Polygon', 'MultiPolygon'):
            x0, y0, x1, y1 = g.bounds
            xs = np.arange(math.floor((x0 - self.x0) / PX), math.ceil((x1 - self.x0) / PX)) * PX + self.x0 + PX / 2
            ys = self.y1 - (np.arange(math.floor((self.y1 - y1) / PX), math.ceil((self.y1 - y0) / PX)) * PX + PX / 2)
            X, Y = np.meshgrid(xs, ys)
            inside = shapely.contains_xy(g, X.ravel(), Y.ravel())
            labs |= {int(v) for v in self.label_at(X.ravel()[inside], Y.ravel()[inside]) if v > 0}
            b = g.boundary
            pts = [b.interpolate(f, normalized=True) for f in np.linspace(0, 1, 64, endpoint=False)]
            labs |= {int(v) for v in self.label_at([p.x for p in pts], [p.y for p in pts], search=3) if v > 0}
        p = g.representative_point()
        labs |= {int(v) for v in self.label_at([p.x], [p.y], search=3) if v > 0}
        return labs

    def origin_dist(self, q):
        return float(shapely.distance(self.origin, shapely.Point(q)))

    def _chain(self):
        """Dijkstra over (link, the bank it leads to): the shortest distance from the origin to each crossing point."""
        links = self.links
        best, heap = {}, []
        for li, (k, q, a, b) in enumerate(links):
            d0 = self.origin_dist(q)
            for enter, exit_ in ((a, b), (b, a)):
                if enter in self.home and d0 < best.get((li, exit_), math.inf):
                    best[(li, exit_)] = d0
                    heapq.heappush(heap, (d0, li, exit_))
        by_label = {}
        for li, (k, q, a, b) in enumerate(links):
            by_label.setdefault(a, []).append((li, b))
            by_label.setdefault(b, []).append((li, a))
        while heap:
            d, li, lab = heapq.heappop(heap)
            if d > best.get((li, lab), math.inf):
                continue
            q = links[li][1]
            for lj, exit_ in by_label.get(lab, []):
                if lj == li:
                    continue
                q2 = links[lj][1]
                nd = d + math.hypot(q2[0] - q[0], q2[1] - q[1])
                if nd < best.get((lj, exit_), math.inf):
                    best[(lj, exit_)] = nd
                    heapq.heappush(heap, (nd, lj, exit_))
        self.arrive = {}
        for (li, lab), d in best.items():
            if lab in self.home:
                continue
            self.arrive.setdefault(lab, []).append((d, li))

    def measure(self, x, y, straight):
        """(distance under the rule, across): a place on a bank the origin holds keeps `straight`; one on another bank
        takes its distance through the crossings (inf when no crossing in the window reaches its bank), never under
        `straight`. A place on a river pixel takes the bank of the land nearest it (within 60 m)."""
        x, y = np.atleast_1d(np.asarray(x, dtype='f8')), np.atleast_1d(np.asarray(y, dtype='f8'))
        straight = np.atleast_1d(np.asarray(straight, dtype='f8'))
        if not self.has_river or not len(x):
            return straight.copy(), np.zeros(len(x), dtype=bool), np.full(len(x), -1, dtype=np.int64)
        labs = self.label_at(x, y, search=3)
        across = (labs > 0) & ~np.isin(labs, list(self.home))
        via = np.full(len(x), np.inf)
        via_link = np.full(len(x), -1, dtype=np.int64)
        for lab, items in self.arrive.items():
            sel = np.nonzero(across & (labs == lab))[0]
            if not len(sel):
                continue
            for d, li in items:
                q = self.links[li][1]
                v = d + np.hypot(x[sel] - q[0], y[sel] - q[1])
                better = v < via[sel]
                via[sel[better]] = v[better]
                via_link[sel[better]] = li
        out = np.where(across, np.maximum(via, straight), straight)
        return out, across, via_link

    def rivers_within(self, area):
        """[(th, en)] of the barrier rivers whose line meets `area` (a shapely geometry in metres), by Thai name."""
        out, seen = [], set()
        for c, nm in zip(self.lines_xy, self.line_names):
            key = nm[0] or nm[1]
            if key and key not in seen and len(c) >= 2 and shapely.LineString(c).intersects(area):
                seen.add(key)
                out.append([nm[0], nm[1]])
        return out

    def reached(self, limit=5000.0):
        """The crossings the origin reaches within `limit`, nearest first: [(metres, link index)] (one per crossing way)."""
        seen = {}
        for lab, items in self.arrive.items():
            for d, li in items:
                k = self.links[li][0]
                if d <= limit and d < seen.get(k, (math.inf, -1))[0]:
                    seen[k] = (d, li)
        # the bank the origin holds: a crossing whose near side is home is reached at its own distance
        for li, (k, q, a, b) in enumerate(self.links):
            if (a in self.home) != (b in self.home):
                d = self.origin_dist(q)
                if d <= limit and d < seen.get(k, (math.inf, -1))[0]:
                    seen[k] = (d, li)
        return sorted(seen.values())


KINDS_ALL = ('bridge', 'road', 'tunnel', 'foot', 'ford', 'metro', 'ferry')
RULE = {
    'th': 'ฝั่งเดียวกับย่านวัดเส้นตรงจากขอบย่าน อีกฝั่งแม่น้ำวัดระยะผ่านทางข้ามที่ใกล้ที่สุด (ขอบย่าน → ทางข้าม → จุด แต่ละช่วงเป็นเส้นตรง) '
          'ทางข้ามคือสะพานและอุโมงค์ถนนทุกระดับ สะพานคนเดิน รถไฟฟ้า และเรือข้ามฟาก ไม่ใช่เวลาเดินหรือขับรถ',
    'en': 'on the neighbourhood’s bank the straight line from its edge; across a river the distance through the nearest crossing '
          '(edge → crossing → place, each leg a straight line); crossings are road bridges and tunnels of every class, footbridges, '
          'metro lines and cross-river ferries; not walking or driving time',
}


def load(path, kinds='all'):
    """(Rivers, meta) from the cache of scripts/crossing/rivers.py. kinds: 'all' (D70 of the Shopping Center) or
    'no-ferry' (every kind but the ferries)."""
    import hashlib
    import pickle
    import sys
    raw = open(path, 'rb').read()
    cache = pickle.loads(raw)
    if cache.get('schema') != 'citymeter-commercialdistrict-rivers/1':
        sys.exit(f'{path}: not a rivers cache of scripts/crossing/rivers.py')
    if kinds == 'all':
        picked = None
    elif kinds == 'no-ferry':
        picked = tuple(k for k in KINDS_ALL if k != 'ferry')
    else:
        sys.exit(f'--crossing-kinds {kinds}: all or no-ferry')
    rule = dict(RULE)
    if kinds == 'no-ferry':
        rule = {'th': RULE['th'].replace(' และเรือข้ามฟาก', ' (ไม่นับเรือข้ามฟาก)'), 'en': RULE['en'].replace(' and cross-river ferries', ' (ferries not counted)')}
    meta = {
        'rule': rule, 'kinds': kinds, 'osm': cache['osm'], 'counts': cache['counts'],
        'method': 'DATA_METHOD.md#river-crossings (the Shopping Center page’s D70, read from montri-th/shoppingcenter DATA_METHOD.md §32)',
        'cacheSha256': hashlib.sha256(raw).hexdigest(),
    }
    return Rivers(cache, kinds=picked), meta
