"""Step 5: which of the 395 neighbourhoods each threshold finds, by group; and the names in the registry's screening tabs
(«คัดย่านการค้า», «ย่านที่พัก 268») when a private export of the registry is given in SCREEN_REGISTRY_XLSX (never committed).
Found = a passing seed that counts for the neighbourhood (its nearest outline) inside it or within 150 m."""
import collections, json, os, pathlib, pickle, numpy as np
REPO = pathlib.Path(__file__).resolve().parents[2]
WORK = pathlib.Path(os.environ.get('SCREEN_WORK', '/tmp/citymeter-screening'))
Z = dict(np.load(WORK / 'seeds.npz')); near, dist, v1 = Z['near'], Z['dist'], Z['v1']
score = np.load(WORK / 'score.npz')['score']
ids = pickle.load(open(WORK / 'layers.pkl', 'rb'))['ids']
rows = {r['id']: r for r in json.load(open(REPO / 'data' / 'neighborhoods.json', encoding='utf-8'))['rows']}
am = {f['properties']['canonical_id'] for f in json.load(open(REPO / 'amendments' / 'outline-amendments.geojson', encoding='utf-8'))['features'] if 'rule' in f['properties']}
found = lambda m: set(near[(dist <= 150) & m].tolist())
f6, f8, f10, fv1, seen = found(score >= 6), found(score >= 8), found(score >= 10), found(v1), set(near[dist <= 150].tolist())
grp = collections.defaultdict(list)
for i, nid in enumerate(ids):
    r = rows[nid]
    grp['first:' + (r['hl'][0]['d'] if r.get('hl') else 'none')].append(i)
    grp['kind:' + r['kind']].append(i)
    grp['outline:' + ('redrawn' if nid in am else 'registry')].append(i)
    grp['all'].append(i)
out = {g: {'n': len(ix), 'dataSees': sum(i in seen for i in ix), 'v1': sum(i in fv1 for i in ix), 's6': sum(i in f6 for i in ix),
           's8': sum(i in f8 for i in ix), 's10': sum(i in f10 for i in ix)} for g, ix in sorted(grp.items(), key=lambda kv: -len(kv[1]))}
json.dump(out, open(WORK / 'groups.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('all', out['all'])
reg = []
x = os.environ.get('SCREEN_REGISTRY_XLSX')
if x:
    import openpyxl
    wb = openpyxl.load_workbook(x, read_only=True, data_only=True)
    def rows_of(name):
        ws = wb[name]; ws.reset_dimensions(); rs = [r for r in ws.iter_rows(values_only=True) if any(v not in (None, '') for v in r)]
        h = [str(c) if c is not None else '' for c in rs[0]]; return [dict(zip(h, r)) for r in rs[1:]]
    for r in rows_of('คัดย่านการค้า'):
        try: reg.append(('คัดย่านการค้า', r['พื้นที่ที่ตรวจ'], r.get('ลำดับสำรวจ'), float(r['ลองจิจูด']), float(r['ละติจูด'])))
        except (TypeError, ValueError, KeyError): pass
    for r in rows_of('ย่านที่พัก 268'):
        try: reg.append(('ย่านที่พัก 268', r['ย่าน / บริเวณ'], r.get('ผลคัดแบบจำลอง'), float(r['จุดเริ่ม ลองจิจูด']), float(r['จุดเริ่ม ละติจูด'])))
        except (TypeError, ValueError, KeyError): pass
print('registry screening names with coordinates:', len(reg), '' if x else '(SCREEN_REGISTRY_XLSX not set)')
pickle.dump(reg, open(WORK / 'regscreen.pkl', 'wb'))
