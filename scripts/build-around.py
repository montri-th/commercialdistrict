#!/usr/bin/env python3
"""CityMETER · Commercial District — the surroundings layer «รอบย่านนี้» (release 0.4.0).

    python3 -I scripts/build-around.py --sources <folder of the 16 pinned demo files> --shoppingcenter <clone of
        montri-th/shoppingcenter> [--repo .] [--out data] [--built-on YYYY-MM-DD] [--pilot <pilot cells.json>]

Owner 2026-11-25 08:15, VERBATIM: “พี่ช่วยปรับ web demo ตามที่แนะนำเลยครับ” — the recommendations of the proposal
02-CityMETER__commercialdistrict-neighbourhood-locale-insight-proposal__v1__2026-11-25 (handoff/around/), D-1 … D-9.

Read only, except the files it writes. Inputs:
  repo            this repository at the data release it pairs with: data/neighborhoods.json (the inside counts),
                  data/boundaries.geojson (the outlines the map draws) and data/records/<id>.json (which records the
                  data build counted inside each outline).
  sources         the 16 demo files data/neighborhoods.json pins (datasets[].source: repo, commit, file, SHA-256),
                  saved flat as <dataset id>.json; the industrial-estate reader also needs the demo's boundaries.geojson,
                  so that one lives in industrialestate_dir/estates.json beside it. Every SHA-256 is checked.
  shoppingcenter  a clone of montri-th/shoppingcenter: data/venues.json (its venue registry) and data/locale/meta.json
                  (the release of «รอบศูนย์นี้»). The centres that have the section are the ones it ranks: countable,
                  status supply, group mall · community · outlet, with a point (js/venue-locale.js inLocaleSet).
                  Both files are checked against SC_PINNED.

Outputs:
  data/around.json      per neighbourhood: for every dataset in scope, the located records outside its outline within
                        400 m and within 800 m of the edge ([r400, r800], cumulative); the mid-rank percentiles of the
                        «ในย่านนี้» readings among the frozen reference set; the centres with a «รอบศูนย์นี้» page inside
                        the outline and within 800 m of it.
  data/rings/<id>.json  the line 400 m and 800 m out from the outline, for the map (display only).

Rules (DATA_METHOD.md §12):
  * Around = outside the outline and no farther than the distance from its edge: a straight line on the neighbourhood's
    bank, and with --crossing (0.7.5, D-13) across a river the distance through the nearest crossing. A record the data build
    counted inside is never around (data/records). The 800 m figure holds the 400 m one. Figures of two neighbourhoods
    can share records (a record between two outlines is around both), so they are never added across neighbourhoods;
    counts of two datasets are never added.
  * Distances are measured on the outline the map draws (the registry's outline simplified at 1.5 m, shared edges kept),
    in an azimuthal equidistant projection centred on the neighbourhood's reference point, so a metre is a ground metre.
  * A dataset with no located record in the neighbourhood's province is out of scope: no key, never 0 (as rows[].c).
  * Levels of the glance: the mid-rank percentile (equal values count half: 100 × (below + ½ equal) / n, the rule of
    montri-th/shoppingcenter scripts/build-residents.py#mid_pct) among the neighbourhoods of the frozen reference set
    that have a value; a dataset with points for under 90 % of its records has no level (D-4).
"""
import argparse, glob, hashlib, importlib.util, json, math, os, subprocess, sys, warnings
from collections import defaultdict
from datetime import date

import numpy as np
import pyproj
import shapely
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union

warnings.simplefilter('ignore')

SCHEMA = 'citymeter-commercialdistrict-around/1'
RELEASE = '0.8.0'   # the page's release, as data/people/meta.json (0.7.5: the around counts take the river rule)
# D-8: the reference set stays until a release names the one it replaces; a neighbourhood added later is ranked against
# it. 0.5.0 adds the outlines of the registry's commercial screen (rows[].kind 'screen') and keeps the set of 0.4.0;
# 0.6.1 adds the ones the owner's answers of 2026-11-26 10:02 outline, and keeps it too.
REFERENCE = {'id': 'commercialdistrict-0.4.0-outlined', 'n': 395,
             'codesSha256': 'd9ae2a5b33ebfdddb4b384014894d9ae57896675b4e6e37d6ca473f6a32d4f6f'}
RINGS = (400, 800)
LOW_LOCATED = 0.9           # D-4: a dataset with points for under 90 % of its records is starred and never ranked here
PAD_DEG = 0.012             # candidate box round an outline (more than 800 m at every latitude of Thailand)
RING_SIMPLIFY_M = 2.0       # the drawn ring only: simplification of the buffer line
RING_QUAD_SEGS = 8          # buffer resolution (segments per quarter circle)
SC_GROUPS = ('mall', 'community', 'outlet')
# montri-th/shoppingcenter @ dfcc6cd: the files that give the centres with a «รอบศูนย์นี้» page (checked like the 16 sources)
SC_PINNED = {
    'data/venues.json': 'c951d31c800d9b194ab0922624ae101f9fc0d92ff130130ff3c52a4fc2e472c9',
    'data/locale/meta.json': '275bf644341761f8b4d8b33d123a586eb588e82445933f8fc8e17f099d91cdf3',
}


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def sha256_text(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def mid_pct(x, values):
    below = sum(1 for v in values if v < x)
    equal = sum(1 for v in values if v == x)
    return 100 * (below + 0.5 * equal) / len(values)


def local(lon0, lat0):
    """Forward and inverse transformers of the azimuthal equidistant projection centred on a point (metres)."""
    crs = f'+proj=aeqd +lat_0={lat0} +lon_0={lon0} +datum=WGS84 +units=m'
    fwd = pyproj.Transformer.from_crs('EPSG:4326', crs, always_xy=True)
    inv = pyproj.Transformer.from_crs(crs, 'EPSG:4326', always_xy=True)
    return fwd, inv


def project(geom, tr):
    return shapely.transform(geom, lambda a: np.column_stack(tr.transform(a[:, 0], a[:, 1])))


def polygonal(g):
    """A valid polygonal geometry (make_valid can return a collection with lines)."""
    if g.is_valid:
        return g
    g = shapely.make_valid(g)
    if g.geom_type == 'GeometryCollection':
        g = unary_union([x for x in g.geoms if x.geom_type in ('Polygon', 'MultiPolygon')])
    return g


def rounded(geom, nd=6):
    """GeoJSON geometry with coordinates rounded to nd decimals (about 0.1 m at 6)."""
    def r(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]
    m = mapping(geom)
    return {'type': m['type'], 'coordinates': r(m['coordinates'])}


def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--repo', default='.')
    ap.add_argument('--sources', required=True)
    ap.add_argument('--shoppingcenter', required=True)
    ap.add_argument('--out', default=None)
    ap.add_argument('--built-on', default=date.today().isoformat())
    ap.add_argument('--pilot', default=None, help='pilot cells of the proposal (optional): report the cells that differ')
    ap.add_argument('--crossing', default=None, help='rivers cache of scripts/crossing/rivers.py (outside the repository): across a river, through the crossings (0.7.5)')
    ap.add_argument('--crossing-kinds', default='all', choices=('all', 'no-ferry'))
    ap.add_argument('--registry-points', default='', help='(0.8.0) the private points of the counted-only datasets (scripts/build-registry-points.py, scripts/build-parks.py)')
    ap.add_argument('--members', default='', help='(0.8.0) the private file of their keys inside each outline (scripts/build-data.py --members-out)')
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    out = os.path.abspath(a.out or os.path.join(repo, 'data'))

    spec = importlib.util.spec_from_file_location('build_data', os.path.join(repo, 'scripts', 'build-data.py'))
    bd = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bd)

    nb_path = os.path.join(repo, 'data', 'neighborhoods.json')
    outl_path = os.path.join(repo, 'data', 'boundaries.geojson')
    nb = json.load(open(nb_path, encoding='utf-8'))
    rows = nb['rows']
    order = [r['id'] for r in rows]
    by_id = {r['id']: r for r in rows}
    datasets = nb['datasets']
    di_of = {d['id']: k for k, d in enumerate(datasets)}
    outl = {str(f['properties']['id']): shape(f['geometry']) for f in json.load(open(outl_path, encoding='utf-8'))['features']}
    if set(outl) != set(order):
        sys.exit('data/boundaries.geojson and data/neighborhoods.json do not hold the same neighbourhoods')
    ref_order = [r['id'] for r in rows if r.get('kind') not in ('screen', 'review')]  # (0.8.0) the review's outlines join after the set, as the screen's did
    if len(ref_order) != REFERENCE['n'] or sha256_text('\n'.join(ref_order)) != REFERENCE['codesSha256']:
        sys.exit(f"the outlines of the reference set {REFERENCE['id']} changed ({len(ref_order)} codes): a release must name the set it replaces (D-8)")

    # ---- which records the data build counted inside each outline (data/records/<id>.json)
    inside_keys = {}
    for i in order:
        shard = json.load(open(os.path.join(repo, 'data', 'records', f'{i}.json'), encoding='utf-8'))
        if shard['id'] != i or shard['fields'][:5] != ['dataset', 'lon', 'lat', 'subgroup', 'key']:
            sys.exit(f'{i}: unexpected records shard')
        keys, count = set(), defaultdict(int)
        for rec in shard['rows']:
            keys.add((rec[0], str(rec[4]), rec[1], rec[2]))
            count[rec[0]] += 1
        for d in datasets:
            if d.get('aggregate'):
                continue  # (0.8.0) counted only: their inside keys come from the private --members file
            want = by_id[i]['c'].get(d['id'], 0)
            if count.get(di_of[d['id']], 0) != want:
                sys.exit(f"{i} {d['id']}: records shard holds {count.get(di_of[d['id']], 0)}, rows[].c says {want}")
        inside_keys[i] = keys

    # ---- (0.8.0) the counted-only datasets: their private points and the keys the data build counted inside
    pts, sources = {}, {}
    agg = [d for d in datasets if d.get('aggregate')]
    if agg:
        if not (a.registry_points and a.members):
            sys.exit('the data holds counted-only datasets: pass --registry-points and --members')
        members = json.load(open(a.members, encoding='utf-8'))
        for d in agg:
            R = json.load(open(os.path.join(a.registry_points, d['id'] + '.json'), encoding='utf-8'))
            if R['meta']['records'] != d['records'] or len(R['points']) != d['located']:
                sys.exit(f"{d['id']}: the points read {R['meta']['records']} / {len(R['points'])}, the data says {d['records']} / {d['located']}")
            di = di_of[d['id']]
            at = {x[3]: (round(x[0], 6), round(x[1], 6)) for x in R['points']}
            pts[d['id']] = {'lon': np.array([x[0] for x in R['points']], dtype=float), 'lat': np.array([x[1] for x in R['points']], dtype=float),
                            'key': [(di, x[3], round(x[0], 6), round(x[1], 6)) for x in R['points']], 'raw': [x[3] for x in R['points']]}
            for i in order:
                ks = (members.get(d['id']) or {}).get(i, [])
                if len(ks) != by_id[i]['c'].get(d['id'], 0):
                    sys.exit(f"{i} {d['id']}: the members file holds {len(ks)}, rows[].c says {by_id[i]['c'].get(d['id'], 0)}")
                inside_keys[i] |= {(di, k, *at[k]) for k in ks}
            sources[d['id']] = {'registry': d['source']['registry'], 'sha256': d['source']['sha256']}

    # ---- the 16 pinned files, read with the demo's own reader (scripts/build-data.py#extract)
    for d in datasets:
        if d.get('aggregate'):
            continue
        path = (os.path.join(a.sources, 'industrialestate_dir', 'estates.json') if d['id'] == 'industrialestate'
                else os.path.join(a.sources, 'housingestate_dir', 'records.json') if d['id'] == 'housingestate'   # (0.8.0) its points file sits beside it
                else os.path.join(a.sources, d['id'] + '.json'))
        got = sha256_file(path)
        if got != d['source']['sha256']:
            sys.exit(f"{d['id']}: {path} has SHA-256 {got}, data/neighborhoods.json pins {d['source']['sha256']}")
        scope, _sub, _measure, _dates, p = bd.extract(d['id'], path)
        if scope['records'] != d['records'] or len(p) != d['located']:
            sys.exit(f"{d['id']}: read {scope['records']} records / {len(p)} located, the data says {d['records']} / {d['located']}")
        di = di_of[d['id']]
        pts[d['id']] = {
            'lon': np.array([x[0] for x in p], dtype=float), 'lat': np.array([x[1] for x in p], dtype=float),
            'key': [(di, str(x[4]), round(x[0], 6), round(x[1], 6)) for x in p],
        }
        sources[d['id']] = {'repo': d['source']['repo'], 'commit': d['source']['commit'], 'file': d['source']['file'], 'sha256': got}

    # ---- the banks of the rivers (0.7.5, V7-09; owner 2026-11-27 06:51 on 400/800 m, VERBATIM “คิดด้วย”): optional
    rivers = crossing_meta = None
    if a.crossing:
        spec_b = importlib.util.spec_from_file_location('banks', os.path.join(repo, 'scripts', 'crossing', 'banks.py'))
        banks_mod = importlib.util.module_from_spec(spec_b)
        spec_b.loader.exec_module(banks_mod)
        rivers, crossing_meta = banks_mod.load(a.crossing, a.crossing_kinds)

    def bank_of(fwd, g, lonlat_bounds):
        if rivers is None:
            return None
        b = banks_mod.Banks(rivers, lambda lo, la: fwd.transform(lo, la), g, lonlat_bounds)
        return b if b.has_river else None

    # ---- surroundings of every outline
    around, rings = {}, {}
    parks_near = {}
    moved = 0
    # records whose side of the drawn line differs from the data build's membership (the 1.5 m simplification):
    # inside the drawn line but not counted inside (they are around, at 0 m) · counted inside but just outside the line
    in_line_not_counted, counted_off_line = 0, 0
    for i in order:
        r = by_id[i]
        lon0, lat0 = r['ref']
        fwd, inv = local(lon0, lat0)
        g = polygonal(project(outl[i], fwd))
        minx, miny, maxx, maxy = outl[i].bounds
        mine = inside_keys[i]
        bank = bank_of(fwd, g, outl[i].bounds)
        a_ = {}
        for d in datasets:
            if d['id'] not in r['c']:
                continue  # out of scope: no key at all, never 0
            P = pts[d['id']]
            m = (P['lon'] >= minx - PAD_DEG) & (P['lon'] <= maxx + PAD_DEG) & (P['lat'] >= miny - PAD_DEG) & (P['lat'] <= maxy + PAD_DEG)
            idx = np.nonzero(m)[0]
            if not len(idx):
                a_[d['id']] = [0, 0]
                continue
            x, y = fwd.transform(P['lon'][idx], P['lat'][idx])
            pp = shapely.points(x, y)
            dist = shapely.distance(g, pp)
            counted = np.array([P['key'][k] in mine for k in idx])
            geo_in = shapely.covers(g, pp)
            in_line_not_counted += int(np.sum(geo_in & ~counted))
            counted_off_line += int(np.sum(counted & ~geo_in))
            outside = ~counted
            if bank is not None:
                # across a river: the distance through the crossings, never under the straight one
                line = [int(np.sum(outside & (dist <= RINGS[0]))), int(np.sum(outside & (dist <= RINGS[1])))]
                dist = bank.measure(np.asarray(x), np.asarray(y), dist)[0]
            a_[d['id']] = [int(np.sum(outside & (dist <= RINGS[0]))), int(np.sum(outside & (dist <= RINGS[1])))]
            if bank is not None and a_[d['id']] != line:
                moved += 1
            if d['id'] == 'park':
                # (0.8.0) the parks whose squares are counted here: inside and within 800 m of the edge, by park
                by_park = defaultdict(lambda: [0, 0])
                for k, c_in, near in zip(idx, counted, (~counted) & (dist <= RINGS[1])):
                    pid = P['raw'][k].split(':')[0]
                    if pid.startswith('x') or not (c_in or near):
                        continue
                    by_park[int(pid)][0 if c_in else 1] += 1
                if by_park:
                    parks_near[i] = sorted(([p_, v[0], v[1]] for p_, v in by_park.items()), key=lambda x: (-(x[1] + x[2]), x[0]))[:4]
        around[i] = a_
        ring = {}
        for k in RINGS:
            b = g.buffer(k, quad_segs=RING_QUAD_SEGS).simplify(RING_SIMPLIFY_M, preserve_topology=True)
            ring[str(k)] = rounded(project(b, inv))
        rings[i] = ring

    # ---- the glance «ในย่านนี้»: values from data/neighborhoods.json, levels among the frozen reference set
    ds_by = {d['id']: d for d in datasets}
    low = sorted(d['id'] for d in datasets if d['records'] and d['located'] / d['records'] < LOW_LOCATED)

    def measured_value(r, ds_id):
        """(value, state): the source figure inside the outline, or the count (shoppingcenter); None when it has none."""
        if ds_id not in r['c']:
            return None, 'out_of_scope'
        n = r['c'][ds_id]
        if ds_id == 'shoppingcenter':
            return (n, 'measured' if n else 'measured_zero')
        if not n:
            return 0, 'measured_zero'
        m = r.get('m', {}).get(ds_id)
        return (m[0], 'measured') if m else (None, 'no_data')

    tiles = [('students', 'school'), ('rooms', 'hotel'), ('centers', 'shoppingcenter')]
    glance, universe = defaultdict(dict), {}
    for tile, ds_id in tiles:
        if ds_id in low:
            universe[tile] = {'dataset': ds_id, 'ranked': False, 'why': 'located under 90% of its records (D-4)'}
            continue
        vals = {i: measured_value(by_id[i], ds_id)[0] for i in order}
        uni = [vals[i] for i in ref_order if vals[i] is not None]  # D-8: levels among the reference set only
        universe[tile] = {'dataset': ds_id, 'ranked': True, 'n': len(uni)}
        for i, v in vals.items():
            if v is not None:
                p = mid_pct(v, uni)
                q = round(p, 6)
                # the page reads levelOf(p) and the count sample round(p × 40 / 100) (JS rounding): never moved by the digits kept
                if v > 0 and (min(5, math.floor(q / 20) + 1) != min(5, math.floor(p / 20) + 1)
                              or math.floor(q * 0.4 + 0.5) != math.floor(p * 0.4 + 0.5)):
                    sys.exit(f'{i} {tile}: storing p = {q} would move its level or colour (exact {p})')
                glance[i][tile] = q

    # ---- centres with a «รอบศูนย์นี้» page, inside or near each outline (joined by id; names only to show them)
    sc_venues_path = os.path.join(a.shoppingcenter, 'data', 'venues.json')
    sc_meta_path = os.path.join(a.shoppingcenter, 'data', 'locale', 'meta.json')
    for rel, want in SC_PINNED.items():
        got = sha256_file(os.path.join(a.shoppingcenter, *rel.split('/')))
        if got != want:
            sys.exit(f'montri-th/shoppingcenter {rel} has SHA-256 {got}, this build pins {want} (dfcc6cd)')
    sc_rows = json.load(open(sc_venues_path, encoding='utf-8'))['rows']
    sc_meta = json.load(open(sc_meta_path, encoding='utf-8'))
    venues = [v for v in sc_rows if v.get('countable') and v.get('status') == 'supply' and v.get('group') in SC_GROUPS
              and v.get('located') and bd.ok(v.get('lon'), v.get('lat'))]
    sc_di = di_of['shoppingcenter']
    inside_by_id = {}
    for i in order:
        for (di, key, _lon, _lat) in inside_keys[i]:
            if di == sc_di:
                inside_by_id.setdefault(key, i)
    by_nb = {i: {'in': [], 'near': []} for i in order}
    by_venue, names = {}, {}
    vlon = np.array([v['lon'] for v in venues]); vlat = np.array([v['lat'] for v in venues])
    vid = [v['id'] for v in venues]
    hits = defaultdict(list)     # venue index → [(neighbourhood, metres)]
    for i in order:
        r = by_id[i]
        fwd, _ = local(*r['ref'])
        g = polygonal(project(outl[i], fwd))
        minx, miny, maxx, maxy = outl[i].bounds
        bank = bank_of(fwd, g, outl[i].bounds)
        m = (vlon >= minx - PAD_DEG) & (vlon <= maxx + PAD_DEG) & (vlat >= miny - PAD_DEG) & (vlat <= maxy + PAD_DEG)
        for k in np.nonzero(m)[0]:
            x, y = fwd.transform(vlon[k], vlat[k])
            pt = Point(x, y)
            dist = g.distance(pt)
            if bank is not None and not g.covers(pt):
                dist = float(bank.measure(np.array([x]), np.array([y]), np.array([dist]))[0][0])
            if dist <= RINGS[1]:
                hits[k].append((i, round(dist), g.covers(pt)))
    # the located records of the Shopping Center file the data build pinned: a centre among them is inside an outline
    # only when the build counted it there (data/records), so the inside and the around never hold the same centre
    pinned_sc = {key[1] for key in pts['shoppingcenter']['key']}
    if sum(1 for v in venues if v['id'] in pinned_sc) < 0.9 * len(venues):
        sys.exit('the centres and the pinned Shopping Center records do not share their ids: check the record key')
    not_pinned = sorted(v['id'] for v in venues if v['id'] not in pinned_sc)
    for k, v in enumerate(venues):
        inside = inside_by_id.get(v['id'])
        if inside is None and v['id'] not in pinned_sc:
            # a centre the pinned file has no point for (newer than it): inside the outline the drawn line covers it in
            cov = [i for i, _dm, cv in hits.get(k, []) if cv]
            inside = cov[0] if cov else None
        near = sorted(((i, dm) for i, dm, _cv in hits.get(k, []) if i != inside), key=lambda x: (x[1], order.index(x[0])))
        if inside:
            by_nb[inside]['in'].append(v['id'])
        for i, dm in near:
            by_nb[i]['near'].append([v['id'], dm])
        if inside or near:
            names[v['id']] = [bd.txt(v.get('name')), bd.txt(v.get('nameEn'))]
        by_venue[v['id']] = {'in': inside, 'nearest': [near[0][0], near[0][1]] if near else None}
    for i in order:
        by_nb[i]['in'].sort(key=lambda x: names[x][0])
        by_nb[i]['near'].sort(key=lambda x: (x[1], names[x[0]][0]))

    # ---- the reference set (D-8: frozen with the release) and the output
    nb_sha = sha256_file(nb_path)
    outl_sha = sha256_file(outl_path)
    try:
        sc_commit = subprocess.run(['git', '-C', a.shoppingcenter, 'rev-parse', 'HEAD'], check=True, capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        sc_commit = None
    meta = {
        'schema': SCHEMA, 'release': RELEASE, 'builtOn': a.built_on,
        'ringsM': list(RINGS),
        'measure': {
            'th': ('นอกขอบของย่านนั้น และห่างจากเส้นขอบไม่เกินระยะที่บอก ' + ('อีกฝั่งแม่น้ำวัดผ่านทางข้าม' if crossing_meta else 'วัดเส้นตรง')
                   + ' · ค่า 800 ม. รวมค่า 400 ม. · รายการเดียวกันอยู่รอบหลายย่านได้ จึงห้ามบวกข้ามย่าน'),
            'en': ('outside the neighbourhood\'s outline and no farther than the distance from its edge, ' + ('across a river through the crossings' if crossing_meta else 'straight line')
                   + ' · the 800 m figure holds the 400 m one · one record can be around several neighbourhoods, so figures are never added across neighbourhoods'),
            'projection': 'azimuthal equidistant, centred on the neighbourhood\'s reference point',
            'notTheSameAs': ['the registry\'s lodging screen: walking distance along the path network from its own start points (DATA_METHOD.md §2a)',
                             'Yolk MCP: a straight radius from the neighbourhood\'s reference point'],
        },
        'outlines': {'file': 'data/boundaries.geojson', 'sha256': outl_sha,
                     'note': 'the outline the map draws: the delivered outline simplified at 1.5 m with shared edges kept; the ring of the map is drawn from it'},
        'inside': {'file': 'data/neighborhoods.json', 'sha256': nb_sha, 'records': 'data/records/<id>.json',
                   'note': 'a record the data build counted inside an outline is never around it'},
        'sources': sources,
        'referenceSet': {**REFERENCE, 'added': len(order) - len(ref_order),
                         'rule': 'the 395 outlined neighbourhoods of release 0.4.0, in the order of data/neighborhoods.json, codes joined by a line feed; it stays until a release names the one it replaces, and a neighbourhood added later (0.5.0: the commercial screen, rows[].kind screen) is ranked against it without joining it (D-8)'},
        'lowLocated': {'threshold': LOW_LOCATED, 'datasets': low,
                       'rule': 'a dataset with points for under 90% of its records is starred and has no rank or level in «รอบย่านนี้» (D-4)'},
        'glance': {
            'tiles': [
                {'id': 'residents', 'dataset': None, 'evidence': 'modelled_estimate', 'state': 'not_yet', 'round': 2},
                {'id': 'students', 'dataset': 'school', 'measure': 'students', 'evidence': 'publisher_listed', 'round': 1},
                {'id': 'rooms', 'dataset': 'hotel', 'measure': 'rooms', 'evidence': 'publisher_listed', 'round': 1},
                {'id': 'centers', 'dataset': 'shoppingcenter', 'measure': 'count', 'evidence': 'derived_count', 'round': 1},
            ],
            'universe': universe,
            'levelRule': 'level = min(5, floor(p / 20) + 1) for a value above 0, 0 for a measured zero (montri-th/shoppingcenter js/venue-locale.js#levelOf); p = 100 × (below + ½ equal) / n among the neighbourhoods of the reference set with a value',
        },
        'venues': {'repo': 'montri-th/shoppingcenter', 'commit': sc_commit, 'file': 'data/venues.json', 'sha256': sha256_file(sc_venues_path),
                   'locale': {'file': 'data/locale/meta.json', 'release': sc_meta.get('release'), 'sha256': sha256_file(sc_meta_path)},
                   'set': 'countable · status supply · group mall, community or outlet · located (js/venue-locale.js inLocaleSet)', 'n': len(venues),
                   'notInPinnedFile': not_pinned,
                   'rule': 'inside: the build counted it inside the outline (data/records), or — for a centre the pinned Shopping Center file has no point for (notInPinnedFile) — the drawn outline covers its point; near: outside, within 800 m of the edge, straight line (a centre of the pinned file the build did not count inside is near, at its distance, even under 1 m); joined by venue id, never by name'},
        'acrossTheDrawnLine': {'insideTheLineNotCountedInside': in_line_not_counted, 'countedInsideOffTheLine': counted_off_line,
                               'note': 'the drawn outline is the delivered one simplified at 1.5 m: a record this close to it can fall on the other side; membership follows the data build (a record it did not count inside is around, at 0 m), distance follows the drawn outline'},
        'parks': {'file': 'data/parks.json', 'field': 'pk', 'note': 'per neighbourhood, up to four parks whose 1-rai squares are counted inside or within 800 m of the edge (the same rule as `a`): [park index, squares inside, squares within 800 m]; a park is named, never added to another neighbourhood'},
        'rings': {'dir': 'rings', 'simplifyM': RING_SIMPLIFY_M, 'quadSegs': RING_QUAD_SEGS, 'note': 'display only: the line the map draws, the outline grown by the distance and simplified at 2 m, so it can sit a few metres off the exact distance; every count above is measured on the outline itself'},
        **({'crossing': {**crossing_meta, 'datasetCountsMoved': moved,
                         'owner': '2026-11-27 06:51, VERBATIM: “ระยะ 400/800 ม. จะคิดเรื่องสิ่งกีดขวางด้วยไหม / คิดด้วย” (D-13)'}} if crossing_meta else {}),
    }
    rows_out = {}
    for i in order:
        rows_out[i] = {'a': around[i]}
        if glance.get(i):
            rows_out[i]['g'] = glance[i]
        if by_nb[i]['in'] or by_nb[i]['near']:
            rows_out[i]['v'] = by_nb[i]
        if parks_near.get(i):
            rows_out[i]['pk'] = parks_near[i]   # (0.8.0) [park index in data/parks.json, ไร่ inside, ไร่ within 800 m], largest first
    doc = {'meta': meta, 'rows': rows_out, 'venues': dict(sorted(names.items())), 'byVenue': dict(sorted(by_venue.items()))}
    dump(os.path.join(out, 'around.json'), doc)
    ring_dir = os.path.join(out, 'rings')
    os.makedirs(ring_dir, exist_ok=True)
    for f in glob.glob(os.path.join(ring_dir, '*.json')):
        if os.path.basename(f)[:-5] not in rings:
            os.remove(f)
    for i in order:
        dump(os.path.join(ring_dir, f'{i}.json'), {'id': i, 'ringsM': list(RINGS), 'rings': rings[i]})

    # ---- report
    cells = sum(len(v) for v in around.values())
    rep = {'outlines': len(order), 'cells': cells,
           'acrossTheDrawnLine': {'insideTheLineNotCountedInside': in_line_not_counted, 'countedInsideOffTheLine': counted_off_line},
           'lowLocated': low, 'universe': universe,
           'venues': {'set': len(venues), 'inside': sum(len(v['in']) for v in by_nb.values()),
                      'neighbourhoodsWithInside': sum(1 for v in by_nb.values() if v['in']),
                      'nearPairs': sum(len(v['near']) for v in by_nb.values()),
                      'linked': sum(1 for v in by_venue.values() if v['in'] or v['nearest']), 'notInPinnedFile': len(not_pinned)}}
    if a.pilot:
        pilot = json.load(open(a.pilot, encoding='utf-8'))
        diff = [(i, ds) for i in order for ds, v in around[i].items() if pilot.get(i, {}).get(ds, [0, None, None])[1:] != v]
        rep['pilot'] = {'cellsDifferent': len(diff), 'examples': diff[:8]}
    print(json.dumps(rep, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
