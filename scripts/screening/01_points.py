"""Step 1 of the neighbourhood screening: read the located points of the 16 demo datasets with the demo's own reader
(scripts/build-data.py), after checking each file is the one data/neighborhoods.json was built from (SHA-256)."""
import hashlib, importlib.util, json, os, pathlib, pickle, sys
REPO = pathlib.Path(__file__).resolve().parents[2]
SRC = pathlib.Path(os.environ.get('SCREEN_SRC', REPO.parent / 'src'))
WORK = pathlib.Path(os.environ.get('SCREEN_WORK', '/tmp/citymeter-screening')); WORK.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('bd', REPO / 'scripts' / 'build-data.py')
bd = importlib.util.module_from_spec(spec); spec.loader.exec_module(bd)
built = {d['id']: d['source'] for d in json.load(open(REPO / 'data' / 'neighborhoods.json', encoding='utf-8'))['datasets']}
data, stale = {}, []
for ds_id, demo, repo, rel, en, th, group, uth, uen in bd.DATASETS:
    path = SRC / repo / rel
    if built.get(ds_id, {}).get('sha256') and hashlib.sha256(path.read_bytes()).hexdigest() != built[ds_id]['sha256']:
        stale.append(f'{ds_id}: {path} differs from the file data/neighborhoods.json was built from')
    scope, subgroups, measure, dates, P = bd.extract(ds_id, str(path))
    data[ds_id] = {'group': group, 'th': th, 'en': en, 'repo': repo, 'file': rel, 'records': scope['records'],
                   'subgroups': [s['id'] for s in subgroups], 'subTh': [s.get('th', '') for s in subgroups], 'dates': dates,
                   'P': [(p[0], p[1], p[2], p[3], str(p[4]), p[5]) for p in P]}
    print(ds_id, len(P))
if stale and os.environ.get('SCREEN_ALLOW_NEWER') != '1':
    sys.exit('\n'.join(stale) + '\ncheck out the commits in data/neighborhoods.json datasets[].source, or set SCREEN_ALLOW_NEWER=1 to screen newer data')
pickle.dump(data, open(WORK / 'points.pkl', 'wb'))
