#!/usr/bin/env python3
"""Owner amendment of one registry outline (0.2.4) — amendments/outline-amendments.geojson.

Owner 2026-11-18 17:05, VERBATIM: “ขอปรับย่าน นิมมาน-เมญ่า เชียงใหม่ ควรรวม ศูนย์การค้า Maya, กาดรินคำ, วิทยาลัยสารพัดช่างเชียงใหม่
เข้าเป็นส่วนหนึ่งของย่านนี้ด้วย”.

CMN-TH-FB55C19EF1 นิมมาน–เมญ่า stopped at the south side of Huay Kaew Road; the three places stand across it. Drawn by the
registry's own rules (หลักเกณฑ์ขอบย่าน, policy 2026-11-17-commercial-recovery-9, DATA_METHOD.md §2b):
  CONTEXT   membership follows the name people know — the neighbourhood's own name says Maya
  WHOLE     the sites whole, the college campus included (a school is not left out for being one): OSM way/249154472
            Maya, way/470067655 Kad Rin Kham, way/580288757 the college campus, and way/580288714 The Wall, the retail
            ground between the campus and the market (left out, the campus would join only through the road)
  CROSSING  the road between them is joined where real crossings are mapped on Huay Kaew (OSM node/11786310252 in front
            of Kad Rin Kham, node/11786310251 and 11786310253 in front of Maya, the signals of the Rin Kham junction):
            a closing of 25 m of the outline and the sites, kept within 45 m of both
  BAY       the lane between Kad Rin Kham and Maya (narrower than 20 m) closed along its length
  OVERLAP   no other registry outline within 1.2 km (Tha Phae–old city, 1,272 m); the lodging screen's draft
            ช้างเผือก–เสริมสุข stays 13 m to the east (the build checks the lodging drafts too)
The registry outline is kept whole (the additions are computed in UTM 47N, the registry's metric CRS, and joined to the
registry's own coordinates, reaching 5 cm over the shared edge); only what lies within 3 m of the additions closes hairline cracks.

Usage: python3 -I scripts/draw-outline-amendment.py <bundle dir> amendments/osm-rincome-2026-11-18.json amendments/outline-amendments.geojson
"""
import hashlib
import json
import sys

import pyproj
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform, unary_union

CODE, NAME = 'CMN-TH-FB55C19EF1', 'นิมมาน–เมญ่า'
SITES = ['way/249154472', 'way/470067655', 'way/580288714', 'way/580288757']
CLOSING_M, STRIP_M, BAY_M, CRACK_M = 25.0, 45.0, 10.0, 1.0
WORDS = 'ขอปรับย่าน นิมมาน-เมญ่า เชียงใหม่ ควรรวม ศูนย์การค้า Maya, กาดรินคำ, วิทยาลัยสารพัดช่างเชียงใหม่เข้าเป็นส่วนหนึ่งของย่านนี้ด้วย'


def geometry_sha256(geometry):
    return hashlib.sha256(json.dumps(geometry, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def main():
    bundle, osm_path, out = sys.argv[1:4]
    fwd = pyproj.Transformer.from_crs('EPSG:4326', 'EPSG:32647', always_xy=True).transform
    inv = pyproj.Transformer.from_crs('EPSG:32647', 'EPSG:4326', always_xy=True).transform
    canon = json.load(open(f'{bundle}/national-gis/canonical-boundaries.geojson', encoding='utf-8'))
    f = next(f for f in canon['features'] if f['properties']['canonical_id'] == CODE)
    base_ll = shape(f['geometry'])
    base = transform(fwd, base_ll)
    osm = json.load(open(osm_path, encoding='utf-8'))
    sites = unary_union([transform(fwd, Polygon(osm['ways'][k]['ring'])) for k in SITES])
    u = unary_union([base, sites])
    mitre = dict(join_style=2, mitre_limit=5)
    road = u.buffer(CLOSING_M, **mitre).buffer(-CLOSING_M, **mitre).difference(u).intersection(sites.buffer(STRIP_M).intersection(base.buffer(STRIP_M)))
    bay = sites.buffer(BAY_M, **mitre).buffer(-BAY_M, **mitre).difference(sites)
    added = unary_union([sites, road, bay])
    whole = unary_union([u, added])
    cracks = whole.buffer(CRACK_M, **mitre).buffer(-CRACK_M, **mitre).difference(whole).intersection(added.buffer(3))
    added = unary_union([added, cracks]).difference(base)
    # The additions reach 5 cm over the shared edge so the round trip to degrees leaves no hairline gap along it.
    amended = unary_union([base_ll, transform(inv, added.buffer(0.05, **mitre))]).buffer(0)
    assert amended.geom_type == 'Polygon' and not amended.interiors, amended.geom_type
    am_m = transform(fwd, amended)
    assert base.difference(am_m).area < 0.01, 'the registry outline is kept whole'
    for g in canon['features']:
        if g is not f and g.get('geometry'):
            assert transform(fwd, shape(g['geometry'])).intersection(am_m).area < 0.1, g['properties']['canonical_id']
    props = {
        'canonical_id': CODE, 'name_th': NAME, 'amended_on': '2026-11-18', 'by': 'owner', 'owner_words_th': WORDS,
        'registry_geometry_sha256': geometry_sha256(f['geometry']), 'registry_area_m2': f['properties']['area_m2'],
        'area_m2': round(am_m.area, 2), 'added_m2': round(am_m.area - base.area, 2), 'metric_crs': 'EPSG:32647',
        'boundary_policy_version': '2026-11-17-commercial-recovery-9', 'rules': ['CONTEXT', 'WHOLE', 'CROSSING', 'BAY', 'OVERLAP'],
        'includes': [{'source_id': k, 'name_th': osm['ways'][k]['name'], 'name_en': osm['ways'][k]['name_en'], 'tags': osm['ways'][k]['tags']} for k in SITES],
        'crossings': [c[0] for c in osm['crossings']], 'osm': osm['source'],
        'method': f'registry outline ∪ the sites whole ∪ the road between them (closing {CLOSING_M:g} m kept within {STRIP_M:g} m of both) ∪ lanes narrower than {2 * BAY_M:g} m between the sites; cracks within 3 m of the additions closed',
        'status_th': 'ขอบปรับตามคำสั่งเจ้าของ รอทะเบียนรับในรุ่นถัดไป', 'status_en': "owner's amendment, awaiting the registry's next release",
    }
    json.dump({'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': props, 'geometry': mapping(amended)}]},
              open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(json.dumps({k: props[k] for k in ('canonical_id', 'registry_area_m2', 'area_m2', 'added_m2')}, ensure_ascii=False), 'vertices', len(amended.exterior.coords))


if __name__ == '__main__':
    main()
