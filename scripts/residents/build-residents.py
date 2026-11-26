#!/usr/bin/env python3
"""
CityMETER · Commercial District — registered residents per neighbourhood (0.7.0; D-12, handoff/around/decisions.json).

    python3 -I scripts/residents/build-residents.py --repo . --cache <folder outside the repository> \
        --out <file outside the repository> [--reach 0|5000] [--workers 4] [--built-on YYYY-MM-DD]

Owner 2026-11-26 14:03 (VERBATIM in handoff/around/decisions.json): “คนอยู่ แบบจำลองยังไม่ถึงรอบข้อมูลรอรุ่นแบบจำลอง
ผู้อยู่อาศัย (รอบ 2) ทำยังไงถึงจะเห็นปริมาณคน residents, visitors, commuters ได้ อยากได้วิธีง่ายๆตรงไปตรงมาไม่ซับซ้อนมาก”;
his answer ~14:31, VERBATIM: “A ตัวเลขทางการแบ่งลงย่าน (แนะนำ)”.

Method (variant A of «รอบศูนย์นี้», montri-th/shoppingcenter): each building of CityMETER Building V4 takes its subdistrict's
registered population (production's popCount, the civil register of the latest month) in proportion to its floor area —
footprint × estimated floors from production's vector tiles, or production's own GFA weight for a building drawn from
OpenStreetMap parts — over production's GFA total of the subdistrict. A building counts where the centre of its footprint
(of the union of its parts) lies: inside the outline the map draws (`in`) or, with --reach 5000, within 400 m · 800 m ·
1 · 3 · 5 km of it, straight line in an azimuthal equidistant projection centred on the neighbourhood's reference point.
Buildings without an estimated floor count carry no floor area and are left out (counted in the meta). This is a model of
where registered people are, not a census of who lives there: people living here without being registered are not in it,
and a commercial building takes people by its floor area like any other.

Reads only (production API, paced and cached outside the repository by scripts/residents/crawl.py) and writes one JSON
file outside the repository, read by scripts/build-people.py --residents. The SHA-256 of every response used is listed
in the meta (`responses`), so a rerun from the same cache is provably the same input.
"""
import argparse
import hashlib
import json
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pyproj
import shapely
from shapely.geometry import shape, Point, box
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
SCALES = (400, 800, 1000, 3000, 5000)
PAD_M = 60                      # the plan's margin round an outline or its reach


def args():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default='.')
    ap.add_argument('--cache', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--reach', type=int, default=0, choices=(0, 5000))
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--built-on', default=time.strftime('%Y-%m-%d'))
    return ap.parse_args()


def outside_repo(repo, path, what):
    r, p = os.path.realpath(repo), os.path.realpath(path)
    if p == r or p.startswith(r + os.sep):
        sys.exit(f'{what} must be outside the repository: {path}')


def main():
    a = args()
    outside_repo(a.repo, a.cache, '--cache')
    outside_repo(a.repo, a.out, '--out')
    os.environ['RES_CACHE'] = os.path.abspath(a.cache)
    sys.path.insert(0, HERE)
    import crawl  # noqa: E402  (reads RES_CACHE at import)
    used = {}
    get0 = crawl.get

    def get(url, binary=False, tries=4):
        v = get0(url, binary, tries)
        key = hashlib.sha256(url.encode()).hexdigest()
        p = os.path.join(crawl.CACHE, key + ('.bin' if binary else '.json'))
        used[url] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
        return v
    crawl.get = get

    nb = json.load(open(os.path.join(a.repo, 'data', 'neighborhoods.json'), encoding='utf-8'))
    feats = json.load(open(os.path.join(a.repo, 'data', 'boundaries.geojson'), encoding='utf-8'))['features']
    outl = {str(f['properties']['id']): shape(f['geometry']) for f in feats}
    rows = nb['rows']
    if {r['id'] for r in rows} != set(outl):
        sys.exit('data/boundaries.geojson and data/neighborhoods.json do not hold the same neighbourhoods')

    # ---- the population month and the subdistricts' tables
    tr = crawl.get(f'{crawl.API}/population/temporalRange')['value']
    month = f"{tr['maxY']:04d}-{tr['maxM']:02d}"
    lv0 = crawl.get(f'{crawl.API}/base/info/lv0')['value']['provinceInfos']
    pid = {p['abbrEn']: p['id'] for p in lv0}
    provs = sorted({r['province'] for r in rows})
    missing = [p for p in provs if p not in pid]
    if missing:
        sys.exit(f'provinces not in production: {missing}')
    sds = {}
    for ab in provs:
        for k, v in crawl.province_tables(pid[ab]).items():
            v['province'] = ab
            sds[k] = v

    # ---- plan: (tile, subdistrict) pairs over every outline's reach
    reach = a.reach
    pairs = set()
    for r in rows:
        g = outl[r['id']]
        x0, y0, x1, y1 = g.bounds
        lat = (y0 + y1) / 2
        dy = (reach + PAD_M) / 111320
        dx = dy / math.cos(math.radians(lat))
        mb = box(*crawl.merc(x0 - dx, y0 - dy), *crawl.merc(x1 + dx, y1 + dy))
        tx0, ty0 = crawl.lonlat_to_tile(x0 - dx, y1 + dy)
        tx1, ty1 = crawl.lonlat_to_tile(x1 + dx, y0 - dy)
        for x in range(int(tx0), int(tx1) + 1):
            for y in range(int(ty0), int(ty1) + 1):
                tb = box(*crawl.tile_merc_bounds(x, y)).intersection(mb)
                if tb.is_empty:
                    continue
                for sid, s in sds.items():
                    e = s['extent']
                    if e[0] > tb.bounds[2] or e[2] < tb.bounds[0] or e[1] > tb.bounds[3] or e[3] < tb.bounds[1]:
                        continue
                    pairs.add((x, y, sid))
    pairs = sorted(pairs)
    touched = sorted({p[2] for p in pairs})
    print(f'{len(rows)} outlines · reach {reach} m · {len(pairs)} tile × subdistrict requests · {len(touched)} subdistricts', flush=True)

    # ---- the population check: popCount of every touched subdistrict = the register's total of the month
    pop_month, compared, differ = {}, 0, []
    for ab in sorted({sds[s]['province'] for s in touched}):
        v = crawl.get(f'{crawl.API}/population/info/lv1/{pid[ab]}?currentDetailType=S')['value']['subdistrictDatas']
        for sid in touched:
            if sds[sid]['province'] != ab:
                continue
            rr = [x for x in ((v.get(sid) or {}).get('rows') or []) if x['y'] == tr['maxY'] and x['m'] == tr['maxM']]
            tot = rr[0]['tot'] if rr else None
            pop_month[sid] = tot
            if sds[sid]['pop'] is not None:
                compared += 1
                if tot != sds[sid]['pop']:
                    differ.append([sid, sds[sid]['pop'], tot])
    print(f'population {month}: {compared} subdistricts compared, {len(differ)} differ', flush=True)

    # ---- crawl
    t0 = time.time()
    found = []
    with ThreadPoolExecutor(a.workers) as ex:
        for n, (bs, nf) in enumerate(ex.map(lambda p: crawl.buildings(p[0], p[1], p[2], 'hide'), pairs)):
            found.append((bs, nf))
            if n % 500 == 0:
                print(f'tiles {n}/{len(pairs)} {time.time() - t0:.0f}s', flush=True)
    with ThreadPoolExecutor(a.workers) as ex:
        parts = dict(zip(touched, ex.map(crawl.parts_buildings, touched)))
    nofloor = sum(nf for _, nf in found)
    lon, lat, gfa, sdi = [], [], [], []
    for bs, _ in found:
        for b in bs:
            lon.append(b[0]); lat.append(b[1]); gfa.append(b[2]); sdi.append(b[3])
    n_tiles = len(lon)

    # parts buildings within reach of an outline take production's GFA weight
    geoms = [outl[r['id']] for r in rows]
    tree = STRtree(geoms)
    need = []
    for sid, bl in parts.items():
        for bid, (blon, blat) in bl.items():
            if reach:
                dy = (reach + PAD_M) / 111320
                dx = dy / math.cos(math.radians(blat))
                hit = len(tree.query(box(blon - dx, blat - dy, blon + dx, blat + dy))) > 0
            else:
                hit = len(tree.query(Point(blon, blat), predicate='intersects')) > 0
            if hit:
                need.append((bid, sid, blon, blat))
    with ThreadPoolExecutor(a.workers) as ex:
        weights = list(ex.map(lambda b: crawl.gfa_of(b[0])[0], need))
    for (bid, sid, blon, blat), w in zip(need, weights):
        lon.append(blon); lat.append(blat); gfa.append(w); sdi.append(sid)
    lon, lat, gfa = np.array(lon), np.array(lat), np.array(gfa)
    # each building's people: popCount(subdistrict) × its GFA / production's GFA total of the subdistrict
    share = np.array([(sds[s]['pop'] / sds[s]['gfa']) if sds[s]['pop'] is not None and sds[s]['gfa'] else np.nan for s in sdi])
    no_total = sorted({s for s, v in zip(sdi, share) if np.isnan(v)})
    people = np.where(np.isnan(share), 0.0, gfa * np.nan_to_num(share))
    print(f'buildings {len(lon)} ({n_tiles} from tiles, {len(need)} from parts) · without floors {nofloor} · subdistricts without a GFA total {len(no_total)}', flush=True)

    # ---- per neighbourhood
    out, no_buildings = {}, {}
    for r in rows:
        g = outl[r['id']]
        x0, y0, x1, y1 = g.bounds
        dy = (reach + PAD_M) / 111320
        dx = dy / math.cos(math.radians((y0 + y1) / 2))
        m = (lon >= x0 - dx) & (lon <= x1 + dx) & (lat >= y0 - dy) & (lat <= y1 + dy)
        idx = np.nonzero(m)[0]
        inside = shapely.contains_xy(g, lon[idx], lat[idx]) if len(idx) else np.zeros(0, bool)
        # no building of Building V4 inside: the model cannot say (None, “no building data here”), never 0
        o = {'in': int(round(float(people[idx][inside].sum()))) if inside.any() else None}
        if not inside.any():
            no_buildings.setdefault('in', []).append(r['id'])
        if reach:
            crs = f"+proj=aeqd +lat_0={r['ref'][1]} +lon_0={r['ref'][0]} +datum=WGS84 +units=m"
            fwd = pyproj.Transformer.from_crs('EPSG:4326', crs, always_xy=True)
            gp = shapely.transform(g, lambda c: np.column_stack(fwd.transform(c[:, 0], c[:, 1])))
            bx, by = fwd.transform(lon[idx], lat[idx])
            d = shapely.distance(gp, shapely.points(bx, by))
            d[inside] = 0.0
            for s in SCALES:
                within = d <= s
                o[str(s)] = int(round(float(people[idx][within].sum()))) if within.any() else None
                if not within.any():
                    no_buildings.setdefault(str(s), []).append(r['id'])
        out[r['id']] = o

    meta = {
        'schema': 'citymeter-commercialdistrict-residents/1', 'builtOn': a.built_on, 'populationMonth': month,
        'reach': reach, 'scales': ['in', *map(str, SCALES)] if reach else ['in'],
        'source': {'api': crawl.API, 'buildings': 'CityMETER Building V4 (detailMvt z15, hideWithParts; parts; detail gfaWeight)',
                   'population': 'building/info lv1 popCount per subdistrict = population/info lv1 tot of the month (checked)'},
        'method': {'th': 'ประชากรตามทะเบียนบ้านของแขวง/ตำบลเดือนล่าสุด แบ่งลงทุกอาคารของ CityMETER Building V4 ตามพื้นที่ใช้สอย (ฐาน × จำนวนชั้นโดยประมาณ หรือค่าน้ำหนักของ production สำหรับอาคารที่วาดจากส่วนอาคาร) หารด้วยพื้นที่ใช้สอยรวมของแขวง/ตำบลที่ production ให้ แล้วรวมอาคารที่จุดกึ่งกลางอยู่ในขอบย่านหรือในระยะ',
                   'en': 'The latest month’s registered population of each subdistrict spread over every CityMETER Building V4 building by floor area (footprint × estimated floors, or production’s weight for a building drawn from parts) over production’s floor-area total of the subdistrict, summed over the buildings whose centre is inside the outline or within the distance'},
        'counts': {'outlines': len(rows), 'requests': len(pairs), 'subdistricts': len(touched), 'buildings': int(len(lon)),
                   'fromTiles': n_tiles, 'fromParts': len(need), 'withoutFloors': int(nofloor), 'subdistrictsWithoutTotal': no_total,
                   'noBuildings': no_buildings},
        'populationCheck': {'month': month, 'compared': compared, 'differ': differ},
        'responses': hashlib.sha256('\n'.join(f'{u}\t{h}' for u, h in sorted(used.items())).encode()).hexdigest(),
        'responseCount': len(used),
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'meta': meta, 'rows': out}, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print(f'wrote {a.out}: {len(out)} neighbourhoods · population month {month} · {len(used)} responses', flush=True)
    if differ:
        print(f'WARNING: {len(differ)} subdistricts whose popCount is not the register total of {month}', flush=True)


if __name__ == '__main__':
    main()
