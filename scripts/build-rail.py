#!/usr/bin/env python3
"""Rail context of the map (0.2.3) — data/rail.json from the published data of CityMETER · Transit (montri-th/transit).

Owner 2026-11-18 15:32, VERBATIM: “ในแผนที่อยากให้แสดง สถานีและแนวเส้นทางระบบรางเพิ่มเติม เพื่อให้เห็น context และการเชื่อมโยง
รอบๆและระหว่างแต่ละย่านการค้า ใน visual อาจจะให้ quiet กว่าตัวย่านการค้าเล็กน้อย”.

Copied as published. The stations are the file the dataset สถานีราง already counts (the same bytes, tests/rail.test.js);
this context counts nothing — no share, rank, role or density reads it (DATA_METHOD.md §9b).
  lines     data/transit.json lines (17: 10 in service, 7 under construction), names as published
  geometry  data/rail-lines.geojson, the parts of each line and status merged into one MultiLineString; coordinates
            rounded to 5 decimals (about 1 m); no other change (one project, SRT_MAPKABAO_CHIRA, has stations only)
  stations  data/transit.json stations (one row per station of a line, 305), status as published
  srt       data/layer-srt.json (stops of conventional rail with scheduled trips in the GTFS, 176, nationwide)
  links     data/transit.json complexes (18): the stations a current network map connects (walkways not confirmed)

Usage (DATA_METHOD.md §11):
  python3 -I scripts/build-rail.py --transit <clone of montri-th/transit> --out data/rail.json
The clone must be clean in data/; its commit and the SHA-256 of the three files are written into meta.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

FILES = ('data/transit.json', 'data/rail-lines.geojson', 'data/layer-srt.json')
STATUS = {'operating': 0, 'construction': 1, 'unverified': 2}


def git(repo, *args):
    return subprocess.run(['git', '-C', str(repo), *args], check=True, capture_output=True, text=True).stdout.strip()


def r5(v):
    return round(float(v), 5)


def part(coords):
    out = []
    for x, y, *_ in coords:
        p = [r5(x), r5(y)]
        if not out or out[-1] != p:
            out.append(p)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--transit', required=True, type=pathlib.Path)
    ap.add_argument('--out', required=True, type=pathlib.Path)
    a = ap.parse_args()
    repo = a.transit.resolve()
    dirty = git(repo, 'status', '--porcelain', '--', *FILES)
    if dirty:
        sys.exit(f'transit clone has local changes in its data: {dirty}')
    commit = git(repo, 'rev-parse', 'HEAD')
    raw = {f: (repo / f).read_bytes() for f in FILES}
    transit = json.loads(raw['data/transit.json'])
    rail = json.loads(raw['data/rail-lines.geojson'])
    srt = json.loads(raw['data/layer-srt.json'])
    tm, gm, sm = transit['meta'], rail.get('metadata', {}), srt['meta']
    if gm.get('release') != tm.get('release'):
        sys.exit(f"rail lines and stations come from different releases: {gm.get('release')} / {tm.get('release')}")

    lines = transit['lines']
    index = {l['id']: i for i, l in enumerate(lines)}
    out_lines = [{'id': l['id'], 'name': l['name'], 'nameEn': l.get('nameEn') or l['name'], 'status': l['status']} for l in lines]

    merged = {}
    for f in rail['features']:
        p = f['properties']
        if p['lineId'] not in index:
            sys.exit(f"rail line {p['lineId']} is not in transit.json lines")
        if p['status'] not in ('operating', 'construction'):
            sys.exit(f"unexpected line status {p['status']}")
        g = f['geometry']
        parts = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates'] if g['type'] == 'MultiLineString' else []
        key = (index[p['lineId']], STATUS[p['status']])
        merged.setdefault(key, []).extend(q for q in (part(c) for c in parts) if len(q) >= 2)
    features = [{'type': 'Feature', 'properties': {'l': l, 's': s}, 'geometry': {'type': 'MultiLineString', 'coordinates': parts}}
                for (l, s), parts in sorted(merged.items())]

    stations, row_of = [], {}
    for s in transit['stations']:
        if s['status'] not in STATUS:
            sys.exit(f"unexpected station status {s['status']} ({s['id']})")
        if not all(isinstance(s.get(k), (int, float)) for k in ('lng', 'lat')):
            continue
        row_of[s['id']] = len(stations)
        stations.append([r5(s['lng']), r5(s['lat']), s['name'], s.get('nameEn') or '', [index[i] for i in s['lineIds'] if i in index], STATUS[s['status']]])
    # Interchange groups (complexes): the stations a current network map connects, as Transit groups them.
    links = []
    for c in transit.get('complexes', []):
        rows = [row_of[i] for i in c.get('stationIds', []) if i in row_of]
        if len(rows) >= 2:
            links.append([c['name'], rows])

    fields = srt['fields']
    fx, fy, fn, fa = (fields.index(k) for k in ('lng', 'lat', 'name', 'area'))
    stops = [[r5(r[fx]), r5(r[fy]), r[fn], r[fa]] for r in srt['rows']]
    src = (sm.get('sources') or [{}])[0]

    meta = {
        'product': 'CityMETER · Commercial District — rail context of the map (display only, never counted)',
        'dataset': {'th': 'ระบบราง · CityMETER Transit', 'en': 'Rail · CityMETER Transit'},
        'release': tm['release'], 'asOf': tm['asOf'],
        'boundary': {'th': tm['boundary'],
                     'en': 'Urban rail lines in service in Bangkok and its vicinity (10 lines) and rail projects under construction with a station list (7 projects)'},
        'statusRule': tm.get('statusRule', ''),
        'grain': tm.get('grain', ''),
        'linesSource': gm.get('source', ''), 'osmLicence': gm.get('osmLicence', ''),
        'srt': {'label': sm.get('label', ''), 'grain': sm.get('grain', ''), 'boundary': sm.get('boundary', ''), 'checkedOn': sm.get('checkedOn', ''),
                'period': src.get('period', ''), 'source': src.get('title', ''), 'provider': src.get('provider', ''), 'licence': src.get('licence', ''),
                'reading': sm.get('reading', '')},
        'counts': {'lines': len(out_lines), 'linesInService': sum(l['status'] == 'operating' for l in out_lines),
                   'linesUnderConstruction': sum(l['status'] == 'construction' for l in out_lines),
                   'linesDrawn': len({l for l, _ in merged}), 'stations': len(stations),
                   'stationsByStatus': {k: sum(r[5] == v for r in stations) for k, v in STATUS.items()}, 'links': len(links), 'srtStops': len(stops)},
        'linkRule': tm.get('complexRule', ''),
        'from': {'repo': 'montri-th/transit', 'commit': commit, 'files': {f: hashlib.sha256(b).hexdigest() for f, b in raw.items()}},
    }
    data = {'meta': meta, 'lines': out_lines, 'geo': {'type': 'FeatureCollection', 'features': features}, 'stations': stations, 'links': links, 'srt': stops}
    a.out.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps({'out': str(a.out), 'bytes': a.out.stat().st_size, 'commit': commit, **meta['counts']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
