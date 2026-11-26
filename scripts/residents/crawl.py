"""
CityMETER · Commercial District — read-only reader of CityMETER production's Building V4 and population (scripts/residents/).

The residents method of «รอบศูนย์นี้» (montri-th/shoppingcenter, variant A): every building of a subdistrict takes the
subdistrict's registered population in proportion to its floor area (footprint × estimated floors from the vector tiles;
production's own GFA weight for the buildings drawn from OpenStreetMap parts), over production's own GFA total of the
subdistrict. Requests are paced (RES_PACE seconds, 0.25 by default), cached by the SHA-256 of the URL in RES_CACHE — a
folder outside the repository, never committed — and logged in RES_CACHE/fetch_log.tsv (time, status, bytes, SHA-256, URL).
Nothing here writes to production.
"""
import hashlib, json, math, os, sys, time, threading, urllib.request
import mapbox_vector_tile
from shapely.geometry import Polygon, MultiPolygon, shape
from shapely.ops import transform
import shapely

API = 'https://landometer.com/api/v2/citymeter-v3'
Z = 15
EXT = 4096
CACHE = os.environ.get('RES_CACHE') or ''   # required: set by build-residents.py --cache (outside the repository)
PACE = float(os.environ.get('RES_PACE', '0.25'))   # seconds between requests
_last = [0.0]
_lock = threading.Lock()


def get(url, binary=False, tries=4):
    if not CACHE:
        raise SystemExit('RES_CACHE is not set: give build-residents.py --cache <a folder outside the repository>')
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.sha256(url.encode()).hexdigest()
    path = os.path.join(CACHE, key + ('.bin' if binary else '.json'))
    if os.path.exists(path):
        b = open(path, 'rb').read()
        return b if binary else json.loads(b)
    for t in range(tries):
        with _lock:
            slot = max(time.time(), _last[0] + PACE)
            _last[0] = slot
        wait = slot - time.time()
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={'Accept-Encoding': 'identity', 'User-Agent': 'citymeter-commercialdistrict-build (read only)'})
            with urllib.request.urlopen(req, timeout=60) as r:
                b = r.read()
                code = r.status
            break
        except Exception as e:
            if t == tries - 1:
                raise
            time.sleep(2 * (t + 1))
    tmp = path + f'.tmp{threading.get_ident()}'
    open(tmp, 'wb').write(b)
    os.replace(tmp, path)
    with _lock, open(os.path.join(CACHE, 'fetch_log.tsv'), 'a') as f:
        f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S%z')}\t{code}\t{len(b)}\t{hashlib.sha256(b).hexdigest()}\t{url}\n")
    return b if binary else json.loads(b)


def lonlat_to_tile(lon, lat, z=Z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    la = math.radians(lat)
    y = (1 - math.log(math.tan(la) + 1 / math.cos(la)) / math.pi) / 2 * n
    return x, y


def tile_to_lonlat(px, py, z=Z):
    n = 2 ** z
    lon = px / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * py / n))))
    return lon, lat


def merc(lon, lat):
    x = lon * 20037508.342789244 / 180
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * 6378137
    return x, y


def tile_merc_bounds(x, y, z=Z):
    lon0, lat1 = tile_to_lonlat(x, y, z)
    lon1, lat0 = tile_to_lonlat(x + 1, y + 1, z)
    a = merc(lon0, lat0); b = merc(lon1, lat1)
    return (a[0], a[1], b[0], b[1])


def province_tables(prov_id):
    base = get(f'{API}/base/info/lv1/{prov_id}')['value']
    bld = get(f'{API}/building/info/lv1/{prov_id}?currentDetailType=S&version=V4')['value']['subdistrictDatas']
    sds = {}
    for s in base['subdistrictInfos']:
        row = (bld.get(s['id']) or {}).get('rows') or [None]
        row = row[0]
        sds[s['id']] = {'code': s['code'], 'name': s['nameTh'], 'extent': s['extent'],
                        'gfa': row['area'] if row else None, 'pop': row['popCount'] if row else None, 'count': row['count'] if row else None}
    return sds


def buildings(x, y, sd_id, parts='hide'):
    """Buildings of one subdistrict in one z15 tile whose centroid falls in the tile proper: [(lon, lat, gfa_m2)]."""
    q = f'inTileType=SUBDISTRICT&inTileId={sd_id}&version=V4' + ('&hideWithParts=true' if parts == 'hide' else '')
    b = get(f'{API}/building/detailMvt/{Z}/{x}/{y}?{q}', binary=True)
    if not b:
        return [], 0
    t = mapbox_vector_tile.decode(b, default_options={'y_coord_down': True})
    out, nofloor = [], 0
    for lay in t.values():
        for f in lay['features']:
            g = f['geometry']
            polys = []
            if g['type'] == 'Polygon':
                polys = [g['coordinates']]
            elif g['type'] == 'MultiPolygon':
                polys = g['coordinates']
            else:
                continue
            geom = MultiPolygon([Polygon(p[0], p[1:]) for p in polys]) if len(polys) > 1 else Polygon(polys[0][0], polys[0][1:])
            if geom.is_empty or geom.area <= 0:
                continue
            c = geom.centroid
            if not (0 <= c.x < EXT and 0 <= c.y < EXT):
                continue
            fl = f['properties'].get('estimated_floor')
            if fl is None:
                nofloor += 1
                continue
            lon, lat = tile_to_lonlat(x + c.x / EXT, y + c.y / EXT)
            # ground area: tile units → Mercator metres → ground (× cos² lat)
            unit = 40075016.685578488 / (2 ** Z) / EXT
            area = geom.area * unit * unit * math.cos(math.radians(lat)) ** 2
            out.append((lon, lat, area * float(fl), sd_id))
    return out, nofloor


def parts_buildings(sd_id):
    """Buildings drawn from OSM parts in one subdistrict: {buildingId: (lon, lat)} — the centroid of the union of its parts."""
    v = get(f'{API}/building/parts?inTileType=SUBDISTRICT&inTileId={sd_id}&version=V4')['value'] or []
    geoms = {}
    for p in v:
        g = shape(json.loads(p['geometry']))
        geoms.setdefault(p['buildingId'], []).append(g)
    out = {}
    for bid, gs in geoms.items():
        u = shapely.union_all(gs)
        c = u.centroid
        out[bid] = (c.x, c.y)
    return out


def gfa_of(bid):
    """Production's GFA weight of a building (used for the buildings drawn from parts)."""
    v = get(f'{API}/building/detail?rowId={bid}&version=V4')['value']
    return float(v['gfaWeight']), v
