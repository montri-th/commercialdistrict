"""Step 4: centres — passing seeds kept when strongest within 600 m (score, then distinct positions; stable order) —
for scores >= 6, 8 and 10 and for the old rule (ranked by distinct positions)."""
import os, pathlib, pickle, numpy as np
from scipy.spatial import cKDTree
WORK = pathlib.Path(os.environ.get('SCREEN_WORK', '/tmp/citymeter-screening'))
Z = dict(np.load(WORK / 'seeds.npz')); S, dist, posN, v1 = Z['S'], Z['dist'], Z['posN'], Z['v1']
score = np.load(WORK / 'score.npz')['score']
def centres(mask, key, radius=600):
    idx = np.where(mask)[0]; order = idx[np.argsort(-key[idx], kind='stable')]
    sub = cKDTree(S[idx]); at = {i: j for j, i in enumerate(idx)}; supp = np.zeros(len(idx), bool); out = []
    for i in order:
        if supp[at[i]]: continue
        out.append(i)
        for k in sub.query_ball_point(S[i], radius): supp[k] = True
    return np.array(out, dtype=np.int64)
res = {}
for th in (6, 8, 10):
    c = centres(score >= th, score.astype(np.int64) * 10000 + posN)
    res[th] = {'centres': c.tolist(), 'new': c[dist[c] > 1000].tolist()}
    print(f'>= {th}: centres {len(c)} · existing {int((dist[c] <= 150).sum())} · extension or merge {int(((dist[c] > 150) & (dist[c] <= 1000)).sum())} · new {len(res[th]["new"])}')
c = centres(v1, posN.astype(np.int64))
res['v1'] = {'centres': c.tolist(), 'new': c[dist[c] > 1000].tolist()}
print(f'old rule: centres {len(c)} · new {len(res["v1"]["new"])}')
pickle.dump(res, open(WORK / 'centres.pkl', 'wb'))
