#!/usr/bin/env python3
"""CityMETER · Commercial District — the three levels of «ความเป็นย่าน» for every neighbourhood (0.7.10).

Owner 2026-11-27 18:05 (VERBATIM): “และ x-y plot แสดงความเป็นย่าน แต่รอบนี้ควรเป็น น่าอยู่ น่าเที่ยว น่าค้าขาย ทำยังไงดีมี
3 แกน”; on Claude's two questions he chose «คนอยู่ · ผู้มาเยือน · ศูนย์และตลาด (แนะนำ)» for the value of each axis and
«สามเหลี่ยมระดับ (แนะนำ)» for the chart (D-V11 and D-V12 in handoff/visual/decisions.json; DATA_METHOD.md §18).

Reads data/people/<id>.json (written only by scripts/build-people.py) and writes data/character.json: for every
neighbourhood and every distance the tiles read (inside · 1 · 3 · 5 km from the edge), the levels the tiles of
«ใครอยู่ตรงนี้» print — คนอยู่ (residents, modelled) · ผู้มาเยือนค้างคืน (guests a year, modelled) · ศูนย์และตลาด (places,
counted) — as the tiles' own mid-rank percentile among the reference set (data/people/meta.json
`levels.reference`, 395), the number the tile rounds to print. A measured 0 is 0 (nothing counted at that distance); a figure the tiles do not have (no building of Building
V4 there, a dataset that does not reach the province) is null and the chart is not drawn. Nothing is added across the
three, across distances or across neighbourhoods; no new score is made. Deterministic: the same people files give the
same bytes.

  python3 -I scripts/build-character.py            # writes data/character.json
  python3 -I scripts/build-character.py --check    # exits 1 when data/character.json differs from the people files
"""
import argparse, glob, json, os, sys

RELEASE = '0.9.0'   # the page's release, as data/people/meta.json and data/around.json
SCHEMA = 'citymeter-commercialdistrict-character/1'
REACHES = ['in', '1000', '3000', '5000']
AXES = ['res', 'gst', 'ctr']
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def level(count, p):
    """The level of one group at one distance: null without a figure, 0 for a measured 0, else the tile's own number (the
    people file's `p`, as js/people.js prints it with Math.round), so the corner, the type and the tile read the same."""
    if count is None:
        return None
    if count == 0:
        return 0
    if p is None:
        return None
    if not p > 0:
        raise SystemExit(f'a level of {p} for a count of {count}: a mid-rank percentile of a positive count is above 0')
    return p


def triple(rec, reach):
    s = (rec.get('s') or {}).get(reach)
    p = (rec.get('p') or {}).get(reach) or {}
    if not s:
        return None
    n = s.get('n') or {}
    return [level(s.get('res'), p.get('res')), level(s.get('gst'), p.get('gst')), level(n.get('shoppingcenter'), p.get('ctr'))]


def build():
    meta = json.load(open(os.path.join(ROOT, 'data/people/meta.json'), encoding='utf-8'))
    rows = {}
    for path in sorted(glob.glob(os.path.join(ROOT, 'data/people/*.json'))):
        if os.path.basename(path) == 'meta.json':
            continue
        rec = json.load(open(path, encoding='utf-8'))
        rows[rec['id']] = {r: triple(rec, r) for r in REACHES}
    ref = (meta.get('levels') or {}).get('reference') or {}
    out = {
        'meta': {
            'schema': SCHEMA, 'release': RELEASE, 'reaches': REACHES, 'axes': AXES, 'split': 50,
            'reference': {'id': ref.get('id'), 'n': ref.get('n'), 'codesSha256': ref.get('codesSha256')},
            'source': {'people': 'data/people/<id>.json', 'peopleRelease': meta.get('release'),
                       'rule': 'the tiles’ levels: mid-rank percentile among the reference set; 0 for a measured 0; null without a figure'},
            'rows': len(rows),
        },
        'rows': rows,
    }
    return json.dumps(out, ensure_ascii=False, separators=(',', ':'), sort_keys=False) + '\n'


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--check', action='store_true', help='compare with data/character.json instead of writing it')
    a = ap.parse_args()
    text = build()
    target = os.path.join(ROOT, 'data/character.json')
    if a.check:
        same = os.path.exists(target) and open(target, encoding='utf-8').read() == text
        print('data/character.json', 'matches the people files' if same else 'differs from the people files')
        sys.exit(0 if same else 1)
    with open(target, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print(f'data/character.json: {json.loads(text)["meta"]["rows"]} neighbourhoods, {len(text.encode())} bytes')


if __name__ == '__main__':
    main()
