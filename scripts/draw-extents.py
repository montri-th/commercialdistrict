#!/usr/bin/env python3
"""CityMETER · Commercial District — draw the trial wider areas (0.3.0) in a headless browser, then look at them.

    python3 -I scripts/draw-extents.py draw --out <export.json> [--places patong,siam] [browser options]
    python3 -I scripts/draw-extents.py review --out-dir <folder> [--lang th|en] [browser options]
    browser options: [--chrome <executable>] [--maplibre-dist <maplibre-gl 5.6.2 npm dist folder>] [--tiles-dir <folder>]

draw — serves this repository on 127.0.0.1, opens the page in headless Chrome (WebGL in software), loads
scripts/draw-extents.browser.js and runs it on the places (all ten by default). The page's own map reads the
OpenFreeMap tiles, so this needs the network to reach tiles.openfreemap.org. The other inputs are pinned:
  registry outlines  data/boundaries.geojson of this repository, served as it is
  hotels             montri-th/hotel at the commit data/neighborhoods.json names, SHA-256 checked (check figures only)
  subdistricts       montri-th/pharmacy data/frames/<province>.json at the commit data/neighborhoods.json names for the
                     Pharmacy dataset (CityMETER production SUBDISTRICT outlines), SHA-256 recorded in the export
Then: python3 -I scripts/extents-from-export.py <export.json> amendments/extents-<date>.geojson, and
scripts/build-extents.py.

review — opens each wider area's first core on the built page (data/extents.json), shows the whole area on the map and
saves a screenshot per place: what the owner reviews before a release.

--maplibre-dist serves MapLibre from a copy of the npm package (the bytes unpkg serves; the page checks them by
Subresource Integrity). --tiles-dir serves tiles from a folder instead of OpenFreeMap: tests only, never a release.
Every other address the page asks for is refused. TLS is verified (SSL_CERT_FILE or REQUESTS_CA_BUNDLE when set).
"""
import argparse, asyncio, functools, gzip, hashlib, http.server, json, os, ssl, subprocess, sys, tempfile, threading, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRAW_JS = os.path.join(ROOT, 'scripts', 'draw-extents.browser.js')
MAPLIBRE = 'https://unpkg.com/maplibre-gl@5.6.2/dist/'
TILES = 'https://tiles.openfreemap.org/'


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def pinned(repo, commit, path, cache):
    """A file of a GitHub repository at a commit, kept in the cache."""
    dest = os.path.join(cache, repo.replace('/', '__'), commit, path)
    if not os.path.exists(dest):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        subprocess.run(['curl', '-sSfL', '--retry', '3', '-o', dest, f'https://raw.githubusercontent.com/{repo}/{commit}/{path}'], check=True)
    return open(dest, 'rb').read()


def ssl_context():
    ca = os.environ.get('SSL_CERT_FILE') or os.environ.get('REQUESTS_CA_BUNDLE')
    return ssl.create_default_context(cafile=ca) if ca else ssl.create_default_context()


def fetch(url, ctx):
    req = urllib.request.Request(url, headers={'Accept-Encoding': 'gzip, identity', 'User-Agent': 'citymeter-commercialdistrict-extents'})
    with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
        body = r.read()
        if (r.headers.get('Content-Encoding') or '').lower() == 'gzip':
            body = gzip.decompress(body)
        return r.status, r.headers.get('Content-Type') or 'application/octet-stream', body


def serve(root):
    handler = functools.partial(type('Quiet', (http.server.SimpleHTTPRequestHandler,), {'log_message': lambda *a: None}), directory=root)
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}'


class Inputs:
    """The pinned files behind /hotel/… and /pharmacy/… on the local page, with their identity."""

    def __init__(self, cache):
        N = json.load(open(os.path.join(ROOT, 'data', 'neighborhoods.json'), encoding='utf-8'))
        src = {d['id']: d['source'] for d in N['datasets']}
        self.cache, self.hotel, self.pharmacy, self.files = cache, src['hotel'], src['pharmacy'], {}

    def get(self, path):
        if path == '/hotel/data/hotels.json':
            s = self.hotel
            b = pinned(s['repo'], s['commit'], s['file'], self.cache)
            if sha256(b) != s['sha256']:
                raise SystemExit(f"hotels.json has SHA-256 {sha256(b)}, neighborhoods.json read {s['sha256']}")
        elif path.startswith('/pharmacy/data/frames/') and path.endswith('.json'):
            s = self.pharmacy
            b = pinned(s['repo'], s['commit'], 'data/frames/' + path.rsplit('/', 1)[1], self.cache)
        else:
            return None
        self.files[path] = sha256(b)
        return b

    def record(self):
        frames = {p.rsplit('/', 1)[1][:-5]: h for p, h in sorted(self.files.items()) if p.startswith('/pharmacy/')}
        retrieved = None
        if frames:
            first = next(iter(frames))
            meta = json.loads(pinned(self.pharmacy['repo'], self.pharmacy['commit'], f'data/frames/{first}.json', self.cache)).get('metadata', {})
            retrieved = meta.get('retrievedOn')
        return {'cores': {'file': 'data/boundaries.geojson', 'sha256': sha256(open(os.path.join(ROOT, 'data', 'boundaries.geojson'), 'rb').read())},
                'hotels': {'repo': self.hotel['repo'], 'commit': self.hotel['commit'], 'file': self.hotel['file'], 'sha256': self.hotel['sha256']},
                'subdistricts': {'repo': self.pharmacy['repo'], 'commit': self.pharmacy['commit'], 'files': 'data/frames/<province>.json',
                                 'sha256': frames, 'retrievedOn': retrieved, 'source': 'CityMETER production SUBDISTRICT outlines'}}


async def open_page(p, a, base, inputs, lang='th'):
    browser = await p.chromium.launch(executable_path=a.chrome or None, args=['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    page = await browser.new_page(viewport={'width': 1440, 'height': 900}, color_scheme='light')
    ctx = ssl_context()
    refused = set()

    async def route(r):
        u = r.request.url
        if u.startswith(base):
            path = '/' + u[len(base):].lstrip('/').split('?')[0]
            body = inputs.get(path) if inputs else None
            return await (r.fulfill(body=body, content_type='application/json') if body is not None else r.continue_())
        if u.startswith(MAPLIBRE) and a.maplibre_dist:
            f = u[len(MAPLIBRE):].split('?')[0]
            return await r.fulfill(path=os.path.join(a.maplibre_dist, f), content_type='text/css' if f.endswith('.css') else 'application/javascript', headers={'access-control-allow-origin': '*'})
        if u.startswith(TILES) and a.tiles_dir:
            rel = u[len(TILES):].split('?')[0]
            if rel == 'planet':
                return await r.fulfill(path=os.path.join(a.tiles_dir, 'tilejson.json'), content_type='application/json', headers={'access-control-allow-origin': '*'})
            parts = rel.split('/')
            if rel.startswith('planet/') and len(parts) == 5 and os.path.exists(os.path.join(a.tiles_dir, *parts[2:])):
                return await r.fulfill(path=os.path.join(a.tiles_dir, *parts[2:]), content_type='application/x-protobuf', headers={'access-control-allow-origin': '*'})
            return await r.fulfill(status=204, headers={'access-control-allow-origin': '*'})
        if u.startswith(MAPLIBRE) or u.startswith(TILES):
            try:
                status, ctype, body = await asyncio.to_thread(fetch, u, ctx)
                return await r.fulfill(status=status, body=body, content_type=ctype, headers={'access-control-allow-origin': '*'})
            except Exception as e:  # a tile the server does not have, or the network
                refused.add(f'{u.split("?")[0]} ({type(e).__name__})')
                return await r.abort()
        refused.add(u.split('?')[0])
        return await r.abort()

    await page.route('**/*', route)
    page.on('pageerror', lambda e: print('page error:', str(e)[:300], file=sys.stderr))
    return browser, page, refused


async def wait_map(page):
    await page.wait_for_function('() => window.__citymeter && window.__citymeter.map && window.__citymeter.map.loaded()', timeout=90000)
    await page.evaluate('() => new Promise(res => { const m = window.__citymeter.map; if (m.areTilesLoaded()) return res(); m.once("idle", res); setTimeout(res, 15000); })')


async def draw(a):
    from playwright.async_api import async_playwright
    httpd, base = serve(ROOT)
    inputs = Inputs(a.cache)
    keys = [k for k in (a.places or '').split(',') if k]
    async with async_playwright() as p:
        browser, page, refused = await open_page(p, a, base, inputs)
        await page.goto(f'{base}/?v3d=0', wait_until='domcontentloaded')
        await wait_map(page)
        await page.add_script_tag(path=DRAW_JS)
        opts = {'coresUrl': '/data/boundaries.geojson', 'hotelsUrl': '/hotel/data/hotels.json', 'framesBase': '/pharmacy/data/frames/'}
        task = asyncio.ensure_future(page.evaluate('async ([keys, o]) => { const P = window.__ext.PLACES.filter(p => !keys.length || keys.includes(p.key)); await window.__ext.run(P, o); return window.__ext.exportText(); }', [keys, opts]))
        t0, last = time.time(), ''
        while not task.done():
            await asyncio.sleep(5)
            try:
                st = await page.evaluate('() => window.__ext && window.__ext.S.status')
            except Exception:
                st = '?'
            if st != last:
                print(f'{time.time() - t0:6.0f}s {st}', file=sys.stderr)
                last = st
        text = task.result()
        version = browser.version
        await browser.close()
    httpd.shutdown()
    X = json.loads(text)
    head = subprocess.run(['git', '-C', ROOT, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
    X['inputs'] = {**inputs.record(), 'page': f'this repository at {head}' if head else 'this repository', 'browser': f'headless Chrome {version}',
                   'refused': sorted(refused)[:50]}
    with open(a.out, 'w', encoding='utf-8') as fh:
        json.dump(X, fh, ensure_ascii=False)
    for pl in X['places']:
        c = pl['check']
        print(f"{pl['key']:<16} {pl['rule']:<5} {c['areaM2'] / 1600:>7.0f} ไร่  core {c['coreM2'] / 1600:>5.0f}  hotels {c['hotelsCore']}→{c['hotels']}  "
              f"osm buildings {c['osmBuildingsCore']}→{c['osmBuildings']}  other cores {c['otherCores']}  edge {c['edgeCells']}", file=sys.stderr)
    if X.get('errors'):
        print('errors:', X['errors'], file=sys.stderr)
        sys.exit(1)


async def review(a):
    from playwright.async_api import async_playwright
    E = json.load(open(os.path.join(ROOT, 'data', 'extents.json'), encoding='utf-8'))
    httpd, base = serve(ROOT)
    os.makedirs(a.out_dir, exist_ok=True)
    async with async_playwright() as p:
        browser, page, refused = await open_page(p, a, base, None, a.lang)
        for it in E['items']:
            q = f"?f.neighborhood={it['cores'][0]}&v3d=0" + ('&lang=en' if a.lang == 'en' else '')
            await page.goto(f'{base}/{q}', wait_until='domcontentloaded')
            await page.wait_for_function('() => window.__citymeter && window.__citymeter.state && window.__citymeter.state.extents && document.querySelector(\'[data-action="fit-extent"]\')', timeout=90000)
            await wait_map(page)
            await page.click('[data-action="fit-extent"]')
            await page.wait_for_timeout(1500)
            await page.evaluate('() => new Promise(res => { const m = window.__citymeter.map; m.once("idle", res); setTimeout(res, 15000); })')
            out = os.path.join(a.out_dir, f"{it['id']}-{a.lang}.png")
            await page.screenshot(path=out)
            missing = await page.evaluate('() => window.__citymeterI18n ? [...window.__citymeterI18n.missing] : []') if a.lang == 'en' else []
            print(out, 'missing English:', missing[:5], file=sys.stderr)
        await browser.close()
    httpd.shutdown()


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='cmd', required=True)
    for name in ('draw', 'review'):
        s = sp.add_parser(name)
        s.add_argument('--chrome', default='')
        s.add_argument('--maplibre-dist', default='')
        s.add_argument('--tiles-dir', default='')
        s.add_argument('--cache', default=os.path.join(tempfile.gettempdir(), 'citymeter-extents-cache'))
        if name == 'draw':
            s.add_argument('--out', required=True)
            s.add_argument('--places', default='')
        else:
            s.add_argument('--out-dir', required=True)
            s.add_argument('--lang', default='th', choices=['th', 'en'])
    a = ap.parse_args()
    asyncio.run(draw(a) if a.cmd == 'draw' else review(a))


if __name__ == '__main__':
    main()
