"""Step 9: the review rows for the queue (score >= SCREEN_QUEUE, default 10, owner 2026-11-25) with a stratified sample of
SCREEN_SAMPLE (default 40): half Bangkok + the 5 surrounding provinces, half the rest; within each, proportional to score bands
10-11 / 12-13 / 14+ (largest remainder), random with SCREEN_SEED (default 20261125). Writes CSV + JSON into SCREEN_WORK only
(spreadsheets never enter this repository)."""
import collections, csv, hashlib, json, os, pathlib, pickle, numpy as np
from shapely import STRtree
from shapely.geometry import Point
REPO = pathlib.Path(__file__).resolve().parents[2]
WORK = pathlib.Path(os.environ.get('SCREEN_WORK', '/tmp/citymeter-screening'))
QUEUE, SAMPLE, SEED = int(os.environ.get('SCREEN_QUEUE', '10')), int(os.environ.get('SCREEN_SAMPLE', '40')), int(os.environ.get('SCREEN_SEED', '20261125'))
DATE = os.environ.get('SCREEN_DATE', '2026-11-25')
Z = dict(np.load(WORK / 'seeds.npz')); S = Z['S']
LY = pickle.load(open(WORK / 'layers.pkl', 'rb')); polys, ids = LY['polys_utm'], LY['ids']
rows = {r['id']: r for r in json.load(open(REPO / 'data' / 'neighborhoods.json', encoding='utf-8'))['rows']}
C = [c for c in json.load(open(WORK / 'candidates.json', encoding='utf-8'))['candidates'] if c['score'] >= QUEUE]
ROLE_TH = {'retail_trade': 'จับจ่ายและการค้า', 'office_business': 'สำนักงานและธุรกิจ', 'housing_daily_life': 'อยู่อาศัยและชีวิตประจำวัน',
           'hospitality_tourism_culture': 'ที่พัก ท่องเที่ยว และวัฒนธรรม', 'education': 'การศึกษา', 'government_public_services': 'ราชการและบริการสาธารณะ'}
METRO = {'BKK', 'NBI', 'SPK', 'PTE', 'SKN', 'NPT'}
tree = STRtree(polys); out = []
for n, c in enumerate(C, 1):
    i = c['seed']; p = Point(*S[i]); j = int(tree.nearest(p)); cx, cy = np.floor(S[i] / 200.0).astype(int)
    out.append({'rank': n, 'id': f'SC-{cx}-{cy}', 'province': c['province'], 'provinceTh': c['provinceTh'], 'metro': c['province'] in METRO, 'score': c['score'],
                'components': ' '.join(c['components']), 'anchors': ' · '.join(c['anchors'][:3]), 'role': ROLE_TH.get(c['roles'][0], c['roles'][0]) if c['roles'] else '',
                'positions400': c['positions400'], 'layers400': c['layers400'], 'hotelGuesthouse400': c['lodging400'], 'oldRule': c['oldRule'],
                'nearestId': ids[j], 'nearestName': rows[ids[j]]['name'], 'nearestM': int(round(polys[j].distance(p))),
                'registryNameWithin800m': c['registryNameWithin800m'] or '', 'lat': c['lat'], 'lon': c['lon']})
rng = np.random.default_rng(SEED)
band = lambda s: '10-11' if s <= 11 else ('12-13' if s <= 13 else '14+')
sample = set()
for region in (True, False):
    grp = [r for r in out if r['metro'] == region]; half = SAMPLE // 2
    bands = collections.defaultdict(list)
    for r in grp: bands[band(r['score'])].append(r)
    quota = {b: half * len(v) / len(grp) for b, v in bands.items()}; take = {b: int(q) for b, q in quota.items()}
    for b in sorted(quota, key=lambda b: -(quota[b] - int(quota[b])))[:half - sum(take.values())]: take[b] += 1
    for b, v in sorted(bands.items()):
        sample.update(v[k]['id'] for k in rng.choice(len(v), size=take[b], replace=False))
for r in out: r['sample'] = r['id'] in sample
HDR = ['ลำดับ', 'รหัสผู้สมัคร', 'ตัวอย่างรอบแรก', 'จังหวัด', 'คะแนน', 'ข้อที่ผ่าน', 'ชื่อสถานที่ใน 400 ม.', 'บทบาทแรก', 'ตำแหน่งการค้าใน 400 ม.',
       'ชั้นการค้าใน 400 ม.', 'โรงแรมและเกสต์เฮาส์ใน 400 ม.', 'ผ่านเกณฑ์เดิมด้วย', 'ย่านเดิมที่ใกล้ที่สุด', 'ห่างย่านเดิม (ม.)', 'ชื่อในทะเบียนใน 800 ม.',
       'ละติจูด', 'ลองจิจูด', 'Google Maps', 'Street View', 'OpenStreetMap',
       'ผลตรวจ ChatGPT', 'ชื่อย่านที่เสนอ', 'หลักฐาน', 'เหตุผล', 'ผู้ตรวจ', 'วันที่ตรวจ', 'พี่ตัดสิน', 'หมายเหตุ']
def line(r):
    la, lo = f"{r['lat']:.5f}", f"{r['lon']:.5f}"
    return [r['rank'], r['id'], 'ใช่' if r['sample'] else '', r['provinceTh'], r['score'], r['components'], r['anchors'], r['role'], r['positions400'],
            r['layers400'], r['hotelGuesthouse400'], 'ใช่' if r['oldRule'] else 'ไม่', f"{r['nearestName']} ({r['nearestId']})", r['nearestM'], r['registryNameWithin800m'],
            la, lo, f'https://www.google.com/maps/search/?api=1&query={la},{lo}', f'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={la},{lo}',
            f'https://www.openstreetmap.org/?mlat={la}&mlon={lo}#map=17/{la}/{lo}', '', '', '', '', '', '', '', '']
NAME = f'02-CityMETER__neighbourhood-candidate-review-rows__v1__{DATE}'
with open(WORK / f'{NAME}.csv', 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f, lineterminator='\n'); w.writerow(HDR)
    for r in out: w.writerow(line(r))
meta = {'documentId': 'citymeter-neighbourhood-candidate-review-rows', 'version': '1', 'date': DATE, 'method': json.load(open(WORK / 'facts.json', encoding='utf-8'))['method'],
        'threshold': QUEUE, 'candidates': len(out),
        'sample': {'size': SAMPLE, 'seed': SEED, 'strata': 'region (Bangkok + NBI SPK PTE SKN NPT vs other provinces, 20 each) x score band (10-11, 12-13, 14+), proportional, largest remainder'},
        'idsSha256': hashlib.sha256('\n'.join(r['id'] for r in out).encode()).hexdigest(), 'columns': HDR,
        'dropdowns': {'ผลตรวจ ChatGPT': ['เป็นย่านใหม่', 'เป็นส่วนของย่านเดิม', 'ไม่ใช่ย่าน', 'ไม่แน่ใจ'], 'พี่ตัดสิน': ['รับเป็นย่านใหม่', 'รวมกับย่านเดิม', 'ไม่ใช่ย่าน', 'ตรวจเพิ่ม']},
        'rows': out}
json.dump(meta, open(WORK / f'{NAME}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('rows', len(out), '· sample', len(sample), '· ids SHA-256', meta['idsSha256'][:16])
