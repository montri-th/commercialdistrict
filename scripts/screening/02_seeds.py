"""Step 2: seeds and everything measured at them.
Seed = a 200 m cell (UTM 47N, EPSG:32647) holding a point of the nine national commerce layers or a rail station.
Commerce layers: shopping centres (mall, community, outlet) · markets and retail venues (market, hoststore, other) · lodging ·
grocery · pharmacy · office · luxury brands · camera · fitness. Restaurants are left out: the dataset reaches 7 provinces only.
Lodging counts as evidence for types 'hotel' and 'guesthouse' only (owner 2026-11-25: “โรงแรม + เกสต์เฮาส์”).
Also here: counts of every layer within 400 / 800 m, distinct positions (~11 m) and layers within 400 m, the nearest outline
within 1 km, the province, and the registry's old queue rule (“เข้าคิวก่อน”, 800 m) at each seed."""
import json, os, pathlib, pickle, numpy as np
from scipy.spatial import cKDTree
from pyproj import Transformer
from shapely.geometry import shape, Point
from shapely import STRtree, transform as shp_transform
REPO = pathlib.Path(__file__).resolve().parents[2]
WORK = pathlib.Path(os.environ.get('SCREEN_WORK', '/tmp/citymeter-screening'))
LODGING_TYPES = ('hotel', 'guesthouse')
data = pickle.load(open(WORK / 'points.pkl', 'rb'))
utm = Transformer.from_crs('EPSG:4326', 'EPSG:32647', always_xy=True)
XY, META = {}, {}
for ds in data:
    P = data[ds]['P']
    lon = np.array([p[0] for p in P]); lat = np.array([p[1] for p in P])
    x, y = utm.transform(lon, lat)
    XY[ds] = np.c_[x, y]
    META[ds] = {'lon': lon, 'lat': lat, 'sg': np.array([p[2] if isinstance(p[2], int) else -1 for p in P]), 'key': [p[4] for p in P], 'name': [p[5] for p in P]}
SC, HSG = data['shoppingcenter']['subgroups'], data['hotel']['subgroups']
L = {'sc_centre': XY['shoppingcenter'][np.isin(META['shoppingcenter']['sg'], [SC.index(s) for s in ('mall', 'community', 'outlet')])],
     'sc_venue': XY['shoppingcenter'][np.isin(META['shoppingcenter']['sg'], [SC.index(s) for s in ('market', 'hoststore', 'other')])],
     'hotel_hotel': XY['hotel'][META['hotel']['sg'] == HSG.index('hotel')],
     'lodging': XY['hotel'][np.isin(META['hotel']['sg'], [HSG.index(s) for s in LODGING_TYPES])]}
for ds in ('office', 'grocery', 'pharmacy', 'restaurant', 'luxurybrands', 'camera', 'fitness', 'transit', 'university', 'hospital',
           'governmentoffice', 'school', 'factory', 'industrialestate'):
    L[ds] = XY[ds]
NAT = ['sc_centre', 'sc_venue', 'lodging', 'grocery', 'pharmacy', 'office', 'luxurybrands', 'camera', 'fitness']
cells = np.unique(np.floor(np.vstack([L[k] for k in NAT] + [L['transit']]) / 200.0).astype(np.int64), axis=0)
S = (cells + 0.5) * 200.0
F = {}
for R in (400, 800):
    for k, v in L.items():
        if len(v): F[f'{k}@{R}'] = cKDTree(v).query_ball_point(S, R, return_length=True).astype(np.int32)
CP = np.vstack([L[k] for k in NAT]); CK = np.concatenate([[i] * len(L[k]) for i, k in enumerate(NAT)]); CT = cKDTree(CP)
posN = np.zeros(len(S), np.int32); layN = np.zeros(len(S), np.int32)
for i, ix in enumerate(CT.query_ball_point(S, 400)):
    if ix:
        posN[i] = len({(a, b) for a, b in np.round(CP[ix] / 11.0).astype(np.int64)}); layN[i] = len(set(CK[ix].tolist()))
feats = json.load(open(REPO / 'data' / 'boundaries.geojson', encoding='utf-8'))['features']
ids = [f['properties']['id'] for f in feats]
polys = [shp_transform(shape(f['geometry']), lambda c: np.c_[utm.transform(c[:, 0], c[:, 1])]) for f in feats]
pts = [Point(x, y) for x, y in S]
near = np.full(len(S), -1, np.int32); dist = np.full(len(S), 1e9)
for si, pi in zip(*STRtree(polys).query(pts, predicate='dwithin', distance=1000)):
    d = polys[pi].distance(pts[si])
    if d < dist[si]: dist[si] = d; near[si] = pi
lon, lat = Transformer.from_crs('EPSG:32647', 'EPSG:4326', always_xy=True).transform(S[:, 0], S[:, 1])
pv = json.load(open(REPO / 'data' / 'provinces.geojson', encoding='utf-8'))['features']
PT = STRtree([shape(f['geometry']) for f in pv]); ll = [Point(a, b) for a, b in zip(lon, lat)]
prov = np.full(len(S), -1)
for si, pi in zip(*PT.query(ll, predicate='intersects')): prov[si] = pi
for si in np.where(prov < 0)[0]: prov[si] = int(PT.nearest(ll[si]))
# the registry's old rule “เข้าคิวก่อน” within 800 m: a centre or venue; >= 3 distinct positions among centres, venues, offices and hotels
# of type hotel; >= 2 of those 4 groups, or >= 3 venues (positions on an ~11 m grid; same-name de-duplication within 100 m not applied)
G4 = ['sc_centre', 'sc_venue', 'office', 'hotel_hotel']
P4 = np.vstack([L[k] for k in G4]); T4 = cKDTree(P4)
pos4 = np.array([len({(a, b) for a, b in np.round(P4[ix] / 11.0).astype(np.int64)}) if ix else 0 for ix in T4.query_ball_point(S, 800)])
types4 = sum((F[f'{k}@800'] > 0).astype(int) for k in G4)
v1 = ((F['sc_centre@800'] + F['sc_venue@800']) >= 1) & (pos4 >= 3) & ((types4 >= 2) | (F['sc_venue@800'] >= 3))
np.savez_compressed(WORK / 'seeds.npz', S=S, lon=lon, lat=lat, near=near, dist=dist, posN=posN, layN=layN, prov=prov, v1=v1, pos4=pos4, **F)
pickle.dump({'L': L, 'META': META, 'polys_utm': polys, 'ids': ids}, open(WORK / 'layers.pkl', 'wb'))
print('seeds', len(S), '· within 1 km of an outline', int((dist < 1e9).sum()), '· inside', int((dist == 0).sum()))
