#!/usr/bin/env python3
"""CityMETER · Commercial District — count the 16 datasets inside the trial wider areas (พื้นที่ย่าน, release 0.3.0).

    python3 -I scripts/build-extents.py --extents amendments/extents-pilot-2026-11-24.geojson
        [--repos <folder with the 16 demo clones at the commits data/neighborhoods.json names>] [--cache <dir>] --out data

Owner 2026-11-24 08:15, VERBATIM: “ผมอยากให้ดูเรื่องขอบเขตย่าน … ป่าตอง กะตะ กะรน น่าจะคลุมพื้นที่อาคารมากกว่านี้มั้ย
… เราใช้ขอบเขตนั้นมาช่วยกำหนดขอบเขตย่านด้วยได้มั้ย … อยาก apply กับที่อื่นๆ และย่านรูปแบบอื่นๆ ที่ relevant กันด้วยทั้ง
dataset นี้”, then 08:19 “อย่างป่าตองก็น่าได้ประมาณนี้มั้ย”, and at 10:12, on the proposal of two layers of outline (the
registry's outline stays the neighbourhood's core; a wider area is added beside it) piloted on ten places: “ลุยเลย”.

Additive and read only. It never changes data/neighborhoods.json, data/boundaries.geojson or data/records/: every
count, rank, highlight and share of the page still uses the registry's outlines (DATA_METHOD.md §2c).

Inputs:
  extents   the trial wider areas drawn on 2026-11-24 from the demo's own basemap tiles (OpenFreeMap planet build,
            OpenMapTiles schema, zoom 14: buildings, land cover and water of OpenStreetMap) and the CityMETER production
            subdistrict outlines, on a grid of 0.0001° (about 11 m); rules in its metadata and DATA_METHOD.md §2c.
  data      neighborhoods.json and boundaries.geojson as built (the registry's outlines, the 16 datasets with the
            repository, file, commit and SHA-256 each was read at).
  repos     optional local clones; without them each dataset file is fetched from GitHub at its commit. Either way its
            SHA-256 must equal the one neighborhoods.json records, or the build stops.

Rules:
  * A wider area holds the registry's outline(s) it was drawn from (the union is taken here, so a core is never cut).
  * Two wider areas never overlap; one that would is refused.
  * A record counts in a wider area when its point lies inside it (covers), with the same reading of each dataset as
    the main build (scripts/build-data.py#extract). A dataset with no located record in the area's province is out of
    scope there: no key, never 0.
  * Counts of different datasets are never added together.

Output: data/extents.json — meta (sources, rules, hashes), items (one per wider area: id, names, cores, province, rule,
area in m² measured in UTM as the registry measures its own, counts per dataset, measures) and geometry (the display
copy, a FeatureCollection).
"""
import argparse, hashlib, importlib.util, json, os, subprocess, sys, tempfile
from datetime import date

from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union
from shapely.prepared import prep
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('build_data', os.path.join(HERE, 'build-data.py'))
bd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bd)

RULES = {
    'beach': {
        'th': 'พื้นที่ที่แผนที่ฐานไม่มีป่า ทุ่ง นา หิน พื้นที่ชุ่มน้ำ หาดทราย สวนสาธารณะ หรือน้ำ ต่อเนื่องจากแกนย่าน เฉพาะส่วนที่อยู่ไม่เกินราว 130 ม. จากกลุ่มอาคารที่ต่อถึงแกนย่าน (อาคารห่างกันไม่เกินราว 90 ม.) หยุดที่ทะเล น้ำ และขอบตำบลของแกนย่าน',
        'en': 'the ground the basemap leaves free of forest, grassland, farmland, rock, wetland, sand, parks and water, continuous with the core, within about 130 m of the buildings that join up with the core (no more than about 90 m apart), stopped by the sea, water and the core\'s subdistrict',
        'short': {'th': 'พื้นสีเข้มต่อจากแกนย่านที่มีอาคารต่อกัน ถึงขอบตำบล', 'en': 'built-up ground continuous with the core, up to its subdistrict'},
        'params': {'gridDeg': 0.0001, 'openingCells': 2, 'buildingJoinCells': 4, 'buildingTrimCells': 3, 'nearBuildingsM': 130, 'reachM': 5000, 'cap': 'subdistrict of the core (CityMETER production)'},
        'insteadWalk': {'th': 'ใช้กฎระยะเดินแทนเมื่อพื้นที่จากกฎชายหาดคลุมแกนย่านอื่น ไปไกลเกิน 5 กม. จากแกนย่าน หรือเล็กกว่าพื้นที่ระยะเดิน', 'en': 'the walk rule instead when the beach area takes in another registry outline, reaches 5 km from the core, or is smaller than the walk area'},
    },
    'walk': {
        'th': 'ถนนและทางเดินของแผนที่ฐานที่เดินจากแกนย่านได้ไม่เกิน 800 ม. (ไม่นับทางด่วน ทางรถไฟ และแนวรถไฟฟ้า) รวมแนวสองข้างทางข้างละ 40 ม. ทางที่เดินจากแกนย่านอื่นได้ใกล้กว่าเป็นของแกนนั้น ไม่รวมแหล่งน้ำ',
        'en': 'the basemap\'s streets and paths within an 800 m walk of the core (expressways, railways and transit lines left out), with 40 m either side; a street that is a shorter walk from another core goes to that core; water left out',
        'short': {'th': 'ระยะเดิน 800 ม. จากแกนย่าน แบ่งกับแกนย่านข้างเคียง', 'en': '800 m walk from the core, shared out with the neighbouring cores'},
        'params': {'gridDeg': 0.0001, 'walkM': 800, 'halfWidthM': 40, 'streetWidthCells': 2, 'neighbours': 8, 'excluded': ['motorway', 'rail', 'transit', 'ferry', 'raceway', 'busway', 'bus_guideway', 'aerialway']},
    },
}


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


# Files the reading of a dataset needs beside its own (scripts/build-data.py#extract), fetched at the same commit; the
# count of located records guards them (it must equal the one neighborhoods.json records).
SIBLINGS = {'industrialestate': ['boundaries.geojson']}


def dataset_file(ds, repos, cache):
    """The dataset's file at the commit neighborhoods.json names, checked by SHA-256."""
    src = ds['source']
    repo = src['repo'].split('/', 1)[1]
    if repos:
        path = os.path.join(repos, repo, src['file'])
    else:
        path = os.path.join(cache, repo, src['commit'], src['file'])
        folder = os.path.dirname(src['file'])
        for rel in [src['file']] + [f'{folder}/{s}' for s in SIBLINGS.get(ds['id'], [])]:
            dest = os.path.join(cache, repo, src['commit'], rel)
            if not os.path.exists(dest):
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                url = f"https://raw.githubusercontent.com/{src['repo']}/{src['commit']}/{rel}"
                subprocess.run(['curl', '-sSfL', '--retry', '3', '-o', dest, url], check=True)
    got = bd.sha256_file(path)
    if got != src['sha256']:
        raise SystemExit(f"{ds['id']}: {path} has SHA-256 {got}, neighborhoods.json read {src['sha256']}")
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--extents', required=True)
    ap.add_argument('--data', default='data')
    ap.add_argument('--repos', default='')
    ap.add_argument('--cache', default=os.path.join(tempfile.gettempdir(), 'citymeter-extents-cache'))
    ap.add_argument('--out', default='data')
    ap.add_argument('--built-on', default=date.today().isoformat())
    a = ap.parse_args()

    nb_path, bd_path = os.path.join(a.data, 'neighborhoods.json'), os.path.join(a.data, 'boundaries.geojson')
    N = json.load(open(nb_path, encoding='utf-8'))
    rows = {r['id']: r for r in N['rows']}
    outlines = {f['properties']['id']: shape(f['geometry']).buffer(0) for f in json.load(open(bd_path, encoding='utf-8'))['features']}
    raw = open(a.extents, 'rb').read()
    X = json.loads(raw)
    xm = X.get('metadata', {})

    items, geoms = [], []
    for f in X['features']:
        p = f['properties']
        cores = p['cores']
        for c in cores:
            if c not in rows or c not in outlines:
                raise SystemExit(f"{p['id']}: core {c} is not an outlined neighbourhood of this build")
        if p['rule'] not in RULES:
            raise SystemExit(f"{p['id']}: unknown rule {p['rule']}")
        provinces = {rows[c]['province'] for c in cores}
        if len(provinces) != 1:
            raise SystemExit(f"{p['id']}: cores in more than one province {sorted(provinces)}")
        drawn = shape(f['geometry']).buffer(0)
        g = unary_union([drawn] + [outlines[c] for c in cores]).buffer(0)
        geoms.append(g)
        items.append({'id': p['id'], 'name': p['name'], 'nameEn': p.get('nameEn', ''), 'cores': cores, 'province': provinces.pop(),
                      'rule': p['rule'], 'areaM2': round(bd.utm_area(g), 2),
                      'bbox': [round(v, 6) for v in g.bounds], 'caps': p.get('caps', []), 'asked': p.get('asked', p['rule']), 'drawn': p.get('check', {})})
    for i in range(len(geoms)):
        for j in range(i + 1, len(geoms)):
            if geoms[i].intersection(geoms[j]).area > 1e-12:
                raise SystemExit(f"{items[i]['id']} and {items[j]['id']} overlap")

    tree = STRtree(geoms)
    prepared = [prep(g) for g in geoms]
    read = []
    for ds in N['datasets']:
        path = dataset_file(ds, a.repos, a.cache)
        scope, subgroups, measure, dates, pts = bd.extract(ds['id'], path)
        if len(pts) != ds['located']:
            raise SystemExit(f"{ds['id']}: {len(pts)} located records, neighborhoods.json says {ds['located']}")
        covered = set(ds.get('byProvince', {}))
        counts = [0] * len(items)
        msum, mknown = [0.0] * len(items), [0] * len(items)
        for lon, lat, sg, mv, key, nm, nm_en, sub_ in pts:
            pt = Point(lon, lat)
            for k in sorted(tree.query(pt)):
                if prepared[k].covers(pt):
                    counts[k] += 1
                    if mv is not None:
                        msum[k] += mv
                        mknown[k] += 1
                    break
        for k, it in enumerate(items):
            if it['province'] not in covered:
                continue  # out of scope: no key at all
            it.setdefault('c', {})[ds['id']] = counts[k]
            if counts[k] and measure and mknown[k]:
                it.setdefault('m', {})[ds['id']] = [round(msum[k]), mknown[k]]
        read.append({'id': ds['id'], 'sha256': ds['source']['sha256']})
        print(f"{ds['id']:<17} " + ' '.join(f"{it['id'].split('-', 1)[1]}={counts[k]}" for k, it in enumerate(items)), file=sys.stderr)

    # every count of a core must fit inside its wider area (the core is inside it)
    for it in items:
        for c in it['cores']:
            for ds_id, n in rows[c].get('c', {}).items():
                if it.get('c', {}).get(ds_id, 0) < n:
                    raise SystemExit(f"{it['id']}: {ds_id} {it['c'].get(ds_id)} inside the area < {n} inside core {c}")

    features = [{'type': 'Feature', 'properties': {'id': it['id'], 'rule': it['rule']},
                 'geometry': json.loads(json.dumps(mapping(g), separators=(',', ':')), parse_float=lambda s: round(float(s), 6))}
                for it, g in zip(items, geoms)]
    out = {
        'meta': {
            'title': 'พื้นที่ย่าน (ทดลอง)', 'titleEn': 'Wider area (trial)',
            'drawnOn': xm.get('drawnOn'), 'builtOn': a.built_on,
            'owner': xm.get('owner'),
            'basemap': xm.get('basemap'), 'subdistricts': xm.get('subdistricts'), 'grid': xm.get('grid'),
            'rules': {k: {key: v[key] for key in ('th', 'en', 'short', 'params', 'insteadWalk') if key in v} for k, v in RULES.items()},
            'file': os.path.relpath(a.extents).replace(os.sep, '/'),
            'fileSha256': sha256_bytes(raw),
            'neighborhoodsSha256': bd.sha256_file(nb_path), 'boundariesSha256': bd.sha256_file(bd_path),
            'datasets': read, 'count': len(items),
            'status': {'th': 'ร่างทดลองจากแผนที่ฐาน รอทะเบียนย่านกลาง ยังไม่ตรวจภาคสนาม', 'en': "trial draft from the basemap; awaiting the central registry; not yet walked"},
        },
        'items': items,
        'geometry': {'type': 'FeatureCollection', 'features': features},
    }
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, 'extents.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write('\n')
    for it in items:
        print(f"{it['id']:<18} {it['rule']:<5} {it['areaM2'] / 1600:>8.0f} rai  hotel={it.get('c', {}).get('hotel')}", file=sys.stderr)


if __name__ == '__main__':
    main()
