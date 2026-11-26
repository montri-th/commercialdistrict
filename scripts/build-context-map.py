#!/usr/bin/env python3
"""
CityMETER · Commercial District — what a reader finds the way by on the round maps (0.7.1): the sea, lakes and river
areas, the rivers, the major roads with a few names, the rail lines and the stations.

    python3 -I scripts/build-context-map.py --repo . --osm <thailand-261124.osm.pbf> --out <file outside the repository>
        [--cache <file outside the repository>] [--only CMN-TH-…,…]

Owner 2026-11-26 17:51 (VERBATIM): “แผนที่รัศมีควรจะมี โครงร่างถนน ทะเล ลำน้ำ กายภาพ ให้ดูแบบเดียวกับ shopping center
ด้วยได้มั้ยครับ”; asked where the OpenStreetMap file should come from, he chose “ดึงจาก Mac ของผม (แนะนำ)”.

As «รอบศูนย์นี้» draws them (montri-th/shoppingcenter scripts/build-residents-map.py @4bb7522: the road classes, the rail
filter, waterway=river, SIMPLIFY_M, the label rules), from the very Geofabrik extract the Shopping Center page measures its
river crossings with (D-14: thailand-261124.osm.pbf, data to 2026-11-24T21:21:23Z; the file stays outside the
repository, its SHA-256 is checked). Added here, because neighbourhoods reach the coast and lakes: the sea and the water
areas, filled; and the national rail stops this page's main map draws.

Per neighbourhood, in the frame of its people file's map (an azimuthal equidistant projection centred on the reference
point, 25 m units, y down), within 5 km of the drawn outline:
  c  the sea: the faces of that ground the coastline leaves on its right (OpenStreetMap draws natural=coastline with the
     land on its left), never where the reference point stands — one path
  a  water areas (natural=water, landuse=reservoir, waterway=riverbank) of 1 ha or more — one path, even-odd
  w  rivers (waterway=river) — one path of lines
  r  [motorway, trunk, primary, secondary] — one path each ('' when none)
  t  rail lines (rail, subway, light rail, monorail without a service tag, not for industry, the military, tourism or
     tests) — one path
  s  stations: the operating stations of CityMETER Transit and the national rail stops with scheduled trips
     (data/rail.json, the main map's), within the ground, nearest the reference point first
  L  names [[kind, x, y, align, th, en]] — ≤ 1 sea, 1 river, 4 roads, 3 stations, placed so that on a 360 px map no two
     overlap, none leaves the ground, none sits on the outline, the 1 · 3 · 5 km labels or the north mark
Lines to read the map by, never a count, a distance or a barrier the page measures with. The same inputs give the same
bytes. meta.frame keeps the frame of each map it was drawn on; scripts/build-people.py --context embeds a row as
map.ctx only on that very frame.
"""
import argparse
import hashlib
import json
import math
import os
import pickle
import sys
import time
import unicodedata

import numpy as np
import pyproj
import shapely
from shapely.geometry import Point, box
from shapely.ops import polygonize

UNIT_M = 25
REACH_M = 5000
CLIP_PAD_M = 150           # the ground drawn reaches a little past the 5 km line the map clips to
SIMPLIFY_M = 12            # as «รอบศูนย์นี้»
MIN_WATER_M2 = 10_000      # a pond under 1 ha is left out
MIN_SEA_LABEL_M2 = 2_000_000
ROAD_CLASSES = ('motorway', 'trunk', 'primary', 'secondary')
RAIL_KINDS = ('rail', 'subway', 'light_rail', 'monorail')
RAIL_USAGE_OUT = {'industrial', 'military', 'tourism', 'test'}
WATER_TAGS = (('natural', 'water'), ('landuse', 'reservoir'), ('waterway', 'riverbank'))
MAX = {'sea': 1, 'river': 1, 'road': 4, 'station': 3}
MAP_PX = 360               # names are fitted on a map 360 px wide (the panel draws it 300–440 px)
CHAR_PX, PAD_PX, LINE_PX = 6.4, 12, 18
BESIDE_PX = 7              # the page sets a name 6 px beside its station (.pm-lab.at-l / .at-r)
CLASS_WEIGHT = (0.8, 1.0, 1.0, 0.75)
SRT_NEAR_M = 150           # a national stop this close to a Transit station is the same station
OSM_PIN = '62b496bf2383ddd266cfcd3456cd03064db1887399f2a4c869bbf953bfd12d24'
CACHE_SCHEMA = 'context-read/1'


def fail(msg):
    sys.exit(f'build-context-map: {msg}')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def base_chars(text):
    return sum(1 for ch in text if unicodedata.category(ch) not in ('Mn', 'Me', 'Cf'))


def short_th(name):
    for full, short in (('ถนน', 'ถ.'), ('ทางหลวงแผ่นดินหมายเลข', 'ทล.'), ('ทางหลวงหมายเลข', 'ทล.')):
        if name.startswith(full):
            return short + name[len(full):].strip()
    return name


def short_en(name):
    for full, short in ((' Road', ' Rd'), (' Expressway', ' Expwy'), (' Highway', ' Hwy'), (' Street', ' St')):
        if name.endswith(full):
            return name[: -len(full)] + short
    return name


def is_thai(text):
    return any('฀' <= ch <= '๿' for ch in text)


def names_of(tags):
    th = (tags.get('name:th') or tags.get('name') or '').strip()
    en = (tags.get('name:en') or '').strip()
    if th and not is_thai(th):
        en = en or th
    return th, en


def svg_lines(lines):
    """One SVG path in 25 m units (y down) from projected lines in metres."""
    out = []
    for ln in lines:
        pts = []
        for x, y in ln.coords:
            q = (round(x / UNIT_M), round(-y / UNIT_M))
            if not pts or q != pts[-1]:
                pts.append(q)
        if len(pts) < 2:
            continue
        out.append(f'M{pts[0][0]} {pts[0][1]}' + ''.join(f'l{c - a} {d - b}' for (a, b), (c, d) in zip(pts, pts[1:])))
    return ''.join(out)


def svg_areas(geom):
    """One SVG path (even-odd) of the polygons of a geometry in metres, rings rounded to the 25 m grid."""
    out = []
    if geom is None or geom.is_empty:
        return ''
    for poly in shapely.get_parts(geom):
        if poly.geom_type != 'Polygon' or poly.is_empty:
            continue
        for ring in [poly.exterior, *poly.interiors]:
            pts = []
            for x, y in ring.coords[:-1]:
                q = (round(x / UNIT_M), round(-y / UNIT_M))
                if not pts or q != pts[-1]:
                    pts.append(q)
            if len(pts) > 1 and pts[0] == pts[-1]:
                pts.pop()
            if len(pts) < 3:
                continue
            out.append(f'M{pts[0][0]} {pts[0][1]}' + ''.join(f'l{c - a} {d - b}' for (a, b), (c, d) in zip(pts, pts[1:])) + 'z')
    return ''.join(out)


# ---------------------------------------------------------------- reading the extract (one pass, kept in a cache)

def read_osm(path, cells):
    """One pass over the extract: the ways of the four road classes, rail, rivers and the coastline, and the water areas,
    whose bounding box meets the 0.1° cells of a neighbourhood's ground.
    lines: list of (kind, cls, th, en, ndarray[n, 2] lon/lat) · areas: list of (th, en, wkb)."""
    import osmium
    lines, areas = [], []
    wkb = osmium.geom.WKBFactory()

    def meets(lo0, la0, lo1, la1):
        i0, i1, j0, j1 = math.floor(lo0 * 10), math.floor(lo1 * 10), math.floor(la0 * 10), math.floor(la1 * 10)
        if (i1 - i0 + 1) * (j1 - j0 + 1) >= 400:
            return True
        return any((i, j) in cells for i in range(i0, i1 + 1) for j in range(j0, j1 + 1))

    way_tags = [*[('highway', c) for c in ROAD_CLASSES], *[('railway', k) for k in RAIL_KINDS],
                ('waterway', 'river'), ('natural', 'coastline')]
    fp = (osmium.FileProcessor(str(path))
          .with_areas(osmium.filter.TagFilter(*WATER_TAGS))
          .with_filter(osmium.filter.EntityFilter(osmium.osm.WAY | osmium.osm.AREA))
          .with_filter(osmium.filter.TagFilter(*way_tags, *WATER_TAGS)))
    n_way = n_area = 0
    for o in fp:
        t = {k: v for k, v in o.tags}
        if o.type_str() == 'a':
            if not any(t.get(k) == v for k, v in WATER_TAGS):
                continue
            try:
                g = shapely.from_wkb(bytes.fromhex(wkb.create_multipolygon(o)))
            except Exception:
                continue
            lo0, la0, lo1, la1 = g.bounds
            # about 1 ha at 20° N is 8.6e-7 square degrees: a pond far under it is left out before projecting
            if g.area < 5e-7 or not meets(lo0, la0, lo1, la1):
                continue
            th, en = names_of(t)
            areas.append((th, en, shapely.to_wkb(g)))
            n_area += 1
            continue
        if t.get('highway') in ROAD_CLASSES:
            kind, cls = 'road', ROAD_CLASSES.index(t['highway'])
        elif t.get('railway') in RAIL_KINDS:
            if 'service' in t or t.get('usage') in RAIL_USAGE_OUT:
                continue
            kind, cls = 'rail', RAIL_KINDS.index(t['railway'])
        elif t.get('waterway') == 'river':
            kind, cls = 'river', 0
        elif t.get('natural') == 'coastline':
            kind, cls = 'coast', 0
        else:
            continue
        try:
            pts = np.array([(n.lon, n.lat) for n in o.nodes], dtype='f8')
        except osmium.InvalidLocationError:
            continue
        if len(pts) < 2:
            continue
        if meets(pts[:, 0].min(), pts[:, 1].min(), pts[:, 0].max(), pts[:, 1].max()):
            th, en = names_of(t)
            lines.append((kind, cls, th, en, pts))
            n_way += 1
    return lines, areas


# ---------------------------------------------------------------- the sea

def sea_of(region, coast):
    """The faces of the region on the right of the coastline (sea). Each coastline segment votes, by its length, for the
    face just right of it (sea) and against the face just left of it (land); a face is sea when its votes are.
    The coastline is cut a little outside the region, so that it crosses the region's edge and is noded with it (a line
    cut exactly on the edge may stop a hair short of it and split nothing)."""
    big = region.buffer(200, quad_segs=8)
    parts = [p for p in shapely.get_parts(shapely.intersection(coast, big)) if p.geom_type == 'LineString' and p.length > 0] if len(coast) else []
    if not parts:
        return None
    noded = shapely.union_all([region.boundary, *parts])
    faces = [f for f in polygonize(shapely.get_parts(noded)) if region.contains(f.representative_point())]
    if not faces:
        return None
    rp, lp, wt = [], [], []
    for ln in parts:
        c = np.asarray(ln.coords)
        d = c[1:] - c[:-1]
        L = np.hypot(d[:, 0], d[:, 1])
        ok = L > 1.0
        if not ok.any():
            continue
        m = c[:-1][ok] + d[ok] / 2
        n = np.column_stack([d[ok, 1], -d[ok, 0]]) / L[ok, None]     # right of the way's direction
        rp.append(m + n * 0.5)
        lp.append(m - n * 0.5)
        wt.append(L[ok])
    if not wt:
        return None
    tree = shapely.STRtree(faces)
    W = np.concatenate(wt)
    vote = np.zeros(len(faces))
    for pts, sign in ((np.concatenate(rp), 1.0), (np.concatenate(lp), -1.0)):
        qi, fi = tree.query(shapely.points(pts), predicate='within')
        np.add.at(vote, fi, sign * W[qi])
    sea = [f for f, v in zip(faces, vote) if v > 0]
    return shapely.union_all(sea) if sea else None


# ---------------------------------------------------------------- names

class Boxes:
    """Name boxes in 25 m units (x right, y down)."""

    def __init__(self, beside):
        self.boxes, self.beside = [], beside

    def make(self, x, y, w, h, align):
        if align == 'c':
            return (x - w / 2, y - h / 2, x + w / 2, y + h / 2)
        if align == 'l':      # the name starts right of the point
            return (x + self.beside, y - h / 2, x + self.beside + w, y + h / 2)
        return (x - self.beside - w, y - h / 2, x - self.beside, y + h / 2)

    def free(self, b):
        return all(b[2] <= o[0] or b[0] >= o[2] or b[3] <= o[1] or b[1] >= o[3] for o in self.boxes)

    def add(self, b):
        self.boxes.append(b)


def build_row(r, outline, frame, ring_labels, lines, areas, stations):
    tf = pyproj.Transformer.from_crs('EPSG:4326', f"+proj=aeqd +lat_0={r['ref'][1]} +lon_0={r['ref'][0]} +datum=WGS84 +units=m", always_xy=True)

    def proj(g):
        return shapely.transform(g, lambda a: np.column_stack(tf.transform(a[:, 0], a[:, 1])))

    g = proj(outline)
    if not g.is_valid:
        g = shapely.make_valid(g)
    ground = g.buffer(REACH_M + CLIP_PAD_M, quad_segs=16)
    shapely.prepare(ground)
    near3 = g.buffer(3000, quad_segs=8)

    roads = [[] for _ in ROAD_CLASSES]
    rails, rivers, coast = [], [], []
    named_roads, named_rivers = {}, {}
    if lines:
        arrs = [ln[4] for ln in lines]
        lens = np.array([len(a) for a in arrs])
        allp = np.concatenate(arrs)
        X, Y = tf.transform(allp[:, 0], allp[:, 1])
        geoms = shapely.linestrings(np.column_stack([X, Y]), indices=np.repeat(np.arange(len(arrs)), lens))
        hit = np.nonzero(shapely.intersects(geoms, ground))[0]
        for k in hit:
            kind, cls, th, en, _p = lines[k]
            if kind == 'coast':
                coast.append(geoms[k])
                continue
            parts = [p for p in shapely.get_parts(shapely.intersection(geoms[k], ground)) if p.geom_type == 'LineString' and p.length > 0]
            if not parts:
                continue
            simple = [p.simplify(SIMPLIFY_M) for p in parts]
            if kind == 'road':
                roads[cls].extend(simple)
                if th:
                    # one name per Thai name: OpenStreetMap spells the English of one road in several ways
                    rec = named_roads.setdefault(short_th(th), [cls, 0.0, [], {}])
                    rec[0] = min(rec[0], cls)
                    length = sum(p.length for p in parts)
                    rec[1] += sum(CLASS_WEIGHT[cls] * (0.75 * p.intersection(near3).length + 0.25 * p.length) for p in parts)
                    rec[2].extend(parts)
                    if en:
                        rec[3][short_en(en)] = rec[3].get(short_en(en), 0.0) + length
            elif kind == 'rail':
                rails.extend(simple)
            else:
                rivers.extend(simple)
                if th or en:
                    rec = named_rivers.setdefault((th or en, en), [0, 0.0, []])
                    rec[1] += sum(p.length for p in parts)
                    rec[2].extend(parts)
    water = []
    for _th, _en, wk in areas:
        pg = proj(shapely.from_wkb(wk))
        if not pg.is_valid:
            pg = shapely.make_valid(pg)
        if pg.area < MIN_WATER_M2 or not pg.intersects(ground):
            continue
        part = pg.intersection(ground)
        if not part.is_empty:
            water.append(part)
    water = shapely.union_all(water).simplify(SIMPLIFY_M, preserve_topology=True) if water else None
    sea = sea_of(ground, np.array(coast, dtype=object)) if coast else None
    sea_dropped = False
    if sea is not None and not sea.is_empty:
        if sea.contains(Point(0, 0)):
            sea, sea_dropped = None, True          # the coastline does not close here: no sea rather than a wrong one
        else:
            sea = sea.simplify(SIMPLIFY_M, preserve_topology=True)
    else:
        sea = None

    # ---- names: in the frame of the page's map, fitted at 360 px
    vw = frame['w'] * 10 + 12
    upx = vw / MAP_PX
    vx, vy = frame['x0'] * 10 - 6, -(frame['y1'] + 1) * 10 - 6
    bx = Boxes(BESIDE_PX * upx)
    bx.add((vx, vy, vx + 72 * upx, vy + 22 * upx))                        # ↑ เหนือ, top left
    for k in ('s1', 's3', 's5'):
        if ring_labels and ring_labels.get(k):
            x, y = ring_labels[k]
            w_, h_ = (6 * CHAR_PX + 12) * upx, LINE_PX * upx              # translate(−50 %, −110 %)
            bx.add((x - w_ / 2, y - 1.15 * h_, x + w_ / 2, y + 0.05 * h_))
    inner = ground.buffer(-(CLIP_PAD_M + 120))
    shapely.prepare(inner)
    core = g.buffer(60)
    shapely.prepare(core)

    def poly_of(b):
        return box(b[0] * UNIT_M, -b[3] * UNIT_M, b[2] * UNIT_M, -b[1] * UNIT_M)

    def fits(b):
        p = poly_of(b)
        return inner.contains(p) and not core.intersects(p) and bx.free(b)

    def size(th, en):
        return (max(base_chars(th), base_chars(en or th)) * CHAR_PX + PAD_PX) * upx, LINE_PX * upx

    labels = []

    def place_on_lines(groups, limit, kind):
        placed = 0
        for _rank, th, en, ls in sorted(groups, key=lambda q: (q[0], q[1], q[2])):
            if placed >= limit:
                break
            w_, h_ = size(th, en)
            cands = []
            for ln in ls:
                steps = max(1, int(ln.length // 125))
                for k in range(steps + 1):
                    p = ln.interpolate(k / steps, normalized=True)
                    d = g.distance(p)
                    if 300 <= d <= 4500:
                        cands.append((abs(d - 1500), round(p.x / UNIT_M), round(-p.y / UNIT_M)))
            for _s, x, y in sorted(cands):
                b = bx.make(x, y, w_, h_, 'c')
                if fits(b):
                    bx.add(b)
                    labels.append([kind, x, y, 'c', th, en])
                    placed += 1
                    break

    # stations, nearest the reference point first
    st = []
    if stations:
        sx, sy = tf.transform(np.array([s[0] for s in stations]), np.array([s[1] for s in stations]))
        for x, y, s in zip(sx, sy, stations):
            if ground.contains(Point(x, y)):
                st.append((round(math.hypot(x, y), 3), s[2], x, y, s))
        st.sort(key=lambda q: (q[0], q[1]))
    st_pts = []
    for _d, _n, x, y, _s in st:
        q = [round(x / UNIT_M), round(-y / UNIT_M)]
        if q not in st_pts:
            st_pts.append(q)
    named = set()

    def name_station(x, y, s):
        if s[2] in named:
            return False
        q = [round(x / UNIT_M), round(-y / UNIT_M)]
        th, en = f'สถานี{s[2]}', (f'{s[3]} station' if s[3] else '')
        w_, h_ = size(th, en)
        for align in ('l', 'r'):
            b = bx.make(q[0], q[1], w_, h_, align)
            if fits(b):
                bx.add(b)
                labels.append(['station', q[0], q[1], align, th, en])
                named.add(s[2])
                return True
        return False

    # the nearest station that can be named (the name a reader looks for), the sea, the river, the roads, the next stations
    for _d, _n, x, y, s in st:
        if name_station(x, y, s):
            break
    if sea is not None:
        biggest = max(shapely.get_parts(sea), key=lambda p: p.area)
        if biggest.area >= MIN_SEA_LABEL_M2:
            w_, h_ = size('ทะเล', 'Sea')
            x0, y0, x1, y1 = biggest.bounds
            # the open water about 2 km off the outline (not crowding it), at least 600 m off
            cand = []
            for gx in np.linspace(x0, x1, 17):
                for gy in np.linspace(y0, y1, 17):
                    q = (round(gx / UNIT_M), round(-gy / UNIT_M))
                    d = g.distance(Point(q[0] * UNIT_M, -q[1] * UNIT_M))
                    if d >= 600:
                        cand.append((round(abs(d - 2000), 3), q))
            for _s, (x, y) in sorted(cand):
                b = bx.make(x, y, w_, h_, 'c')
                p = poly_of(b)
                if biggest.contains(p) and inner.contains(p) and bx.free(b):
                    bx.add(b)
                    labels.append(['sea', x, y, 'c', 'ทะเล', 'Sea'])
                    break
    place_on_lines([(-ln_len, th, en, ls) for (th, en), (_c, ln_len, ls) in named_rivers.items() if ln_len >= 1000], MAX['river'], 'river')
    def english(spellings):
        return max(spellings.items(), key=lambda kv: (kv[1], kv[0]))[0] if spellings else ''
    place_on_lines([(-score, th, english(sp), ls) for th, (_c, score, ls, sp) in named_roads.items()
                    if score >= 400 and base_chars(th) <= 18 and base_chars(english(sp) or th) <= 20], MAX['road'], 'road')
    for _d, _n, x, y, s in st:
        if len(named) >= MAX['station']:
            break
        name_station(x, y, s)

    rec = {
        'c': svg_areas(sea),
        'a': svg_areas(water),
        'w': svg_lines(rivers),
        'r': [svg_lines(roads[c]) for c in range(len(ROAD_CLASSES))],
        't': svg_lines(rails),
        's': st_pts,
        'L': labels,
    }
    return rec, sea_dropped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default='.')
    ap.add_argument('--osm', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--cache', default='')
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    rr = os.path.realpath(a.repo)
    for what, p in (('--osm', a.osm), ('--out', a.out), ('--cache', a.cache)):
        if p and os.path.realpath(p).startswith(rr + os.sep):
            fail(f'{what} must be outside the repository')
    t0 = time.time()
    osm_sha = sha256(a.osm)
    if osm_sha != OSM_PIN:
        fail(f'{a.osm}: SHA-256 {osm_sha[:12]}…, not the Shopping Center page’s extract {OSM_PIN[:12]}… (D-14)')
    nb = json.load(open(os.path.join(rr, 'data', 'neighborhoods.json'), encoding='utf-8'))
    outl = {str(f['properties']['id']): shapely.geometry.shape(f['geometry'])
            for f in json.load(open(os.path.join(rr, 'data', 'boundaries.geojson'), encoding='utf-8'))['features']}
    all_rows = nb['rows']
    only = [x for x in a.only.split(',') if x]
    rows = [r for r in all_rows if r['id'] in set(only)] if only else all_rows
    rail = json.load(open(os.path.join(rr, 'data', 'rail.json'), encoding='utf-8'))
    transit = [(s[0], s[1], s[2], s[3]) for s in rail['stations'] if s[5] == 0]      # operating (meta.statusRule)
    tf_m = pyproj.Transformer.from_crs('EPSG:4326', 'EPSG:32647', always_xy=True)
    tx, ty = tf_m.transform(np.array([s[0] for s in transit]), np.array([s[1] for s in transit]))
    srt = []
    en_of = {s[2]: s[3] for s in transit if s[3]}          # a national stop takes the English of a Transit station of its name
    for s in rail['srt']:
        x, y = tf_m.transform(s[0], s[1])
        if not len(transit) or np.min(np.hypot(tx - x, ty - y)) > SRT_NEAR_M:
            srt.append((s[0], s[1], s[2], en_of.get(s[2], '')))
    stations = transit + srt

    # the 0.1° cells of every neighbourhood's ground (all of them, so one cache serves any --only)
    cells = {}
    for r in all_rows:
        x0, y0, x1, y1 = outl[r['id']].bounds
        dlat = (REACH_M + 400) / 111_320
        dlon = dlat / max(0.2, math.cos(math.radians((y0 + y1) / 2)))
        for i in range(math.floor((x0 - dlon) * 10), math.floor((x1 + dlon) * 10) + 1):
            for j in range(math.floor((y0 - dlat) * 10), math.floor((y1 + dlat) * 10) + 1):
                cells.setdefault((i, j), set()).add(r['id'])
    data = None
    if a.cache and os.path.exists(a.cache):
        with open(a.cache, 'rb') as f:
            data = pickle.load(f)
        if data.get('schema') != CACHE_SCHEMA or data.get('osm') != osm_sha or data.get('cells') != sorted(cells):
            data = None
    if data is None:
        lines, areas = read_osm(a.osm, cells)
        data = {'schema': CACHE_SCHEMA, 'osm': osm_sha, 'cells': sorted(cells), 'lines': lines, 'areas': areas}
        if a.cache:
            os.makedirs(os.path.dirname(os.path.abspath(a.cache)), exist_ok=True)
            with open(a.cache, 'wb') as f:
                pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
        print(f'read {len(lines):,} ways and {len(areas):,} water areas in {time.time() - t0:.0f}s', flush=True)
    lines, areas = data['lines'], data['areas']

    def rows_of(lo0, la0, lo1, la1):
        i0, i1, j0, j1 = math.floor(lo0 * 10), math.floor(lo1 * 10), math.floor(la0 * 10), math.floor(la1 * 10)
        if (i1 - i0 + 1) * (j1 - j0 + 1) >= 400:
            return None
        out = set()
        for i in range(i0, i1 + 1):
            for j in range(j0, j1 + 1):
                out |= cells.get((i, j), set())
        return out
    want = {r['id'] for r in rows}
    by_l = {i: [] for i in want}
    for item in lines:
        p = item[4]
        hit = rows_of(p[:, 0].min(), p[:, 1].min(), p[:, 0].max(), p[:, 1].max())
        for rid in (want if hit is None else hit & want):
            by_l[rid].append(item)
    by_a = {i: [] for i in want}
    for item in areas:
        hit = rows_of(*shapely.from_wkb(item[2]).bounds)
        for rid in (want if hit is None else hit & want):
            by_a[rid].append(item)

    out, dropped, frames = {}, [], {}
    counts = {'withSea': 0, 'withWater': 0, 'withRiver': 0, 'withRoad': 0, 'withRail': 0, 'withStations': 0,
              'labels': {k: 0 for k in MAX}}
    for n, r in enumerate(rows):
        pf = os.path.join(rr, 'data', 'people', f"{r['id']}.json")
        if not os.path.exists(pf):
            fail(f'{pf} is missing: build the people files first')
        pmap = json.load(open(pf, encoding='utf-8'))['map']
        frames[r['id']] = pmap['cell']
        rec, sea_dropped = build_row(r, outl[r['id']], pmap['cell'], (pmap.get('lines') or {}).get('lab'), by_l[r['id']], by_a[r['id']], stations)
        out[r['id']] = rec
        if sea_dropped:
            dropped.append(r['id'])
        counts['withSea'] += bool(rec['c'])
        counts['withWater'] += bool(rec['a'])
        counts['withRiver'] += bool(rec['w'])
        counts['withRoad'] += bool(any(rec['r']))
        counts['withRail'] += bool(rec['t'])
        counts['withStations'] += bool(rec['s'])
        for lab in rec['L']:
            counts['labels'][lab[0]] += 1
        if n % 50 == 0:
            print(f'{n}/{len(rows)} {time.time() - t0:.0f}s', flush=True)
    import osmium
    stamp = osmium.io.Reader(a.osm, osmium.osm.osm_entity_bits.NOTHING).header().get('osmosis_replication_timestamp')
    meta = {
        'schema': 'citymeter-commercialdistrict-context/1',
        'asOf': (stamp or '')[:10],
        'unit_m': UNIT_M, 'reach_m': REACH_M, 'simplify_m': SIMPLIFY_M, 'minWater_m2': MIN_WATER_M2,
        'roads': list(ROAD_CLASSES), 'rail': list(RAIL_KINDS), 'labels': {**MAX, 'fittedOnPx': MAP_PX},
        **({'only': sorted(only)} if only else {}),
        'source': {
            'osm': {'file': os.path.basename(a.osm), 'sha256': osm_sha, 'bytes': os.path.getsize(a.osm), 'timestamp': stamp,
                    'publisher': 'Geofabrik extract of OpenStreetMap (download.geofabrik.de/asia/thailand-latest.osm.pbf)',
                    'license': 'ODbL 1.0', 'attribution': '© OpenStreetMap contributors',
                    'sameAs': 'montri-th/shoppingcenter data/crossing/meta.json osm (0.12.0, D70)'},
            'stations': {'file': 'data/rail.json', 'sha256': sha256(os.path.join(rr, 'data', 'rail.json')),
                         'kept': 'stations of status 0 (operating) and the national stops (srt) farther than 150 m from them'},
            'method': 'montri-th/shoppingcenter scripts/build-residents-map.py @4bb7522 (roads, rail, rivers, names); the sea, water areas and national stops added here',
        },
        'counts': {**counts, 'seaDropped': sorted(dropped)},
        'frame': frames,
        'note': 'lines and water to read the map by, never a count, a distance or a barrier the page measures with; names as OpenStreetMap writes them, shortened (ถนน → ถ., Road → Rd)',
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'meta': meta, 'rows': out}, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
        f.write('\n')
    print(f'wrote {a.out}: {len(out)} neighbourhoods in {time.time() - t0:.0f}s · {json.dumps(meta["counts"], ensure_ascii=False)}', flush=True)


if __name__ == '__main__':
    main()
