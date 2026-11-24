"""Step 7: the figures of the screening (facts.json): seeds, cores, background, AUC, found and centres per threshold and for the
old rule, per-group results, the restaurant check within the 7 provinces the dataset reaches, and the queue candidates."""
import collections, hashlib, json, os, pathlib, pickle, numpy as np
from sklearn.metrics import roc_auc_score
REPO = pathlib.Path(__file__).resolve().parents[2]
WORK = pathlib.Path(os.environ.get('SCREEN_WORK', '/tmp/citymeter-screening'))
QUEUE = int(os.environ.get('SCREEN_QUEUE', '10'))
sha = lambda p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
Z = dict(np.load(WORK / 'seeds.npz')); S, dist, prov = Z['S'], Z['dist'], Z['prov']
SC_ = np.load(WORK / 'score.npz'); score, best, pctN = SC_['score'], SC_['best'], SC_['pctN']
G = json.load(open(WORK / 'groups.json', encoding='utf-8')); CEN = pickle.load(open(WORK / 'centres.pkl', 'rb'))
CAND = json.load(open(WORK / 'candidates.json', encoding='utf-8'))
nb = json.load(open(REPO / 'data' / 'neighborhoods.json', encoding='utf-8'))
codes = [f['properties']['id'] for f in json.load(open(REPO / 'data' / 'provinces.geojson', encoding='utf-8'))['features']]
pos = best[best >= 0]; neg = np.where(dist > 1000)[0]
LODGING = os.environ.get('SCREEN_LODGING', 'hotel,guesthouse,resort').split(',')
F = {'method': 'lodging evidence = ' + ' + '.join(LODGING) + '; seeds from the nine national commerce layers and rail stations; province percentile with ties ranked lowest; cores by the nine layers, nearest outline only; role ties in registry order',
     'inputs': {'data/neighborhoods.json': sha(REPO / 'data' / 'neighborhoods.json'), 'data/boundaries.geojson': sha(REPO / 'data' / 'boundaries.geojson'),
                'registryExport': sha(os.environ['SCREEN_REGISTRY_XLSX']) if os.environ.get('SCREEN_REGISTRY_XLSX') else None},
     'seeds': int(len(S)), 'seedsWithin150': int((dist <= 150).sum()), 'background': int(len(neg)), 'positives': int(len(pos)), 'dataSees': int((best >= 0).sum()),
     'auc': round(float(roc_auc_score(np.r_[np.ones(len(pos)), np.zeros(len(neg))], np.r_[score[pos], score[neg]])), 4), 'maxScoreObserved': int(score.max())}
def stats(c):
    c = np.array(c, dtype=np.int64)
    return {'centres': int(len(c)), 'onExisting': int((dist[c] <= 150).sum()), 'nearExisting': int(((dist[c] > 150) & (dist[c] <= 1000)).sum()),
            'new': int((dist[c] > 1000).sum()), 'newProvinces': len({codes[prov[i]] for i in c if dist[i] > 1000})}
F['v1'] = {'found': G['all']['v1'], 'recall': round(G['all']['v1'] / G['all']['n'], 3), **stats(CEN['v1']['centres'])}
F['thresholds'] = [{'threshold': th, 'found': G['all'][f's{th}'], 'recall': round(G['all'][f's{th}'] / G['all']['n'], 3), **stats(CEN[th]['centres'])} for th in (6, 8, 10)]
F['groups'] = G
F['components'] = CAND['components']
q = [c for c in CAND['candidates'] if c['score'] >= QUEUE]
F['queue'] = {'threshold': QUEUE, 'candidates': len(q), 'byProvince': dict(collections.Counter(c['province'] for c in q).most_common()),
              'roleFirst': dict(collections.Counter(c['roles'][0] if c['roles'] else '-' for c in q).most_common()),
              'singleSiteRisk': sum(c['singleSiteRisk'] for c in q), 'registryNameNear': sum(1 for c in q if c['registryNameWithin800m']),
              'oldRuleToo': sum(c['oldRule'] for c in q)}
cov = set(next(d for d in nb['datasets'] if d['id'] == 'restaurant')['byProvince'])
inc = np.array([codes[p] in cov for p in prov]); f1 = Z['restaurant@400'] >= 10; pc, nc = pos[inc[pos]], neg[inc[neg]]
F['restaurantCheck'] = {'provinces': sorted(cov), 'cores': int(len(pc)), 'coresWith': int(f1[pc].sum()), 'background': int(len(nc)), 'backgroundWith': int(f1[nc].sum()),
                        'lift': round(float(f1[pc].mean() / f1[nc].mean()), 2)}
F['kPass'] = {'k1': int((pctN >= .9).sum()), 'k2': int((pctN >= .97).sum())}
json.dump(F, open(WORK / 'facts.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({k: F[k] for k in ('seeds', 'positives', 'background', 'auc', 'v1', 'thresholds', 'queue')}, ensure_ascii=False))
