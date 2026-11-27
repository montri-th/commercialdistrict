#!/usr/bin/env python3
"""CityMETER · Commercial District — people in and around each neighbourhood, and the round 250 m maps (release 0.7.0).

    python3 -I scripts/build-people.py --sources <folder of the 16 pinned demo files> --office <montri-th/office
        data/offices.json @8e8d8be> --shoppingcenter <clone of montri-th/shoppingcenter> [--repo .] [--out data]
        [--built-on YYYY-MM-DD] [--residents <people-residents.json from scripts/residents/>]
        [--context <context.json from scripts/build-context-map.py>]

Owner 2026-11-26 14:03 (VERBATIM in handoff/around/decisions.json): “ทำยังไงถึงจะเห็นปริมาณคน residents, visitors,
commuters ได้ อยากได้วิธีง่ายๆตรงไปตรงมาไม่ซับซ้อนมาก”, then 14:31 “A ตัวเลขทางการแบ่งลงย่าน (แนะนำ)” (D-12) and 14:40
“จากขอบย่าน (แนะนำ)” for 1 · 3 · 5 km (D-13); “พวก heatmap กลมๆก็ไม่มี ทำยังไงจะมีได้และ relevant กับ case ของ commercial
district นี้ด้วย” (2.4) for the maps.

Read only, except the files it writes. Inputs:
  repo            data/neighborhoods.json (rows, the 16 datasets and the inside measures), data/boundaries.geojson (the
                  outline the map draws), data/records/<id>.json (which records the data build counted inside),
                  data/provinces.geojson (a lodging record's province) and scripts/people/mots-t17.1-2567.tsv (the
                  Ministry of Tourism and Sports' guests by province, checked against its own regional totals).
  sources         the 16 demo files data/neighborhoods.json pins, saved flat as <dataset id>.json, every SHA-256 checked;
                  read with the demo's own reader (scripts/build-data.py#extract) like scripts/build-around.py.
  office          montri-th/office data/offices.json at the commit «รอบศูนย์นี้» used for its office workers (checked by
                  SHA-256): the leasable or source area and the building's own occupancy, by Office ID.
  shoppingcenter  a clone of montri-th/shoppingcenter: scripts/build-visitors-map.py is imported for the office model
                  (OFFICE_MODEL, office_inputs, rounded), so both pages model office workers with the same code.

Outputs:
  data/people/<id>.json per neighbourhood (data/people/meta.json beside them), per scale (in = counted inside by the data build; 1000 · 3000 · 5000 = the service
                        area so far from the edge, inside included): the people the sources record (students, university
                        students, registered factory workers, recorded government staff), modelled office workers [low,
                        high], the at-least total of people who come to work and study (D-12 amends INV-01 for this group
                        only), recorded rooms and modelled guests a year; levels among the frozen reference set.
                        and under `map` the 250 m cells within 5 km of the outline: places visitors use and places of work and study per
                        cell, and the outline, the walk edges and the service-area lines to draw over them.
                        With --context (0.7.1), `map.ctx`: the sea, water areas, rivers, major roads, rail, stations
                        and a few names from OpenStreetMap to find the way by (scripts/build-context-map.py), drawn
                        on the map's own frame; never a count.

Rules (DATA_METHOD.md §15):
  * Distances: straight line from the outline the map draws, in an azimuthal equidistant projection centred on the
    neighbourhood's reference point (as scripts/build-around.py), until the Shopping Center's method along real paths is
    in hand (D-13, D-14). The page says so.
  * A part whose dataset has no located record in the neighbourhood's province is unknown (null), never 0.
  * University students count in a scale only when every site of the university is located and within it.
  * Guests a year: each lodging record's recorded rooms × its province's guests ÷ the province's recorded rooms (records
    with a room figure). A model, never footfall or customers.
  * Levels: the mid-rank percentile among the reference set (scripts/build-around.py REFERENCE); a figure half or more of
    which comes from datasets located under 90 % takes no level (the rule of «รอบศูนย์นี้» §30), and is starred.
"""
import argparse, hashlib, importlib.util, json, math, os, sys, warnings
from collections import defaultdict
from datetime import date

import numpy as np
import pyproj
import shapely
from shapely.geometry import shape

warnings.simplefilter('ignore')

SCHEMA = 'citymeter-commercialdistrict-people/1'
MAPS_SCHEMA = 'citymeter-commercialdistrict-maps/1'
CONTEXT_SCHEMA = 'citymeter-commercialdistrict-context/1'
RELEASE = '0.7.4'
SCALES = (400, 800, 1000, 3000, 5000)   # 400 · 800: the walkable edges, inside included, for the axis rows; 1 · 3 · 5 km: the service area (D-10)
CELL_M = 250
UNIT_M = 25                      # drawn lines in 25 m units (as «รอบศูนย์นี้»)
PAD_DEG = 0.06                   # candidate box round an outline (more than 5 km at every latitude of Thailand)
LOW_LOCATED = 0.9                # D-4 and «รอบศูนย์นี้» §30
OFFICE_PIN = {'commit': '8e8d8be866f4307d581eb4d72cd64579c2724564',
              'sha256': '4d225abba080832c99f5952decae6843cdaea1b1b490d7e39a7ac942728e6a77'}
SC_MODEL = 'scripts/build-visitors-map.py'
MOTS_FILE = 'scripts/people/mots-t17.1-2567.tsv'
MOTS_SOURCE = {
    'th': 'กระทรวงการท่องเที่ยวและกีฬา ตาราง 17.1 จำนวนผู้เข้าพักจำแนกตามจังหวัด พ.ศ. 2567 (ข้อมูล ณ 13 ม.ค. 2568) เผยแพร่โดยสำนักงานสถิติแห่งชาติ',
    'en': 'Ministry of Tourism and Sports, Table 17.1 guests by province, 2024 (as of 13 Jan 2025), published by the National Statistical Office',
    'url': 'https://www.nso.go.th/nsoweb/downloadFile/stat_main_nso/FgpN/file_th', 'year': 2024,
}
MOTS_ALIAS = {'ศรีสะเกษ': 'ศรีษะเกษ'}   # the table's spelling
# The groups of the round maps, as «รอบศูนย์นี้» (visitors: stays and retail · work and study, stations not counted).
MAP_GROUPS = {
    'visit': ('hotel', 'shoppingcenter', 'grocery', 'restaurant', 'pharmacy', 'fitness', 'luxurybrands', 'camera'),
    'work': ('office', 'governmentoffice', 'factory', 'industrialestate', 'university', 'hospital', 'school'),
}
# The parts of «คนมาทำงานและเรียน» that the sources record (dataset → its measure in scripts/build-data.py#extract).
RECORDED = (('stu', 'school'), ('fac', 'factory'), ('gov', 'governmentoffice'))


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def local(lon0, lat0):
    crs = f'+proj=aeqd +lat_0={lat0} +lon_0={lon0} +datum=WGS84 +units=m'
    return (pyproj.Transformer.from_crs('EPSG:4326', crs, always_xy=True),
            pyproj.Transformer.from_crs(crs, 'EPSG:4326', always_xy=True))


def project(geom, tr):
    return shapely.transform(geom, lambda a: np.column_stack(tr.transform(a[:, 0], a[:, 1])))


def polygonal(g):
    if g.is_valid:
        return g
    g = shapely.make_valid(g)
    if g.geom_type == 'GeometryCollection':
        g = shapely.union_all([x for x in g.geoms if x.geom_type in ('Polygon', 'MultiPolygon')])
    return g


def path_d(geom, simplify_m):
    """An SVG path of a polygon in 25 m units, y down, one decimal (about 2.5 m)."""
    g = geom.simplify(simplify_m, preserve_topology=True)
    polys = list(g.geoms) if g.geom_type == 'MultiPolygon' else [g]
    out = []
    for p in polys:
        for ring in [p.exterior, *p.interiors]:
            xy = np.asarray(ring.coords)[:-1]
            if len(xy) < 3:
                continue
            pts = [f'{x / UNIT_M:.1f} {-y / UNIT_M:.1f}' for x, y in xy]
            out.append('M' + 'L'.join(pts) + 'Z')
    return ''.join(out)


def mid_pct(x, values):
    below = sum(1 for v in values if v < x)
    equal = sum(1 for v in values if v == x)
    return 100 * (below + 0.5 * equal) / len(values)


def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')


def read_mots(path):
    """Province (Thai) → guests a year, checked: every region's provinces add up to its row, the regions and Bangkok to the kingdom."""
    rows = [l.split('\t') for l in open(path, encoding='utf-8').read().split('\n') if l and not l.startswith('#')][1:]
    guests, region, sums, totals = {}, None, defaultdict(lambda: [0, 0]), {}
    kingdom = bangkok = None
    for th, en, g, _occ, v in rows:
        g, v = int(g), int(v)
        if en == 'Whole Kingdom':
            kingdom = (g, v)
        elif en == 'Bangkok':
            bangkok = (g, v)
            guests[th] = g
        elif en.endswith('Region'):
            region = en
            totals[region] = (g, v)
        else:
            sums[region][0] += g
            sums[region][1] += v
            guests[th] = g
    for reg, (g, v) in totals.items():
        if sums[reg] != [g, v]:
            sys.exit(f'{path}: {reg} provinces add up to {sums[reg]}, its row says {[g, v]}')
    if (sum(t[0] for t in totals.values()) + bangkok[0], sum(t[1] for t in totals.values()) + bangkok[1]) != kingdom:
        sys.exit(f'{path}: the regions and Bangkok do not add up to the kingdom')
    if len(guests) != 77:
        sys.exit(f'{path}: {len(guests)} provinces, expected 77')
    return guests


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--repo', default='.')
    ap.add_argument('--sources', required=True)
    ap.add_argument('--office', required=True)
    ap.add_argument('--shoppingcenter', required=True)
    ap.add_argument('--residents', default=None)
    ap.add_argument('--context', default=None)
    ap.add_argument('--crossing', default=None, help='rivers cache of scripts/crossing/rivers.py (outside the repository): across a river, through the crossings (0.7.5)')
    ap.add_argument('--crossing-kinds', default='all', choices=('all', 'no-ferry'))
    ap.add_argument('--out', default=None)
    ap.add_argument('--built-on', default=date.today().isoformat())
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    out = os.path.abspath(a.out or os.path.join(repo, 'data'))

    bd = load_module('build_data', os.path.join(repo, 'scripts', 'build-data.py'))
    ba = load_module('build_around', os.path.join(repo, 'scripts', 'build-around.py'))
    sc_model_path = os.path.join(a.shoppingcenter, *SC_MODEL.split('/'))
    scm = load_module('sc_visitors_map', sc_model_path)

    nb = json.load(open(os.path.join(repo, 'data', 'neighborhoods.json'), encoding='utf-8'))
    rows, datasets = nb['rows'], nb['datasets']
    order = [r['id'] for r in rows]
    by_id = {r['id']: r for r in rows}
    di_of = {d['id']: k for k, d in enumerate(datasets)}
    ds_by = {d['id']: d for d in datasets}
    outl = {str(f['properties']['id']): shape(f['geometry'])
            for f in json.load(open(os.path.join(repo, 'data', 'boundaries.geojson'), encoding='utf-8'))['features']}
    if set(outl) != set(order):
        sys.exit('data/boundaries.geojson and data/neighborhoods.json do not hold the same neighbourhoods')
    ref_order = [r['id'] for r in rows if r.get('kind') != 'screen']
    if len(ref_order) != ba.REFERENCE['n'] or ba.sha256_text('\n'.join(ref_order)) != ba.REFERENCE['codesSha256']:
        sys.exit('the reference set changed: a release must name the set it replaces (D-8)')
    low = {d['id'] for d in datasets if d['records'] and d['located'] / d['records'] < LOW_LOCATED}

    # ---- inside membership, as scripts/build-around.py
    inside = {}
    for i in order:
        shard = json.load(open(os.path.join(repo, 'data', 'records', f'{i}.json'), encoding='utf-8'))
        inside[i] = {(rec[0], str(rec[4]), rec[1], rec[2]) for rec in shard['rows']}

    # ---- the 16 pinned files
    pts = {}
    for d in datasets:
        path = (os.path.join(a.sources, 'industrialestate_dir', 'estates.json') if d['id'] == 'industrialestate'
                else os.path.join(a.sources, d['id'] + '.json'))
        if sha256_file(path) != d['source']['sha256']:
            sys.exit(f"{d['id']}: {path} is not the file data/neighborhoods.json pins")
        scope, _sub, _measure, _dates, p = bd.extract(d['id'], path)
        if scope['records'] != d['records'] or len(p) != d['located']:
            sys.exit(f"{d['id']}: read {scope['records']} / {len(p)}, the data says {d['records']} / {d['located']}")
        di = di_of[d['id']]
        pts[d['id']] = {
            'lon': np.array([x[0] for x in p], dtype=float), 'lat': np.array([x[1] for x in p], dtype=float),
            'm': np.array([x[3] if isinstance(x[3], (int, float)) and x[3] > 0 else 0 for x in p], dtype=float),
            'has': np.array([isinstance(x[3], (int, float)) and x[3] > 0 for x in p]),
            'id': [str(x[4]) for x in p],
            'key': [(di, str(x[4]), round(x[0], 6), round(x[1], 6)) for x in p],
        }

    # ---- office model: the Shopping Center's own code and inputs (D-12 via «รอบศูนย์นี้» §26)
    if sha256_file(a.office) != OFFICE_PIN['sha256']:
        sys.exit(f'{a.office} is not montri-th/office data/offices.json @{OFFICE_PIN["commit"][:7]}')
    offices, office_source = scm.office_inputs(a.office, OFFICE_PIN['commit'])
    P = pts['office']
    P['area'] = np.array([offices.get(k, (None, None, None))[0] or 0.0 for k in P['id']])
    P['rate'] = np.array([(offices.get(k, (None, None, None))[2] or scm.OFFICE_MODEL['occupancy']['rate']) for k in P['id']])
    joined = sum(1 for k in P['id'] if k in offices)
    if joined < 0.95 * len(P['id']):
        sys.exit(f'only {joined} of {len(P["id"])} located office records join the Office file by Office ID')

    # ---- universities: students of a university count where every site of it is
    uni_file = json.load(open(os.path.join(a.sources, 'university.json'), encoding='utf-8'))
    sites, unis = uni_file['sites'], uni_file['universities']
    site_uni = {str(k): sites['uni'][n] for n, k in enumerate(sites['key'])}
    uni_sites = defaultdict(set)
    for k, u in site_uni.items():
        uni_sites[u].add(k)
    uni_students = {u: (x['students'] if x.get('latest') and isinstance(x.get('students'), int) and x['students'] > 0 else None)
                    for u, x in enumerate(unis)}
    located_sites = set(pts['university']['id'])

    # ---- lodging: guests a year by province ÷ the province's recorded rooms
    mots = read_mots(os.path.join(repo, MOTS_FILE))
    prov = json.load(open(os.path.join(repo, 'data', 'provinces.geojson'), encoding='utf-8'))['features']
    pgeom = [shape(f['geometry']) for f in prov]
    pname = [MOTS_ALIAS.get(f['properties']['name'], f['properties']['name']) for f in prov]
    missing = [n for n in pname if n not in mots]
    if missing:
        sys.exit(f'provinces without a row in the tourism table: {missing}')
    H = pts['hotel']
    hp = np.full(len(H['lon']), -1)
    tree = shapely.STRtree(pgeom)
    hpts = shapely.points(H['lon'], H['lat'])
    pi_, gi_ = tree.query(hpts, predicate='within')
    hp[pi_] = gi_
    # a coastal or island record just off the drawn province (data/provinces.geojson is simplified for the map): the
    # nearest province within about 5 km
    off = np.nonzero(hp < 0)[0]
    if len(off):
        near_in, near_tree = tree.query_nearest(hpts[off], max_distance=0.05)
        for a_, b_ in zip(near_in, near_tree):
            if hp[off[a_]] < 0:
                hp[off[a_]] = b_
    rooms_p = defaultdict(float)
    for k in range(len(hp)):
        if hp[k] >= 0 and H['has'][k]:
            rooms_p[hp[k]] += H['m'][k]
    H['gpr'] = np.array([mots[pname[hp[k]]] / rooms_p[hp[k]] if hp[k] >= 0 and rooms_p[hp[k]] > 0 and H['has'][k] else 0.0
                         for k in range(len(hp))])
    unplaced_lodging = int(np.sum(hp < 0))

    # ---- residents (0.7.1, scripts/residents/): optional here
    residents = json.load(open(a.residents, encoding='utf-8')) if a.residents else None
    # ---- what a reader finds the way by on the maps (0.7.1, scripts/build-context-map.py): optional here, drawn on the
    #      very frame of each map (its meta.frame is checked against the map's cell below)
    context = json.load(open(a.context, encoding='utf-8')) if a.context else None
    if context and context['meta'].get('schema') != CONTEXT_SCHEMA:
        sys.exit(f"{a.context}: schema {context['meta'].get('schema')}, not {CONTEXT_SCHEMA}")
    # ---- the banks of the rivers (0.7.5, V7-09, scripts/crossing/): across a river, a place counts through the crossings;
    #      the residents file must have been built with the very same cache and kinds
    rivers = crossing_meta = None
    if a.crossing:
        banks_mod = load_module('banks', os.path.join(repo, 'scripts', 'crossing', 'banks.py'))
        rivers, crossing_meta = banks_mod.load(a.crossing, a.crossing_kinds)
        rc = (residents or {}).get('meta', {}).get('crossing')
        if residents and (not rc or rc['cacheSha256'] != crossing_meta['cacheSha256'] or rc['kinds'] != crossing_meta['kinds']):
            sys.exit('the residents file was not built with this --crossing cache and kinds: build it again with them')
    elif residents and residents.get('meta', {}).get('crossing'):
        sys.exit('the residents file counts through the crossings: give --crossing with the same cache')

    people, maps, maps_written = {}, {}, 0
    straight_of = {}
    check = defaultdict(int)
    for i in order:
        r = by_id[i]
        fwd, _inv = local(*r['ref'])
        g = polygonal(project(outl[i], fwd))
        minx, miny, maxx, maxy = outl[i].bounds
        mine = inside[i]
        bank = banks_mod.Banks(rivers, lambda lo, la: fwd.transform(lo, la), g, outl[i].bounds) if rivers is not None else None
        if bank is not None and not bank.has_river:
            bank = None
        scales = {'in': {}, **{str(s): {} for s in SCALES}}
        dist_of = {}
        for d in datasets:
            Pd = pts[d['id']]
            m = (Pd['lon'] >= minx - PAD_DEG) & (Pd['lon'] <= maxx + PAD_DEG) & (Pd['lat'] >= miny - PAD_DEG) & (Pd['lat'] <= maxy + PAD_DEG)
            idx = np.nonzero(m)[0]
            if len(idx):
                x, y = fwd.transform(Pd['lon'][idx], Pd['lat'][idx])
                pp = shapely.points(x, y)
                dist = shapely.distance(g, pp)
                cin = np.array([Pd['key'][k] in mine for k in idx])
                dist = np.where(cin, 0.0, dist)
            else:
                x = y = dist = np.zeros(0)
                cin = np.zeros(0, dtype=bool)
            straight = dist
            if bank is not None and len(idx):
                # across a river: the distance through the crossings (never under the straight one); inside stays 0
                dist = np.where(cin, 0.0, bank.measure(np.asarray(x), np.asarray(y), straight)[0])
            dist_of[d['id']] = (idx, np.asarray(x), np.asarray(y), dist, cin, straight)

        def select(ds_id, scale, line=False):
            idx, _x, _y, dist, cin, straight = dist_of[ds_id]
            return idx[cin] if scale == 'in' else idx[(straight if line else dist) <= scale]

        def fill(scales, line=False):
            _sel = (lambda ds_id, scale: select(ds_id, scale, line))
            for sc in ['in', *SCALES]:
                key = 'in' if sc == 'in' else str(sc)
                o = scales[key]
                # a recorded part: the sum over the records that carry the figure; none within the scale is a measured 0;
                # records there without any figure leave the part unknown (None), never 0 — `<part>N` = [with a figure, all]
                for part, ds_id in RECORDED:
                    if ds_id not in r['c']:
                        o[part] = None
                        continue
                    sel = _sel(ds_id, sc)
                    known = int(np.sum(pts[ds_id]['has'][sel]))
                    o[part] = int(pts[ds_id]['m'][sel].sum()) if known or not len(sel) else None
                    if len(sel):
                        o[part + 'N'] = [known, int(len(sel))]
                # university students: every site of the university located and within the scale
                # (a university with a site within the scale that cannot be counted leaves the part unknown when none can)
                if 'university' in r['c']:
                    sel = set(pts['university']['id'][k] for k in _sel('university', sc))
                    near = {site_uni[k] for k in sel if k in site_uni}
                    counted = [u for u in near if uni_students.get(u) and uni_sites[u] <= located_sites and uni_sites[u] <= sel]
                    o['uni'] = sum(uni_students[u] for u in counted) if counted or not near else None
                    if near:
                        o['uniN'] = [len(counted), len(near)]
                else:
                    o['uni'] = None
                # office workers: area × occupancy ÷ 12–10 m² per person, rounded outward (the Shopping Center's code)
                if 'office' in r['c']:
                    sel = _sel('office', sc)
                    share = float(np.sum(pts['office']['area'][sel] * pts['office']['rate'][sel]))
                    with_area = int(np.sum(pts['office']['area'][sel] > 0))
                    lo_sqm, hi_sqm = scm.OFFICE_MODEL['sqmPerPerson'][1], scm.OFFICE_MODEL['sqmPerPerson'][0]
                    o['off'] = [scm.rounded(share / lo_sqm, False), scm.rounded(share / hi_sqm, True)] if with_area else None
                    o['offN'] = [with_area, int(len(sel))]
                else:
                    o['off'] = None
                parts = [o['stu'], o['uni'], o['fac'], o['gov'], o['off'][0] if o['off'] else None]
                o['com'] = None if all(v is None for v in parts) else int(sum(v or 0 for v in parts))
                # the share of the at-least figure that comes from datasets located under 90 %
                low_share = 0
                for v, ds_id in ((o['stu'], 'school'), (o['uni'], 'university'), (o['fac'], 'factory'), (o['gov'], 'governmentoffice'),
                                 (o['off'][0] if o['off'] else None, 'office')):
                    if v and ds_id in low:
                        low_share += v
                o['comLow'] = bool(o['com']) and low_share * 2 >= o['com']
                # rooms and guests a year
                # (lodging within the scale without any room figure leaves rooms and guests unknown, never 0)
                if 'hotel' in r['c']:
                    sel = _sel('hotel', sc)
                    known = int(np.sum(pts['hotel']['has'][sel]))
                    if known or not len(sel):
                        o['rooms'] = int(pts['hotel']['m'][sel].sum())
                        o['gst'] = int(round(float(np.sum(pts['hotel']['m'][sel] * pts['hotel']['gpr'][sel]))))
                    else:
                        o['rooms'] = o['gst'] = None
                    if len(sel):
                        o['roomsN'] = [known, int(len(sel))]
                else:
                    o['rooms'] = o['gst'] = None
                # located records per dataset within the scale (inside included), for the axis rows at a service distance
                o['n'] = {d['id']: int(len(_sel(d['id'], sc))) for d in datasets if d['id'] in r['c']}
                if residents and i in residents.get('rows', {}):
                    o['res'] = residents['rows'][i].get(key)
                    acr = residents.get('across', {}).get(i, {}).get(key)
                    if line and acr:
                        o['res'] = acr['straight']   # the straight figure of the same run, for the comparison
        fill(scales)
        # the same figures in a straight line where a river comes near (the panel's folded comparison, as «รอบศูนย์นี้»)
        if bank is not None:
            line_scales = {'in': {}, **{str(sc_): {} for sc_ in SCALES}}
            fill(line_scales, line=True)
            st = {}
            for key in map(str, SCALES):
                diff = {f: line_scales[key].get(f) for f in ('res', 'com', 'gst') if line_scales[key].get(f) != scales[key].get(f)}
                c0, c1 = line_scales[key].get('n', {}).get('shoppingcenter'), scales[key].get('n', {}).get('shoppingcenter')
                if c0 != c1:
                    diff['ctr'] = c0
                if diff:
                    st[key] = diff
            if st:
                straight_of[i] = st
        # the inside figures equal the data build's measures (rows[].m)
        for part, ds_id in RECORDED + (('rooms', 'hotel'),):
            # rows[].m holds [sum, records with a figure] only when some record inside has one
            if ds_id not in r['c']:
                want = None
            elif ds_id in r.get('m', {}):
                want = r['m'][ds_id][0]
            else:
                want = 0 if r['c'][ds_id] == 0 else None
            if scales['in'][part] != want:
                sys.exit(f'{i} {ds_id}: inside {scales["in"][part]}, rows[].m says {want}')
            check[ds_id] += 1
        people[i] = scales

        # ---- the round maps: 250 m cells within 5 km of the outline
        s5 = g.buffer(5000, quad_segs=16)
        bx0, by0, bx1, by1 = s5.bounds
        ix0, ix1 = math.floor(bx0 / CELL_M), math.floor(bx1 / CELL_M)
        iy0, iy1 = math.floor(by0 / CELL_M), math.floor(by1 / CELL_M)
        W, Hh = ix1 - ix0 + 1, iy1 - iy0 + 1
        grids = {}
        for grp, members in MAP_GROUPS.items():
            cells = defaultdict(int)
            for ds_id in members:
                idx, x, y, dist, _cin, straight = dist_of[ds_id]
                if not len(idx):
                    continue
                keep = straight <= 5000   # the map draws every place within 5 km in a straight line (0.7.5)
                cx = np.floor(x[keep] / CELL_M).astype(int)
                cy = np.floor(y[keep] / CELL_M).astype(int)
                for a_, b_ in zip(cx, cy):
                    cells[int((iy1 - b_) * W + (a_ - ix0))] += 1
            ks = sorted(cells)
            if ks:
                cx_ = (np.array([k % W for k in ks]) + ix0 + 0.5) * CELL_M
                cy_ = (iy1 - np.array([k // W for k in ks]) + 0.5) * CELL_M
                dc = shapely.distance(g, shapely.points(cx_, cy_))
                far = np.zeros(len(ks), dtype=bool)
                if bank is not None:
                    # a cell across a river takes its centre's distance through the crossings; band 4: across and beyond
                    # 5 km that way (a cell at the rim whose centre is just past 5 km in a straight line stays band 3)
                    dr, acr, _vl = bank.measure(cx_, cy_, dc)
                    far = acr & (dr > 5000)
                    dc = np.where(acr, dr, dc)
                band = np.where(far, 4, np.where(dc <= 0, 0, np.where(dc <= 1000, 1, np.where(dc <= 3000, 2, 3))))
            else:
                band = []
            grids[grp] = [[int(k), int(cells[k]), int(b)] for k, b in zip(ks, band)]
        xs = (np.arange(W) + ix0 + 0.5) * CELL_M
        ys = (iy1 - np.arange(Hh) + 0.5) * CELL_M
        gx, gy = np.meshgrid(xs, ys)
        inmask = shapely.contains_xy(s5, gx.ravel(), gy.ravel())
        mask_runs, k, n = [], 0, W * Hh
        while k < n:  # run lengths of the cells inside 5 km, starting with an outside run
            v = inmask[k]
            e = k
            while e < n and inmask[e] == v:
                e += 1
            mask_runs.append(int(e - k))
            k = e
        if inmask[0]:
            mask_runs.insert(0, 0)
        lines = {'o': path_d(g, 1.0), 's5': path_d(s5, 20.0)}
        for k_ in (400, 800):
            lines[f'w{k_}'] = path_d(g.buffer(k_, quad_segs=12), 8.0)
        lab = {}
        for k_ in (1000, 3000):
            b_ = g.buffer(k_, quad_segs=16)
            lines[f's{k_ // 1000}'] = path_d(b_, 12.0)
            xy = np.asarray(b_.exterior.coords if b_.geom_type == 'Polygon' else max(b_.geoms, key=lambda q: q.area).exterior.coords)
            top = xy[np.argmax(xy[:, 1])]
            lab[f's{k_ // 1000}'] = [round(top[0] / UNIT_M, 1), round(-top[1] / UNIT_M, 1)]
        xy = np.asarray(s5.exterior.coords if s5.geom_type == 'Polygon' else max(s5.geoms, key=lambda q: q.area).exterior.coords)
        top = xy[np.argmax(xy[:, 1])]
        lab['s5'] = [round(top[0] / UNIT_M, 1), round(-top[1] / UNIT_M, 1)]
        lines['lab'] = lab
        maps[i] = {'cell': {'m': CELL_M, 'x0': int(ix0), 'y1': int(iy1), 'w': int(W), 'h': int(Hh)}, 'unit': UNIT_M,
                   'mask': mask_runs, 'visit': grids['visit'], 'work': grids['work'], 'lines': lines}
        # ---- the river (0.7.5): the cells of the 5 km across a river with their centre's distance through the crossings
        #      (tens of metres, -1: no crossing in the window reaches that bank), the crossings reached within 5 km, the
        #      rivers, and from the residents run the share across within each distance and the crossing most come through
        if bank is not None:
            drawn = set(np.nonzero(inmask)[0].tolist())
            for grp in ('visit', 'work'):
                drawn |= {c[0] for c in grids[grp]}
            drawn |= {c[0] for c in ((residents or {}).get('grid', {}).get(i) or [])}
            # a building at the very rim can fall a cell past the frame (the map clips it): it has no centre to measure
            kk = np.array(sorted(k for k in drawn if 0 <= k < W * Hh), dtype=np.int64)
            px_, py_ = gx.ravel()[kk], gy.ravel()[kk]
            d_all, acr_all, _vl = bank.measure(px_, py_, shapely.distance(g, shapely.points(px_, py_)))
            xk = [[int(k), int(round(v / 10)) if np.isfinite(v) else -1] for k, v, a_ in zip(kk, d_all, acr_all) if a_]
            if xk:
                xc, ways = [], []
                for dd, li in bank.reached(5000):
                    kx, q, _a, _b = bank.links[li]
                    kind, th, en, _c, wid = rivers.crossings[kx]
                    if len(xc) < 12:
                        xc.append([round(q[0] / UNIT_M), round(-q[1] / UNIT_M), kind, th, en, int(round(dd))])
                        ways.append(int(wid))
                ax = (residents or {}).get('across', {}).get(i, {})
                a_share, u_ = {}, {}
                for key, v in ax.items():
                    a_share[key] = round(v['across'] / v['straight'] * 100, 1) if v['straight'] else 0.0
                    if v.get('via') and v['counted']:
                        wid = v['via'][0]
                        u_[key] = [ways.index(wid) if wid in ways else -1, round(v['via'][2] / v['counted'] * 100)]
                maps[i]['x'] = {'k': xk, 'c': xc, 'r': bank.rivers_within(s5), **({'a': a_share} if a_share else {}), **({'u': u_} if u_ else {})}
        # the residents map, from a run over 5 km of scripts/residents/ on this very frame (people per cell, modelled)
        rg = (residents or {}).get('grid', {}).get(i)
        if rg is not None:
            if residents['meta'].get('frame') and residents['meta']['frame'].get(i) != maps[i]['cell']:
                sys.exit(f'{i}: the residents grid was drawn on another frame')
            maps[i]['res'] = rg
        cx = (context or {}).get('rows', {}).get(i)
        if cx is not None:
            if context['meta']['frame'].get(i) != maps[i]['cell']:
                sys.exit(f'{i}: the context was drawn on another frame')
            maps[i]['ctx'] = cx
        maps_written += 1

    # ---- levels among the reference set (D-8), per scale; a figure mostly from datasets under 90 % takes none
    levels = {}
    for key in ['in', *map(str, SCALES)]:
        for fig in ('com', 'gst', 'res', 'ctr'):
            vals = {i: (people[i][key].get('n', {}).get('shoppingcenter') if fig == 'ctr' else people[i][key].get(fig)) for i in order}
            uni = [vals[i] for i in ref_order if vals[i] is not None]
            if not uni:
                continue
            for i in order:
                v = vals[i]
                if v is None or (fig == 'com' and people[i][key].get('comLow')):
                    continue
                levels.setdefault(i, {}).setdefault(key, {})[fig] = round(mid_pct(v, uni), 6)
    for i in order:
        if i in levels:
            people[i]['p'] = levels[i]

    meta = {
        'schema': SCHEMA, 'release': RELEASE, 'builtOn': a.built_on,
        'scales': {'in': 'the records the data build counted inside the outline',
                   'km': ('the service area so far from the drawn outline, inside included; across a river through the crossings (0.7.5, V7-09: the Shopping Center page’s rule D70, scripts/crossing/)'
                          if crossing_meta else 'the service area so far from the drawn outline, inside included; straight line')},
        'distance': ({'th': crossing_meta['rule']['th'], 'en': crossing_meta['rule']['en']} if crossing_meta
                     else {'th': 'เส้นตรงจากขอบย่าน', 'en': 'straight line from the outline'}),
        **({'crossing': {**crossing_meta, 'neighbourhoods': {'riverWithin5km': sum(1 for m_ in maps.values() if m_.get('x')),
                                                              'figuresChanged': len(straight_of)}}} if crossing_meta else {}),
        'parts': {
            'stu': {'dataset': 'school', 'th': 'นักเรียนที่บันทึกปี 2569', 'en': 'students recorded for 2026'},
            'uni': {'dataset': 'university', 'th': 'นักศึกษาของมหาวิทยาลัยที่ทุกวิทยาเขตอยู่ในระยะ', 'en': 'students of universities whose every site is within the distance'},
            'fac': {'dataset': 'factory', 'th': 'คนงานตามทะเบียน กรอ.', 'en': 'workers the DIW register reports'},
            'gov': {'dataset': 'governmentoffice', 'th': 'บุคลากรที่หน่วยงานบันทึก (เฉพาะบางประเภท)', 'en': 'staff the offices record (some types only)'},
            'off': {'dataset': 'office', 'th': 'คนทำงานในสำนักงาน (แบบจำลอง: พื้นที่ × อัตราการเช่า ÷ 10–12 ตร.ม. ต่อคน)', 'en': 'office workers (model: area × occupancy ÷ 10–12 m² per person)', 'model': office_source},
        },
        'com': {'th': 'คนมาทำงานและเรียน อย่างน้อย = นักเรียน + นักศึกษา + คนงานโรงงาน + บุคลากรรัฐ + ค่าต่ำของคนทำงานในสำนักงาน',
                'en': 'people who come to work and study, at least = students + university students + factory workers + government staff + the low end of office workers',
                'owner': 'D-12 (2026-11-26 14:31): option A; amends INV-01 for this group only'},
        'gst': {'th': 'ผู้เข้าพักต่อปี (แบบจำลอง) = ห้องที่บันทึก × ผู้เข้าพักของจังหวัด ÷ ห้องที่บันทึกของจังหวัด', 'en': 'guests a year (model) = recorded rooms × the province’s guests ÷ the province’s recorded rooms',
                'source': MOTS_SOURCE, 'file': MOTS_FILE, 'sha256': sha256_file(os.path.join(repo, MOTS_FILE)),
                'lodgingOutsideProvinces': unplaced_lodging},
        'levels': {'reference': ba.REFERENCE, 'rule': 'mid-rank percentile among the reference set; none for a figure half or more of which comes from datasets located under 90 %', 'lowLocated': sorted(low)},
        'maps': {'schema': MAPS_SCHEMA, 'cellM': CELL_M, 'reachM': 5000, 'groups': {k: list(v) for k, v in MAP_GROUPS.items()},
                 'what': 'places per 250 m cell (listed places, not people or visits), cells within 5 km of the drawn outline, straight line (the cells across a river beyond the distance through the crossings are drawn and marked by `x`)',
                 'order': 'cell k = row × w + column; rows north to south from y1, columns west to east from x0; mask = run lengths of cells inside 5 km, starting outside',
                 'cellRecord': '[k, places, band]: band 0 = the cell centre inside the outline, 1 within 1 km of it, 2 within 3 km, 3 within 5 km, 4 (0.7.5) across a river and beyond 5 km through the crossings',
                 'x': 'where a barrier river comes within the window (0.7.5): k [[cell, tens of metres through the crossings, -1 none in reach]] of the cells across it; c [[x, y (25 m units, y down), kind, name th, name en, metres]] the crossings reached within 5 km, nearest first (≤ 12); r [[th, en]] the rivers within 5 km; a {distance: % of the straight-line residents across the river}; u {distance: [index in c or -1, % of those counted across who come through it]}'},
        'sources': {d['id']: d['source'] for d in datasets if d['id'] in {'school', 'factory', 'governmentoffice', 'university', 'office', 'hotel'} | set(sum(MAP_GROUPS.values(), ()))},
        'shoppingcenterModel': {'file': SC_MODEL, 'sha256': sha256_file(sc_model_path)},
        'residents': residents.get('meta') if residents else None,
        'context': {k: v for k, v in context['meta'].items() if k != 'frame'} if context else None,
        'checked': dict(check),
    }
    # one file per neighbourhood (the panel loads the one it opens) and the meta beside them
    for i in order:
        dump(os.path.join(out, 'people', f'{i}.json'), {'id': i, 's': {k: v for k, v in people[i].items() if k != 'p'},
                                                         'p': people[i].get('p', {}), 'map': maps[i],
                                                         **({'st': straight_of[i]} if i in straight_of else {})})
    dump(os.path.join(out, 'people', 'meta.json'), meta)
    print(f'people: {len(people)} neighbourhoods · maps: {maps_written} · lodging outside every province: {unplaced_lodging}')


if __name__ == '__main__':
    main()
