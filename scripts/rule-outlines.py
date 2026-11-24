#!/usr/bin/env python3
"""CityMETER · Commercial District — outlines redrawn by the owner's rule (0.3.0), from the drawing's export to amendments.

The drawing runs in the live demo (scripts/draw-outline-rule.browser.js); it exports, per neighbourhood, the grid it was
drawn on, its check figures and the rings of its share (and of every share of a split area, so one area's outlines come
from one drawing). This script:

  decode  <part-file>… --sha <sha256> --out <export.json>
          joins the base64 parts of window.__rule.exportGz(), unzips them and keeps the JSON only if its SHA-256 is the
          one the page reported.
  review  <export.json>… --rows data/neighborhoods.json --out <review.json>
          sorts every neighbourhood into what the rule does there (DATA_METHOD.md §2c) and groups the split areas.
  amend   <export.json>… --bundle <registry bundle folder> --lodging <lodging review folder> --admitted <read-back.json>
          --amendments amendments/outline-amendments.geojson --on 2026-11-24
          writes the applied outlines as owner amendments the build checks (scripts/build-data.py --outline-amendments):
          the registry's own outline (its canonical geometry, by SHA-256) united with the drawn share, less every other
          outline, so an amendment only adds area and overlaps nothing.

Nothing here reaches a network; the drawing's inputs are named in the export and in amendments/ (DATA_METHOD.md §2c).
"""
import argparse
import base64
import warnings
import gzip
import hashlib
import json
import sys
from collections import defaultdict

warnings.filterwarnings('ignore', category=DeprecationWarning)  # shapely.ops.transform, kept for shapely 2.0

OWNER_TH = ('แทนขอบเดิมไปเลย เรียบง่ายกว่า / ใช้ชื่อป่าตอง / แบ่งเป็น 2 ย่าน / เลือกใช้แบบ B โดยมี A เป็นขอบนอกสุดอีกชั้นนึง'
            'กั้นไว้ไม่ให้เกิน ยกเว้นถ้ามีกรณีพิเศษให้มาถาม / ดูย่านอื่นๆทั่วประเทศด้วย ว่าสามารถ apply หลักเดียวกันได้มั้ย ติดตรงไหนให้มาถาม')

GROWS = lambda c: c['areaM2'] > c['coreM2'] * 1.02 + 200  # the same test as the drawing's (run(): grows)


def decode_rings(s, grid):
    """Rings as cell corners in base 36 → one (Multi)Polygon by even–odd: a share's holes are other shares."""
    from shapely.geometry import Polygon
    from shapely.validation import make_valid
    lon0, lat1, res = grid
    geom = None
    for ring in (s.split('|') if s else []):
        pts = [(int(ring[i:i + 3], 36), int(ring[i + 3:i + 6], 36)) for i in range(0, len(ring), 6)]
        if len(pts) < 4:
            continue
        p = make_valid(Polygon([(lon0 + x * res, lat1 - y * res) for x, y in pts]))
        geom = p if geom is None else geom.symmetric_difference(p)
    return geom


def cmd_decode(a):
    b64 = ''.join(open(p, encoding='ascii').read().strip() for p in a.parts)
    raw = gzip.decompress(base64.b64decode(b64, validate=True))
    sha = hashlib.sha256(raw).hexdigest()
    if sha != a.sha:
        sys.exit(f'SHA-256 {sha} is not the page\'s {a.sha}: a part was read wrong')
    json.loads(raw)
    open(a.out, 'wb').write(raw)
    print(f'{a.out}: {len(raw)} bytes, SHA-256 {sha}', file=sys.stderr)


def load_places(paths):
    places, meta = {}, {}
    for p in paths:
        x = json.load(open(p, encoding='utf-8'))
        meta = {'drawnOn': x['drawnOn'], 'tilesBuild': x['tilesBuild']}
        for pl in x['places']:
            places[pl['id']] = pl
        if x.get('errors'):
            print(f'{p}: drawing errors {x["errors"]}', file=sys.stderr)
    return places, meta


def classify(pl):
    c = pl['check']
    if not GROWS(c):
        return 'unchanged'
    if c['edgeCells']:
        return 'city' if c['reachM'] == 2000 else 'runs-on'
    if not (pl.get('rings') or pl.get('shares')):  # no rings: the gain was smaller than the tracing keeps
        return 'unchanged'
    return 'split' if c['sharers'] else 'clean'


def cmd_review(a):
    places, meta = load_places(a.exports)
    rows = {r['id']: r for r in json.load(open(a.rows, encoding='utf-8'))['rows']}
    out, groups = [], defaultdict(set)
    for pid, pl in places.items():
        r, c = rows[pid], pl['check']
        cls = classify(pl)
        out.append({'id': pid, 'name': r['name'], 'province': r['province'], 'kind': r['kind'], 'class': cls,
                    'coreRai': round(c['coreM2'] / 1600), 'areaRai': round(c['areaM2'] / 1600),
                    'growth': round(c['areaM2'] / max(c['coreM2'], 1), 2), 'reachM': c['reachM'], 'fill': c['fill'],
                    'sharers': c['sharers'], 'osmBuildings': [c['osmBuildingsCore'], c['osmBuildings']],
                    'hotels': [c['hotelsCore'], c['hotels']]})
        if cls == 'split':
            for s in c['sharers']:
                groups[pid].add(s)
                groups[s].add(pid)
    # split areas: neighbourhoods joined by shared built-up ground, as one group each
    seen, areas = set(), []
    for pid in sorted(groups):
        if pid in seen:
            continue
        stack, comp = [pid], set()
        while stack:
            q = stack.pop()
            if q in comp:
                continue
            comp.add(q)
            stack.extend(groups[q] - comp)
        seen |= comp
        areas.append(sorted(comp))
    summary = defaultdict(int)
    for x in out:
        summary[x['class']] += 1
    json.dump({'drawnOn': meta.get('drawnOn'), 'tilesBuild': meta.get('tilesBuild'), 'summary': dict(summary),
               'splitAreas': areas, 'places': sorted(out, key=lambda x: (x['class'], x['province'], x['id']))},
              open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps(dict(summary)), f'{len(areas)} split areas', file=sys.stderr)


RULE = {
    'name': 'buildings within the dark ground',
    'th': 'แนบตามอาคาร (เส้น B) ไม่เกินพื้นที่ที่แผนที่ฐานไม่ได้ระบุเป็นป่า ทุ่ง หรือน้ำ (เส้น A) แบ่งครึ่งทางกับย่านข้างเคียง',
    'en': 'tight to the buildings (line B), within ground the basemap does not mark as forest, field or water (line A), '
          'shared halfway with the neighbouring neighbourhoods',
}
SMOOTH_M, REACH_M, SIMPLIFY_M, CRUMB_M2 = 12, 6, 2, 500  # display: round the cells' steps, never past half a cell


def utm(geom):
    from pyproj import Transformer
    zone = 32647 if geom.centroid.x < 102 else 32648  # the build's utm_area (scripts/build-data.py)
    return (Transformer.from_crs(4326, zone, always_xy=True).transform, Transformer.from_crs(zone, 4326, always_xy=True).transform)


def utm_area(geom):
    from shapely.ops import transform
    return transform(utm(geom)[0], geom).area


TRIM_M = 75  # the owner's "ตัดแขนแคบ": an opening of 75 m takes off arms narrower than 150 m


def trim_arms(drawn, core):
    """The drawing less its arms narrower than 150 m: an opening of 75 m, the parts that still meet the outline it grew from."""
    from shapely.geometry import Polygon
    from shapely.ops import transform, unary_union
    fwd, back = utm(drawn)
    m, c = transform(fwd, drawn), transform(fwd, core)
    kept = unary_union([m.buffer(-TRIM_M, join_style=1).buffer(TRIM_M, join_style=1).intersection(m), c.intersection(m)])
    parts = [g for g in getattr(kept, 'geoms', [kept]) if isinstance(g, Polygon) and g.area > 0 and g.buffer(1).intersects(c)]
    return transform(back, unary_union(parts)) if parts else core


def reach_m(new, core):
    """How far the new outline reaches from the registry's: the discrete Hausdorff distance in UTM, metres."""
    from shapely.ops import transform
    fwd = utm(new)[0]
    return round(transform(fwd, new).hausdorff_distance(transform(fwd, core)))


def smooth(ext):
    """The drawing's cells, their steps rounded off: a closing of 12 m kept within 6 m of the cells, simplified at 2 m."""
    from shapely.ops import transform
    fwd, back = utm(ext)
    m = transform(fwd, ext)
    s = m.buffer(SMOOTH_M, join_style=1).buffer(-SMOOTH_M, join_style=1).intersection(m.buffer(REACH_M, join_style=1))
    return transform(back, s.simplify(SIMPLIFY_M))


def cmd_amend(a):
    import os
    from shapely.geometry import shape, mapping, MultiPolygon, Polygon
    from shapely.ops import unary_union
    from shapely.validation import make_valid
    places, meta = load_places(a.exports)
    rows = {r['id']: r for r in json.load(open(a.rows, encoding='utf-8'))['rows']}
    gsha = lambda g: hashlib.sha256(json.dumps(g, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    # the outlines as the build reads them: the registry's canonical ones, then the lodging drafts it appends
    if a.display:  # a preview only: the display copy stands in for the registry's geometry (no build accepts it)
        feats = json.load(open(a.display, encoding='utf-8'))['features']
        base = {f['properties']['id']: f['geometry'] for f in feats}
        order = [f['properties']['id'] for f in feats]
    else:
        canon = json.load(open(os.path.join(a.bundle, 'national-gis', 'canonical-boundaries.geojson'), encoding='utf-8'))
        base = {f['properties']['canonical_id']: f['geometry'] for f in canon['features'] if f['geometry']}
        order = [f['properties']['canonical_id'] for f in canon['features'] if f['geometry']]
        drafts = json.load(open(os.path.join(a.lodging, 'boundaries', 'current-all268-review-drafts.geojson'), encoding='utf-8'))['features']
        for d in drafts:
            code = 'CMN-TH-' + d['properties']['proposal_group_id'].removeprefix('LP-NEW-')
            if code in rows and rows[code]['kind'] == 'lodging':
                base[code] = d['geometry']
                order.append(code)
    missing = [k for k in rows if k not in base]
    if missing:
        sys.exit(f'{len(missing)} outlines of the demo are not in the inputs, e.g. {missing[:3]}')
    old = json.load(open(a.amendments, encoding='utf-8')) if os.path.exists(a.amendments) else {'type': 'FeatureCollection', 'features': []}
    kept = [f for f in old['features'] if not f['properties'].get('rule')]  # the owner's own amendments stay as drawn
    fixed = {f['properties']['canonical_id'] for f in kept}
    def poly(g):  # the polygonal part of a valid copy: a few display outlines cross themselves
        v = make_valid(shape(g))
        ps = [p for p in getattr(v, 'geoms', [v]) if isinstance(p, (Polygon, MultiPolygon))]
        return v if isinstance(v, (Polygon, MultiPolygon)) else unary_union(ps)
    cur = {k: poly(g) for k, g in base.items()}
    for f in kept:
        cur[f['properties']['canonical_id']] = poly(f['geometry'])
    only = set(a.only.split(',')) if a.only else None
    trim = set()
    if a.choices:  # the owner's picks (amendments/outline-rule-choices-*.json): apply, applyTicked, and the ones to take without narrow arms
        ch = json.load(open(a.choices, encoding='utf-8'))
        if (ch.get('redraw') or {}).get('status') == 'pending':
            sys.exit('amend: the owner\'s picks wait for a drawing not exported yet (choices.redraw): ' + ch['redraw']['why'])
        only = set(ch['apply']) | set(ch.get('applyTicked', [])) | set(ch.get('applyNoted', [])) | set(ch.get('trimArms', []))
        trim = set(ch.get('trimArms', []))
    skip = set(a.skip.split(',')) if a.skip else set()
    # one drawing per area: the first neighbourhood of the area in the registry's order gives every share of it
    assigned, report = {}, defaultdict(list)
    for pid in order:
        pl = places.get(pid)
        if pl is None or classify(pl) not in ('clean', 'split') or pid in assigned:
            continue
        for k, rings in ({pid: pl['rings']} if classify(pl) == 'clean' else pl['shares']).items():
            assigned.setdefault(k, (pl['grid'], rings, pid))
    feats_out = []
    for pid in order:
        if pid not in assigned:
            continue
        grid, rings, by = assigned[pid]
        why = 'owner-amended' if pid in fixed else 'skipped' if pid in skip or (only is not None and pid not in only) else ''
        if why:
            report[why].append(pid)
            continue
        core = poly(base[pid])
        drawn = smooth(decode_rings(rings, grid))
        if pid in trim:
            drawn = trim_arms(drawn, core)
        near = [cur[k] for k in cur if k != pid and cur[k].intersects(drawn.buffer(0.001))]
        new = drawn.difference(unary_union(near)) if near else drawn  # a union: outlines that overlap each other stay subtracted
        new = make_valid(new.union(core))
        parts = [p for p in getattr(new, 'geoms', [new]) if isinstance(p, Polygon) and (p.intersects(core) or utm_area(p) >= CRUMB_M2)]
        new = parts[0] if len(parts) == 1 else MultiPolygon(parts)
        reg_a, new_a = utm_area(core), utm_area(new)
        if new_a <= reg_a * 1.02 + 200:
            report['no gain'].append(pid)
            continue
        lost = core.difference(new)
        assert lost.is_empty or utm_area(lost) < 0.01, f'{pid} loses area'
        for g in near:  # what the build checks; an overlap the outlines already had (none in the registry's) is not new
            both, had = g.intersection(new), g.intersection(core)
            assert both.is_empty or utm_area(both) - (0 if had.is_empty else utm_area(had)) < 0.1, f'{pid} overlaps a neighbour'
        cur[pid] = new
        c = places[by]['check'] if by == pid else places[pid]['check'] if pid in places else {}
        feats_out.append({'type': 'Feature', 'geometry': mapping(new), 'properties': {
            'canonical_id': pid, 'name_th': rows[pid]['name'], 'amended_on': a.on, 'by': 'owner', 'owner_words_th': OWNER_TH,
            'registry_geometry_sha256': gsha(base[pid]), 'registry_area_m2': round(reg_a, 2), 'area_m2': round(new_a, 2),
            'added_m2': round(new_a - reg_a, 2), 'reach_m': reach_m(new, core), 'metric_crs': 'EPSG:32647' if new.centroid.x < 102 else 'EPSG:32648',
            'rules': ['BUILDINGS', 'DARK-GROUND'] + (['HALFWAY'] if by != pid or places[pid]['check']['sharers'] else []),
            'includes': [], 'crossings': [],
            'osm': f"OpenFreeMap planet {meta['tilesBuild']} (OpenMapTiles schema, zoom 14) as the demo's basemap draws it, © OpenStreetMap contributors, ODbL 1.0",
            'method': f"scripts/draw-outline-rule.browser.js in the live demo on {meta['drawnOn']} (drawn with {by}), "
                      f"scripts/rule-outlines.py amend: steps rounded (closing {SMOOTH_M} m within {REACH_M} m), simplified {SIMPLIFY_M} m, "
                      'the registry outline kept whole, every other outline left out',
            'rule': {'name': RULE['name'], 'th': RULE['th'], 'en': RULE['en'], 'drawnWith': by, 'armsTrimmed': pid in trim,
                     'shared': bool(by != pid or places[pid]['check']['sharers'])},
            'status_th': 'ขอบปรับตามหลักที่เจ้าของกำหนด รอทะเบียนรับในรุ่นถัดไป',
            'status_en': "redrawn by the owner's rule, awaiting the registry's next release"}})
        report['amended'].append(pid)
    out = {'type': 'FeatureCollection', 'features': kept + feats_out}
    open(a.out or a.amendments, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({k: len(v) for k, v in report.items()}), file=sys.stderr)
    for k, v in report.items():
        if k != 'amended':
            print(k, v, file=sys.stderr)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    d = sub.add_parser('decode')
    d.add_argument('parts', nargs='+')
    d.add_argument('--sha', required=True)
    d.add_argument('--out', required=True)
    r = sub.add_parser('review')
    r.add_argument('exports', nargs='+')
    r.add_argument('--rows', default='data/neighborhoods.json')
    r.add_argument('--out', required=True)
    m = sub.add_parser('amend')
    m.add_argument('exports', nargs='+')
    m.add_argument('--rows', default='data/neighborhoods.json')
    m.add_argument('--bundle', default='', help='the registry bundle folder (national-gis/canonical-boundaries.geojson)')
    m.add_argument('--lodging', default='', help="the bundle's current lodging review folder (boundaries/current-all268-review-drafts.geojson)")
    m.add_argument('--display', default='', help='preview only: data/boundaries.geojson stands in for the registry geometry')
    m.add_argument('--amendments', default='amendments/outline-amendments.geojson')
    m.add_argument('--out', default='', help='write here instead of over --amendments')
    m.add_argument('--on', required=True)
    m.add_argument('--only', default='', help='comma-separated codes to amend (default: every clean or split one)')
    m.add_argument('--skip', default='', help='comma-separated codes to leave as drawn by the registry')
    m.add_argument('--choices', default='', help="the owner's picks: amendments/outline-rule-choices-<date>.json (apply, applyTicked, applyNoted, trimArms)")
    a = ap.parse_args()
    if a.cmd == 'amend' and not a.display and not (a.bundle and a.lodging):
        sys.exit('amend needs --bundle and --lodging (or --display for a preview)')
    {'decode': cmd_decode, 'review': cmd_review, 'amend': cmd_amend}[a.cmd](a)


if __name__ == '__main__':
    main()
