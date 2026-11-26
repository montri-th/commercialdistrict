"""Step 3: the province percentile (ties ranked lowest), the core of each neighbourhood and the 17-component score."""
import json, os, pathlib, pickle, numpy as np
from sklearn.metrics import roc_auc_score
REPO = pathlib.Path(__file__).resolve().parents[2]
WORK = pathlib.Path(os.environ.get('SCREEN_WORK', '/tmp/citymeter-screening'))
Z = dict(np.load(WORK / 'seeds.npz')); near, dist, posN, layN, prov = Z['near'], Z['dist'], Z['posN'], Z['layN'], Z['prov']
NB = len(json.load(open(REPO / 'data' / 'boundaries.geojson', encoding='utf-8'))['features'])
# share of the other seeds of the province with strictly fewer distinct positions
pctN = np.zeros(len(posN))
for p in np.unique(prov):
    ix = np.where(prov == p)[0]; sv = np.sort(posN[ix])
    pctN[ix] = np.searchsorted(sv, posN[ix], side='left') / max(1, len(ix) - 1)
# core: seeds count only for their nearest outline (within 150 m); inside before outside, then most layers, then most positions,
# then the lowest seed index
key = layN.astype(np.int64) * 100000 + posN
best = np.full(NB, -1)
for si in np.where(dist <= 150)[0]:
    p = near[si]; b = best[p]
    if b < 0: best[p] = si; continue
    a_in, b_in = dist[si] == 0, dist[b] == 0
    if (a_in and not b_in) or (a_in == b_in and key[si] > key[b]): best[p] = si
C = {
 'A1 ศูนย์การค้า ≥1 (400 ม.)': (Z['sc_centre@400'] >= 1, 3),
 'A2 ตลาด/พื้นที่ค้าปลีก ≥1 (400 ม.)': (Z['sc_venue@400'] >= 1, 2),
 'A3 ตลาด/พื้นที่ค้าปลีก ≥3 (800 ม.)': (Z['sc_venue@800'] >= 3, 1),
 'H1 ที่พัก ≥3 (400 ม.)': (Z['lodging@400'] >= 3, 2),
 'H2 ที่พัก ≥10 (400 ม.)': (Z['lodging@400'] >= 10, 2),
 'O1 สำนักงาน ≥1 (400 ม.)': (Z['office@400'] >= 1, 1),
 'O2 สำนักงาน ≥3 (400 ม.)': (Z['office@400'] >= 3, 1),
 'T1 สถานีราง ≥1 (800 ม.)': (Z['transit@800'] >= 1, 2),
 'U1 มหาวิทยาลัย ≥1 (800 ม.)': (Z['university@800'] >= 1, 1),
 'D1 ร้านค้าปลีกของใช้ ≥3 (400 ม.)': (Z['grocery@400'] >= 3, 1),
 'D2 ร้านยา ≥1 (400 ม.)': (Z['pharmacy@400'] >= 1, 1),
 'P1 แบรนด์หรู/ร้านกล้อง/ฟิตเนส ≥1 (400 ม.)': ((Z['luxurybrands@400'] + Z['camera@400'] + Z['fitness@400']) >= 1, 1),
 'G1 หน่วยงานรัฐ ≥1 (400 ม.)': (Z['governmentoffice@400'] >= 1, 1),
 'M1 ชั้นข้อมูลการค้า ≥3 ชั้น (400 ม.)': (layN >= 3, 1),
 'M2 ชั้นข้อมูลการค้า ≥5 ชั้น (400 ม.)': (layN >= 5, 1),
 'K1 ความหนาแน่นติด 10% บนของจังหวัด': (pctN >= 0.90, 2),
 'K2 ความหนาแน่นติด 3% บนของจังหวัด': (pctN >= 0.97, 1),
}
score = sum(c.astype(int) * pts for c, pts in C.values())
np.savez_compressed(WORK / 'score.npz', score=score, pctN=pctN, best=best)
pickle.dump({k: (v[0], v[1]) for k, v in C.items()}, open(WORK / 'components.pkl', 'wb'))
pos = best[best >= 0]; neg = np.where(dist > 1000)[0]
auc = roc_auc_score(np.r_[np.ones(len(pos)), np.zeros(len(neg))], np.r_[score[pos], score[neg]])
print('seeds', len(posN), '· cores', len(pos), '· without a core', int((best < 0).sum()), '· background', len(neg), '· AUC', round(auc, 4), '· max', int(score.max()))
