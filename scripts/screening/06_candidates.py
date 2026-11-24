"""Step 6: the new centres (farther than 1 km from every outline) with score >= 6, ranked by score then distinct positions;
their components, roles (registry codes; ties in the order of «8 บทบาทย่าน»; T1 rail is context, not a role), anchor names within
400 m (shopping centres and markets, rail stations, universities, else hotels and guesthouses), a registry screening name within
800 m, and the per-component shares in cores and background."""
import collections, json, os, pathlib, pickle, numpy as np
from scipy.spatial import cKDTree
from pyproj import Transformer
from sklearn.metrics import roc_auc_score
REPO = pathlib.Path(__file__).resolve().parents[2]
WORK = pathlib.Path(os.environ.get('SCREEN_WORK', '/tmp/citymeter-screening'))
Z = dict(np.load(WORK / 'seeds.npz')); S, dist, prov, posN, layN = Z['S'], Z['dist'], Z['prov'], Z['posN'], Z['layN']
SC_ = np.load(WORK / 'score.npz'); score, best = SC_['score'], SC_['best']
C = pickle.load(open(WORK / 'components.pkl', 'rb')); data = pickle.load(open(WORK / 'points.pkl', 'rb'))
pf = json.load(open(REPO / 'data' / 'provinces.geojson', encoding='utf-8'))['features']
codes = [f['properties']['id'] for f in pf]; pth = {f['properties']['id']: f['properties']['name'] for f in pf}
pos = best[best >= 0]; neg = np.where(dist > 1000)[0]
CID = {k: k.split(' ')[0] for k in C}
comp = []
for k, (cond, pts) in C.items():
    a, b = cond[pos].mean(), cond[neg].mean()
    comp.append({'id': CID[k], 'th': k.split(' ', 1)[1], 'points': pts, 'n395': int(cond[pos].sum()), 'nBackground': int(cond[neg].sum()),
                 'cores': int(len(pos)), 'background': int(len(neg)), 'share395': round(float(a), 4), 'shareBackground': round(float(b), 4),
                 'lift': round(float(a / b), 1) if b > 0 else None})
auc = roc_auc_score(np.r_[np.ones(len(pos)), np.zeros(len(neg))], np.r_[score[pos], score[neg]])
ROLE = {'retail_trade': ['A1', 'A2', 'A3', 'P1'], 'office_business': ['O1', 'O2'], 'housing_daily_life': ['D1', 'D2'],
        'hospitality_tourism_culture': ['H1', 'H2'], 'education': ['U1'], 'government_public_services': ['G1']}
fired = {CID[k]: v[0] for k, v in C.items()}; pts = {CID[k]: v[1] for k, v in C.items()}
def roles_at(i):
    sc = {r: sum(pts[c] for c in cs if fired[c][i]) for r, cs in ROLE.items()}
    return [r for r, v in sorted(sc.items(), key=lambda kv: -kv[1]) if v > 0]
utm = Transformer.from_crs('EPSG:4326', 'EPSG:32647', always_xy=True)
SCg, HSG = data['shoppingcenter']['subgroups'], data['hotel']['subgroups']
named = {}
for ds, keep in (('shoppingcenter', lambda sg: isinstance(sg, int) and 0 <= sg < len(SCg) and SCg[sg] in ('mall', 'community', 'outlet', 'market', 'hoststore')),
                 ('transit', lambda sg: True), ('university', lambda sg: True),
                 ('hotel', lambda sg: isinstance(sg, int) and HSG[sg] in ('hotel', 'guesthouse'))):
    P = [p for p in data[ds]['P'] if keep(p[2]) and p[5]]
    x, y = utm.transform([p[0] for p in P], [p[1] for p in P])
    named[ds] = (cKDTree(np.c_[x, y]), [p[5] for p in P])
def anchors(i, R=400):
    out = []
    for ds in ('shoppingcenter', 'transit', 'university', 'hotel'):
        if ds == 'hotel' and out: break
        t, nm = named[ds]
        for kk in sorted(t.query_ball_point(S[i], R), key=lambda kk: np.hypot(*(t.data[kk] - S[i]))):
            if nm[kk] not in out: out.append(nm[kk])
    return out[:3]
reg = pickle.load(open(WORK / 'regscreen.pkl', 'rb'))
RT = None
if reg:
    x, y = utm.transform([r[3] for r in reg], [r[4] for r in reg]); RT = cKDTree(np.c_[x, y])
res = pickle.load(open(WORK / 'centres.pkl', 'rb'))
cands = []
for i in sorted(res[6]['new'], key=lambda i: (-score[i], -posN[i])):
    near_name = None
    if RT is not None:
        d, k = RT.query(S[i], distance_upper_bound=800)
        near_name = reg[k][1] if np.isfinite(d) else None
    cands.append({'seed': int(i), 'score': int(score[i]), 'province': codes[prov[i]], 'provinceTh': pth[codes[prov[i]]],
                  'lat': round(float(Z['lat'][i]), 5), 'lon': round(float(Z['lon'][i]), 5), 'positions400': int(posN[i]), 'layers400': int(layN[i]),
                  'lodging400': int(Z['lodging@400'][i]), 'components': [c for c in pts if fired[c][i]], 'roles': roles_at(i), 'anchors': anchors(i),
                  'registryNameWithin800m': near_name, 'singleSiteRisk': bool(posN[i] < 5), 'oldRule': bool(Z['v1'][i])})
for n, c in enumerate(cands, 1): c['rank'] = n
json.dump({'auc': round(float(auc), 4), 'positives': int(len(pos)), 'background': int(len(neg)), 'seeds': int(len(S)), 'components': comp, 'candidates': cands},
          open(WORK / 'candidates.json', 'w', encoding='utf-8'), ensure_ascii=False)
for th in (6, 8, 10):
    cc = [c for c in cands if c['score'] >= th]
    print(f'>= {th}: {len(cc)} new candidates in {len({c["province"] for c in cc})} provinces · first roles', dict(collections.Counter(c['roles'][0] if c['roles'] else '-' for c in cc)))
