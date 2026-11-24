#!/usr/bin/env python3
"""Turn the export of scripts/draw-extents.browser.js into the repository's wider-area file (0.3.0).

    python3 -I scripts/extents-from-export.py <export.json> amendments/extents-pilot-<date>.geojson [--inputs <inputs.json>]

--inputs: for an export copied out of the live demo's console, the record of what it read there (each file's SHA-256,
checked against the pinned files); the headless runner (scripts/draw-extents.py) writes the same record into its export.

The export holds, per place, the grid it was drawn on ([lon0, lat1, res]) and its rings as cell corners in base 36
(three characters for x, three for y). Each ring is the outer edge of one part (holes were filled when drawn). The file
written here is the input of scripts/build-extents.py; nothing on the page reads it directly.
"""
import argparse, hashlib, json, sys

from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union
from shapely.validation import make_valid

OWNER = {
    'on': '2026-11-24',
    'asked': 'ผมอยากให้ดูเรื่องขอบเขตย่าน โดยเฉพาะย่าน ท่องเที่ยวชายหาดเป็นตัวอย่าง ว่า ย่าน ป่าตอง กะตะ กะรน น่าจะคลุมพื้นที่อาคารมากกว่านี้มั้ย อย่างป่าตอง ทำไมไม่นับรวมทุกอาคารในป่าตองเลย อย่างกมลา เราจะเห็นบน basemap เป็นขอบเขตสีดำๆ เราใช้ขอบเขตนั้นมาช่วยกำหนดขอบเขตย่านด้วยได้มั้ย … อยาก apply กับที่อื่นๆ และย่านรูปแบบอื่นๆ ที่ relevant กันด้วยทั้ง dataset นี้',
    'then': 'อย่างป่าตองก็น่าได้ประมาณนี้มั้ย',
    'go': 'ลุยเลย',
    'readings': 'two layers (the registry outline stays the core) · names unchanged · Karon and Kata one area with two cores · edge A (the dark ground) held to contiguous buildings',
}


def decode(s, lon0, lat1, res):
    parts = []
    for ring in s.split('|'):
        pts = [(int(ring[i:i + 3], 36), int(ring[i + 3:i + 6], 36)) for i in range(0, len(ring), 6)]
        coords = [(round(lon0 + x * res, 6), round(lat1 - y * res, 6)) for x, y in pts]
        if len(coords) >= 4:
            parts.append(Polygon(coords))
    # rings of one area can touch at a corner (two cells meeting diagonally): each is made valid, then the union is taken
    return unary_union([make_valid(p) for p in parts]).buffer(0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('export')
    ap.add_argument('out')
    ap.add_argument('--inputs', default='')
    a = ap.parse_args()
    src, dest = a.export, a.out
    raw = open(src, 'rb').read()
    X = json.loads(raw)
    if a.inputs:
        X['inputs'] = json.load(open(a.inputs, encoding='utf-8'))
    if X.get('errors'):
        raise SystemExit(f"the export has errors: {X['errors']}")
    build = X.get('tilesBuild') or ''
    built_on = f'{build[0:4]}-{build[4:6]}-{build[6:8]}' if len(build) >= 8 else None
    feats = []
    for p in X['places']:
        lon0, lat1, res = p['grid']
        g = decode(p['rings'], lon0, lat1, res)
        feats.append({'type': 'Feature', 'properties': {'id': f"EXT-{p['key']}", 'name': p['name'], 'province': p['prov'], 'cores': p['cores'],
                                                        'rule': p['rule'], 'asked': p.get('asked', p['rule']), 'caps': p.get('caps', []), 'check': p.get('check', {})},
                      'geometry': json.loads(json.dumps(mapping(g)), parse_float=lambda v: round(float(v), 6))})
    out = {'type': 'FeatureCollection',
           'metadata': {'title': 'พื้นที่ย่าน (ทดลอง)', 'drawnOn': X['drawnOn'], 'owner': OWNER,
                        'basemap': {'source': 'OpenFreeMap planet vector tiles (OpenMapTiles schema), zoom 14', 'build': build, 'builtOn': built_on,
                                    'layers': 'building · landcover (wood, grass, farmland, rock, wetland, sand) · park (class park only) · landuse (pitch, playground, zoo, stadium, garden, cemetery) · water (ocean, lake, river, pond) · transportation (walk rule)',
                                    'license': '© OpenMapTiles © OpenStreetMap contributors, ODbL 1.0'},
                        'subdistricts': X.get('inputs', {}).get('subdistricts') or {'source': 'CityMETER production SUBDISTRICT outlines as the live demos publish them (montri-th/pharmacy data/frames/<province>.json)'},
                        'checkedWith': {k: v for k, v in X.get('inputs', {}).items() if k in ('cores', 'hotels', 'page', 'browser')} or {'page': 'the live demo (browser console)'},
                        'grid': '0.0001° (about 11 m); edges simplified by Douglas–Peucker at 1.2 cells',
                        'script': 'scripts/draw-extents.browser.js', 'ranIn': X.get('inputs', {}).get('page') or 'the live demo (browser console)',
                        'exportSha256': hashlib.sha256(raw.rstrip(b'\n')).hexdigest()},
           'features': feats}
    with open(dest, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write('\n')
    for f in feats:
        c = f['properties']['check']
        print(f"{f['properties']['id']:<22} {f['properties']['rule']:<5} {c.get('areaM2', 0) / 1600:>8.0f} rai  hotels {c.get('hotelsCore')}→{c.get('hotels')}  others {c.get('otherCores')}", file=sys.stderr)


if __name__ == '__main__':
    main()
