#!/usr/bin/env python3
"""CityMETER · Commercial District — public parks as area, from the OpenStreetMap extract (0.8.0).

    python3 -I scripts/build-parks.py --osm <thailand-261124.osm.pbf> --park-master <park research master .xlsx>
        --provinces data/provinces.geojson --neighborhoods data/boundaries.geojson --out <private folder> --public data

Owner 2026-11-28 20:12, VERBATIM: “ในขอบเขต 800 เมตรของย่านศูนย์สิริกิติ ควรจะมีสวนเบญจกิตติ ถูกนับด้วย / Parks
ขนาดใหญ่ขนาดนี้ควรมีผลกับความ "น่าอยู่" ของย่านมากๆ มากกว่า fitness …”

The registry's park dataset (research.TH.park, tab 02_PARKS) names 2,227 parks but has no checked point for any of them
(`latitude` empty; Bangkok's 148 have none at all, สวนเบญจกิติ PRK-BMA-86fb52c8b836 says `unselected;not_collected`).
The ground of a park therefore comes from the Shopping Center page's OpenStreetMap extract (the same file by SHA-256,
D-14): every area tagged leisure=park whose access is not private, no or customers, of 400 m² or more. A park's area
is counted, not the park: its ground is cut into 40 m squares (one square = 1,600 m² = 1 ไร่) on the UTM grid of its zone,
and each square whose centre lies in a park is one record of the dataset (a square in two parks counts once); a park
of half a ไร่ or more without a centre in it is one square at a point inside it. So the dataset's unit is ไร่ and a
neighbourhood's figure is about the ground of parks inside it (or within the walkable edge), never a count of parks.
Kinds by the size of the whole park: 50 ไร่ or more · 5–50 ไร่ · under 5 ไร่.

A park whose name matches a name of the registry's park dataset in the same province (spaces, “สวน”, “สาธารณะ”,
“park” and punctuation left out) is marked as in the registry; the match is by name and province (an Inference), used
only for that mark.

Outputs: <out>/park.json (the squares, in the format of scripts/build-registry-points.py) and <public>/parks.json: the
parks within 1 km of a neighbourhood — name, English name, whole area in ไร่, size kind, registry mark — the list
data/around.json points into. © OpenStreetMap contributors (ODbL).
"""
import argparse, hashlib, json, math, os, re, sys
from collections import Counter
from datetime import date

import numpy as np
import pyproj
import shapely
from shapely.geometry import shape
from shapely.strtree import STRtree

RAI = 1600.0
CELL = 40.0            # metres: one square = 1 ไร่
MIN_M2 = 400.0
SIZES = [('big', 'สวนขนาดใหญ่ 50 ไร่ขึ้นไป', 'Large parks, 50 rai or more', 50), ('mid', 'สวน 5–50 ไร่', 'Parks of 5–50 rai', 5),
         ('small', 'สวนเล็กกว่า 5 ไร่', 'Parks under 5 rai', 0)]
ACCESS_OUT = {'private', 'no', 'customers'}


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def norm(s):
    s = (s or '').lower()
    s = re.sub(r'สวนสาธารณะ|สาธารณะ|สวน|park|public|garden|[\s\-–—_.,()\'"’]+', '', s)
    return s


def utm(lon):
    return pyproj.Transformer.from_crs('EPSG:4326', 'EPSG:32647' if lon < 102 else 'EPSG:32648', always_xy=True), ('EPSG:32647' if lon < 102 else 'EPSG:32648')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--osm', required=True)
    ap.add_argument('--osm-sha256', default='62b496bf')
    ap.add_argument('--park-master', required=True)
    ap.add_argument('--provinces', default='data/provinces.geojson')
    ap.add_argument('--neighborhoods', default='data/boundaries.geojson')
    ap.add_argument('--out', required=True)
    ap.add_argument('--public', default='data')
    ap.add_argument('--built-on', default=date.today().isoformat())
    a = ap.parse_args()
    import osmium
    import openpyxl

    osm_sha = sha256_file(a.osm)
    if not osm_sha.startswith(a.osm_sha256):
        sys.exit(f'the OpenStreetMap extract is not the pinned one: {osm_sha}')
    wkb = osmium.geom.WKBFactory()
    parks = []
    fp = (osmium.FileProcessor(a.osm).with_areas(osmium.filter.TagFilter(('leisure', 'park')))
          .with_filter(osmium.filter.EntityFilter(osmium.osm.AREA)).with_filter(osmium.filter.TagFilter(('leisure', 'park'))))
    for o in fp:
        t = {k: v for k, v in o.tags}
        if t.get('leisure') != 'park' or t.get('access') in ACCESS_OUT:
            continue
        try:
            g = shapely.from_wkb(bytes.fromhex(wkb.create_multipolygon(o)))
        except Exception:
            continue
        if not g.is_valid:
            g = shapely.make_valid(g)
        c = g.representative_point()
        tr, zone = utm(c.x)
        gp = shapely.transform(g, lambda xy: np.column_stack(tr.transform(xy[:, 0], xy[:, 1])))
        if gp.area < MIN_M2:
            continue
        osm_id = ('w' if o.from_way() else 'r') + str(o.orig_id())
        parks.append({'osm': osm_id, 'th': (t.get('name:th') or t.get('name') or '').strip(), 'en': (t.get('name:en') or '').strip(),
                      'name': (t.get('name') or '').strip(), 'm2': gp.area, 'g': g, 'gp': gp, 'zone': zone, 'pt': (c.x, c.y)})
    print('parks read', len(parks), file=sys.stderr)

    # province of each park and the registry's names by province
    prov = json.load(open(a.provinces, encoding='utf-8'))['features']
    pg = [shape(f['geometry']) for f in prov]
    ptree = STRtree(pg)
    for p in parks:
        hit = [i for i in ptree.query(shapely.Point(p['pt'])) if pg[i].contains(shapely.Point(p['pt']))]
        p['prov'] = prov[hit[0]]['properties']['name'] if hit else ''
    wb = openpyxl.load_workbook(a.park_master, read_only=True, data_only=True)
    ws = wb['02_PARKS']
    rows = [['' if x is None else str(x).strip() for x in r] for r in ws.iter_rows(values_only=True)]
    head = rows[0]
    reg = {}
    for r in rows[1:]:
        d = dict(zip(head, r))
        if d.get('owner_scope_decision') in ('excluded_after_evidence_review', 'component_context_non_additive', 'duplicate_context_non_additive'):
            continue
        for nm in (d.get('name_th'), d.get('name_en')):
            k = norm(nm)
            if len(k) >= 3:
                reg.setdefault((d.get('province'), k), d.get('park_record_id'))
    matched = 0
    for p in parks:
        p['reg'] = any((p['prov'], norm(n)) in reg for n in (p['th'], p['en'], p['name']) if len(norm(n)) >= 3)
        matched += p['reg']

    # the squares: centres of the 40 m UTM grid inside a park, each once
    seen, points, kinds = set(), [], Counter()
    order = sorted(range(len(parks)), key=lambda i: -parks[i]['m2'])
    for i in order:
        p = parks[i]
        rai = p['m2'] / RAI
        p['kind'] = next(k for k, s in enumerate(SIZES) if rai >= s[3])
        x0, y0, x1, y1 = p['gp'].bounds
        xs = np.arange(math.floor(x0 / CELL) * CELL + CELL / 2, x1, CELL)
        ys = np.arange(math.floor(y0 / CELL) * CELL + CELL / 2, y1, CELL)
        if len(xs) and len(ys):
            X, Y = np.meshgrid(xs, ys)
            X, Y = X.ravel(), Y.ravel()
            inside = shapely.contains_xy(p['gp'], X, Y)
            X, Y = X[inside], Y[inside]
        else:
            X = Y = np.array([])
        inv = pyproj.Transformer.from_crs(p['zone'], 'EPSG:4326', always_xy=True)
        cells = []
        for x, y in zip(X, Y):
            k = (p['zone'], int(x // CELL), int(y // CELL))
            if k not in seen:
                seen.add(k)
                cells.append((x, y))
        if not len(X) and rai >= 0.5:
            rp = p['gp'].representative_point()
            k = (p['zone'], 'pt', p['osm'])
            seen.add(k)
            cells.append((rp.x, rp.y))
        if cells:
            lon, lat = inv.transform(np.array([c[0] for c in cells]), np.array([c[1] for c in cells]))
            for j, (lo, la) in enumerate(zip(lon, lat)):
                points.append([round(float(lo), 6), round(float(la), 6), p['kind'], f"{i}:{j}", 'osm'])
            kinds[SIZES[p['kind']][0]] += len(cells)
        p['cells'] = len(cells)
    print('squares', len(points), 'matched to the registry', matched, file=sys.stderr)

    # the parks the page can name: within 1 km of a neighbourhood's drawn outline (a box test, then the distance)
    nb = json.load(open(a.neighborhoods, encoding='utf-8'))['features']
    ng = [shape(f['geometry']) for f in nb]
    ntree = STRtree(ng)
    near = set()
    for i, p in enumerate(parks):
        if not p['cells']:
            continue
        lo0, la0, lo1, la1 = p['g'].bounds
        for j in ntree.query(shapely.box(lo0 - 0.011, la0 - 0.011, lo1 + 0.011, la1 + 0.011)):
            if ng[j].distance(p['g']) < 0.0095:   # ~1 km at Thai latitudes (a generous box; the page reads the counted squares)
                near.add(i)
                break
    index = {i: k for k, i in enumerate(sorted(near, key=lambda i: parks[i]['osm']))}
    for pt in points:
        i = int(pt[3].split(':')[0])
        pt[3] = f"{index[i]}:{pt[3].split(':')[1]}" if i in index else f"x{pt[3]}"
    public = {'meta': {'schema': 'citymeter-commercialdistrict-parks/1', 'builtOn': a.built_on, 'osm': {'file': os.path.basename(a.osm), 'sha256': osm_sha},
                       'rule': 'leisure=park, access not private/no/customers, 400 m² or more; area in ไร่ (1,600 m²); 40 m squares', 'parks': len(parks),
                       'registryMatched': matched, 'credit': '© OpenStreetMap contributors (ODbL)'},
              'kinds': [{'id': s[0], 'th': s[1], 'en': s[2]} for s in SIZES],
              'parks': [[parks[i]['th'] or parks[i]['name'], parks[i]['en'], round(parks[i]['m2'] / RAI, 1), parks[i]['kind'], 1 if parks[i]['reg'] else 0, parks[i]['osm']]
                        for i in sorted(index, key=index.get)]}
    os.makedirs(a.public, exist_ok=True)
    with open(os.path.join(a.public, 'parks.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(public, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    out = {'meta': {'id': 'park', 'registry': 'research.TH.park', 'source': 'OpenStreetMap leisure=park', 'th': 'สวนสาธารณะ', 'en': 'Parks', 'group': 'Living',
                    'unit': ['ไร่', 'rai'], 'ruleTh': 'พื้นที่สวนสาธารณะจาก OpenStreetMap (leisure=park ที่ไม่ปิดเป็นของส่วนตัว) นับเป็นไร่ ด้วยตาราง 40 ม.',
                    'ruleEn': 'public parks of OpenStreetMap (leisure=park not marked private), counted in rai on a 40 m grid',
                    'osmSha256': osm_sha, 'builtOn': a.built_on, 'records': len(points), 'placed': len(points), 'placedBy': {'osm': len(points)},
                    'kinds': dict(kinds), 'parks': len(parks), 'registryMatched': matched, 'named': len(index)},
           'groups': [{'id': s[0], 'th': s[1], 'en': s[2]} for s in SIZES], 'points': points, 'unplaced': {}}
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, 'park.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(json.dumps({k: out['meta'][k] for k in ('records', 'kinds', 'parks', 'registryMatched', 'named')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
