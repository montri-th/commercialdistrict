#!/usr/bin/env python3
"""CityMETER · Commercial District — places of worship, from the OpenStreetMap extract (0.8.0).

    python3 -I scripts/build-worship.py --osm <thailand-261124.osm.pbf> --temple-master <01_PLACES .csv>
        --provinces data/provinces.geojson --out <private folder>

Owner 2026-11-28 20:12, VERBATIM: “… ขอให้ leverage ข้อมูลที่เรามีให้เต็มที่”; 21:21, on downloading the temple master's
tab `01_PLACES` through his Chrome: “ได้”.

The registry's temple dataset (research.TH.temple, tab 01_PLACES, 53,045 rows of the National Office of Buddhism's and the
churches' and mosques' registers) has no point for any row: `geometry_status` is `not_collected` and `latitude` empty on
every one. So, as with parks, the ground of a place of worship comes from the Shopping Center page's OpenStreetMap
extract (the same file by SHA-256, D-14): every node or area tagged amenity=place_of_worship whose access is not private
or no. One record per place: a node inside the outline of another place of worship is a part of it (a hall, a chapel)
and is not counted again, nor is an outline inside a larger one. Kinds by the `religion` tag only: buddhist · muslim ·
christian · the rest (other faiths and places without the tag). A place is counted at its node, or at a point inside its
outline.

A place whose name matches a name of the registry's temple dataset in the same province (spaces and punctuation left
out) is marked as in the registry; the match is by name and province (an Inference), used only for that mark. The
registry's own rows stay counted by province in its tab, never placed by this script.

Output: <out>/temple.json in the format of scripts/build-registry-points.py (private, like every registry point file).
© OpenStreetMap contributors (ODbL).
"""
import argparse, csv, hashlib, json, os, re, sys
from collections import Counter
from datetime import date

import shapely
from shapely.geometry import shape
from shapely.strtree import STRtree

KINDS = [('buddhist', 'วัดและสำนักสงฆ์', 'Buddhist temples', ('buddhist',)),
         ('muslim', 'มัสยิด', 'Mosques', ('muslim',)),
         ('christian', 'โบสถ์คริสต์', 'Churches', ('christian',)),
         ('other', 'ศาลเจ้า ศาสนสถานอื่น และที่ไม่ระบุศาสนา', 'Shrines, other faiths and places without a stated faith', ())]
ACCESS_OUT = {'private', 'no'}


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def norm(s):
    return re.sub(r'[\s\-–—_.,()\'"’“”]+', '', (s or '').lower())


def kind_of(religion):
    r = (religion or '').strip().lower()
    return next((i for i, k in enumerate(KINDS) if r in k[3]), len(KINDS) - 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--osm', required=True)
    ap.add_argument('--osm-sha256', default='62b496bf')
    ap.add_argument('--temple-master', required=True, help="the registry's tab 01_PLACES as CSV")
    ap.add_argument('--provinces', default='data/provinces.geojson')
    ap.add_argument('--out', required=True)
    ap.add_argument('--built-on', default=date.today().isoformat())
    ap.add_argument('--candidates', default='', help="(private, for the register's owners) one row per register row whose name and province "
                    'match exactly one place here and no other register row: a candidate point to check, never a point of the register')
    a = ap.parse_args()
    import osmium

    osm_sha = sha256_file(a.osm)
    if not osm_sha.startswith(a.osm_sha256):
        sys.exit(f'the OpenStreetMap extract is not the pinned one: {osm_sha}')
    wkb = osmium.geom.WKBFactory()
    tag = osmium.filter.TagFilter(('amenity', 'place_of_worship'))
    nodes, areas = [], []
    fp = (osmium.FileProcessor(a.osm).with_areas(tag)
          .with_filter(osmium.filter.EntityFilter(osmium.osm.NODE | osmium.osm.AREA)).with_filter(tag))
    for o in fp:
        t = {k: v for k, v in o.tags}
        if t.get('amenity') != 'place_of_worship' or t.get('access') in ACCESS_OUT:
            continue
        name = (t.get('name:th') or t.get('name') or '').strip()
        rec = {'name': name, 'en': (t.get('name:en') or '').strip(), 'kind': kind_of(t.get('religion'))}
        if o.is_node():
            if not o.location.valid():
                continue
            rec.update(osm='n' + str(o.id), pt=(o.location.lon, o.location.lat))
            nodes.append(rec)
        else:
            try:
                g = shapely.from_wkb(bytes.fromhex(wkb.create_multipolygon(o)))
            except Exception:
                continue
            if not g.is_valid:
                g = shapely.make_valid(g)
            c = g.representative_point()
            rec.update(osm=('w' if o.from_way() else 'r') + str(o.orig_id()), pt=(c.x, c.y), g=g, area=g.area)
            areas.append(rec)
    print('read', len(nodes), 'nodes', len(areas), 'areas', file=sys.stderr)

    # one record per place: the outermost outline; nodes and smaller outlines inside an outline are its parts
    areas.sort(key=lambda r: -r['area'])
    atree = STRtree([r['g'] for r in areas])
    keep = []
    for i, r in enumerate(areas):
        pt = shapely.Point(r['pt'])
        if any(j < i and areas[j]['g'].covers(pt) for j in atree.query(pt)):
            continue
        keep.append(r)
    parts = 0
    for r in nodes:
        pt = shapely.Point(r['pt'])
        if any(areas[j]['g'].covers(pt) for j in atree.query(pt)):
            parts += 1
            continue
        keep.append(r)
    print('places', len(keep), 'parts left out', parts + len(areas) - sum(1 for r in keep if 'g' in r), file=sys.stderr)

    # the province of each place, and the registry's names by province (the mark only)
    prov = json.load(open(a.provinces, encoding='utf-8'))['features']
    pg = [shape(f['geometry']) for f in prov]
    ptree = STRtree(pg)
    outside = 0
    for r in keep:
        pt = shapely.Point(r['pt'])
        hit = [i for i in ptree.query(pt) if pg[i].covers(pt)]
        r['prov'] = prov[hit[0]]['properties']['name'] if hit else ''
        outside += not hit
    with open(a.temple_master, encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
    reg, by_rel = set(), Counter()
    for d in rows:
        if d.get('layer') != 'active_scope_research_candidate':
            continue
        by_rel[d.get('religion', '')] += 1
        k = norm(d.get('name'))
        if len(k) >= 3:
            reg.add((d.get('province', '').strip(), k))
    matched = 0
    for r in keep:
        r['reg'] = (r['prov'], norm(r['name'])) in reg if len(norm(r['name'])) >= 3 else False
        matched += r['reg']
    if a.candidates:
        by_osm, by_reg = {}, {}
        for r in keep:
            k = (r['prov'], norm(r['name']))
            if len(k[1]) >= 3:
                by_osm.setdefault(k, []).append(r)
        for d in rows:
            if d.get('layer') == 'active_scope_research_candidate':
                k = (d.get('province', '').strip(), norm(d.get('name')))
                if len(k[1]) >= 3:
                    by_reg.setdefault(k, []).append(d)
        n = 0
        with open(a.candidates, 'w', encoding='utf-8', newline='') as f:
            w = csv.writer(f)
            w.writerow(['record_id', 'name', 'religion', 'province', 'district', 'subdistrict', 'osm_element', 'osm_name', 'osm_kind',
                        'latitude', 'longitude', 'match', 'osm_file_sha256'])
            for k, ds_ in sorted(by_reg.items()):
                o = by_osm.get(k, [])
                if len(ds_) == 1 and len(o) == 1:
                    d, r = ds_[0], o[0]
                    w.writerow([d['record_id'], d['name'], d.get('religion', ''), d.get('province', ''), d.get('district', ''), d.get('subdistrict', ''),
                                r['osm'], r['name'], KINDS[r['kind']][0], f"{r['pt'][1]:.6f}", f"{r['pt'][0]:.6f}", 'name_and_province_unique', osm_sha])
                    n += 1
        print('candidates', n, file=sys.stderr)
    keep.sort(key=lambda r: r['osm'])
    points = [[round(r['pt'][0], 6), round(r['pt'][1], 6), r['kind'], r['osm'], 'osm'] for r in keep]
    kinds = Counter(KINDS[r['kind']][0] for r in keep)
    print('kinds', dict(kinds), 'outside every province', outside, 'matched to the registry', matched, file=sys.stderr)
    out = {'meta': {'id': 'temple', 'registry': 'research.TH.temple', 'source': 'OpenStreetMap amenity=place_of_worship', 'tab': 'OpenStreetMap amenity=place_of_worship',
                    'th': 'ศาสนสถาน', 'en': 'Places of worship', 'group': 'Living', 'unit': ['แห่ง', 'places'],
                    'ruleTh': 'ศาสนสถานจาก OpenStreetMap (amenity=place_of_worship ที่ไม่ปิดเป็นของส่วนตัว) หนึ่งแห่งต่อสถานที่ อาคารย่อยในรั้วเดียวกันไม่นับซ้ำ',
                    'ruleEn': 'places of worship of OpenStreetMap (amenity=place_of_worship not marked private), one per place; halls within the same grounds counted once',
                    'osmSha256': osm_sha, 'exportSha256': osm_sha, 'builtOn': a.built_on, 'records': len(points), 'placed': len(points), 'placedBy': {'osm': len(points)},
                    'kinds': dict(kinds), 'registryMatched': matched, 'outsideProvinces': outside,
                    'registry': {'tab': '01_PLACES', 'sha256': sha256_file(a.temple_master), 'rows': len(rows),
                                 'active': sum(by_rel.values()), 'byReligion': dict(by_rel.most_common()), 'withPoint': 0}},
           'groups': [{'id': k[0], 'th': k[1], 'en': k[2]} for k in KINDS], 'points': points, 'unplaced': {}}
    # (the registry's id is also in meta.registry: keep the short id the other point files carry)
    out['meta']['registry'] = 'research.TH.temple'
    out['meta']['registryTab'] = {'tab': '01_PLACES', 'sha256': sha256_file(a.temple_master), 'rows': len(rows), 'active': sum(by_rel.values()),
                                  'byReligion': dict(by_rel.most_common()), 'withPoint': 0}
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, 'temple.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(json.dumps({k: v for k, v in out['meta'].items() if k not in ('ruleTh', 'ruleEn')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
