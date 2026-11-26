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
LIGHT_WORDS = {'industrial': ('พื้นที่อุตสาหกรรม', 'industrial land')}  # land use the owner made light ground (18:1x)


def rule_words(light):
    """The rule in words for one drawing: line A leaves out forest, field and water, and the land uses made light ground."""
    th, en = [LIGHT_WORDS[x][0] for x in light if x in LIGHT_WORDS], [LIGHT_WORDS[x][1] for x in light if x in LIGHT_WORDS]
    if not th:
        return RULE['th'], RULE['en']
    return (RULE['th'].replace('ป่า ทุ่ง หรือน้ำ', 'ป่า ทุ่ง น้ำ หรือ' + ' '.join(th)),
            RULE['en'].replace('forest, field or water', 'forest, field, water or ' + ' or '.join(en)))


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
    trim, group_of, note_of, drawn_from = set(), {}, {}, None
    if a.choices:  # the owner's picks (amendments/outline-rule-choices-*.json): apply, applyTicked, and the ones to take without narrow arms
        ch = json.load(open(a.choices, encoding='utf-8'))
        if (ch.get('redraw') or {}).get('status') == 'pending':
            sys.exit('amend: the owner\'s picks wait for a drawing not exported yet (choices.redraw): ' + ch['redraw']['why'])
        only = set(ch['apply']) | set(ch.get('applyTicked', [])) | set(ch.get('applyNoted', [])) | set(ch.get('trimArms', []))
        trim = set(ch.get('trimArms', []))
        for g in ('apply', 'applyTicked', 'applyNoted', 'trimArms'):  # which of his picks each outline answers to
            for k in ch.get(g, []):
                group_of.setdefault(k, g)
        if ch.get('drawing'):  # the drawing his picks were made on, by SHA-256 (the reviewed one, or a redraw of it)
            got = [hashlib.sha256(open(p_, 'rb').read()).hexdigest() for p_ in a.exports]
            if got != [ch['drawing']['sha256']]:
                sys.exit(f"amend: the owner's picks name the drawing {ch['drawing']['file']} ({ch['drawing']['sha256'][:8]}…), not {', '.join(a.exports)}")
            drawn_from = {'file': ch['drawing']['file'], 'sha256': ch['drawing']['sha256']}
        if (ch.get('redraw') or {}).get('limits'):  # his own words per place where he set limits or asked again
            lim = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ch['redraw']['limits']), encoding='utf-8'))
            note_of = {k: p_['owner'] for k, p_ in lim['places'].items()}
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
        opts = places[by].get('opts') or {}  # what the drawing was made with: light land uses, the owner's limits by name
        words = rule_words(opts.get('lightLanduse') or [])
        feats_out.append({'type': 'Feature', 'geometry': mapping(new), 'properties': {
            'canonical_id': pid, 'name_th': rows[pid]['name'], 'amended_on': a.on, 'by': 'owner', 'owner_words_th': OWNER_TH,
            **({'owner_note_th': note_of[pid]} if pid in note_of else {}), **({'choice': group_of[pid]} if pid in group_of else {}),
            **({'drawing': drawn_from} if drawn_from else {}),
            'registry_geometry_sha256': gsha(base[pid]), 'registry_area_m2': round(reg_a, 2), 'area_m2': round(new_a, 2),
            'added_m2': round(new_a - reg_a, 2), 'reach_m': reach_m(new, core), 'metric_crs': 'EPSG:32647' if new.centroid.x < 102 else 'EPSG:32648',
            'rules': ['BUILDINGS', 'DARK-GROUND'] + (['HALFWAY'] if by != pid or places[pid]['check']['sharers'] else []),
            'includes': [], 'crossings': [],
            'osm': f"OpenFreeMap planet {meta['tilesBuild']} (OpenMapTiles schema, zoom 14) as the demo's basemap draws it, © OpenStreetMap contributors, ODbL 1.0",
            'method': f"scripts/draw-outline-rule.browser.js in the live demo on {meta['drawnOn']} (drawn with {by}), "
                      f"scripts/rule-outlines.py amend: steps rounded (closing {SMOOTH_M} m within {REACH_M} m), simplified {SIMPLIFY_M} m, "
                      'the registry outline kept whole, every other outline left out',
            'rule': {'name': RULE['name'], 'th': words[0], 'en': words[1], 'drawnWith': by, 'armsTrimmed': pid in trim,
                     'shared': bool(by != pid or places[pid]['check']['sharers']),
                     **({'lightLanduse': opts['lightLanduse']} if opts.get('lightLanduse') else {}),
                     **({'limits': opts['limits']} if opts.get('limits') else {})},
            'status_th': 'ขอบปรับตามหลักที่เจ้าของกำหนด รอทะเบียนรับในรุ่นถัดไป',
            'status_en': "redrawn by the owner's rule, awaiting the registry's next release"}})
        report['amended'].append(pid)
    out = {'type': 'FeatureCollection', 'features': kept + feats_out}
    open(a.out or a.amendments, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({k: len(v) for k, v in report.items()}), file=sys.stderr)
    for k, v in report.items():
        if k != 'amended':
            print(k, v, file=sys.stderr)


SEED_M = 8  # (0.5.0) a new code has no outline to grow from: the drawing starts from a 24-gon of 8 m round its reference point
#             (about one grid cell of 0.0001°), so an outline is the buildings the rule reaches, never the seed's own shape
WIDE_M = 40  # where that reaches no building, a second drawing from a 24-gon of 40 m (buildings 45 to about 85 m away) …
WIDE_MIN = 2.5  # … is used only when its outline is at least 2.5 times that seed: never a circle with a building or two
REVIEW_M = 1000  # owner 2026-11-24 15:00 (“ให้ผมติ๊กรายย่าน”): an outline reaching more than 1 km waits for his tick


def seed_polygon(lat, lon, radius=None):
    """The seed the page drew a new code from, vertex for vertex (the same formula and rounding as the page's)."""
    import math
    from shapely.geometry import Polygon
    ky, kx = 1 / 111320, 1 / (111320 * math.cos(lat * math.pi / 180))
    ring = []
    for k in range(24):
        t = 2 * math.pi * k / 24
        r_ = SEED_M if radius is None else radius
        ring.append((round(lon + r_ * kx * math.cos(t), 7), round(lat + r_ * ky * math.sin(t), 7)))
    return Polygon(ring)


def cmd_new(a):
    """(0.5.0) Outlines for the codes the registry admitted from its commercial screen (owner 2026-11-26 06:09, “ลุยตามพี่
    แนะนำเลยครับทุกข้อ”, on “วาดขอบ … ย่านใหม่ตามหลักเกณฑ์ของพี่”): the owner's rule of 2026-11-24 drawn from a seed round each
    code's reference point, every outline the build already draws left out, one drawing per shared area (the first new code
    of it in the registry's order), and the reach that he ticks himself beyond 1 km."""
    import os
    from shapely.geometry import shape, mapping, MultiPolygon, Polygon
    from shapely.ops import unary_union, transform
    from shapely.validation import make_valid
    places, meta = load_places(a.exports)
    wide, wide_meta = load_places([a.wide]) if a.wide else ({}, {})
    seeds = json.load(open(a.seeds, encoding='utf-8'))
    seeds_sha = hashlib.sha256(json.dumps(seeds, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    if a.seeds_sha and not (len(a.seeds_sha) >= 16 and seeds_sha.startswith(a.seeds_sha)):  # the page reports 16 hex digits
        sys.exit(f'the seeds are not the list the page drew from: {seeds_sha} ≠ {a.seeds_sha}')
    info = {s['code']: s for s in json.load(open(a.info, encoding='utf-8'))} if a.info else {}
    rows = {r['id']: r for r in json.load(open(a.rows, encoding='utf-8'))['rows']}
    canon = json.load(open(os.path.join(a.bundle, 'national-gis', 'canonical-boundaries.geojson'), encoding='utf-8'))
    base = {f['properties']['canonical_id']: f['geometry'] for f in canon['features'] if f['geometry']}
    drafts = json.load(open(os.path.join(a.lodging, 'boundaries', 'current-all268-review-drafts.geojson'), encoding='utf-8'))['features']
    for d in drafts:
        code = 'CMN-TH-' + d['properties']['proposal_group_id'].removeprefix('LP-NEW-')
        if code in rows and rows[code]['kind'] == 'lodging':
            base[code] = d['geometry']
    def poly(g):
        v = make_valid(shape(g))
        ps = [p for p in getattr(v, 'geoms', [v]) if isinstance(p, (Polygon, MultiPolygon))]
        return v if isinstance(v, (Polygon, MultiPolygon)) else unary_union(ps)
    cur = {k: poly(g) for k, g in base.items()}
    for f in json.load(open(a.amendments, encoding='utf-8'))['features']:  # every outline as the build draws it
        cur[f['properties']['canonical_id']] = poly(f['geometry'])
    missing = [k for k in rows if k not in cur]
    if missing:
        sys.exit(f'{len(missing)} outlines of the demo are not in the inputs, e.g. {missing[:3]}')
    order = [s[0] for s in seeds]
    new_set, held = set(order), set(a.hold.split(',')) if a.hold else set()
    if set(places) != new_set or (wide and set(wide) != new_set):
        sys.exit(f'the drawings hold {len(places)} and {len(wide)} places, the seeds {len(new_set)}')
    # the point-seeded drawing first; the wide one only for a code it left unchanged (no building within reach of the point)
    wide_area = utm_area(seed_polygon(13.75, 100.5, WIDE_M))
    use_wide = set()
    for pid in order:
        if classify(places[pid]) == 'unchanged' and pid in wide and classify(wide[pid]) in ('clean', 'split') \
                and wide[pid]['check']['areaM2'] >= WIDE_MIN * wide_area:
            use_wide.add(pid)
    assigned = {}
    for source, pids in (('point', order), ('wide', [p_ for p_ in order if p_ in use_wide])):
        for pid in pids:
            pl = places[pid] if source == 'point' else wide[pid]
            if classify(pl) not in ('clean', 'split') or pid in assigned:
                continue
            for k, rings in ({pid: pl['rings']} if classify(pl) == 'clean' else pl['shares']).items():
                # an existing neighbour's share is never taken (its outline stays as the build draws it); a new code
                # takes a share of the wide drawing only when the point drawing left it unchanged
                if k in new_set and (source == 'point' or k in use_wide or classify(places[k]) == 'unchanged'):
                    assigned.setdefault(k, (pl['grid'], rings, pid, source))
    tree_ids = list(cur)
    feats, report = [], []
    for code, lat, lon in seeds:
        pl, seed = places[code], seed_polygon(lat, lon)
        c = pl['check']
        rec = {'id': code, 'class': classify(pl), 'reachM': c['reachM'], 'fill': c['fill'], 'osmBuildings': c['osmBuildings'],
               'sharers': c['sharers'], 'inside': [k for k in tree_ids if k not in new_set and cur[k].intersects(seed)]}
        if code in wide:
            cw = wide[code]['check']
            rec['wide'] = {'class': classify(wide[code]), 'areaM2': round(cw['areaM2']), 'osmBuildings': cw['osmBuildings'], 'used': code in use_wide}
        if code not in assigned:
            st = {'city': 'city', 'runs-on': 'runs-on'}.get(rec['class'])
            if st is None and rec.get('wide', {}).get('class') in ('city', 'runs-on'):
                st = rec['wide']['class']
            if st is None and rec.get('wide', {}).get('class') in ('clean', 'split'):
                st = 'few-buildings'  # the wide drawing grew, but under WIDE_MIN times its seed
            rec['status'] = st or 'no-buildings'
            report.append(rec)
            continue
        grid, rings, by, source = assigned[code]
        if source == 'wide':
            seed = seed_polygon(lat, lon, WIDE_M)
        drawn = smooth(decode_rings(rings, grid))
        near = [cur[k] for k in cur if k != code and cur[k].intersects(drawn.buffer(0.001))]
        new = drawn.difference(unary_union(near)) if near else drawn
        new = make_valid(new)
        parts = [p for p in getattr(new, 'geoms', [new]) if isinstance(p, Polygon) and (p.intersects(seed) or utm_area(p) >= CRUMB_M2)]
        if not parts:
            rec['status'] = 'covered'
            report.append(rec)
            continue
        new = parts[0] if len(parts) == 1 else MultiPolygon(parts)
        fwd = utm(new)[0]
        reach = round(transform(fwd, new).hausdorff_distance(transform(fwd, seed_polygon(lat, lon))))  # from the point's own seed
        status = 'held' if code in held else 'apply' if reach <= REVIEW_M else 'review'
        rec.update({'status': status, 'drawnWith': by, 'seedM': WIDE_M if source == 'wide' else SEED_M, 'areaM2': round(utm_area(new), 2),
                    'reachSeedM': reach, 'parts': len(parts)})
        report.append(rec)
        for g in near:
            both = g.intersection(new)
            assert both.is_empty or utm_area(both) < 0.1, f'{code} overlaps an outline'
        cur[code] = new  # held or waiting, it keeps its ground: a later code never takes it
        tree_ids.append(code)
        x = info.get(code, {})
        opts = (wide if source == 'wide' else places)[by].get('opts') or {}
        words = rule_words(opts.get('lightLanduse') or [])
        feats.append({'type': 'Feature', 'geometry': mapping(new), 'properties': {
            'canonical_id': code, 'name_th': x.get('name', ''), 'province_th': x.get('province', ''), 'district_th': x.get('district', ''),
            'reference_point': [lon, lat], 'drawn_on': meta['drawnOn'], 'outlined_on': a.on, 'by': 'owner', 'owner_words_th': OWNER_TH,
            'status': status, 'area_m2': rec['areaM2'], 'reach_m': reach, 'metric_crs': 'EPSG:32647' if new.centroid.x < 102 else 'EPSG:32648',
            'seed': {'shape': '24-gon', 'radius_m': WIDE_M if source == 'wide' else SEED_M, 'centre': 'the registry\'s reference point (05_REVIEW_QUEUE, column จุดอ้างอิงย่าน)'},
            'rules': ['BUILDINGS', 'DARK-GROUND'] + (['HALFWAY'] if by != code or c['sharers'] else []),
            'osm': f"OpenFreeMap planet {meta['tilesBuild']} (OpenMapTiles schema, zoom 14) as the demo's basemap draws it, © OpenStreetMap contributors, ODbL 1.0",
            'method': f"scripts/draw-outline-rule.browser.js in the demo on {(wide_meta if source == 'wide' else meta)['drawnOn']} (drawn with {by}), seeded at the reference point ({WIDE_M if source == 'wide' else SEED_M} m); "
                      f"scripts/rule-outlines.py new: steps rounded (closing {SMOOTH_M} m within {REACH_M} m), simplified {SIMPLIFY_M} m, every other outline left out",
            'rule': {'name': RULE['name'], 'th': words[0], 'en': words[1], 'drawnWith': by, 'shared': bool(by != code or c['sharers']),
                     **({'lightLanduse': opts['lightLanduse']} if opts.get('lightLanduse') else {})},
            'status_th': 'ขอบวาดตามหลักที่เจ้าของกำหนดจากจุดอ้างอิงของผลคัดย่านการค้า รอทะเบียนรับในรุ่นถัดไป',
            'status_en': "drawn by the owner's rule from the commercial screen's reference point, awaiting the registry's next release"}})
    out = {'type': 'FeatureCollection', 'drawing': {'drawnOn': meta['drawnOn'], 'tilesBuild': meta['tilesBuild'], 'seedsSha256': seeds_sha,
           'seedM': SEED_M, 'wideSeedM': WIDE_M if a.wide else None, 'wideMin': WIDE_MIN if a.wide else None,
           'exports': [{'file': os.path.basename(p), 'sha256': hashlib.sha256(open(p, 'rb').read()).hexdigest(), 'seedM': SEED_M} for p in a.exports]
                      + ([{'file': os.path.basename(a.wide), 'sha256': hashlib.sha256(open(a.wide, 'rb').read()).hexdigest(), 'seedM': WIDE_M}] if a.wide else [])},
           'features': feats}
    open(a.out, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    json.dump(report, open(a.report, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    tally = defaultdict(int)
    for r in report:
        tally[r['status']] += 1
    print(json.dumps(dict(tally)), f'{len(feats)} outlines', file=sys.stderr)


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
    n = sub.add_parser('new', help="(0.5.0) outlines for the commercial screen's new codes, drawn from seeds at their reference points")
    n.add_argument('exports', nargs='+')
    n.add_argument('--seeds', required=True, help='the [code, lat, lon] list the page drew from, in the registry\'s order')
    n.add_argument('--wide', default='', help='the drawing seeded with WIDE_M round the same points (used where the point drawing reached no building)')
    n.add_argument('--seeds-sha', default='', help='the SHA-256 the page reported for that list')
    n.add_argument('--info', default='', help='names, provinces and districts of the codes (a private read of the registry, never committed)')
    n.add_argument('--rows', default='data/neighborhoods.json')
    n.add_argument('--bundle', required=True)
    n.add_argument('--lodging', required=True)
    n.add_argument('--amendments', default='amendments/outline-amendments.geojson')
    n.add_argument('--hold', default='', help='comma-separated codes drawn but held on the owner\'s word')
    n.add_argument('--on', required=True)
    n.add_argument('--out', required=True)
    n.add_argument('--report', required=True)
    a = ap.parse_args()
    if a.cmd == 'amend' and not a.display and not (a.bundle and a.lodging):
        sys.exit('amend needs --bundle and --lodging (or --display for a preview)')
    {'decode': cmd_decode, 'review': cmd_review, 'amend': cmd_amend, 'new': cmd_new}[a.cmd](a)


if __name__ == '__main__':
    main()
