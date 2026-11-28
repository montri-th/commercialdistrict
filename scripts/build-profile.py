#!/usr/bin/env python3
"""CityMETER · Commercial District — the profile of every neighbourhood: its scale, its price level, the people most likely
to stand out in it, and the neighbourhoods most alike in mix, scale and price (release 0.9.0).

    python3 -I scripts/build-profile.py --repos <folder of the demo clones at the commits data/neighborhoods.json pins>
        [--registry-points <private points of the counted-only datasets>] [--crossing <rivers cache> --crossing-kinds no-ferry]
        [--repo .] [--out data] [--built-on YYYY-MM-DD]

Owner 2026-11-29 00:41, VERBATIM (items 1 and 2 of his message):
  “1) ย่านที่ส่วนผสมคล้ายกัน มันควรจะดูด้านขนาดด้วยนะ เช่น จำนวนคน ความถี่ และด้านคุณภาพ จำนวนเงิน ระดับราคา อย่างย่าน
  ศูนย์สิริกิติ์ กับ ตลาดเมืองนครนายก กุดป่องเลย เรืองราษฎร์ระนอง จำนวนคน กับ ระดับราคาของสินค้าในพื้นที่มันใกล้กันตรงไหน
  พี่มองด้านนี้บ้างสิ ระดับราคาของโรงเรียน โรงแรม คอนโด บ้านจัดสรร etc พวกนี้ ควรจะใช้ infer ได้
  2) ที่อยากให้ทำได้มากๆคือระบุ persona เด่นๆ ในย่าน ออกมาให้เห็นชัดว่าเป็นใคร ใน traffic แต่ละประเภท ทั้ง คนอยู่, ผู้มาเยือน,
  คนทำงาน_เรียน อยู่ในย่านช่วงไหน ว่าซื้ออะไรหรือมาทำอะไรในย่านบ้าง”

Reads only, except data/profile.json. Inputs, all already pinned by the release:
  data/neighborhoods.json   rows (scope: a dataset with no key in rows[].c is out of the province), densities for the mix
  data/boundaries.geojson   the outlines the map draws: distances are measured from them, as data/around.json measures
  data/people/<id>.json     the three groups within 1 km of the edge (residents, overnight guests a year, at least who come
                            to work and study) and their parts
  data/condo/<cell>.json    the condominium display points and their appraisal price per m² (P50), never counted
  data/around.json          parks and places of worship within 800 m when their private points are not at hand
  --repos                   the demo files, each checked by the SHA-256 data/neighborhoods.json pins (datasets[].source)
  --registry-points         the counted-only datasets' private points (scripts/build-registry-points.py), for their kinds

What it measures (DATA_METHOD.md §22): inside the outline and within 800 m of its edge — the walkable edge «ขอบเดินถึง» —
on the neighbourhood's bank a straight line, and with --crossing across a river through the nearest crossing (§17):
  * the price level (Inference): up to seven readings, each against every neighbourhood that has it (mid-rank percentile):
    the median recorded nightly price of the lodging, the median appraisal price per m² of the condominiums, the share of
    priced restaurants at 300 baht or more, the median asking rent of the offices, the share of private and international
    schools among the schools, the share of upmarket supermarkets among the supermarkets and hypermarkets, the points of
    sale of luxury brands; the level is their mean when at least two are known — never a price, an income or a spend;
  * the scale: the people figures of «ใครอยู่ตรงนี้» within 1 km (never added across groups);
  * the people who stand out (Inference): for each group a short list of profiles whose evidence the neighbourhood holds
    — every profile has a rule on counted records, ranked by its strength among the neighbourhoods where the rule holds;
  * the neighbourhoods most alike (Inference): the mix (the cosine of centred log density, as before), the scale (the
    three groups within 1 km on a log scale) and the price level, each 0–1, their geometric mean.
"""
import argparse, hashlib, importlib.util, json, math, os, sys, warnings
from collections import Counter, defaultdict
from datetime import date

import numpy as np
import pyproj
import shapely
from shapely.geometry import shape

warnings.simplefilter('ignore')

SCHEMA = 'citymeter-commercialdistrict-profile/1'
RELEASE = '0.9.0'
NEAR = 800                    # the walkable edge «ขอบเดินถึง»: inside and within 800 m of the drawn outline
PAD_DEG = 0.012               # candidate box round an outline (more than 800 m at every latitude of Thailand)
SCALE_AT = '1000'             # «ใครอยู่ตรงนี้» reads 1 km by default; the scale reads the same figures

# the price readings: (id, minimum records, what a higher value means). A reading needs this many records near.
PRICE_MIN = {'hotel': 3, 'condo': 3, 'rest': 10, 'office': 2, 'school': 3, 'grocery': 3, 'lux': 1}
PRICE_ORDER = ('hotel', 'condo', 'rest', 'office', 'school', 'grocery', 'lux')
PRICE_LEVEL_MIN = 2           # a level needs at least two readings
# upmarket supermarket banners (the Grocery demo's own banners; Tops, Villa, Gourmet, Foodland, MaxValu, Don Don Donki,
# UFM Fuji Super, Rimping) against the mass and wholesale ones (Lotus's, Big C, Makro, GO Wholesale)
UPMARKET = {'Tops', 'Villa Market', 'Gourmet Market', 'Foodland', 'MaxValu', 'Don Don Donki', 'UFM Fuji Super', 'Rimping'}
REST_BUCKETS = ('UNDER_100', 'R100_300', 'R300_500', 'R500_1000', 'OVER_1000', 'UNSPECIFIED')
# lodging price tiers on the recorded nightly price (baht): budget, mid, upper, luxury
TIERS = (800, 2500, 5000)

# condominiums: the research master's appraisal price (P50, baht per m²) — about the top tenth of the neighbourhoods
CONDO_UPPER = 60000
OFFICE_PRIME = 700            # asking rent, baht per m² a month: about the top third of the offices with a rent

# what each profile is likely to use or do nearby: (dataset, kind or None), counted inside and within 800 m
USES = {
    'condo_upper': [('grocery', 'SUPERMARKET'), ('restaurant', None), ('fitness', None), ('services', 'laundry'), ('park', None), ('pet', None), ('clinic', None)],
    'condo': [('grocery', 'C_STORE'), ('grocery', 'SUPERMARKET'), ('restaurant', None), ('services', 'laundry'), ('fitness', None), ('park', None), ('salon', None)],
    'estate': [('grocery', 'HYPERMARKET'), ('shoppingcenter', 'community'), ('school', None), ('park', None), ('car', None), ('hospital', None)],
    'family': [('school', None), ('park', None), ('playground', None), ('hospital', None), ('grocery', 'SUPERMARKET'), ('shoppingcenter', 'mall')],
    'family_private': [('school', 'private'), ('school', 'international'), ('park', None), ('playground', None), ('grocery', 'SUPERMARKET'), ('shoppingcenter', 'mall')],
    'student_rent': [('grocery', 'C_STORE'), ('restaurant', None), ('services', 'telecom'), ('services', 'laundry'), ('hobby', 'books'), ('salon', None)],
    'local_community': [('shoppingcenter', 'market'), ('temple', None), ('grocery', 'C_STORE'), ('pharmacy', None), ('gold', None), ('bank', None)],
    'biz': [('hotel', 'hotel'), ('restaurant', 'western'), ('restaurant', 'japanese'), ('restaurant', 'cafe'), ('massage', None), ('transit', None), ('shoppingcenter', 'mall')],
    'upscale': [('hotel', 'hotel'), ('luxurybrands', None), ('shoppingcenter', 'mall'), ('restaurant', 'western'), ('massage', None), ('clinic', None)],
    'budget': [('hotel', 'guesthouse'), ('restaurant', 'thai'), ('massage', None), ('tourism', None), ('grocery', 'C_STORE'), ('transit', None)],
    'resort': [('hotel', 'resort'), ('tourism', 'nature'), ('massage', None), ('restaurant', None), ('park', None)],
    'culture': [('tourism', 'culture'), ('temple', None), ('arts', None), ('restaurant', 'thai'), ('hobby', 'gift')],
    'shopper': [('shoppingcenter', 'mall'), ('shoppingcenter', 'market'), ('apparel', None), ('beauty', None), ('luxurybrands', None), ('cinema', None), ('restaurant', 'cafe')],
    'patient': [('hospital', None), ('pharmacy', None), ('restaurant', None), ('grocery', 'C_STORE'), ('hotel', None)],
    'office': [('restaurant', 'fastfood'), ('restaurant', 'thai'), ('restaurant', 'cafe'), ('grocery', 'C_STORE'), ('bank', None), ('fitness', None), ('services', 'telecom')],
    'office_prime': [('restaurant', 'japanese'), ('restaurant', 'western'), ('restaurant', 'cafe'), ('fitness', None), ('bank', None), ('clinic', None), ('optical', None)],
    'gov': [('restaurant', 'thai'), ('bank', None), ('grocery', 'C_STORE'), ('pharmacy', None), ('restaurant', 'cafe')],
    'factory': [('restaurant', 'thai'), ('grocery', 'C_STORE'), ('bank', None), ('gold', None), ('car', None), ('pharmacy', None)],
    'uni': [('restaurant', 'cafe'), ('restaurant', None), ('services', 'electronics'), ('hobby', 'books'), ('grocery', 'C_STORE'), ('fitness', None)],
    'school': [('grocery', 'C_STORE'), ('hobby', 'books'), ('restaurant', None), ('park', None), ('playground', None)],
    'medical': [('restaurant', 'cafe'), ('pharmacy', None), ('grocery', 'C_STORE'), ('bank', None)],
    'retail': [('restaurant', 'thai'), ('grocery', 'C_STORE'), ('bank', None), ('pharmacy', None), ('transit', None)],
}
USES_SHOWN = 6
# (review of 2026-11-29) a long-settled community still holds a few condominium buildings (สำเพ็ง 12 within 800 m)
COMMUNITY_CONDO_MAX = 20
# profiles that measure the same thing in the same unit share one pool, so a split by price never lowers a rank
POOL = {'condo_upper': 'condo', 'family_private': 'family', 'office_prime': 'office'}
# the first profile of the people who come to work and study: within LEAD_TIE points of the clearest, the order below
# decides — the places of work before the schools, which stand in nearly every town and so rank high almost everywhere
# (review of 2026-11-29: สีลม, อโศก, สำเพ็ง led by school pupils). The page's own order, an Inference (DATA_METHOD.md §22);
# residents and visitors keep the order of how clearly each stands out
LEAD_TIE = 5.0
LEAD_ORDER = {'com': ('office_prime', 'office', 'gov', 'medical', 'factory', 'uni', 'retail', 'school')}

SIM_KEEP = 5
SIM_MIN_SHARED = 8            # as js/profile.js#similarRows of 0.8.x: datasets in scope for both
SIM_MIN_BOTH = 3
SCALE_SPAN = 1.0              # one order of magnitude apart on the scale = no likeness of scale
PRICE_SPAN = 40.0             # forty level points apart = no likeness of price


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def mid_pct(x, values):
    below = sum(1 for v in values if v < x)
    equal = sum(1 for v in values if v == x)
    return 100 * (below + 0.5 * equal) / len(values)


def median(v):
    v = sorted(v)
    n = len(v)
    return None if not n else (v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2)


def local(lon0, lat0):
    crs = f'+proj=aeqd +lat_0={lat0} +lon_0={lon0} +datum=WGS84 +units=m'
    return pyproj.Transformer.from_crs('EPSG:4326', crs, always_xy=True)


def project(geom, tr):
    return shapely.transform(geom, lambda a: np.column_stack(tr.transform(a[:, 0], a[:, 1])))


def polygonal(g):
    if g.is_valid:
        return g
    g = shapely.make_valid(g)
    if g.geom_type == 'GeometryCollection':
        g = shapely.unary_union([x for x in g.geoms if x.geom_type in ('Polygon', 'MultiPolygon')])
    return g


def ok(lon, lat):
    return isinstance(lon, (int, float)) and isinstance(lat, (int, float)) and math.isfinite(lon) and math.isfinite(lat) \
        and 97.0 <= lon <= 106.0 and 5.3 <= lat <= 20.8


def pos(v):
    return v if isinstance(v, (int, float)) and math.isfinite(v) and v > 0 else None


# ---------------------------------------------------------------------------------------------------------- readers
def readers(bd, repos, datasets):
    """Every core dataset's located records with the attributes the profile reads, in the order of the demo's own reader
    (scripts/build-data.py#extract: the same records, checked point by point)."""
    out = {}
    for d in datasets:
        if d.get('aggregate'):
            continue
        spec = next(s for s in bd.DATASETS if s[0] == d['id'])
        path = os.path.join(repos, spec[2], spec[3])
        got = sha256_file(path)
        if got != d['source']['sha256']:
            sys.exit(f"{d['id']}: {path} has SHA-256 {got}, data/neighborhoods.json pins {d['source']['sha256']}")
        _scope, subgroups, _m, _dates, pts = bd.extract(d['id'], path)
        lon = np.array([p[0] for p in pts], dtype=float)
        lat = np.array([p[1] for p in pts], dtype=float)
        sub = np.array([p[2] if isinstance(p[2], int) else len(subgroups) - 1 for p in pts], dtype=int)
        meas = [p[3] for p in pts]
        extra = {}
        raw = json.load(open(path, encoding='utf-8'))
        if d['id'] == 'hotel':
            c = raw['cols']
            idx = [i for i in range(len(c['key'])) if ok(c['lon'][i], c['lat'][i])]
            extra['price'] = [pos(c['pavg'][i]) for i in idx]
            extra['meet'] = [1 if isinstance(c['meet'][i], int) and c['meet'][i] > 0 else 0 for i in idx]
            extra['brand'] = [1 if isinstance(c['brand'][i], int) and c['brand'][i] >= 0 else 0 for i in idx]
        elif d['id'] == 'restaurant':
            c = raw['cols']
            grid = 4194304
            idx = []
            for i in range(len(c['key'])):
                lo = c['gx'][i] / grid * 360 - 180
                la = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * c['gy'][i] / grid))))
                if ok(lo, la):
                    idx.append(i)
            extra['bucket'] = [c['price'][i] if isinstance(c['price'][i], int) else 5 for i in idx]
        elif d['id'] == 'office':
            c = raw['cols']
            idx = [i for i in range(len(c['key'])) if ok(c['lon'][i], c['lat'][i])]
            def rent(i):
                lo, hi = c['rmin'][i], c['rmax'][i]
                lo = lo if isinstance(lo, (int, float)) and lo > 0 else None
                hi = hi if isinstance(hi, (int, float)) and hi > 0 else None
                if lo is None and hi is None:
                    lp = (raw.get('legacyPrice') or {}).get(str(i))
                    if lp:
                        lo, hi = lp[0], lp[1]
                return None if lo is None and hi is None else ((lo or hi) + (hi or lo)) / 2
            extra['rent'] = [rent(i) for i in idx]
        elif d['id'] == 'grocery':
            F = {k: i for i, k in enumerate(raw['fields'])}
            brands = raw['brands']
            idx = [r for r in raw['rows'] if ok(r[F['lon']], r[F['lat']])]
            name = lambda r: brands[r[F['brand']]].get('name') if isinstance(r[F['brand']], int) and 0 <= r[F['brand']] < len(brands) else ''
            types = [t['id'] for t in raw['types']]
            extra['tier'] = ['up' if name(r) in UPMARKET else 'value' if name(r) == 'ถูกดี มีมาตรฐาน' else 'mass' for r in idx]
            extra['type'] = [types[r[F['type']]] if isinstance(r[F['type']], int) and 0 <= r[F['type']] < len(types) else '' for r in idx]
        if extra:
            for k, v in extra.items():
                if len(v) != len(pts):
                    sys.exit(f"{d['id']}: the profile reader holds {len(v)} records for {k}, the demo's reader {len(pts)}")
        out[d['id']] = {'lon': lon, 'lat': lat, 'sub': sub, 'meas': meas, 'extra': extra, 'nsub': max(1, len(subgroups))}
    return out


def condo_points(repo):
    lon, lat, p50 = [], [], []
    folder = os.path.join(repo, 'data', 'condo')
    for f in sorted(os.listdir(folder)):
        if not f.endswith('.json') or f == 'index.json':
            continue
        j = json.load(open(os.path.join(folder, f), encoding='utf-8'))
        F = {k: i for i, k in enumerate(j['fields'])}
        for r in j['rows']:
            lon.append(r[F['lon']]); lat.append(r[F['lat']]); p50.append(r[F['p50']])
    return {'lon': np.array(lon, dtype=float), 'lat': np.array(lat, dtype=float), 'p50': p50}


# ---------------------------------------------------------------------------------------------------------- personas
# Each profile: the group it belongs to, the rule that must hold on the records within 800 m (and the people figures
# within 1 km), its strength (ranked among the neighbourhoods where the rule holds) and the facts the page prints.
# The words, the week and what each profile uses live in js/personas.js; ids are shared.
def personas(n, p):
    """n: counts near (inside + 800 m) by dataset and kind; p: the people record at 1 km. → {group: [(id, strength, facts)]}"""
    k = lambda ds, sub=None: (n['k'].get(ds, {}).get('n', 0) if sub is None else n['k'].get(ds, {}).get('by', {}).get(sub, 0))
    out = defaultdict(list)
    H = n['hotel']
    # ---- residents
    if n['condo']['n'] >= 3 and n['condo']['p50'] is not None:
        pid = 'condo_upper' if n['condo']['p50'] >= CONDO_UPPER else 'condo'
        out['res'].append((pid, n['condo']['n'], [n['condo']['n'], round(n['condo']['p50'])]))
    he_plots = n['k'].get('housingestate', {}).get('m', 0)
    if k('housingestate') >= 2 and he_plots >= 100:
        out['res'].append(('estate', he_plots, [k('housingestate'), round(he_plots)]))
    formal = sum(k('school', s) for s in ('public', 'local', 'private', 'international'))
    priv = k('school', 'private') + k('school', 'international')
    stu = n['k'].get('school', {}).get('m', 0)
    if formal >= 2 and stu >= 1500:
        pid = 'family_private' if priv / formal >= 0.5 else 'family'
        out['res'].append((pid, stu, [formal, round(stu), priv, k('school', 'international')]))
    apt = k('hotel', 'apartment')
    if k('university') >= 1 and (apt >= 3 or (p.get('uni') or 0) >= 3000):
        out['res'].append(('student_rent', apt + (p.get('uni') or 0) / 1000, [k('university'), apt]))
    markets = k('shoppingcenter', 'market')
    temples = k('temple')
    if markets >= 1 and temples >= 1 and n['condo']['n'] < COMMUNITY_CONDO_MAX:
        out['res'].append(('local_community', markets + temples / 2 + n['grocery']['value'] / 4, [markets, temples, n['grocery']['value']]))
    # ---- visitors (overnight guests a year are the group's figure; day visitors have none)
    rooms_mid = H['rooms_by_tier'][1] + H['rooms_by_tier'][2] + H['rooms_by_tier'][3]
    if k('hotel') >= 3 and (H['meet'] >= 1 or (k('office') >= 3 and H['median'] is not None and H['median'] >= 1000)):
        out['gst'].append(('biz', rooms_mid + 50 * H['meet'], [k('hotel'), round(H['median']) if H['median'] else None, k('office'), H['meet']]))
    up_rooms = H['rooms_by_tier'][2] + H['rooms_by_tier'][3]
    lux = k('luxurybrands')
    if up_rooms >= 100 or lux >= 3:
        out['gst'].append(('upscale', up_rooms + 20 * lux, [H['places_by_tier'][2] + H['places_by_tier'][3], up_rooms, lux]))
    budget_rooms = H['rooms_budget']
    if budget_rooms >= 30:
        out['gst'].append(('budget', budget_rooms, [H['places_budget'], budget_rooms, round(H['median']) if H['median'] else None]))
    resort = H['rooms_by_group'].get('resort', 0)
    if resort >= 30:
        out['gst'].append(('resort', resort, [k('hotel', 'resort'), resort, round(H['median']) if H['median'] else None]))
    attr, arts = k('tourism'), k('arts')
    if attr >= 2 and (temples >= 2 or arts >= 1):
        out['gst'].append(('culture', attr + temples / 2 + 2 * arts, [attr, temples, arts]))
    malls = k('shoppingcenter', 'mall')
    community = k('shoppingcenter', 'community')
    if malls >= 1 or markets >= 2 or n.get('form') in ('market', 'walking', 'night'):
        out['gst'].append(('shopper', 3 * malls + markets + community, [malls, markets, community]))
    beds = n['k'].get('hospital', {}).get('m', 0)
    if beds >= 100:
        out['gst'].append(('patient', beds, [k('hospital'), round(beds)]))
    # ---- people who come to work and study (the parts of the people record within 1 km)
    off = p.get('off') or [0, 0]
    if k('office') >= 2 or off[0] >= 500:
        pid = 'office_prime' if n['office']['rent'] is not None and n['office']['rent'] >= OFFICE_PRIME else 'office'
        out['com'].append((pid, off[0] or k('office') * 100, [k('office'), round(n['office']['rent']) if n['office']['rent'] else None, off[0], off[1]]))
    gov = p.get('gov') or 0
    if k('governmentoffice') >= 3 or gov >= 300:
        out['com'].append(('gov', max(gov, k('governmentoffice') * 20), [k('governmentoffice'), gov]))
    fac = p.get('fac') or 0
    if fac >= 300 or k('industrialestate') >= 1:
        out['com'].append(('factory', fac, [k('factory'), fac, k('industrialestate')]))
    uni = p.get('uni') or 0
    if uni >= 1000 or k('university') >= 1:
        out['com'].append(('uni', uni or k('university') * 1000, [k('university'), uni]))
    stu1 = p.get('stu') or 0
    if stu1 >= 1000:
        out['com'].append(('school', stu1, [p.get('stuN', [0, 0])[0], stu1]))
    if beds >= 200:
        out['com'].append(('medical', beds, [k('hospital'), round(beds)]))
    shops = k('restaurant') + k('grocery')
    if malls >= 1 or shops >= 50:
        out['com'].append(('retail', shops + 20 * malls + 5 * markets, [malls, markets, k('restaurant')]))
    return out


# ---------------------------------------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--repo', default='.')
    ap.add_argument('--repos', required=True)
    ap.add_argument('--registry-points', default='')
    ap.add_argument('--crossing', default=None)
    ap.add_argument('--crossing-kinds', default='no-ferry', choices=('all', 'no-ferry'))
    ap.add_argument('--out', default=None)
    ap.add_argument('--built-on', default=date.today().isoformat())
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    out_dir = os.path.abspath(a.out or os.path.join(repo, 'data'))
    spec = importlib.util.spec_from_file_location('build_data', os.path.join(repo, 'scripts', 'build-data.py'))
    bd = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bd)

    nb = json.load(open(os.path.join(repo, 'data', 'neighborhoods.json'), encoding='utf-8'))
    rows, datasets = nb['rows'], nb['datasets']
    order = [r['id'] for r in rows]
    ds_by = {d['id']: d for d in datasets}
    outl = {str(f['properties']['id']): shape(f['geometry']) for f in json.load(open(os.path.join(repo, 'data', 'boundaries.geojson'), encoding='utf-8'))['features']}
    around = json.load(open(os.path.join(repo, 'data', 'around.json'), encoding='utf-8'))
    a_rows = around['rows'] if isinstance(around.get('rows'), dict) else {}

    core = readers(bd, a.repos, datasets)
    sub_ids = {d['id']: [s['id'] for s in d['subgroups']] for d in datasets}
    meas_of = {'hotel': 'rooms', 'school': 'students', 'hospital': 'beds', 'factory': 'workers', 'governmentoffice': 'staff', 'housingestate': 'plots'}
    agg = {}
    for d in datasets:
        if not d.get('aggregate'):
            continue
        path = os.path.join(a.registry_points, d['id'] + '.json') if a.registry_points else ''
        if path and os.path.exists(path):
            R = json.load(open(path, encoding='utf-8'))
            if len(R['points']) != d['located']:
                sys.exit(f"{d['id']}: {len(R['points'])} private points, the data says {d['located']} located")
            agg[d['id']] = {'lon': np.array([x[0] for x in R['points']], dtype=float), 'lat': np.array([x[1] for x in R['points']], dtype=float),
                            'sub': np.array([x[2] for x in R['points']], dtype=int), 'nsub': max(1, len(d['subgroups']))}
    condo = condo_points(repo)

    rivers = None
    if a.crossing:
        spec_b = importlib.util.spec_from_file_location('banks', os.path.join(repo, 'scripts', 'crossing', 'banks.py'))
        banks_mod = importlib.util.module_from_spec(spec_b)
        spec_b.loader.exec_module(banks_mod)
        rivers, crossing_meta = banks_mod.load(a.crossing, a.crossing_kinds)

    people = {}
    for i in order:
        path = os.path.join(repo, 'data', 'people', f'{i}.json')
        people[i] = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else None

    near = {}
    for r in rows:
        i = r['id']
        fwd = local(*r['ref'])
        g = polygonal(project(outl[i], fwd))
        minx, miny, maxx, maxy = outl[i].bounds
        bank = None
        if rivers is not None:
            b = banks_mod.Banks(rivers, lambda lo, la: fwd.transform(lo, la), g, outl[i].bounds)
            bank = b if b.has_river else None

        def within(P):
            m = (P['lon'] >= minx - PAD_DEG) & (P['lon'] <= maxx + PAD_DEG) & (P['lat'] >= miny - PAD_DEG) & (P['lat'] <= maxy + PAD_DEG)
            idx = np.nonzero(m)[0]
            if not len(idx):
                return idx
            x, y = fwd.transform(P['lon'][idx], P['lat'][idx])
            dist = shapely.distance(g, shapely.points(x, y))
            if bank is not None:
                dist = bank.measure(np.asarray(x), np.asarray(y), dist)[0]
            return idx[dist <= NEAR]

        K = {}
        hotel = {'rooms_by_tier': [0, 0, 0, 0], 'places_by_tier': [0, 0, 0, 0], 'rooms_by_group': Counter(), 'meet': 0, 'median': None,
                 'n_priced': 0, 'rooms_budget': 0, 'places_budget': 0}
        office = {'rent': None, 'n_rent': 0}
        rest = {'priced': 0, 'over300': 0, 'under100': 0, 'buckets': [0] * 6}
        grocery = {'up': 0, 'mass': 0, 'value': 0, 'big': 0, 'up_big': 0}
        for d in datasets:
            if d['id'] not in r['c']:
                continue  # out of scope: no key, never 0
            if d['id'] in core:
                P = core[d['id']]
            elif d['id'] in agg:
                P = agg[d['id']]
            else:
                # (park, temple without their private points) the count of data/around.json at 800 m, inside included
                ar = ((a_rows.get(i) or {}).get('a') or {}).get(d['id'])
                K[d['id']] = {'n': r['c'][d['id']] + (ar[1] if isinstance(ar, list) and len(ar) > 1 else 0), 'by': {}}
                continue
            idx = within(P)
            by = Counter(sub_ids[d['id']][int(P['sub'][j])] if 0 <= int(P['sub'][j]) < len(sub_ids[d['id']]) else 'other' for j in idx)
            entry = {'n': int(len(idx)), 'by': dict(by)}
            if d['id'] in meas_of and d['id'] in core:
                entry['m'] = float(sum(core[d['id']]['meas'][j] or 0 for j in idx))
            K[d['id']] = entry
            X = P.get('extra', {}) if isinstance(P, dict) else {}
            if d['id'] == 'hotel':
                prices = []
                for j in idx:
                    pr, rooms = X['price'][j], core['hotel']['meas'][j] or 0
                    grp = sub_ids['hotel'][int(P['sub'][j])]
                    hotel['rooms_by_group'][grp] += rooms
                    hotel['meet'] += X['meet'][j]
                    if pr is None:
                        continue
                    prices.append(pr)
                    t = sum(1 for c in TIERS if pr >= c)
                    hotel['rooms_by_tier'][t] += rooms
                    hotel['places_by_tier'][t] += 1
                    if t == 0 or grp in ('guesthouse', 'homestay'):
                        hotel['rooms_budget'] += rooms
                        hotel['places_budget'] += 1
                hotel['n_priced'] = len(prices)
                hotel['median'] = median(prices)
            elif d['id'] == 'office':
                rents = [X['rent'][j] for j in idx if X['rent'][j]]
                office = {'rent': median(rents), 'n_rent': len(rents)}
            elif d['id'] == 'restaurant':
                for j in idx:
                    b = X['bucket'][j]
                    rest['buckets'][b] += 1
                    if b < 5:
                        rest['priced'] += 1
                        rest['over300'] += b >= 2
                        rest['under100'] += b == 0
            elif d['id'] == 'grocery':
                for j in idx:
                    grocery[X['tier'][j]] += 1
                    if X['type'][j] in ('SUPERMARKET', 'HYPERMARKET', 'WHOLESALE'):
                        grocery['big'] += 1
                        grocery['up_big'] += X['tier'][j] == 'up'
        ci = within(condo)
        cp = [condo['p50'][j] for j in ci if condo['p50'][j]]
        near[i] = {'k': K, 'hotel': hotel, 'office': office, 'rest': rest, 'grocery': grocery,
                   'condo': {'n': int(len(ci)), 'p50': median(cp)}, 'form': r.get('form')}

    # ---- price readings and their levels (mid-rank among every neighbourhood that has the reading; trading sites read
    # against the neighbourhoods but are nobody's peer)
    peer = {r['id']: r.get('peer') is not False for r in rows}

    def reading(i):
        n = near[i]
        out = {}
        if n['hotel']['n_priced'] >= PRICE_MIN['hotel']:
            out['hotel'] = (n['hotel']['median'], n['hotel']['n_priced'])
        if n['condo']['n'] >= PRICE_MIN['condo'] and n['condo']['p50'] is not None:
            out['condo'] = (n['condo']['p50'], n['condo']['n'])
        if n['rest']['priced'] >= PRICE_MIN['rest']:
            out['rest'] = (round(100 * n['rest']['over300'] / n['rest']['priced'], 1), n['rest']['priced'])
        if n['office']['n_rent'] >= PRICE_MIN['office']:
            out['office'] = (n['office']['rent'], n['office']['n_rent'])
        sch = n['k'].get('school')
        if sch:
            formal = sum(sch['by'].get(s, 0) for s in ('public', 'local', 'private', 'international'))
            if formal >= PRICE_MIN['school']:
                out['school'] = (round(100 * (sch['by'].get('private', 0) + sch['by'].get('international', 0)) / formal, 1), formal)
        if n['grocery']['big'] >= PRICE_MIN['grocery']:
            out['grocery'] = (round(100 * n['grocery']['up_big'] / n['grocery']['big'], 1), n['grocery']['big'])
        lx = n['k'].get('luxurybrands')
        if lx is not None:
            out['lux'] = (lx['n'], lx['n'])
        return out

    readings = {i: reading(i) for i in order}
    pool = {c: [readings[i][c][0] for i in order if peer[i] and c in readings[i]] for c in PRICE_ORDER}
    price = {}
    for i in order:
        comp = {}
        for c, (v, cnt) in readings[i].items():
            if c == 'lux' and v == 0 and not any(x > 0 for x in pool['lux']):
                continue
            comp[c] = [round(v, 1) if isinstance(v, float) else v, cnt, round(mid_pct(v, pool[c]), 1)]
        # luxury points are read only where a neighbourhood has some (a zero says nothing of price where none exist)
        known = [x[2] for c, x in comp.items() if c != 'lux' or x[0] > 0]
        lv = round(sum(known) / len(known), 1) if len(known) >= PRICE_LEVEL_MIN else None
        price[i] = {'lv': lv, 'c': {c: comp[c] for c in PRICE_ORDER if c in comp}}

    # ---- scale: the three groups within 1 km (never added)
    scale = {}
    for i in order:
        rec = people[i]
        s = (rec or {}).get('s', {}).get(SCALE_AT) or {}
        scale[i] = [s.get('res'), s.get('gst'), s.get('com')]

    # ---- people who stand out: each profile ranked among the neighbourhoods where its rule holds
    pers = {i: personas(near[i], ((people[i] or {}).get('s', {}).get(SCALE_AT) or {})) for i in order}
    strength, held = defaultdict(list), Counter()
    for i in order:
        if not peer[i]:
            continue
        for grp, lst in pers[i].items():
            for pid, st, _f in lst:
                strength[POOL.get(pid, pid)].append(st)
                held[pid] += 1
    picks = {}
    for i in order:
        g_out = {}
        for grp in ('res', 'gst', 'com'):
            lst = []
            for pid, st, facts in pers[i].get(grp, []):
                pool_ = strength.get(POOL.get(pid, pid)) or [st]
                K = near[i]['k']
                uses = []
                for ds_, kind in USES.get(pid, []):
                    e = K.get(ds_)
                    if e is None:
                        continue  # out of the province's scope: never a 0
                    v = e['n'] if kind is None else e['by'].get(kind, 0)
                    if ds_ == 'park' and kind is None and v:
                        v = e['n']   # ไร่ of park ground
                    if v:
                        uses.append([ds_, kind, int(v)])
                lst.append([pid, round(mid_pct(st, pool_), 1), facts, uses[:USES_SHOWN]])
            lst.sort(key=lambda x: (-x[1], x[0]))
            if len(lst) > 1 and grp in LEAD_ORDER:
                near_top = [x for x in lst if x[1] >= lst[0][1] - LEAD_TIE]
                lead = min(near_top, key=lambda x: LEAD_ORDER[grp].index(x[0]))
                lst = [lead] + [x for x in lst if x is not lead]
            if lst:
                g_out[grp] = lst[:3]
        picks[i] = g_out

    # ---- likeness: mix, scale, price
    cover = {d['id']: [r for r in rows if d['id'] in r['c']] for d in datasets}
    dens = {r['id']: {d: (r['c'][d] / (r['areaM2'] / 1e6)) for d in r['c']} for r in rows}
    mean = {d: (sum(math.log1p(dens[r['id']][d]) for r in cover[d]) / len(cover[d]) if cover[d] else 0) for d in ds_by}
    vec = {i: {d: math.log1p(v) - mean[d] for d, v in dens[i].items()} for i in order}
    by_id = {r['id']: r for r in rows}

    def mix(a_, b_):
        A, B = vec[a_], vec[b_]
        shared = [d for d in A if d in B]
        if len(shared) < SIM_MIN_SHARED:
            return None
        both = sum(1 for d in shared if by_id[a_]['c'][d] > 0 and by_id[b_]['c'][d] > 0)
        dot = sum(A[d] * B[d] for d in shared)
        na, nb_ = math.sqrt(sum(A[d] ** 2 for d in shared)), math.sqrt(sum(B[d] ** 2 for d in shared))
        if not na or not nb_ or both < SIM_MIN_BOTH:
            return None
        return dot / (na * nb_)

    def scale_like(a_, b_):
        d = [abs(math.log10(1 + x) - math.log10(1 + y)) for x, y in zip(scale[a_], scale[b_]) if x is not None and y is not None]
        return None if not d else max(0.0, 1 - (sum(d) / len(d)) / SCALE_SPAN)

    def price_like(a_, b_):
        x, y = price[a_]['lv'], price[b_]['lv']
        return None if x is None or y is None else max(0.0, 1 - abs(x - y) / PRICE_SPAN)

    sim = {}
    for i in order:
        if not peer[i]:
            continue
        cand = []
        for j in order:
            if j == i or not peer[j]:
                continue
            m = mix(i, j)
            if m is None or m <= 0:
                continue
            s_ = scale_like(i, j)
            if s_ is None:
                continue
            p_ = price_like(i, j)
            parts = [m, s_] + ([p_] if p_ is not None else [])
            if min(parts) <= 0:
                continue
            allv = math.exp(sum(math.log(x) for x in parts) / len(parts))
            cand.append((allv, j, m, s_, p_))
        cand.sort(key=lambda x: (-x[0], x[1]))
        sim[i] = [[j, round(av, 3), round(m, 3), round(s_, 3), None if p_ is None else round(p_, 3)] for av, j, m, s_, p_ in cand[:SIM_KEEP]]

    # ---- near counts the page reads for the profiles' uses (by kind for the datasets that have kinds)
    out_rows = {}
    for i in order:
        out_rows[i] = {'sc': scale[i], 'pr': price[i], 'pe': picks[i], 'sim': sim.get(i, [])}
    meta = {
        'schema': SCHEMA, 'release': RELEASE, 'builtOn': a.built_on, 'near': NEAR, 'scaleAt': int(SCALE_AT),
        'distance': ({'th': 'ในย่านและไม่เกิน 800 ม. จากขอบ ฝั่งเดียวกับย่านวัดเส้นตรง อีกฝั่งแม่น้ำวัดผ่านสะพาน อุโมงค์ หรือรถไฟฟ้า (ไม่นับเรือข้ามฟาก)',
                      'en': 'inside and within 800 m of the edge: straight on the neighbourhood’s bank, across a river through a bridge, tunnel or metro line (ferries not counted)'}
                     if rivers is not None else {'th': 'ในย่านและไม่เกิน 800 ม. จากขอบ เส้นตรง', 'en': 'inside and within 800 m of the edge, straight line'}),
        'price': {'order': list(PRICE_ORDER), 'min': PRICE_MIN, 'levelMin': PRICE_LEVEL_MIN,
                  'pool': {c: len(pool[c]) for c in PRICE_ORDER}, 'upmarket': sorted(UPMARKET), 'tiers': list(TIERS),
                  'restBuckets': list(REST_BUCKETS)},
        'sim': {'keep': SIM_KEEP, 'minShared': SIM_MIN_SHARED, 'minBoth': SIM_MIN_BOTH, 'scaleSpan': SCALE_SPAN, 'priceSpan': PRICE_SPAN,
                'rule': 'geometric mean of mix (cosine of centred log density), scale (three groups within 1 km, log10) and price level'},
        'personas': dict(sorted(held.items())), 'pools': POOL, 'lead': {'tie': LEAD_TIE, 'order': {g: list(v) for g, v in LEAD_ORDER.items()}},
        'communityCondoMax': COMMUNITY_CONDO_MAX,
        'condoUpper': CONDO_UPPER, 'officePrime': OFFICE_PRIME, 'uses': {k: [list(x) for x in v] for k, v in USES.items()},
        'sources': {'neighborhoods': sha256_file(os.path.join(repo, 'data', 'neighborhoods.json')),
                    'boundaries': sha256_file(os.path.join(repo, 'data', 'boundaries.geojson')),
                    'around': sha256_file(os.path.join(repo, 'data', 'around.json')),
                    'registryPoints': sorted(agg), 'aroundFor': sorted(d['id'] for d in datasets if d.get('aggregate') and d['id'] not in agg)},
    }
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, 'profile.json')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'meta': meta, 'rows': out_rows}, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    lv = [p['lv'] for p in price.values() if p['lv'] is not None]
    print(f'profile.json {os.path.getsize(path)} bytes · price level for {len(lv)} of {len(order)} · personas {dict(meta["personas"])}', file=sys.stderr)


if __name__ == '__main__':
    main()
