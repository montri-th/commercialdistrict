#!/usr/bin/env python3
"""
CityMETER · Commercial District — the rivers that part the land and the ways across them (0.7.5, V7-09).

    python3 -I scripts/crossing/rivers.py --osm <thailand-261124.osm.pbf> --out <cache.pkl outside the repository>

The rule is the Shopping Center page's D70 (montri-th/shoppingcenter DATA_METHOD.md §32, release 0.12.0, VERBATIM from
its owner 2026-11-26 14:12: “รัศมี 1,3,5km ถ้ากรณีคร่อมไปคนละฝั่งแม่น้ำ หรือมี physical barrier ขวางแบบนี้เราควรนับคน/จุด/
context ฝั่งตรงข้ามยังไงครับ”, his answer “อ้อมผ่านทางข้าม (Recommended)”), on the very OpenStreetMap file it used (D-14:
Geofabrik thailand-latest, data to 2026-11-24T21:21:23Z, SHA-256 62b496bf…12d24, outside this repository). Its scripts
live in that page's bundle outside both repositories, so this is a reading of the written rule, checked against the
Shopping Center's published results by scripts/crossing/parity.py (DATA_METHOD.md §17):

  barrier rivers  waterway=river ways whose Thai name (the way's, else its waterway relation's) starts with แม่น้ำ (or
                  the misspelling แม้น้ำ), or whose English name says River while the Thai name is not a khlong (คลอง)
                  or huai (ห้วย); an unnamed waterway=river way whose two ends meet ways of one such river (a gap in it);
                  a river end within 2 km of the coastline carried 20 km on out to sea, along its last segment
  crossings       a highway way of any class across a barrier river, bridge-tagged or not (not under construction,
                  proposed, abandoned or razed; not closed to everyone — access=no or private counts when the way is
                  open on foot, by bicycle or by vehicle); metro lines (subway, light rail, monorail) and rail tunnels;
                  route=ferry ways up to 1.6 km long, without the boats that run along the river (express boats)

Writes one pickle outside the repository: the barrier lines (lon/lat), the crossings (kind, names, lon/lat line) and the
counts, with the SHA-256 of the OSM file it read.
"""
import argparse
import hashlib
import math
import os
import pickle
import re
import sys
from collections import defaultdict

import numpy as np
import shapely
import shapely.ops
from shapely.strtree import STRtree

R = 6371008.8
OSM_SHA256 = '62b496bf2383ddd266cfcd3456cd03064db1887399f2a4c869bbf953bfd12d24'
FERRY_MAX_M = 1600
MOUTH_NEAR_M = 2000
MOUTH_OUT_M = 20000
FOOT = {'footway', 'path', 'pedestrian', 'steps', 'cycleway', 'bridleway', 'corridor'}
NOT_OPEN = {'construction', 'proposed', 'abandoned', 'disused', 'razed', 'demolished', 'planned', 'no'}
OPEN_MODES = ('foot', 'bicycle', 'motor_vehicle', 'motorcar', 'motorcycle', 'vehicle')
OPEN_VALUES = ('yes', 'designated', 'permissive', 'destination')
METRO = ('subway', 'light_rail', 'monorail')
KINDS = ('bridge', 'road', 'tunnel', 'foot', 'ford', 'metro', 'ferry')


def hav(lo0, la0, lo1, la1):
    lo0, la0, lo1, la1 = map(np.radians, (lo0, la0, lo1, la1))
    a = np.sin((la1 - la0) / 2) ** 2 + np.cos(la0) * np.cos(la1) * np.sin((lo1 - lo0) / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(np.minimum(a, 1)))


def line_len(c):
    return float(hav(c[:-1, 0], c[:-1, 1], c[1:, 0], c[1:, 1]).sum())


def thai_of(t):
    return (t.get('name:th') or t.get('name') or '').strip()


def is_barrier_name(th, en):
    if th.startswith('แม่น้ำ') or th.startswith('แม้น้ำ'):
        return True
    return bool(en and re.search(r'\briver\b', en, re.I) and not (th.startswith('คลอง') or th.startswith('ห้วย')))


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def read_osm(path):
    """Two passes: rivers, waterway relations, coastline, ferries and railways; then the highway ways that meet a river."""
    import osmium

    def coords(o):
        return np.array([(n.lon, n.lat) for n in o.nodes], dtype='f8')

    rivers, river_rel, coast, ferries, ferry_rel, rails = [], [], [], [], [], []
    fp = (osmium.FileProcessor(path).with_locations()
          .with_filter(osmium.filter.EntityFilter(osmium.osm.WAY | osmium.osm.RELATION))
          .with_filter(osmium.filter.KeyFilter('waterway', 'natural', 'route', 'railway', 'type')))
    for o in fp:
        t = {k: v for k, v in o.tags}
        if o.is_relation():
            if t.get('type') == 'waterway' or t.get('waterway') in ('river', 'stream', 'canal'):
                river_rel.append((o.id, t, [m.ref for m in o.members if m.type == 'w']))
            elif t.get('route') == 'ferry':
                ferry_rel.append((o.id, t, [m.ref for m in o.members if m.type == 'w']))
            continue
        try:
            if t.get('waterway') == 'river':
                rivers.append((o.id, t, np.array([n.ref for n in o.nodes], dtype='i8'), coords(o)))
            elif t.get('natural') == 'coastline':
                coast.append((o.id, coords(o)))
            elif t.get('route') == 'ferry':
                ferries.append((o.id, t, coords(o)))
            elif 'railway' in t:
                rails.append((o.id, t, coords(o)))
        except osmium.InvalidLocationError:
            continue
    lines = [shapely.LineString(c) for (_i, _t, _n, c) in rivers if len(c) >= 2]
    tree = STRtree(lines)
    cells = set()
    for c in (c for (_i, _t, _n, c) in rivers if len(c) >= 2):
        for (x0, y0), (x1, y1) in zip(c[:-1], c[1:]):
            steps = max(1, int(max(abs(x1 - x0), abs(y1 - y0)) / 0.004))
            for s in range(steps + 1):
                f = s / steps
                cells.add((math.floor((x0 + (x1 - x0) * f) * 100), math.floor((y0 + (y1 - y0) * f) * 100)))
    highways = []
    fp = (osmium.FileProcessor(path).with_locations()
          .with_filter(osmium.filter.EntityFilter(osmium.osm.WAY))
          .with_filter(osmium.filter.KeyFilter('highway')))
    for o in fp:
        try:
            c = coords(o)
        except osmium.InvalidLocationError:
            continue
        if len(c) < 2:
            continue
        i0, i1 = math.floor(c[:, 0].min() * 100), math.floor(c[:, 0].max() * 100)
        j0, j1 = math.floor(c[:, 1].min() * 100), math.floor(c[:, 1].max() * 100)
        if (i1 - i0 + 1) * (j1 - j0 + 1) <= 400 and not any((i, j) in cells for i in range(i0, i1 + 1) for j in range(j0, j1 + 1)):
            continue
        if len(tree.query(shapely.LineString(c), predicate='intersects')):
            highways.append((o.id, {k: v for k, v in o.tags}, c))
    return {'rivers': rivers, 'river_rel': river_rel, 'coast': coast, 'ferries': ferries, 'ferry_rel': ferry_rel,
            'rails': rails, 'highways': highways}


def barriers(d):
    """{way id: name} of the barrier rivers, the gap ways, and the mouth extensions (lon/lat lines)."""
    rel_of = defaultdict(list)
    for _rid, t, ways in d['river_rel']:
        for w in ways:
            rel_of[w].append(t)
    ways, named = {}, {}
    for wid, t, nodes, c in d['rivers']:
        if len(c) < 2:
            continue
        th, en = thai_of(t), (t.get('name:en') or '').strip()
        rels = rel_of.get(wid, [])
        if not th:
            th = next((thai_of(r) for r in rels if thai_of(r)), '')
        if not en:
            en = next(((r.get('name:en') or '').strip() for r in rels if r.get('name:en')), '')
        ways[wid] = (nodes, c, th, en)
        if is_barrier_name(th, en):
            named[wid] = (th, en)
    node_ways = defaultdict(set)
    for wid, (nodes, c, th, en) in ways.items():
        for n in nodes:
            node_ways[int(n)].add(wid)
    gaps = {}
    for wid, (nodes, c, th, en) in ways.items():
        if th or en or wid in named:
            continue
        a = {named[x] for x in node_ways[int(nodes[0])] if x in named}
        b = {named[x] for x in node_ways[int(nodes[-1])] if x in named}
        same = a & b
        if same:
            gaps[wid] = sorted(same)[0]
    barrier = {**named, **gaps}
    deg = defaultdict(int)
    for w in barrier:
        for n in set(int(x) for x in ways[w][0]):
            deg[n] += 1
    coast = [shapely.LineString(c) for _i, c in d['coast'] if len(c) >= 2]
    ctree = STRtree(coast)
    mouths = []
    for w in sorted(barrier):
        nodes, c, th, en = ways[w]
        for i, step in ((0, 1), (len(c) - 1, -1)):
            if deg[int(nodes[i])] != 1:
                continue
            p = shapely.Point(c[i])
            near = ctree.query_nearest(p, return_distance=False)
            if not len(near):
                continue
            q = shapely.ops.nearest_points(p, coast[near[0]])[1]
            if float(hav(c[i][0], c[i][1], q.x, q.y)) > MOUTH_NEAR_M:
                continue
            x0, y0 = c[i]
            k = i + step
            while 0 <= k < len(c) and float(hav(c[k][0], c[k][1], x0, y0)) < 1:
                k += step
            if not 0 <= k < len(c):
                continue
            x1, y1 = c[k]
            dx, dy = (x0 - x1) * math.cos(math.radians(y0)), (y0 - y1)
            nrm = math.hypot(dx, dy) or 1
            dlo = dx / nrm * MOUTH_OUT_M / (R * math.cos(math.radians(y0))) * 180 / math.pi
            dla = dy / nrm * MOUTH_OUT_M / R * 180 / math.pi
            mouths.append((w, np.array([[x0, y0], [x0 + dlo, y0 + dla]])))
    return ways, named, gaps, mouths


def crossings(d, lines_tree, lines_ids):
    """[(kind, th, en, lon/lat line, osm way id)] by the rule above."""
    def crosses(c):
        return len(lines_tree.query(shapely.LineString(c), predicate='intersects')) > 0

    out = []
    for wid, t, c in d['highways']:
        hw = t.get('highway')
        if hw in NOT_OPEN or t.get('construction'):
            continue
        if t.get('access') in ('no', 'private') and not any(t.get(m) in OPEN_VALUES for m in OPEN_MODES):
            continue
        if not crosses(c):
            continue
        if hw in FOOT:
            kind = 'foot'
        elif t.get('ford') and t.get('ford') != 'no':
            kind = 'ford'
        elif t.get('bridge') and t.get('bridge') != 'no':
            kind = 'bridge'
        elif t.get('tunnel') and t.get('tunnel') != 'no':
            kind = 'tunnel'
        else:
            kind = 'road'
        out.append((kind, t.get('name', ''), t.get('name:en', ''), c, wid))
    for wid, t, c in d['rails']:
        rw = t.get('railway')
        if (rw in METRO or (t.get('tunnel') not in (None, 'no') and rw in ('rail', *METRO))) and crosses(c):
            out.append(('metro', t.get('name', ''), t.get('name:en', ''), c, wid))
    express = set()
    for _rid, t, ways in d['ferry_rel']:
        nm = (t.get('name', '') + ' ' + t.get('name:en', '')).lower()
        if 'express' in nm or 'ด่วน' in nm:
            express |= set(ways)
    for wid, t, c in d['ferries']:
        nm = (t.get('name', '') + ' ' + t.get('name:en', '')).lower()
        if wid in express or 'ด่วน' in nm or 'express' in nm or len(c) < 2 or line_len(c) > FERRY_MAX_M:
            continue
        if crosses(c):
            out.append(('ferry', t.get('name', ''), t.get('name:en', ''), c, wid))
    return out


def build(osm_path):
    sha = sha256_file(osm_path)
    if sha != OSM_SHA256:
        sys.exit(f'{osm_path}: SHA-256 {sha}, not the pinned file {OSM_SHA256} (D-14)')
    d = read_osm(osm_path)
    ways, named, gaps, mouths = barriers(d)
    lines = [(w, ways[w][1], named.get(w) or gaps[w]) for w in sorted({**named, **gaps})]   # (th, en) of the river
    lines += [(-(k + 1), c, ('', '')) for k, (_w, c) in enumerate(mouths)]
    tree = STRtree([shapely.LineString(c) for _w, c, _n in lines])
    cr = crossings(d, tree, [w for w, _c, _n in lines])
    by_kind = {k: sum(1 for c in cr if c[0] == k) for k in KINDS}
    return {
        'schema': 'citymeter-commercialdistrict-rivers/1',
        'osm': {'file': os.path.basename(osm_path), 'sha256': sha, 'bytes': os.path.getsize(osm_path)},
        'lines': lines, 'crossings': cr,
        'counts': {'namedWays': len(named), 'gapWays': len(gaps), 'mouths': len(mouths), 'crossings': len(cr), 'byKind': by_kind},
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--osm', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    here = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    if os.path.abspath(a.out).startswith(here + os.sep):
        sys.exit('--out must be outside the repository (the OSM-derived cache is not published)')
    res = build(a.osm)
    with open(a.out, 'wb') as f:
        pickle.dump(res, f, protocol=5)
    print(res['counts'])


if __name__ == '__main__':
    main()
