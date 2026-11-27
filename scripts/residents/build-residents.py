#!/usr/bin/env python3
"""
CityMETER · Commercial District — registered residents per neighbourhood (0.7.0; D-12, handoff/around/decisions.json).

    python3 -I scripts/residents/build-residents.py --repo . --cache <folder outside the repository> \
        --out <file outside the repository> [--reach 0|1000|3000|5000] [--workers 4] [--built-on YYYY-MM-DD] [--plan-only]

Owner 2026-11-26 14:03 (VERBATIM in handoff/around/decisions.json): “คนอยู่ แบบจำลองยังไม่ถึงรอบข้อมูลรอรุ่นแบบจำลอง
ผู้อยู่อาศัย (รอบ 2) ทำยังไงถึงจะเห็นปริมาณคน residents, visitors, commuters ได้ อยากได้วิธีง่ายๆตรงไปตรงมาไม่ซับซ้อนมาก”;
his answer ~14:31, VERBATIM: “A ตัวเลขทางการแบ่งลงย่าน (แนะนำ)”.

Method (variant A of «รอบศูนย์นี้», montri-th/shoppingcenter): each building of CityMETER Building V4 takes its subdistrict's
registered population (production's popCount, the civil register of the latest month) in proportion to its floor area —
footprint × estimated floors from production's vector tiles, or production's own GFA weight for a building drawn from
OpenStreetMap parts — over production's GFA total of the subdistrict. A building counts where the centre of its footprint
(of the union of its parts) lies: inside the outline the map draws (`in`) or, with --reach, within 400 m · 800 m ·
1 · 3 · 5 km of it (the distances up to the reach), straight line in an azimuthal equidistant projection centred on the neighbourhood's reference point.
With --crossing (0.7.5, V7-09; owner 2026-11-27 06:51 on 400/800 m, VERBATIM “คิดด้วย”, and 07:09 “คนอยู่ไม่น่าจะข้ามแม่น้ำจาก
บางกระเจ้ามาที่ปุณณวิถีได้นะครับ”): a building across a river counts by its distance through the crossings
(scripts/crossing/, the Shopping Center page's rule D70) — the same bank as the outline keeps the straight distance.
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
    ap.add_argument('--reach', type=int, default=0, choices=(0, 1000, 3000, 5000))
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--built-on', default=time.strftime('%Y-%m-%d'))
    ap.add_argument('--plan-only', action='store_true', help='print the requests the run needs and how many are cached, then stop')
    ap.add_argument('--only', default='', help='comma-separated neighbourhood ids: a trial on a few (the output says so)')
    ap.add_argument('--crossing', default='', help='rivers cache of scripts/crossing/rivers.py (outside the repository): across a river, through the crossings')
    ap.add_argument('--crossing-kinds', default='all', choices=('all', 'no-ferry'))
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
    only = [x for x in a.only.split(',') if x]
    # the subdistricts of every province a neighbourhood is in (0.7.5): a trial on a few takes the same pairs near them
    # as the full run, so a reach that crosses into the next province finds its buildings there too
    all_provs = sorted({r['province'] for r in rows})
    if only:
        rows = [r for r in rows if r['id'] in set(only)]
        if len(rows) != len(set(only)):
            sys.exit('--only names a neighbourhood that is not in data/neighborhoods.json')

    # ---- the population month and the subdistricts' tables
    tr = crawl.get(f'{crawl.API}/population/temporalRange')['value']
    month = f"{tr['maxY']:04d}-{tr['maxM']:02d}"
    lv0 = crawl.get(f'{crawl.API}/base/info/lv0')['value']['provinceInfos']
    pid = {p['abbrEn']: p['id'] for p in lv0}
    provs = all_provs
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
    # the subdistricts' extents as one array (0.7.3): the same test as before, per tile at once, so the plan of a 5 km run
    # takes seconds instead of minutes in every chunk
    sid_list = list(sds)
    ext = np.array([sds[s]['extent'] for s in sid_list], dtype='f8').reshape(-1, 4)
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
                bx0, by0, bx1, by1 = tb.bounds
                keep = ~((ext[:, 0] > bx1) | (ext[:, 2] < bx0) | (ext[:, 1] > by1) | (ext[:, 3] < by0))
                for k in np.nonzero(keep)[0]:
                    pairs.add((x, y, sid_list[k]))
    pairs = sorted(pairs)
    touched = sorted({p[2] for p in pairs})
    print(f'{len(rows)} outlines · reach {reach} m · {len(pairs)} tile × subdistrict requests · {len(touched)} subdistricts', flush=True)
    if a.plan_only:
        def cached(url, binary):
            return os.path.exists(os.path.join(crawl.CACHE, hashlib.sha256(url.encode()).hexdigest() + ('.bin' if binary else '.json')))
        q = 'inTileType=SUBDISTRICT&inTileId={}&version=V4&hideWithParts=true'
        have = sum(cached(f'{crawl.API}/building/detailMvt/{crawl.Z}/{x}/{y}?{q.format(sid)}', True) for x, y, sid in pairs)
        have_parts = sum(cached(f'{crawl.API}/building/parts?inTileType=SUBDISTRICT&inTileId={sid}&version=V4', False) for sid in touched)
        provs_t = sorted({sds[s]['province'] for s in touched})
        print(f'tiles cached {have}/{len(pairs)} · parts lists cached {have_parts}/{len(touched)} · provinces {len(provs_t)}', flush=True)
        return

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

    # ---- the banks of the rivers (0.7.5): optional
    rivers = crossing_meta = None
    if a.crossing:
        outside_repo(a.repo, a.crossing, '--crossing')
        sys.path.insert(0, os.path.join(os.path.abspath(a.repo), 'scripts', 'crossing'))
        import banks as banks_mod
        rivers, crossing_meta = banks_mod.load(a.crossing, a.crossing_kinds)

    # ---- per neighbourhood
    out, no_buildings, grid, frames, xs = {}, {}, {}, {}, {}
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
            straight = d
            bank = None
            if rivers is not None:
                bank = banks_mod.Banks(rivers, lambda lo, la: fwd.transform(lo, la), gp, g.bounds)
                if bank.has_river:
                    d, across, via_link = bank.measure(np.asarray(bx), np.asarray(by), straight)
                    d[inside] = 0.0
                    across &= ~inside
                else:
                    bank = None
            xr = {}
            for s in [x for x in SCALES if x <= reach]:   # a scale beyond the run's reach is not read, so not written
                within = d <= s
                o[str(s)] = int(round(float(people[idx][within].sum()))) if within.any() else None
                if not within.any():
                    no_buildings.setdefault(str(s), []).append(r['id'])
                if bank is not None:
                    # across the river within the straight distance; counted through a crossing; the crossing most of
                    # those counted come through (its OSM way id and kind) — for the page's line under the tiles
                    ws = straight <= s
                    acr = float(people[idx][across & ws].sum())
                    cnt = float(people[idx][across & within].sum())
                    via = {}
                    for li, v in zip(via_link[across & within], people[idx][across & within]):
                        if li >= 0:
                            key = bank.links[li][0]
                            via[key] = via.get(key, 0.0) + float(v)
                    top = max(via.items(), key=lambda kv: kv[1]) if via else None
                    st = int(round(float(people[idx][ws].sum()))) if ws.any() else None
                    xr[str(s)] = {'straight': st, 'across': round(acr), 'counted': round(cnt),
                                  'via': [int(rivers.crossings[top[0]][4]), rivers.crossings[top[0]][0], round(top[1])] if top else None}
            if xr and any(v['across'] for v in xr.values()):
                xs[r['id']] = xr
            # the residents map (reach 5 km): people per 250 m cell of the frame the people file's maps use
            if reach >= 5000:
                pf = os.path.join(a.repo, 'data', 'people', f"{r['id']}.json")
                frame = json.load(open(pf, encoding='utf-8'))['map']['cell'] if os.path.exists(pf) else None
                if frame:
                    frames[r['id']] = frame
                    m_, ix0, iy1, W = frame['m'], frame['x0'], frame['y1'], frame['w']
                    keep = straight <= 5000   # the map draws every building within 5 km in a straight line
                    cx = np.floor(np.asarray(bx)[keep] / m_).astype(int)
                    cy = np.floor(np.asarray(by)[keep] / m_).astype(int)
                    vals = people[idx][keep]
                    cells = {}
                    for a_, b_, v_ in zip(cx, cy, vals):
                        k_ = int((iy1 - b_) * W + (a_ - ix0))
                        cells[k_] = cells.get(k_, 0.0) + float(v_)
                    ks = sorted(k_ for k_, v_ in cells.items() if round(v_, 1) > 0)
                    if ks:
                        ccx = (np.array([k_ % W for k_ in ks]) + ix0 + 0.5) * m_
                        ccy = (iy1 - np.array([k_ // W for k_ in ks]) + 0.5) * m_
                        dc = shapely.distance(gp, shapely.points(ccx, ccy))
                        far = np.zeros(len(ks), dtype=bool)
                        if bank is not None:
                            # a cell across the river takes its centre's distance through the crossings; band 4: across
                            # and beyond 5 km that way (drawn, hatched, left out of the table); a rim cell stays band 3
                            dr, acr, _vl = bank.measure(ccx, ccy, dc)
                            far = acr & (dr > 5000)
                            dc = np.where(acr, dr, dc)
                        band = np.where(far, 4, np.where(dc <= 0, 0, np.where(dc <= 1000, 1, np.where(dc <= 3000, 2, 3))))
                        grid[r['id']] = [[int(k_), round(cells[k_], 1), int(b_)] for k_, b_ in zip(ks, band)]
                    else:
                        grid[r['id']] = []
        out[r['id']] = o

    meta = {
        'schema': 'citymeter-commercialdistrict-residents/1', 'builtOn': a.built_on, 'populationMonth': month,
        **({'only': only} if only else {}),
        'reach': reach, 'scales': ['in', *[str(x) for x in SCALES if x <= reach]],
        'source': {'api': crawl.API, 'buildings': 'CityMETER Building V4 (detailMvt z15, hideWithParts; parts; detail gfaWeight)',
                   'population': 'building/info lv1 popCount per subdistrict = population/info lv1 tot of the month (checked)'},
        'method': {'th': 'ประชากรตามทะเบียนบ้านของแขวง/ตำบลเดือนล่าสุด แบ่งลงทุกอาคารของ CityMETER Building V4 ตามพื้นที่ใช้สอย (ฐาน × จำนวนชั้นโดยประมาณ หรือค่าน้ำหนักของ production สำหรับอาคารที่วาดจากส่วนอาคาร) หารด้วยพื้นที่ใช้สอยรวมของแขวง/ตำบลที่ production ให้ แล้วรวมอาคารที่จุดกึ่งกลางอยู่ในขอบย่านหรือในระยะ',
                   'en': 'The latest month’s registered population of each subdistrict spread over every CityMETER Building V4 building by floor area (footprint × estimated floors, or production’s weight for a building drawn from parts) over production’s floor-area total of the subdistrict, summed over the buildings whose centre is inside the outline or within the distance'},
        'counts': {'outlines': len(rows), 'requests': len(pairs), 'subdistricts': len(touched), 'buildings': int(len(lon)),
                   'fromTiles': n_tiles, 'fromParts': len(need), 'withoutFloors': int(nofloor), 'subdistrictsWithoutTotal': no_total,
                   'noBuildings': no_buildings},
        'populationCheck': {'month': month, 'compared': compared, 'differ': differ},
        **({'frame': frames} if frames else {}),
        **({'crossing': crossing_meta} if crossing_meta else {}),
        'responses': hashlib.sha256('\n'.join(f'{u}\t{h}' for u, h in sorted(used.items())).encode()).hexdigest(),
        'responseCount': len(used),
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'meta': meta, 'rows': out, **({'grid': grid} if grid else {}), **({'across': xs} if rivers is not None else {})}, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print(f'wrote {a.out}: {len(out)} neighbourhoods · population month {month} · {len(used)} responses', flush=True)
    if differ:
        print(f'WARNING: {len(differ)} subdistricts whose popCount is not the register total of {month}', flush=True)


if __name__ == '__main__':
    main()
