#!/usr/bin/env python3
"""CityMETER · Commercial District — logos of the records and of the centres (release 0.5.1).

    python3 -I scripts/build-logos.py --root <folder that holds the family's checkouts> --built-on YYYY-MM-DD

Owner 2026-11-26 06:14, VERBATIM: “เรื่องโลโก้นี้ ให้แสดงใน Commercial district ในลักษณะเดียวกับ venue ด้วย โดยเฉพาะ
venue และ POI สำคัญ”. No logo is collected here: every file is one a demo of the family already ships, checked against
the SHA-256 of the record that ships it (the family's logo kit, scripts/logo-kit, the same bytes in every repository).
A record takes a logo only by ids (DATA_METHOD.md §13):
  * a brand record (hotel, fitness, restaurant, grocery, camera, luxury, pharmacy, university): its key in its own
    demo's data → the brand id that demo gives it → the logo that demo's registry gives that id (kit: own id or the same
    id in another dataset of the family; never a name rewrite, never fuzzy);
  * a shopping centre and a centre «รอบย่านนี้» names: the Shopping Center venue id → the family's venue logo (kit
    VenuePool), roles venue_specific and parent_complex only (a shared department-store or chain banner is left out);
  * an office: its Office ID → montri-th/office data/office-logos.json;
  * a station record: its line → the line's mark in montri-th/transit data/operator-logos.json (a line in service whose
    GTFS names its operator; a line under construction takes none).
The source files are read from the checkouts at their current commits; each is recorded with its commit and SHA-256,
and a brand dataset whose file differs from the one the records were built from (neighborhoods.json → source.sha256)
is joined only where the key reads the same name, else left without logos.
Display: SVG and rasters ≤ 512 px and ≤ 64 KB keep their bytes; larger rasters are scaled uniformly to 384 px on the
longest side as WebP (the original SHA-256 is kept). Plates: the family's (#FFFFFF, #E5E9E6, #182327), both themes.
Writes assets/logos/<sha256 20>.<ext>, data/logos/<neighbourhood id>.json (one per records shard, empty maps where a
neighbourhood has no logo) and data/logos-report.json.
"""
import argparse, collections, glob, hashlib, io, json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'logo-kit'))
import citymeter_logos as kit  # noqa: E402
from PIL import Image  # noqa: E402

MAX_EDGE, MAX_BYTES, TARGET_EDGE = 512, 64 * 1024, 384
EXT = {'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif'}
VENUE_ROLES = ('venue_specific', 'parent_complex')
BRAND = {  # CD dataset id → the kit's dataset name for its brand ids
    'hotel': 'research.TH.hotel', 'fitness': 'research.TH.fitness', 'restaurant': 'research.TH.restaurants',
    'grocery': 'research.TH.grocery', 'camera': 'research.TH.camera', 'luxurybrands': 'research.TH.luxury',
    'university': 'research.TH.university',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(root, repo, path, used):
    full = os.path.join(root, repo, path)
    raw = open(full, 'rb').read()
    used[f'{repo}/{path}'] = {'commit': kit.git_head(os.path.join(root, repo)), 'sha256': sha(raw)}
    return json.loads(raw)


def brand_links(root, used):
    """CD dataset id → {record key → (brand id, name the demo gives the record)}: the ids each demo's own data gives."""
    out = {}
    d = load(root, 'hotel', 'data/hotels.json', used); c = d['cols']
    out['hotel'] = {c['key'][i]: (d['brands'][b]['id'], c['name'][i]) for i, b in enumerate(c['brand']) if isinstance(b, int) and b >= 0}
    d = load(root, 'fitness', 'data/fitness.json', used); c = d['cols']
    out['fitness'] = {c['key'][i]: (d['brands'][b]['id'], c['name'][i]) for i, b in enumerate(c['brand']) if isinstance(b, int) and b >= 0}
    d = load(root, 'pharmacy', 'data/pharmacies.json', used); c = d['cols']
    out['pharmacy'] = {c['key'][i]: (d['brands'][b]['id'], c['name'][i]) for i, b in enumerate(c['brand']) if isinstance(b, int) and b >= 0}
    d = load(root, 'restaurant', 'data/restaurants.json', used); c = d['cols']
    out['restaurant'] = {c['key'][ri]: (d['brands'][bi]['id'], c['name'][ri]) for ri, bi in d['brand'] if isinstance(bi, int) and bi >= 0}
    d = load(root, 'grocery', 'data/grocery.json', used); F = {f: i for i, f in enumerate(d['fields'])}
    out['grocery'] = {r[F['id']]: (d['brands'][r[F['brand']]]['id'], r[F['name']]) for r in d['rows'] if isinstance(r[F['brand']], int) and r[F['brand']] >= 0}
    d = load(root, 'camera', 'data/camera.json', used); by = {b['name']: b['id'] for b in d['brands']}
    out['camera'] = {r['id']: (by[r['brand']], r.get('name')) for r in d['rows'] if r.get('brand') in by}
    reg = load(root, 'luxurybrands', 'data/brand-logos.json', used); by = {b['name']: b['id'] for b in reg['brands']}
    d = load(root, 'luxurybrands', 'data/luxury.json', used)
    out['luxurybrands'] = {r['id']: (by[r['brand']], r.get('name')) for r in d['rows'] if r.get('brand') in by}
    d = load(root, 'university', 'data/universities.json', used); s = d['sites']
    out['university'] = {s['key'][i]: (d['universities'][u]['key'], s['name'][i]) for i, u in enumerate(s['uni']) if isinstance(u, int) and u >= 0}
    return out


def display(raw, mime):
    """(bytes, mime, width, height, transformation) under the family's display rule."""
    if mime == 'image/svg+xml':
        w, h = kit.dimensions(raw, mime)
        return raw, mime, w, h, 'none'
    im = Image.open(io.BytesIO(raw))
    im.load()
    w, h = im.size
    if max(w, h) <= MAX_EDGE and len(raw) <= MAX_BYTES and mime in EXT:
        return raw, mime, w, h, 'none'
    alpha = im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)
    im = im.convert('RGBA' if alpha else 'RGB')
    scale = min(1.0, TARGET_EDGE / max(im.size))
    if scale < 1:
        im = im.resize((max(1, round(im.size[0] * scale)), max(1, round(im.size[1] * scale))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', **({'lossless': True, 'quality': 100, 'method': 6} if alpha else {'quality': 90, 'method': 6}))
    how = 'lossless' if alpha else 'quality 90'
    for q in (90, 80, 70):  # (0.5.2) a mark still over 64 KB once lossless (photo-like) keeps its alpha at the first quality that fits
        if buf.tell() <= MAX_BYTES:
            break
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=q, alpha_quality=100, method=6)
        how = f'quality {q}' + (', alpha kept' if alpha else '')
    return buf.getvalue(), 'image/webp', im.size[0], im.size[1], f'uniform scale to {TARGET_EDGE} px longest side, WebP ' + how


class Out:
    """The files this demo ships, by the SHA-256 of the source file."""

    def __init__(self):
        self.by_source, self.logos = {}, {}
        shutil.rmtree(os.path.join(ROOT, 'assets/logos'), ignore_errors=True)
        os.makedirs(os.path.join(ROOT, 'assets/logos'))

    def add(self, raw, mime, plate, label, origin):
        source = sha(raw)
        if source in self.by_source:
            return self.by_source[source]
        if plate not in kit.LDS_PLATES:
            plate = kit.plate_for(raw, mime)
        data, out_mime, w, h, how = display(raw, mime)
        digest = sha(data)
        key = 'LG-' + digest[:16]
        name = f'{digest[:20]}.{EXT[out_mime]}'
        open(os.path.join(ROOT, 'assets/logos', name), 'wb').write(data)
        self.logos[key] = {'file': f'assets/logos/{name}', 'sha256': digest, 'mime': out_mime, 'bytes': len(data),
                           'width': round(float(w), 2), 'height': round(float(h), 2), 'plate': plate.upper(), 'label': label or '',
                           'origin': origin, 'sourceSha256': source, 'transformation': how}
        self.by_source[source] = key
        return key


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', required=True)
    ap.add_argument('--built-on', required=True)
    a = ap.parse_args()
    root = os.path.abspath(a.root)
    model = json.load(open(os.path.join(ROOT, 'data/neighborhoods.json'), encoding='utf-8'))
    ids = [d['id'] for d in model['datasets']]
    pinned = {d['id']: d['source'] for d in model['datasets']}
    used = {}
    pool = kit.build_pool(root)
    venues = kit.build_venue_pool(root)
    links = brand_links(root, used)
    ph = load(root, 'pharmacy', 'data/brand-logos.json', used)['logos']
    office = load(root, 'office', 'data/office-logos.json', used)
    tr = load(root, 'transit', 'data/transit.json', used)
    tlogos = load(root, 'transit', 'data/operator-logos.json', used)
    line_by, sys_by = {l['id']: l for l in tr['lines']}, {s['id']: s for s in tr['systems']}
    station_line = {s['id']: (s.get('lineIds') or [None])[0] for s in tr['stations']}
    out = Out()
    counts = collections.defaultdict(collections.Counter)

    def file_logo(repo, rec, label, origin):
        full = os.path.join(root, repo, rec['file'])
        raw = open(full, 'rb').read()
        if sha(raw) != rec['sha256']:
            return None, 'sha256 differs'
        return out.add(raw, rec.get('mime') or kit.guess_mime(full, raw), str(rec.get('plate') or rec.get('background') or ''), label, origin), 'own'

    def venue_logo(vid):
        link, how = venues.resolve(vid)
        if not link:
            return None, how
        if link['role'] not in VENUE_ROLES:
            return None, 'role ' + link['role']
        f = venues.files[link['sha256']]
        raw = open(os.path.join(root, f['repo'], f['path']), 'rb').read()
        return out.add(raw, f['mime'], f['background'], '', f'montri-th/{f["repo"]} venue logo ({link["role"]})'), link['role']

    def record_logo(ds, key, name):
        if ds in BRAND or ds == 'pharmacy':
            hit = links[ds].get(key)
            if not hit:
                return None, 'no brand'
            brand, own_name = hit
            if used_sha.get(ds) != pinned[ds]['sha256'] and (own_name or '').strip() != (name or '').strip():
                return None, 'source changed'
            if ds == 'pharmacy':
                rec = ph.get(brand)
                return file_logo('pharmacy', rec, rec.get('name'), 'montri-th/pharmacy brand logo') if rec else (None, 'brand without logo')
            digest, how = pool.resolve(BRAND[ds], brand)
            if not digest:
                return None, 'brand without logo'
            f = pool.files[digest]
            return out.add(pool.read(digest), f['mime'], f['background'], '', f'{f["source"]["repo"]} brand logo'), how
        if ds == 'shoppingcenter':
            return venue_logo(key)
        if ds == 'office':
            lk = office['offices'].get(key)
            if not lk:
                return None, 'no logo'
            rec = office['logos'][lk]
            return file_logo('office', rec, rec.get('label'), 'montri-th/office building logo')
        if ds == 'transit':
            line = line_by.get(station_line.get(key))
            if not line or line.get('status') == 'construction' or not str(line.get('operator') or '').strip():
                return None, 'no operator'
            slots = tlogos['agencies'].get((sys_by.get(line.get('systemId')) or {}).get('operatorId') or '') or {}
            lk = slots.get('system') or slots.get('operator')
            if not lk:
                return None, 'no logo'
            rec = tlogos['logos'][lk]
            return file_logo('transit', rec, rec.get('label'), 'montri-th/transit operator logo')
        return None, 'no logo source'

    used_sha = {}
    for ds, src in pinned.items():
        rel = f'{src["repo"].split("/")[1]}/{src["file"]}'
        if rel in used:
            used_sha[ds] = used[rel]['sha256']
    shutil.rmtree(os.path.join(ROOT, 'data/logos'), ignore_errors=True)
    os.makedirs(os.path.join(ROOT, 'data/logos'))
    around = json.load(open(os.path.join(ROOT, 'data/around.json'), encoding='utf-8'))
    shards = with_logo = 0
    for path in sorted(glob.glob(os.path.join(ROOT, 'data/records/*.json'))):
        rec = json.load(open(path, encoding='utf-8'))
        F = {f: i for i, f in enumerate(rec['fields'])}
        records, vmap = {}, {}
        for r in rec['rows']:
            ds = ids[r[F['dataset']]]
            key = str(r[F['key']])
            lk, how = record_logo(ds, key, r[F['name']])
            counts[ds]['records'] += 1
            counts[ds][how if lk else f'none: {how}'] += 1
            if lk:
                records[f'{ds}:{key}'] = lk
        v = (around.get('rows') or {}).get(rec['id'], {}).get('v') or {}
        for vid in sorted(set(v.get('in') or []) | set(x if isinstance(x, str) else x[0] for x in (v.get('near') or []))):
            lk, how = venue_logo(vid)
            counts['around venues']['venues'] += 1
            counts['around venues'][how if lk else f'none: {how}'] += 1
            if lk:
                vmap[vid] = lk
        # every neighbourhood with records has a shard (empty maps where none), so a shard that fails to load is a real gap
        keys = sorted(set(records.values()) | set(vmap.values()))
        shard = {'schema': 1, 'id': rec['id'],
                 'logos': {k: {x: out.logos[k][x] for x in ('file', 'width', 'height', 'plate')} for k in keys},
                 'records': dict(sorted(records.items())), 'venues': dict(sorted(vmap.items()))}
        with open(os.path.join(ROOT, 'data/logos', f'{rec["id"]}.json'), 'w', encoding='utf-8') as f:
            json.dump(shard, f, ensure_ascii=False, separators=(',', ':'))
            f.write('\n')
        shards += 1
        with_logo += bool(records or vmap)
    report = {'schemaVersion': 1, 'builtOn': a.built_on, 'kit': f'{kit.KIT} {kit.VERSION}',
              'rule': 'ids only: record key → the brand id its own demo gives → the logo that demo ships (kit own / same-id); centres by venue id (roles venue_specific, parent_complex); offices by Office ID; stations by line',
              'display': f'SVG and rasters ≤ {MAX_EDGE} px and ≤ {MAX_BYTES // 1024} KB keep their bytes; larger rasters → {TARGET_EDGE} px longest side WebP; plates {sorted(kit.LDS_PLATES)} on both themes',
              'inputs': dict(sorted(used.items())), 'pool': {k: v for k, v in pool.summary().items() if k != 'issues'},
              'venuePool': {k: v for k, v in venues.summary().items() if k != 'issues'},
              'issues': pool.issues + venues.issues, 'shards': shards, 'shardsWithLogo': with_logo, 'files': len(out.logos),
              'counts': {k: dict(sorted(v.items())) for k, v in sorted(counts.items())},
              'logos': dict(sorted(out.logos.items())),
              'rights': 'เครื่องหมายเป็นของเจ้าของแต่ละราย การแสดงเพื่อระบุแบรนด์หรือสถานที่ไม่ใช่ใบอนุญาตเครื่องหมายการค้า'}
    with open(os.path.join(ROOT, 'data/logos-report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(json.dumps({'shards': shards, 'files': len(out.logos), 'counts': report['counts']}, ensure_ascii=False, indent=0)[:3000])


if __name__ == '__main__':
    main()
