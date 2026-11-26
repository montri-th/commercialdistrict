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
  new     (0.5.0) outlines for the commercial screen's codes, drawn from seeds round their reference points (§2d).
  revise  (0.5.2) the owner's answers of 2026-11-26 10:02 on those outlines (amendments/outline-new-choices-2026-11-26.json):
          the 17 over 1 km as he chose them, the codes without buildings drawn again with CityMETER Building V4, and the
          codes he keeps with seeds and limits of their own; writes the next file, 0.5.0's stays as it was.

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
CM_WORDS = ('CityMETER Building V4 (Landometer production tiles, layer building-detail) inside the units of data/building-units, '
            'where it holds at least 1.15 times the OpenStreetMap buildings; owner 2026-11-01 for the map, 2026-11-26 10:02 for the outlines')
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



JOIN_CELL_M = 5  # (0.5.2) cells of the walk that joins a seeded code's point to its trimmed outline


def trim_arms_seed(drawn, lon, lat):
    """(0.5.2) The owner's "ตัดแขนแคบ" for an outline drawn from a seed, which has no registry outline to keep: the drawing
    opened by TRIM_M as trim_arms() opens it (arms narrower than 150 m off), the opened part nearest to the reference point
    along the drawing, and the strip of the drawing that joins the point to that part — the 5 m cells whose walk from the
    point to the part, inside the drawing, is at most 2 × TRIM_M longer than the shortest — so the outline holds its point.
    Returns (geometry, the opened parts left out)."""
    import heapq
    import numpy as np
    import shapely
    from shapely.geometry import Point, Polygon, MultiPolygon, box
    from shapely.ops import transform, unary_union
    from shapely.validation import make_valid
    fwd, back = utm(drawn)
    m, s = transform(fwd, drawn), transform(fwd, Point(lon, lat))
    opened = m.buffer(-TRIM_M, join_style=1).buffer(TRIM_M, join_style=1).intersection(m)
    parts = [g for g in getattr(opened, 'geoms', [opened]) if isinstance(g, Polygon) and g.area > 0]
    if not parts:
        return drawn, 0
    for g in parts:
        if g.buffer(1).intersects(s):
            return transform(back, g), len(parts) - 1
    c = JOIN_CELL_M
    x0, y0, x1, y1 = m.bounds
    nx, ny = int((x1 - x0) // c) + 1, int((y1 - y0) // c) + 1
    xs, ys = np.meshgrid(x0 + (np.arange(nx) + 0.5) * c, y0 + (np.arange(ny) + 0.5) * c)
    inside = shapely.contains_xy(m, xs, ys)
    label = np.full(inside.shape, -1)
    for i, g in enumerate(parts):
        label[shapely.contains_xy(g, xs, ys) & inside] = i
    steps = [(dr, dq, c * (2 ** 0.5 if dr and dq else 1)) for dr in (-1, 0, 1) for dq in (-1, 0, 1) if dr or dq]

    def walk(sources):
        d = np.full(inside.shape, np.inf)
        h = [(0.0, r, q) for r, q in sources]
        for _, r, q in h:
            d[r, q] = 0.0
        heapq.heapify(h)
        while h:
            dd, r, q = heapq.heappop(h)
            if dd > d[r, q]:
                continue
            for dr, dq, w in steps:
                rr, qq = r + dr, q + dq
                if 0 <= rr < ny and 0 <= qq < nx and inside[rr, qq] and dd + w < d[rr, qq]:
                    d[rr, qq] = dd + w
                    heapq.heappush(h, (dd + w, rr, qq))
        return d
    dist2 = np.where(inside, (xs - s.x) ** 2 + (ys - s.y) ** 2, np.inf)
    r0, q0 = np.unravel_index(np.argmin(dist2), dist2.shape)
    ds = walk([(r0, q0)])
    near = [float(ds[label == i].min()) if (label == i).any() else np.inf for i in range(len(parts))]
    k = int(np.argmin(near))
    if not np.isfinite(near[k]):
        return drawn, len(parts)
    dt = walk(list(zip(*np.nonzero(label == k))))
    join = inside & (ds + dt <= near[k] + 2 * TRIM_M) & (label != k)
    cells = [box(x0 + q * c, y0 + r * c, x0 + (q + 1) * c, y0 + (r + 1) * c) for r, q in zip(*np.nonzero(join))]
    strip = unary_union(cells).buffer(c / 2, join_style=2).intersection(m) if cells else Point(s).buffer(0)
    out = make_valid(unary_union([parts[k], strip]))
    polys = [g for g in getattr(out, 'geoms', [out]) if isinstance(g, Polygon) and g.area > 0]
    body = [g for g in polys if g.intersects(parts[k])]
    out = body[0] if len(body) == 1 else MultiPolygon(body)
    return transform(back, out), len(parts) - 1



def cmd_revise(a):
    """(0.5.2) The owner's answers of 2026-11-26 10:02 (amendments/outline-new-choices-2026-11-26.json) on the outlines of
    0.5.0 (--prior): the 17 that reached over 1 km as he chose them (use; trim the narrow arms, shown to him before the
    web; no outline), the codes the basemap left without buildings, or too few, drawn again with CityMETER Building V4
    inside its units (the drawing's option cm), and the codes he keeps with seeds and limits of their own (ย่านตลาดไท).
    Every outline 0.5.0 applied keeps its geometry; the new outlines leave out every outline the build draws, in the
    same order and by the same tests as `new`."""
    import os
    from shapely.geometry import shape, mapping, MultiPolygon, Polygon, Point
    from shapely.ops import unary_union, transform
    from shapely.validation import make_valid
    ch = json.load(open(a.choices, encoding='utf-8'))
    prior_sha = hashlib.sha256(open(a.prior, 'rb').read()).hexdigest()
    if prior_sha != ch['reviewed']['sha256']:
        sys.exit(f"the owner's answers are on {ch['reviewed']['file']} ({ch['reviewed']['sha256'][:8]}…), not {a.prior} ({prior_sha[:8]}…)")
    prior = json.load(open(a.prior, encoding='utf-8'))
    ticks = ch['ticks']
    use, trim, reject = set(ticks['use']), set(ticks['trimArms']), set(ticks['reject'])
    waiting = {f['properties']['canonical_id'] for f in prior['features'] if f['properties']['status'] == 'review'}
    if use | trim | reject != waiting or len(use) + len(trim) + len(reject) != len(waiting):
        sys.exit(f'the answers name {len(use | trim | reject)} codes, the prior file waits on {len(waiting)}: each once')
    places, meta = load_places([a.point])
    wide, wide_meta = load_places([a.wide]) if a.wide else ({}, {})
    special, special_meta = load_places([a.special]) if a.special else ({}, {})
    seeds = json.load(open(a.seeds, encoding='utf-8'))
    seeds_sha = hashlib.sha256(json.dumps(seeds, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    if not (len(a.seeds_sha) >= 16 and seeds_sha.startswith(a.seeds_sha)):
        sys.exit(f'the seeds are not the list the page drew from: {seeds_sha} ≠ {a.seeds_sha}')
    info = {s['code']: s for s in json.load(open(a.info, encoding='utf-8'))}
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
    for f in json.load(open(a.amendments, encoding='utf-8'))['features']:
        cur[f['properties']['canonical_id']] = poly(f['geometry'])
    missing = [k for k in rows if rows[k]['kind'] != 'screen' and k not in cur]  # 0.5.0's own outlines come next
    if missing:
        sys.exit(f'{len(missing)} outlines of the demo are not in the inputs, e.g. {missing[:3]}')
    owner = ch['owner']
    feats, report = [], []
    # 1. 0.5.0's outlines: applied ones as they were; the 17 as he chose
    for f in prior['features']:
        p_ = dict(f['properties'])
        code = p_['canonical_id']
        if p_['status'] == 'apply':
            cur[code] = poly(f['geometry'])
            feats.append(f)
            report.append({'id': code, 'status': 'apply', 'from': '0.5.0'})
            continue
        if code in reject:
            report.append({'id': code, 'status': 'rejected', 'from': '0.5.0', 'reachM': p_['reach_m']})
            continue
        geom = shape(f['geometry'])
        p_['decided'] = {'on': owner['on'], 'words_th': owner['ticks_th'], 'choice': 'use' if code in use else 'trimArms'}
        if code in use:
            p_['status'] = 'apply'
        else:
            lon, lat = p_['reference_point']
            geom, left = trim_arms_seed(geom, lon, lat)
            fwd = utm(geom)[0]
            p_['reach_m'] = round(transform(fwd, geom).hausdorff_distance(transform(fwd, seed_polygon(lat, lon))))
            p_['area_m2'] = round(utm_area(geom), 2)
            p_['rule'] = {**p_['rule'], 'armsTrimmed': True}
            p_['method'] += (f"; scripts/rule-outlines.py revise: narrow arms taken off (opening of {TRIM_M} m, the part nearest the "
                             f"point and the strip joining the point to it, {JOIN_CELL_M} m cells within {2 * TRIM_M} m of the shortest walk)")
            # shown to him before the web (the tick sheet's word): it waits for his look, as an outline over 1 km does
            if p_['reach_m'] <= REVIEW_M:
                sys.exit(f'{code}: trimmed within 1 km; the page has no words yet for an outline that waits for his look')
            p_['status'] = 'review'
            assert Point(lon, lat).within(geom), code
        cur[code] = poly(mapping(geom))
        feats.append({'type': 'Feature', 'geometry': mapping(geom), 'properties': p_})
        report.append({'id': code, 'status': p_['status'], 'from': '0.5.0', 'choice': p_['decided']['choice'], 'reachM': p_['reach_m']})
    # 2. the codes drawn again with CityMETER Building V4 (as `new`, the wide drawing for a code the point one left unchanged)
    order = [s_[0] for s_ in seeds]
    if set(places) != set(order) or not set(wide) <= set(order):
        sys.exit(f'the V4 drawings hold {len(places)} and {len(wide)} places, the seeds {len(order)}')
    for pl in list(places.values()) + list(wide.values()):
        if (pl.get('opts') or {}).get('cm') != 'CityMETER Building V4':
            sys.exit(f"{pl['id']}: drawn without CityMETER Building V4")
    wide_area = utm_area(seed_polygon(13.75, 100.5, WIDE_M))
    use_wide = {pid for pid in order if classify(places[pid]) == 'unchanged' and pid in wide
                and classify(wide[pid]) in ('clean', 'split') and wide[pid]['check']['areaM2'] >= WIDE_MIN * wide_area}
    assigned = {}
    for source, pids in (('point', order), ('wide', [p_ for p_ in order if p_ in use_wide])):
        for pid in pids:
            pl = places[pid] if source == 'point' else wide[pid]
            if classify(pl) not in ('clean', 'split') or pid in assigned:
                continue
            for k, rings in ({pid: pl['rings']} if classify(pl) == 'clean' else pl['shares']).items():
                if k in order and (source == 'point' or k in use_wide or classify(places[k]) == 'unchanged'):
                    assigned.setdefault(k, (pl['grid'], rings, pid, source))
    tilesBuild = meta['tilesBuild']
    for code, lat, lon in seeds:
        pl, seed = places[code], seed_polygon(lat, lon)
        c = pl['check']
        rec = {'id': code, 'class': classify(pl), 'reachM': c['reachM'], 'fill': c['fill'], 'osmBuildings': c['osmBuildings'],
               'cmBuildings': c.get('cmBuildings'), 'sharers': c['sharers'], 'from': 'V4'}
        if code in wide:
            cw = wide[code]['check']
            rec['wide'] = {'class': classify(wide[code]), 'areaM2': round(cw['areaM2']), 'osmBuildings': cw['osmBuildings'],
                           'cmBuildings': cw.get('cmBuildings'), 'used': code in use_wide}
        if code not in assigned:
            st = {'city': 'city', 'runs-on': 'runs-on'}.get(rec['class'])
            if st is None and rec.get('wide', {}).get('class') in ('city', 'runs-on'):
                st = rec['wide']['class']
            if st is None and rec.get('wide', {}).get('class') in ('clean', 'split'):
                st = 'few-buildings'
            rec['status'] = st or 'no-buildings'
            report.append(rec)
            continue
        grid, rings, by, source = assigned[code]
        if source == 'wide':
            seed = seed_polygon(lat, lon, WIDE_M)
        drawn = smooth(decode_rings(rings, grid))
        near = [cur[k] for k in cur if k != code and cur[k].intersects(drawn.buffer(0.001))]
        new = make_valid(drawn.difference(unary_union(near)) if near else drawn)
        parts = [p for p in getattr(new, 'geoms', [new]) if isinstance(p, Polygon) and (p.intersects(seed) or utm_area(p) >= CRUMB_M2)]
        if not parts:
            rec['status'] = 'covered'
            report.append(rec)
            continue
        new = parts[0] if len(parts) == 1 else MultiPolygon(parts)
        if not new.contains(Point(lon, lat)):  # (0.5.2) the rounding can pass a few metres off the point: the seed joins
            new = make_valid(new.union(seed.difference(unary_union(near)) if near else seed))
            new = new if isinstance(new, (Polygon, MultiPolygon)) else unary_union([g for g in new.geoms if isinstance(g, (Polygon, MultiPolygon))])
            rec['seedJoined'] = True
        assert new.contains(Point(lon, lat)), f'{code}: its outline does not hold its point'
        fwd = utm(new)[0]
        reach = round(transform(fwd, new).hausdorff_distance(transform(fwd, seed_polygon(lat, lon))))
        status = 'apply' if reach <= REVIEW_M else 'review'
        rec.update({'status': status, 'drawnWith': by, 'seedM': WIDE_M if source == 'wide' else SEED_M, 'areaM2': round(utm_area(new), 2),
                    'reachSeedM': reach, 'parts': len(parts)})
        report.append(rec)
        for g in near:
            both = g.intersection(new)
            assert both.is_empty or utm_area(both) < 0.1, f'{code} overlaps an outline'
        cur[code] = new
        x = info[code]
        src = wide if source == 'wide' else places
        opts = src[by].get('opts') or {}
        words = rule_words(opts.get('lightLanduse') or [])
        drawn_on = (wide_meta if source == 'wide' else meta)['drawnOn']
        feats.append({'type': 'Feature', 'geometry': mapping(new), 'properties': {
            'canonical_id': code, 'name_th': x['name'], 'province_th': x['province'], 'district_th': x['district'],
            'reference_point': [lon, lat], 'drawn_on': drawn_on, 'outlined_on': a.on, 'by': 'owner', 'owner_words_th': OWNER_TH,
            'decided': {'on': owner['on'], 'words_th': owner['buildings_th'], 'choice': 'buildingsV4'},
            'status': status, 'area_m2': rec['areaM2'], 'reach_m': reach, 'metric_crs': 'EPSG:32647' if new.centroid.x < 102 else 'EPSG:32648',
            'seed': {'shape': '24-gon', 'radius_m': WIDE_M if source == 'wide' else SEED_M, 'centre': 'the registry\'s reference point (05_REVIEW_QUEUE, column จุดอ้างอิงย่าน)'},
            'rules': ['BUILDINGS', 'DARK-GROUND'] + (['HALFWAY'] if by != code or c['sharers'] else []),
            'buildings': {'cm': src[by]['check'].get('cmBuildings'), 'osm': src[by]['check']['osmBuildings']},
            'osm': f"OpenFreeMap planet {tilesBuild} (OpenMapTiles schema, zoom 14) as the demo's basemap draws it, © OpenStreetMap contributors, ODbL 1.0",
            'cm': CM_WORDS,
            'method': f"scripts/draw-outline-rule.browser.js in the demo on {drawn_on} (drawn with {by}, option cm), seeded at the reference point ({WIDE_M if source == 'wide' else SEED_M} m); "
                      f"scripts/rule-outlines.py revise: steps rounded (closing {SMOOTH_M} m within {REACH_M} m), simplified {SIMPLIFY_M} m, every other outline left out",
            'rule': {'name': RULE['name'], 'th': words[0], 'en': words[1], 'drawnWith': by, 'shared': bool(by != code or c['sharers']),
                     'buildings': 'CityMETER Building V4 inside its units (data/building-units), OpenStreetMap elsewhere',
                     **({'lightLanduse': opts['lightLanduse']} if opts.get('lightLanduse') else {})},
            'status_th': 'ขอบวาดตามหลักที่เจ้าของกำหนดจากจุดอ้างอิงของผลคัดย่านการค้า ด้วยอาคาร CityMETER (Building V4) ใน อปท. ที่เดโมใช้อาคารชุดนี้ รอทะเบียนรับในรุ่นถัดไป',
            'status_en': "drawn by the owner's rule from the commercial screen's reference point, with CityMETER Building V4 where the demo draws it, awaiting the registry's next release"}})
    # 3. the codes he keeps with seeds and limits of their own
    for code, k in (ch.get('keep') or {}).items():
        pl = special.get(code)
        if pl is None:
            sys.exit(f'{code}: the owner keeps it, and no drawing of it was given (--special)')
        if (pl.get('opts') or {}).get('cm') != 'CityMETER Building V4' or sorted(pl['opts'].get('limits') or []) != sorted(L['label'] for L in k['limits']):
            sys.exit(f'{code}: the drawing was not made with CityMETER Building V4 and the limits the answers name')
        cls = classify(pl)
        pts = [(q['point'][0], q['point'][1]) for q in k['seeds']]
        seed8 = unary_union([seed_polygon(la, lo) for lo, la in pts])
        rec = {'id': code, 'class': cls, 'reachM': pl['check']['reachM'], 'fill': pl['check']['fill'], 'from': 'keep',
               'osmBuildings': pl['check']['osmBuildings'], 'cmBuildings': pl['check'].get('cmBuildings'), 'sharers': pl['check']['sharers']}
        if cls not in ('clean', 'split'):
            rec['status'] = cls if cls in ('city', 'runs-on') else 'no-buildings'
            report.append(rec)
            continue
        rings = pl['rings'] if cls == 'clean' else pl['shares'][code]
        drawn = smooth(decode_rings(rings, pl['grid']))
        near = [cur[q] for q in cur if q != code and cur[q].intersects(drawn.buffer(0.001))]
        new = make_valid(drawn.difference(unary_union(near)) if near else drawn)
        parts = [p for p in getattr(new, 'geoms', [new]) if isinstance(p, Polygon) and (p.intersects(seed8) or utm_area(p) >= CRUMB_M2)]
        new = parts[0] if len(parts) == 1 else MultiPolygon(parts)
        fwd = utm(new)[0]
        reach = round(transform(fwd, new).hausdorff_distance(transform(fwd, seed8)))
        status = 'apply' if reach <= REVIEW_M else 'review'
        for g in near:
            both = g.intersection(new)
            assert both.is_empty or utm_area(both) < 0.1, f'{code} overlaps an outline'
        assert all(Point(lo, la).within(new) for lo, la in pts), f'{code}: a seed point falls outside its outline'
        cur[code] = new
        rec.update({'status': status, 'areaM2': round(utm_area(new), 2), 'reachSeedM': reach, 'parts': len(parts)})
        report.append(rec)
        x = info[code]
        feats.append({'type': 'Feature', 'geometry': mapping(new), 'properties': {
            'canonical_id': code, 'name_th': x['name'], 'province_th': x['province'], 'district_th': x['district'],
            'reference_point': list(pts[0]), 'reference_point_th': k['reference_th'],
            'drawn_on': special_meta['drawnOn'], 'outlined_on': a.on, 'by': 'owner', 'owner_words_th': OWNER_TH,
            'decided': {'on': owner['on'], 'words_th': owner['keep_th'], 'choice': 'keep'},
            'status': status, 'area_m2': rec['areaM2'], 'reach_m': reach, 'metric_crs': 'EPSG:32647' if new.centroid.x < 102 else 'EPSG:32648',
            'seed': {'shape': '24-gon', 'radius_m': k['seedM'], 'points': k['seeds']},
            'rules': ['BUILDINGS', 'DARK-GROUND'] + (['HALFWAY'] if pl['check']['sharers'] else []) + ['OWNER-LIMITS'],
            'limits': k['limits'],
            'buildings': {'cm': pl['check'].get('cmBuildings'), 'osm': pl['check']['osmBuildings']},
            'osm': f"OpenFreeMap planet {special_meta['tilesBuild']} (OpenMapTiles schema, zoom 14) as the demo's basemap draws it, © OpenStreetMap contributors, ODbL 1.0",
            'cm': CM_WORDS,
            'method': f"scripts/draw-outline-rule.browser.js in the demo on {special_meta['drawnOn']} (option cm, the limits named), seeded at "
                      f"{len(pts)} points ({k['seedM']} m); scripts/rule-outlines.py revise: steps rounded (closing {SMOOTH_M} m within {REACH_M} m), "
                      f"simplified {SIMPLIFY_M} m, every other outline left out; reach measured from 8 m round each point",
            'rule': {'name': RULE['name'], 'th': RULE['th'], 'en': RULE['en'], 'drawnWith': code, 'shared': bool(pl['check']['sharers']),
                     'buildings': 'CityMETER Building V4 inside its units (data/building-units), OpenStreetMap elsewhere', 'limits': pl['opts']['limits']},
            'status_th': 'ขอบวาดตามคำของเจ้าของ (26 พ.ย. 2569) และหลักที่เจ้าของกำหนด ด้วยอาคาร CityMETER (Building V4) รอทะเบียนรับในรุ่นถัดไป',
            'status_en': "drawn on the owner's word of 2026-11-26 and by his rule, with CityMETER Building V4, awaiting the registry's next release"}})
    file_ = lambda p_: {'file': os.path.basename(p_), 'sha256': hashlib.sha256(open(p_, 'rb').read()).hexdigest()}
    out = {'type': 'FeatureCollection', 'drawing': {
        'prior': {**file_(a.prior), 'drawing': prior.get('drawing')},
        'answers': file_(a.choices),
        'buildingsV4': {'drawnOn': meta['drawnOn'], 'tilesBuild': tilesBuild, 'seedsSha256': seeds_sha, 'seedM': SEED_M,
                        'wideSeedM': WIDE_M if a.wide else None, 'wideMin': WIDE_MIN if a.wide else None,
                        'exports': [{**file_(a.point), 'seedM': SEED_M}] + ([{**file_(a.wide), 'seedM': WIDE_M}] if a.wide else [])},
        **({'keep': {'drawnOn': special_meta['drawnOn'], 'exports': [file_(a.special)]}} if a.special else {})},
        'features': feats}
    open(a.out, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    json.dump(report, open(a.report, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    tally = defaultdict(int)
    for r in report:
        tally[(r.get('from'), r['status'])] += 1
    print(json.dumps({f'{k[0]}:{k[1]}': v for k, v in sorted(tally.items())}), f'{len(feats)} outlines', file=sys.stderr)


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
    v = sub.add_parser('revise', help="(0.5.2) the owner's answers of 2026-11-26 10:02 on the commercial screen's outlines")
    v.add_argument('--prior', required=True, help="0.5.0's file: amendments/outline-new-2026-11-26.geojson")
    v.add_argument('--choices', required=True, help="his answers: amendments/outline-new-choices-2026-11-26.json")
    v.add_argument('--point', required=True, help='the drawing with CityMETER Building V4 from 8 m seeds')
    v.add_argument('--wide', default='', help='the drawing with CityMETER Building V4 from 40 m seeds (codes the point one left unchanged)')
    v.add_argument('--special', default='', help='the drawing of the codes he keeps with seeds and limits of their own')
    v.add_argument('--seeds', required=True)
    v.add_argument('--seeds-sha', required=True)
    v.add_argument('--info', required=True)
    v.add_argument('--rows', default='data/neighborhoods.json')
    v.add_argument('--bundle', required=True)
    v.add_argument('--lodging', required=True)
    v.add_argument('--amendments', default='amendments/outline-amendments.geojson')
    v.add_argument('--on', required=True)
    v.add_argument('--out', required=True)
    v.add_argument('--report', required=True)
    a = ap.parse_args()
    if a.cmd == 'amend' and not a.display and not (a.bundle and a.lodging):
        sys.exit('amend needs --bundle and --lodging (or --display for a preview)')
    {'decode': cmd_decode, 'review': cmd_review, 'amend': cmd_amend, 'new': cmd_new, 'revise': cmd_revise}[a.cmd](a)


if __name__ == '__main__':
    main()
