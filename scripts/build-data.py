#!/usr/bin/env python3
"""CityMETER · Commercial District — build the demo's data from the central neighbourhood registry and the 16 demos.

    python3 -I scripts/build-data.py --bundle <unzipped registry bundle> --registry <registry .xlsx export>
        --repos <folder with the 16 demo clones> --commits <commits.json> --mapshaper <path to mapshaper>
        [--condo <condominium research master .xlsx export>] [--lodging <current lodging review folder of the bundle>]
        [--prev-canonical <the canonical outlines of the previous data release>] --out data

Read only. Inputs:
  bundle    the owner's bundle «CityMETER • ทะเบียนย่าน ขอบเขต และหลักฐานล่าสุด.zip» unzipped: national-gis/canonical-
            boundaries.geojson (2026-11-17-commercial-recovery-9: 370 canonical codes, 358 closed draft outlines, 2 held,
            10 collections) and its revision summary. Since 2026-11-18 the bundle stores that file as a lossless byte alias
            (scripts/restore-bundle-member.py restores it, every SHA-256 checked; gis/revision-summary.json is its revision summary). The outlines are drawn as they are (no
            edit); the display copy is simplified with shared edges kept.
  lodging   (0.2.0) the bundle's current lodging review (lodging-held78-recovery-2026-11-18): decision-ledger.json (268
            proposals screened from 30,730 lodging records by walking 400/800 m, model only) and boundaries/current-
            all268-review-drafts.geojson (130 review drafts). Owner 2026-11-18, VERBATIM: “2 และ update เป็นย่านในทะเบียน”:
            the 79 new lodging areas are neighbourhoods of this demo — the 37 with a review draft are drawn and counted
            like the registry's outlines, the 42 without one are searchable only. (0.2.1) Owner 2026-11-18, VERBATIM:
            “update เป็นย่านในทะเบียน”, then “ทั้ง 79”: the registry admitted all 79 as central codes the same day
            (tab ชื่อกลาง, code CMN-TH-<the proposal's hex> for LP-NEW-<hex>; --admitted is the read-back of those rows,
            checked by SHA-256 against the sheet); the 37 drafts stay draft outlines, the 42 are held codes. The review's
            walking figures are published per neighbourhood (status, lodging reached, reported rooms/units, services
            reached); its origins, evidence names, links, reviewers and field questions are not.
  registry  the central neighbourhood registry (Google Sheet, internal) exported as .xlsx: aliases (ชื่อกลาง) and the
            roles it proposes from its evidence rows (หลักฐานบทบาท). Its internal working fields (field questions, source
            ids, merge notes, outline policy versions) are not published (owner 2026-11-16).
  repos     the public demo repositories; each demo's own data file, read with the demo's own default scope.
  condo     (0.1.3) CityMETER Condominium Thailand — Research Master (Google Sheet, internal) exported as .xlsx: tab
            07_PRODUCTION, the points the CityMETER condominium appraisal map draws. Shown on the map only, never counted
            in a neighbourhood (its own spatial policy: a display point does not make an area membership).

Outputs (data/): neighborhoods.json (registry rows + per-dataset counts and comparisons), boundaries.geojson (display
outlines), records/<neighbourhood id>.json (0.1.3: the located records inside one outline, with the key, name and
figure each demo publishes — loaded when the neighbourhood opens), condo/ (0.1.3: the condominium display points in
0.1° cells, condo/index.json lists the cells), build-report.json.

Rules (DATA_METHOD.md):
  * A record counts in a neighbourhood when its point lies inside the outline (covers: an edge point belongs to the
    first outline in canonical order). Records without a point are never placed; the coverage is printed per dataset.
  * A dataset covers a province when at least one of its located records lies in the province (CityMETER production
    outlines, data/provinces.geojson). In a province it does not cover, a neighbourhood's value is "out of scope",
    never 0.
  * Counts of different datasets are never added together; each dataset keeps its own unit.
  * Density = records / area (km²) with the registry's own area_m2 (metric CRS of the registry, never recomputed).
  * A neighbourhood is ranked for a dataset when it holds at least MIN_COUNT records (the peers are the neighbourhoods
    of the covered provinces that also hold MIN_COUNT); the rank is by density, ties share the better rank.
"""
import argparse, hashlib, json, math, os, subprocess, sys, tempfile
from collections import Counter, defaultdict
from datetime import date

import openpyxl
from shapely.geometry import shape, Point, mapping
from shapely.strtree import STRtree
from shapely.prepared import prep

MIN_COUNT = 3          # records a neighbourhood needs before it is ranked for a dataset
TOP_SHARE = 0.10       # the best tenth of the ranked peers is a highlight ("หนาแน่นอันดับต้น")
MIN_PEERS = 10         # a rank highlight needs at least this many ranked peers
RARE_SHARE = 0.15      # present in at most this share of the covered neighbourhoods is a highlight ("มีไม่กี่ย่าน")
NATIONAL_SHARE = 0.05  # holding at least this share of the dataset's located records is a highlight
PAIR_MIN_BOTH = 8      # a co-location pair needs this many neighbourhoods holding both
STRENGTH_MIN = 0.75    # a comparison counts as a strength from the top quarter of its peers
MAX_HIGHLIGHTS = 4
PAIR_MIN_RHO = 0.35

TH_BOX = (97.0, 5.3, 106.0, 20.8)

DATASETS = [
    # id, demo path, repo, file in repo, English menu name, Thai name, group (registry), unit th/en
    ('hotel', 'hotel', 'hotel', 'data/hotels.json', 'Hotel', 'ที่พัก', 'Land', 'แห่ง', 'places'),
    ('industrialestate', 'industrialestate', 'factory', 'industrialestate/data/estates.json', 'Industrial Estate', 'นิคมอุตสาหกรรม', 'Land', 'แห่ง', 'estates'),
    ('office', 'office', 'office', 'data/offices.json', 'Office', 'สำนักงาน', 'Land', 'รายการ', 'records'),
    ('shoppingcenter', 'shoppingcenter', 'shoppingcenter', 'data/venues.json', 'Shopping Center', 'ศูนย์การค้าและตลาด', 'Land', 'แห่ง', 'places'),
    ('camera', 'camera', 'camera', 'data/camera.json', 'Camera Shops', 'ร้านกล้อง', 'Location', 'สาขา', 'outlets'),
    ('factory', 'factory', 'factory', 'data/factories.json', 'Factory', 'โรงงาน', 'Location', 'ทะเบียน', 'registrations'),
    ('fitness', 'fitness', 'fitness', 'data/fitness.json', 'Fitness', 'ฟิตเนส', 'Location', 'สาขา', 'branches'),
    ('grocery', 'grocery', 'grocery', 'data/grocery.json', 'Grocery', 'ร้านค้าปลีกของใช้', 'Location', 'ร้าน', 'stores'),
    ('luxurybrands', 'luxurybrands', 'luxurybrands', 'data/luxury.json', 'Luxury Brands', 'แบรนด์หรู', 'Location', 'จุดขาย', 'points of sale'),
    ('pharmacy', 'pharmacy', 'pharmacy', 'data/pharmacies.json', 'Pharmacy', 'ร้านยา', 'Location', 'ร้าน', 'pharmacies'),
    ('restaurant', 'restaurant', 'restaurant', 'data/restaurants.json', 'Restaurants', 'ร้านอาหาร', 'Location', 'ร้าน', 'restaurants'),
    ('governmentoffice', 'governmentoffice', 'governmentoffice', 'data/offices.json', 'Government Office', 'หน่วยงานรัฐ', 'Living', 'แห่ง', 'places'),
    ('hospital', 'hospital', 'hospital', 'data/hospitals.json', 'Hospital', 'สถานพยาบาล', 'Living', 'แห่ง', 'facilities'),
    ('school', 'school', 'school', 'data/schools.json', 'School', 'สถานศึกษา', 'Living', 'แห่ง', 'schools'),
    ('transit', 'transit', 'transit', 'data/transit.json', 'Transit', 'สถานีราง', 'Living', 'สถานี–สาย', 'station-line records'),
    ('university', 'university', 'university', 'data/universities.json', 'University', 'มหาวิทยาลัย', 'Living', 'แห่ง', 'sites'),
]

# The `e` kind each demo's address opens a record with (the demo's own createCodec `items`, read 2026-11-16 at the
# commits in commits.json): a record link is <demo>/?e=<kind>:<key>.
ITEM_KIND = {
    'hotel': 'hotel', 'industrialestate': 'estate', 'office': 'office', 'shoppingcenter': 'venue', 'camera': 'store',
    'factory': 'factory', 'fitness': 'store', 'grocery': 'store', 'luxurybrands': 'store', 'pharmacy': 'store',
    'restaurant': 'store', 'governmentoffice': 'office', 'hospital': 'facility', 'school': 'school', 'transit': 'station',
    'university': 'site',
}

# Condominium display points (0.1.3, owner 2026-11-16 “ควรแสดงจุด Condominium ด้วย … เอา condo จาก dataset ใน registry
# ไง”): the registry's condominium dataset (group Land), tab 07_PRODUCTION of its research master. Only the points the
# source marks as observed in the production map and whose search area is not held for a conflict are drawn; held,
# duplicate and pointless rows are counted in the report and never drawn. Never counted in a neighbourhood.
CONDO_SHOWN = 'observed_in_provider_tile_not_independent_site_confirmation'
CONDO_CELL = 0.1  # degrees: the map loads the cells in view

# Lodging screen of the registry (0.2.0): status codes of its ledger → short codes, in reading order. Thai labels come
# from the ledger itself (VERBATIM); the English ones are this demo's rendering.
LODGING_STATUS = {'A_compact5_and_services400': 'A', 'B_compact3_and_services400': 'B', 'C_extended800_and_services': 'C',
                  'H_lodging_access_evidence': 'HL', 'H_support_access_evidence': 'HS', 'H_unknown_origin': 'HO'}
LODGING_STATUS_ORDER = ['A', 'B', 'C', 'HS', 'HL', 'HO']
LODGING_STATUS_EN = {'A': 'Dense lodging core with services reached within 400 m', 'B': 'Small lodging core with services reached within 400 m',
                     'C': 'Lodging and services reached within 800 m; continuity still to check',
                     'HS': 'Held: services reached on foot not yet complete', 'HL': 'Held: fewer than 3 lodging places reached on foot',
                     'HO': 'Held: start point or walking network unknown'}
LODGING_BOUNDARY_EN = {
    'คงขอบเดิม: ยังไม่มีหลักฐานตำแหน่งใหม่เพียงพอ': 'Outline kept: not enough new location evidence',
    'คงขอบเดิม: ส่วนต่อเนื่องยังขาดช่วง': 'Outline kept: the continuation still has a gap',
    'คงขอบเดิม: แนวจริงยังปิดไม่ลง': 'Outline kept: the real edges do not close yet',
    'คงขอบเดิมและพักการขยาย': 'Outline kept; extension held',
    'คงร่างขอบเดิม: ยังไม่มีหลักฐานตำแหน่งใหม่เพียงพอ': 'Draft outline kept: not enough new location evidence',
    'คงร่างขอบเดิม: ส่วนที่จะขยายยังระบุแนวตรวจไม่ชัด': 'Draft outline kept: the edge of the extension is not yet clear',
    'พัก: ขอบ campus หรือบริบทยังไม่ลงตัว': 'Held: the campus or context edge is not settled',
    'พัก: ขอบcampusยังไม่ลงตัว': 'Held: the campus edge is not settled',
    'พัก: ขอบหลายก้อนยังเชื่อมไม่ชัด': 'Held: the parts are not yet clearly joined',
    'พัก: ทับย่านเดิม ต้องทบทวนร่วมกัน': 'Held: overlaps an existing neighbourhood, to review together',
    'พัก: ส่วนต่อเนื่องทับกับข้อเสนออื่น': 'Held: the continuation overlaps another proposal',
    'พัก: หลักฐานทางเดินยังไม่รองรับ': 'Held: the walking evidence does not support it yet',
    'พัก: แนวจริงยังปิดไม่ลง': 'Held: the real edges do not close yet',
    'พักการปิดขอบ: ยังไม่มีหลักฐานตำแหน่งใหม่เพียงพอ': 'Outline held: not enough new location evidence',
    'ร่างบริเวณใหม่ รอตรวจชื่อและขอบ': 'New-area draft; name and edges to check',
    'ร่างส่วนต่อเนื่อง รอตรวจในพื้นที่': 'Continuation draft; to check on site',
    'ใช้ขอบเดิม ตรวจเพิ่มบทบาทที่พัก': 'Existing outline used; the lodging role to check further',
}
LODGING_SERVICE_ORDER = ['food_drink', 'daily_supplies', 'health_care', 'daily_services', 'retail_centre', 'transport_reference']
LODGING_SERVICE_EN = {'food_drink': 'food and drink', 'daily_supplies': 'daily supplies', 'health_care': 'health', 'daily_services': 'daily services',
                      'retail_centre': 'shopping', 'transport_reference': 'transport reference'}

# The registry's functional roles (rules/functional-roles.json, citymeter-functional-roles-1) and the demo datasets whose
# records speak to each role. The registry's tab «8 บทบาทย่าน» names the evidence; the mapping of the demos onto it is
# this demo's (Inference, DATA_METHOD.md §6).
ROLES = [
    ('shopping_trade', 'จับจ่ายและการค้า', 'Shopping and trade', ['shoppingcenter', 'grocery', 'restaurant', 'luxurybrands', 'camera']),
    ('office_business', 'สำนักงานและธุรกิจ', 'Offices and business', ['office']),
    ('living_daily', 'อยู่อาศัยและชีวิตประจำวัน', 'Living and daily life', ['grocery', 'pharmacy', 'fitness']),
    ('stay_tourism_culture', 'ที่พัก ท่องเที่ยว และวัฒนธรรม', 'Stay, tourism and culture', ['hotel']),
    ('education', 'การศึกษา', 'Education', ['school', 'university']),
    ('health_care', 'สุขภาพและการดูแล', 'Health and care', ['hospital', 'pharmacy']),
    ('industry_production', 'อุตสาหกรรมและการผลิต', 'Industry and production', ['industrialestate', 'factory']),
    ('government_public', 'ราชการและบริการสาธารณะ', 'Government and public services', ['governmentoffice']),
]


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def ok(lon, lat):
    return (isinstance(lon, (int, float)) and isinstance(lat, (int, float)) and math.isfinite(lon) and math.isfinite(lat)
            and TH_BOX[0] <= lon <= TH_BOX[2] and TH_BOX[1] <= lat <= TH_BOX[3])


def pos(v):
    return v if isinstance(v, (int, float)) and math.isfinite(v) and v > 0 else None


def txt(v):
    """A published name as one line of plain text ('' for none)."""
    return ' '.join(str(v).split()) if isinstance(v, str) and v.strip() else ''


# ---------------------------------------------------------------------------------------------------------------- read
def extract(ds_id, path):
    """Return (scope dict, subgroups, measure or None, dates, points [(lon, lat, subgroup, measure, key, name, nameEn, sub)]).

    key: the record's id in its own demo (the demo opens it from `?e=<kind>:<key>`); name / nameEn: the names the demo
    publishes ('' when none); sub: a second line some datasets need (a station's line), ''."""
    d = json.load(open(path, encoding='utf-8'))
    m = d.get('meta', {})
    if ds_id == 'hotel':
        c = d['cols']
        pts = [(c['lon'][i], c['lat'][i], c['group'][i], pos(c['rooms'][i]), c['key'][i], txt(c['name'][i]), txt(c['nameEn'][i]), '')
               for i in range(len(c['key'])) if ok(c['lon'][i], c['lat'][i])]
        return ({'records': len(c['key']), 'th': 'ทุกรายการที่พักในชุดข้อมูล', 'en': 'every accommodation record of the dataset'},
                [{'id': g['id'], 'th': g['th'], 'en': g.get('en', '')} for g in d['groups']],
                {'id': 'rooms', 'th': 'ห้อง', 'en': 'rooms', 'noteTh': 'ห้องที่แหล่งบันทึก ไม่ใช่ห้องว่างต่อคืน', 'noteEn': 'rooms the source records, not rooms available per night'},
                {'checkedOn': m.get('checkedOn'), 'builtOn': m.get('builtOn')}, pts)
    if ds_id == 'office':
        c = d['cols']
        # the demo's name is the building's own (often English) name; `alt` is the Thai one when it has it
        pts = [(c['lon'][i], c['lat'][i], c['group'][i], None, c['key'][i], txt(c['alt'][i]) or txt(c['name'][i]), txt(c['name'][i]), '')
               for i in range(len(c['key'])) if ok(c['lon'][i], c['lat'][i])]
        return ({'records': len(c['key']), 'th': 'ทุกรายการสำนักงาน หนึ่งรายการอาจเป็นบางชั้นของอาคาร', 'en': 'every office record; a record can be a few floors of a building'},
                [{'id': g['id'], 'th': g['th'], 'en': g.get('en', '')} for g in d['groups']], None,
                {'readOn': m.get('readOn'), 'checkedOn': m.get('checkedOn')}, pts)
    if ds_id == 'shoppingcenter':
        groups = [('mall', 'ศูนย์การค้า', 'Shopping mall'), ('community', 'คอมมูนิตี้มอลล์', 'Community mall'), ('market', 'ตลาด', 'Market'),
                  ('hoststore', 'ห้างที่มีร้านเช่า', 'Host store with tenants'), ('outlet', 'เอาท์เล็ท', 'Outlet'),
                  ('fuel', 'สถานีบริการที่มีร้านค้า', 'Fuel station with shops'), ('other', 'พื้นที่ค้าปลีกอื่น', 'Other retail place'),
                  ('component', 'พื้นที่ค้าปลีกในโครงการ', 'Retail component')]
        gi = {g[0]: i for i, g in enumerate(groups)}
        rows = [r for r in d['rows'] if r.get('countable') and r.get('status') == 'supply']
        pts = [(r['lon'], r['lat'], gi.get(r.get('group'), gi['other']), None, r['id'], txt(r.get('name')), txt(r.get('nameEn')), '')
               for r in rows if r.get('located') and ok(r.get('lon'), r.get('lat'))]
        return ({'records': len(rows), 'th': 'สถานที่ค้าปลีกที่นับได้และแหล่งยังระบุว่าเปิด (ศูนย์การค้า ตลาด ห้าง และสถานีบริการที่มีร้านค้า)', 'en': 'countable retail places the source still lists as operating (malls, markets, stores and fuel stations with shops)'},
                [{'id': a, 'th': b, 'en': e} for a, b, e in groups], None, {'asOf': m.get('asOf')}, pts)
    if ds_id == 'industrialestate':
        bnd = json.load(open(os.path.join(os.path.dirname(path), 'boundaries.geojson'), encoding='utf-8'))
        byid = {e['id']: e for e in d['estates']}
        pts = []
        for f in bnd['features']:
            e = byid.get(f['properties']['id'])
            if e:
                p = shape(f['geometry']).representative_point()
                if ok(p.x, p.y):
                    pts.append((p.x, p.y, e.get('type', 0), None, e['id'], txt(e.get('name')), txt(e.get('nameEn')), ''))
        return ({'records': len(d['estates']), 'th': 'นิคม สวน และเขตอุตสาหกรรมที่มีขอบในเดโม ใช้จุดภายในขอบ', 'en': 'industrial estates, parks and zones with an outline in the demo, placed by a point inside the outline'},
                [{'id': t['id'], 'th': t['th'], 'en': t['en']} for t in d['types']], None,
                {'catalogCheckedOn': m.get('catalogCheckedOn'), 'builtOn': m.get('builtOn')}, pts)
    if ds_id == 'camera':
        th = {'multibrand_camera': 'ร้านกล้องหลายแบรนด์', 'manufacturer_brand_store': 'ร้านของแบรนด์ผู้ผลิต', 'adjacent_retail_channel': 'ร้านค้าปลีกที่ขายกล้องด้วย',
              'imaging_equipment_specialist': 'ร้านอุปกรณ์ถ่ายภาพเฉพาะทาง', 'used_film_specialist': 'ร้านกล้องมือสองและฟิล์ม'}
        en = {'multibrand_camera': 'Multi-brand camera shop', 'manufacturer_brand_store': 'Manufacturer brand store', 'adjacent_retail_channel': 'Adjacent retail channel',
              'imaging_equipment_specialist': 'Imaging equipment specialist', 'used_film_specialist': 'Used and film specialist'}
        rows = [r for r in d['rows'] if r.get('role') == 'retail_outlet_listing']
        segs = list(dict.fromkeys(r.get('segment') for r in rows))
        pts = [(r['longitude'], r['latitude'], segs.index(r.get('segment')), None, r['id'], txt(r.get('name')), '', '')
               for r in rows if ok(r.get('longitude'), r.get('latitude'))]
        return ({'records': len(rows), 'th': 'สาขาขายปลีกตามค่าเริ่มต้นของเดโม', 'en': 'retail outlet listings, the demo default'},
                [{'id': s, 'th': th.get(s, s), 'en': en.get(s, s)} for s in segs], None, {'asOf': m.get('asOf'), 'checkedOn': m.get('checkedOn')}, pts)
    if ds_id == 'factory':
        c = d['cols']
        fam = d.get('families') or []
        pts = []
        for i in range(len(c['key'])):
            if ok(c['lon'][i], c['lat'][i]):
                g = c['group'][i]
                f = d['groups'][g]['family'] if isinstance(g, int) and 0 <= g < len(d['groups']) else len(fam) - 1
                # a natural person's name never reaches the demo's data (withheld at its build); the operator's name otherwise
                pts.append((c['lon'][i], c['lat'][i], f, pos(c['workers'][i]), c['key'][i], txt(c['name'][i]) or txt(c['op'][i]), '', ''))
        return ({'records': len(c['key']), 'th': 'ทะเบียนโรงงานทุกขนาด วางได้เฉพาะทะเบียนที่มีพิกัด', 'en': 'factory registrations of every size; only those with a point can be placed'},
                [{'id': str(i), 'th': f.get('th', '') if isinstance(f, dict) else str(f), 'en': f.get('en', '') if isinstance(f, dict) else ''} for i, f in enumerate(fam)],
                {'id': 'workers', 'th': 'คนงาน', 'en': 'workers', 'noteTh': 'คนงานตามทะเบียน กรอ. ไม่ใช่การจ้างงานปัจจุบัน', 'noteEn': 'workers the DIW register reports, not current employment'},
                {'checkedOn': m.get('checkedOn'), 'builtOn': m.get('builtOn')}, pts)
    if ds_id == 'fitness':
        c = d['cols']
        own = {p[0]: (p[2], p[1]) for p in d['points']}
        listed = [i for i in range(len(c['key'])) if d['vocab']['status'][c['status'][i]] == 'listed']
        pts = []
        for i in listed:
            lon = lat = None
            if i in own:
                lon, lat = own[i]
            elif isinstance(c['venue'][i], int) and c['venue'][i] >= 0:
                v = d['venues'][c['venue'][i]]
                lon, lat = v.get('longitude'), v.get('latitude')
            if ok(lon, lat):
                pts.append((lon, lat, c['group'][i], None, c['key'][i], txt(c['name'][i]), '', ''))
        return ({'records': len(listed), 'th': 'สาขาที่แหล่งยังระบุ ณ วันตรวจ ใช้จุดของสาขา หรือจุดของอาคารที่ตั้ง', 'en': 'branches the source still lists on the check date, at the branch point or its host building point'},
                [{'id': g['id'], 'th': g['th'], 'en': g.get('en', '')} for g in d['groups']], None,
                {'asOf': m.get('asOf'), 'checkedOn': m.get('checkedOn')}, pts)
    if ds_id == 'grocery':
        F = {k: i for i, k in enumerate(d['fields'])}
        brands = d['brands']
        brand = lambda r: txt(brands[r[F['brand']]].get('name')) if isinstance(r[F['brand']], int) and 0 <= r[F['brand']] < len(brands) else ''
        # the branch name is the place (ถนนอัษฎางค์); the banner comes first, as people say it (7-Eleven ถนนอัษฎางค์)
        pts = [(r[F['lon']], r[F['lat']], r[F['type']], None, r[F['id']], ' '.join(x for x in (brand(r), txt(r[F['name']])) if x), '', '')
               for r in d['rows'] if ok(r[F['lon']], r[F['lat']])]
        return ({'records': len(d['rows']), 'th': 'จุดร้านของ 17 แบรนด์ ตำแหน่งจาก vector tile ไม่ใช่การสำรวจ', 'en': 'store points of 17 banners, positions decoded from vector tiles, not surveyed'},
                [{'id': t['id'], 'th': t['th'], 'en': t['en']} for t in d['types']], None, {'asOf': m.get('asOf')}, pts)
    if ds_id == 'luxurybrands':
        th = {'luxury_designer': 'แฟชั่นแบรนด์หรู', 'beauty_fragrance': 'ความงามและน้ำหอม', 'watches': 'นาฬิกา', 'fine_jewelry': 'เครื่องประดับ',
              'premium_extension': 'แบรนด์พรีเมียม', 'upscale_streetwear': 'สตรีทแวร์ระดับบน', 'thai_designer': 'ดีไซเนอร์ไทย', 'curated_retailer': 'ร้านคัดสรรหลายแบรนด์'}
        en = {'luxury_designer': 'Luxury designer', 'beauty_fragrance': 'Beauty and fragrance', 'watches': 'Watches', 'fine_jewelry': 'Fine jewellery',
              'premium_extension': 'Premium extension', 'upscale_streetwear': 'Upscale streetwear', 'thai_designer': 'Thai designer', 'curated_retailer': 'Curated retailer'}
        rows = [r for r in d['rows'] if r.get('origin') == 'market_refresh' and r.get('status') == 'source_listed']
        segs = list(dict.fromkeys(r.get('segment') for r in rows))
        pts = [(r['longitude'], r['latitude'], segs.index(r.get('segment')), None, r['id'], txt(r.get('name')), '', '')
               for r in rows if ok(r.get('longitude'), r.get('latitude'))]
        return ({'records': len(rows), 'th': 'จุดขายจากรอบ refresh ที่แหล่งยังระบุ ค่าเริ่มต้นของเดโม', 'en': 'points of sale of the refresh round that the source still lists, the demo default'},
                [{'id': s, 'th': th.get(s, s), 'en': en.get(s, s)} for s in segs], None, {'asOf': m.get('asOf')}, pts)
    if ds_id == 'pharmacy':
        c = d['cols']
        pm = {p[0]: (p[2], p[1]) for p in d['points']}
        lic = [i for i in range(len(c['key'])) if d['vocab']['evidence'][c['evidence'][i]] == 'licensed']
        pts = [(pm[i][0], pm[i][1], c['group'][i], None, c['key'][i], txt(c['name'][i]), '', '') for i in lic if i in pm and ok(*pm[i])]
        return ({'records': len(lic), 'th': 'ร้านที่มีใบอนุญาต ขย1 ค่าเริ่มต้นของเดโม วางได้เฉพาะร้านที่มีจุด', 'en': 'pharmacies holding a type-1 (Khor Yor 1) licence, the demo default; only those with a point can be placed'},
                [{'id': g['id'], 'th': g['th'], 'en': g.get('en', '')} for g in d['groups']], None,
                {'asOf': m.get('asOf'), 'checkedOn': m.get('checkedOn')}, pts)
    if ds_id == 'restaurant':
        c = d['cols']
        grid = 4194304
        unspec = next(i for i, g in enumerate(d['groups']) if g['id'] == 'unspecified')
        pts = []
        for i in range(len(c['key'])):
            lon = c['gx'][i] / grid * 360 - 180
            lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * c['gy'][i] / grid))))
            t = c['type'][i]
            if ok(lon, lat):
                pts.append((lon, lat, d['typeGroup'][t] if isinstance(t, int) and t >= 0 else unspec, None, c['key'][i], txt(c['name'][i]), '', ''))
        return ({'records': len(c['key']), 'th': 'ทุกร้านในชุดข้อมูล ตำแหน่งแสดงผลจาก tile ไม่ใช่พิกัดสำรวจ', 'en': 'every restaurant row of the dataset; display positions from tiles, not surveyed points'},
                [{'id': g['id'], 'th': g['th'], 'en': g.get('en', '')} for g in d['groups']], None,
                {'asOf': m.get('asOf'), 'checkedOn': m.get('checkedOn')}, pts)
    if ds_id == 'governmentoffice':
        c = d['cols']
        types = d['types']
        pts = []
        for i in range(len(c['key'])):
            if ok(c['lon'][i], c['lat'][i]):
                t = c['type'][i]
                pts.append((c['lon'][i], c['lat'][i], types[t]['group'] if isinstance(t, int) and 0 <= t < len(types) else len(d['groups']) - 1, pos(c['staff'][i]),
                            c['key'][i], txt(c['name'][i]), '', ''))
        return ({'records': len(c['key']), 'th': 'ทุกจุดของชุดข้อมูลหน่วยงานรัฐ ทุกหมวด ค่าเริ่มต้นของเดโม', 'en': 'every point of the government-office dataset, all groups, the demo default'},
                [{'id': g['id'], 'th': g['th'], 'en': g.get('en', '')} for g in d['groups']],
                {'id': 'staff', 'th': 'บุคลากรที่บันทึก', 'en': 'recorded staff', 'noteTh': 'เฉพาะประเภทที่บันทึกบุคลากรรายแห่ง', 'noteEn': 'only types that record staff per office'},
                {'readOn': m.get('readOn'), 'checkedOn': m.get('checkedOn')}, pts)
    if ds_id == 'hospital':
        c = d['cols']
        pts = [(c['lon'][i], c['lat'][i], c['group'][i], pos(c['beds'][i]), c['key'][i], txt(c['name'][i]) or txt(c['nameOff'][i]), '', '')
               for i in range(len(c['key'])) if ok(c['lon'][i], c['lat'][i])]
        return ({'records': len(c['key']), 'th': 'สถานพยาบาลทุกประเภทในชุดข้อมูล วางได้เฉพาะที่มีจุด', 'en': 'health facilities of every type in the dataset; only those with a point can be placed'},
                [{'id': g['id'], 'th': g['th'], 'en': g.get('en', '')} for g in d['groups']],
                {'id': 'beds', 'th': 'เตียง', 'en': 'beds', 'noteTh': 'เตียงที่ทะเบียน HCODE รายงาน ไม่ใช่เตียงว่าง', 'noteEn': 'beds the HCODE register reports, not available beds'},
                {'readOn': m.get('readOn'), 'checkedOn': m.get('checkedOn')}, pts)
    if ds_id == 'school':
        c = d['cols']
        closed = d.get('closed') or {}
        idx = [i for i in range(len(c['key'])) if str(i) not in closed and c['key'][i] not in closed]
        pts = [(c['lon'][i], c['lat'][i], c['group'][i], pos(c['students'][i]), c['key'][i], txt(c['name'][i]), txt(c['nameEn'][i]), '')
               for i in idx if ok(c['lon'][i], c['lat'][i])]
        return ({'records': len(idx), 'th': 'สถานศึกษาทุกสังกัดในฐานปี 2569 วางได้เฉพาะที่มีจุด', 'en': 'schools of every affiliation in the 2026 baseline; only those with a point can be placed'},
                [{'id': g['id'], 'th': g['th'], 'en': g.get('en', '')} for g in d['groups']],
                {'id': 'students', 'th': 'นักเรียน', 'en': 'students', 'noteTh': 'นักเรียนที่บันทึกปี 2569 ไม่ใช่ที่นั่งที่รับได้', 'noteEn': 'students recorded for 2026, not seats'},
                {'readOn': m.get('readOn'), 'checkedOn': m.get('checkedOn')}, pts)
    if ds_id == 'transit':
        rows = [s for s in d['stations'] if s.get('status') in ('operating', 'construction')]
        lines = {ln['id']: ln for ln in d['lines']}
        line_of = lambda s, k: ' · '.join(txt(lines[x].get(k)) for x in (s.get('lineIds') or []) if x in lines)
        # one record per station and line: the line is the second line of the record, in both languages ("th|en")
        pts = [(s['lng'], s['lat'], 0 if s['status'] == 'operating' else 1, None, s['id'], txt(s.get('name')), txt(s.get('nameEn')),
                f"{line_of(s, 'name')}|{line_of(s, 'nameEn')}") for s in rows if ok(s.get('lng'), s.get('lat'))]
        return ({'records': len(rows), 'th': 'สถานีราง หนึ่งรายการต่อหนึ่งสาย สถานีเปลี่ยนสายนับตามจำนวนสาย ไม่รวมสถานีที่ยังยืนยันไม่ได้', 'en': 'rail stations, one record per line (an interchange counts once per line); unverified stations left out'},
                [{'id': 'operating', 'th': 'เปิดให้บริการ', 'en': 'Operating'}, {'id': 'construction', 'th': 'กำลังก่อสร้าง', 'en': 'Under construction'}], None,
                {'asOf': m.get('asOf'), 'release': m.get('release')}, pts)
    if ds_id == 'university':
        s = d['sites']
        types = [('autonomous', 'มหาวิทยาลัยในกำกับ', 'Autonomous university'), ('public', 'มหาวิทยาลัยรัฐ', 'Public university'),
                 ('rajabhat', 'มหาวิทยาลัยราชภัฏ', 'Rajabhat university'), ('rmut', 'มหาวิทยาลัยเทคโนโลยีราชมงคล', 'Rajamangala University of Technology'),
                 ('private', 'มหาวิทยาลัยเอกชน', 'Private university'), ('private_other', 'สถาบันเอกชนอื่น', 'Other private institution'),
                 ('open', 'มหาวิทยาลัยเปิด', 'Open university'), ('outside', 'สถาบันนอกสังกัด อว.', 'Institution outside MHESI')]
        ti = {k: i for i, (k, _, _) in enumerate(types)}
        unis = d['universities']
        pts = []
        for i in range(len(s['key'])):
            if ok(s['lon'][i], s['lat'][i]):
                u = unis[s['uni'][i]] if isinstance(s['uni'][i], int) and 0 <= s['uni'][i] < len(unis) else {}
                pts.append((s['lon'][i], s['lat'][i], ti.get(u.get('type'), ti['outside']), None, s['key'][i], txt(s['name'][i]), '', ''))
        return ({'records': len(s['key']), 'th': 'วิทยาเขตและพื้นที่ของมหาวิทยาลัยที่ทีมวิจัยตรวจ นับเป็นแห่ง ไม่แบ่งนักศึกษาตามจุด', 'en': 'university campuses and sites the research team checked, counted as places; students are not split by point'},
                [{'id': a, 'th': b, 'en': e} for a, b, e in types], None, {'readOn': m.get('readOn'), 'checkedOn': m.get('checkedOn')}, pts)
    raise SystemExit(f'unknown dataset {ds_id}')


def utm_area(geom):
    """Area in m² in UTM 47N (west of 102°E) or 48N, the metric CRS the registry names for its own areas."""
    from pyproj import Transformer
    from shapely.ops import transform
    zone = 32647 if geom.centroid.x < 102 else 32648
    return transform(Transformer.from_crs(4326, zone, always_xy=True).transform, geom).area


# The registry's tabs were renamed on 2026-11-25 to the layout of the other research sheets of the Dataset
# Registry (its 00_README holds the table of contents, old name beside new; the gids did not change). The build
# reads a tab by its new name or by its old one, never both, so an export from before the rename still builds.
REGISTRY_TABS = {'ชื่อกลาง': '01_NEIGHBOURHOODS', 'หลักฐานบทบาท': '08_ROLE_EVIDENCE', 'ย่านที่พัก 268': '19_LODGING_SCREEN'}
REGISTRY_TABS_RENAMED_ON = '2026-11-25'
REGISTRY_TAB_READ = {}  # old name -> the tab name this export has (recorded in the data's provenance)


# The columns the build reads by position, checked against their header (the registry's own column names, read from
# the sheet on 2026-11-25): a moved or renamed column stops the build instead of being read as another field.
# (0.5.0) the name source of the codes the registry admitted from its commercial screen (2026-11-25 and 26)
SCREEN_NAME_SOURCE = 'ร่างชื่อจากผลคัดย่านการค้า'

REGISTRY_COLUMNS = {
    'ชื่อกลาง': {1: 'ชื่อย่านกลาง', 2: 'จังหวัด', 3: 'ที่มาของชื่อ', 7: 'บทบาทที่เสนอจากหลักฐาน', 9: 'รหัสย่านใช้งานปัจจุบัน',
                 10: 'ชื่อย่านใช้งานปัจจุบัน', 11: 'สถานะรหัสเดิม'},
    'หลักฐานบทบาท': {0: 'รหัสย่านกลาง', 3: 'บทบาทย่าน', 4: 'สถานะ'},
}


def registry_tab_on(old, on):
    """The registry tab's name on a date (ISO YYYY-MM-DD, checked): the old name before the rename, the new one from
    that day."""
    return REGISTRY_TABS[old] if date.fromisoformat(on) >= date.fromisoformat(REGISTRY_TABS_RENAMED_ON) else old


def registry_tables(xlsx):
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    def rows(name):
        new = REGISTRY_TABS.get(name)
        found = [n for n in (new, name) if n and n in wb.sheetnames]
        if len(found) != 1:
            renamed = f' (renamed {new!r} on {REGISTRY_TABS_RENAMED_ON})' if new else ''
            sys.exit(f'registry export: tab {name!r}{renamed}: found {found or "neither"}')
        REGISTRY_TAB_READ[name] = found[0]
        ws = wb[found[0]]
        out = [['' if v is None else v for v in r] for r in ws.iter_rows(values_only=True)]
        width = max(len(r) for r in out)
        out = [r + [''] * (width - len(r)) for r in out]
        for i, want in REGISTRY_COLUMNS.get(name, {}).items():
            got = str(out[0][i]).strip() if i < len(out[0]) else ''
            if got != want:
                sys.exit(f'registry export: tab {found[0]!r} column {i + 1} is headed {got!r}; the build reads it as {want!r}')
        return out[0], out[1:]
    return rows


def spearman(x, y):
    n = len(x)
    def ranks(v):
        order = sorted(range(n), key=lambda i: v[i])
        r = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j + 1 < n and v[order[j + 1]] == v[order[i]]:
                j += 1
            avg = (i + j) / 2 + 1
            for k in range(i, j + 1):
                r[order[k]] = avg
            i = j + 1
        return r
    rx, ry = ranks(x), ranks(y)
    mx, my = sum(rx) / n, sum(ry) / n
    sxy = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    sxx = sum((a - mx) ** 2 for a in rx)
    syy = sum((b - my) ** 2 for b in ry)
    return sxy / math.sqrt(sxx * syy) if sxx > 0 and syy > 0 else 0.0


def share_rank(items, key):
    """Rank items by key descending; equal values share the better rank (1, 2, 2, 4)."""
    order = sorted(items, key=lambda i: -key(i))
    out = {}
    for n, i in enumerate(order):
        out[i] = n + 1 if n == 0 or key(order[n - 1]) != key(i) else out[order[n - 1]]
    return out


# --------------------------------------------------------------------------------------------------------------- build
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bundle', required=True)
    ap.add_argument('--bundle-zip', default='')
    ap.add_argument('--registry', required=True)
    ap.add_argument('--repos', required=True)
    ap.add_argument('--commits', required=True)
    ap.add_argument('--mapshaper', required=True)
    ap.add_argument('--provinces', default='data/provinces.geojson')
    ap.add_argument('--out', default='data')
    ap.add_argument('--read-on', default='2026-11-18')
    ap.add_argument('--condo', default='', help='condominium research master .xlsx export (0.1.3)')
    ap.add_argument('--condo-read-on', default='2026-11-16')
    ap.add_argument('--lodging', default='', help='current lodging review folder of the bundle (0.2.0)')
    ap.add_argument('--prev-canonical', default='', help='canonical-boundaries.geojson of the previous data release (marks the outlines new since)')
    ap.add_argument('--admitted', default='', help='read-back of the lodging areas the registry admitted (0.2.1): {spec: [[hex, name, province, status, review]], blockSha}')
    ap.add_argument('--admitted-on', default='2026-11-18')
    ap.add_argument('--outline-amendments', default='', help='owner amendments of registry outlines (0.2.4): amendments/outline-amendments.geojson')
    ap.add_argument('--screen', default='', help="(0.5.0) outlines the owner's rule drew for the commercial screen's codes: amendments/outline-new-<date>.geojson")
    ap.add_argument('--screen-on', default='2026-11-26')
    ap.add_argument('--screen-hold', default='', help='comma-separated codes of the commercial screen held until the owner decides (neither drawn nor listed)')
    a = ap.parse_args()

    canon_path = os.path.join(a.bundle, 'national-gis', 'canonical-boundaries.geojson')
    canon = json.load(open(canon_path, encoding='utf-8'))
    revision = json.load(open(os.path.join(a.bundle, 'national-gis', 'revision-summary.json'), encoding='utf-8'))
    commits = json.load(open(a.commits, encoding='utf-8'))
    prov = json.load(open(a.provinces, encoding='utf-8'))
    dopa = {f['properties']['code']: f['properties']['id'] for f in prov['features']}
    prov_shapes = [(f['properties']['id'], prep(shape(f['geometry'])), shape(f['geometry'])) for f in prov['features']]
    prov_tree = STRtree([s for _, _, s in prov_shapes])

    def province_of(lon, lat):
        pt = Point(lon, lat)
        for k in prov_tree.query(pt):
            if prov_shapes[k][1].covers(pt):
                return prov_shapes[k][0]
        return ''

    # ----- neighbourhoods (closed draft outlines in canonical order)
    feats = canon['features']
    closed = [f for f in feats if f['geometry']]
    pending = [f for f in feats if not f['geometry']]
    n_registry = len(closed)
    for f in closed:
        f['properties']['_kind'] = 'registry'
    # ----- owner amendments (0.2.4): a registry outline the owner asked to change, drawn by the registry's own rules
    # (scripts/draw-outline-amendment.py, DATA_METHOD.md §2b). Applied only to the outline it was drawn from (its SHA-256),
    # only adding area and overlapping no other outline; the area is measured in UTM as the registry measures its own.
    # (0.3.0) Or redrawn by the owner's rule from the basemap (scripts/draw-outline-rule.browser.js, scripts/rule-outlines.py,
    # DATA_METHOD.md §2c): the same checks, and a lodging area's draft outline too, once the drafts have joined.
    amendments, deferred = [], []
    geometry_sha = lambda g: hashlib.sha256(json.dumps(g, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

    def amend(am, f, others):
        ap_ = am['properties']
        if f is None or geometry_sha(f['geometry']) != ap_['registry_geometry_sha256']:
            sys.exit(f"{ap_['canonical_id']}: the registry outline is not the one the amendment was drawn from; redraw it")
        new, old = shape(am['geometry']), shape(f['geometry'])
        lost = old.difference(new)
        if not lost.is_empty and utm_area(lost) >= 0.01:
            sys.exit(f"{ap_['canonical_id']}: the amendment would take area from the registry outline")
        for g in others:
            both = shape(g['geometry']).intersection(new) if g is not f else None
            if both is not None and not both.is_empty and utm_area(both) >= 0.1:
                sys.exit(f"{ap_['canonical_id']}: the amendment overlaps {g['properties']['canonical_id']}")
        f['geometry'] = am['geometry']
        f['properties']['area_m2'] = utm_area(new)
        f['properties']['_amended'] = ap_['amended_on']
        amendments.append({
            'id': ap_['canonical_id'], 'name': ap_['name_th'], 'on': ap_['amended_on'], 'by': 'owner',
            'registryAreaM2': ap_['registry_area_m2'], 'areaM2': round(f['properties']['area_m2'], 2),
            'includes': [{'th': x['name_th'], 'en': x['name_en'], 'osm': x['source_id']} for x in ap_['includes']],
            'rules': ap_['rules'], 'crossings': ap_['crossings'], 'osm': ap_['osm'],
            'statusTh': ap_['status_th'], 'statusEn': ap_['status_en'],
            **({'rule': ap_['rule']} if ap_.get('rule') else {}),
        })
        print(f"amended           {ap_['canonical_id']} {ap_['registry_area_m2']:.0f} → {f['properties']['area_m2']:.0f} m2", file=sys.stderr)

    if a.outline_amendments:
        by_code = {f['properties']['canonical_id']: f for f in closed}
        for am in json.load(open(a.outline_amendments, encoding='utf-8'))['features']:
            if am['properties']['canonical_id'] not in by_code and am['properties'].get('rule'):
                deferred.append(am)  # a lodging area's draft outline: amended once the drafts have joined
                continue
            amend(am, by_code.get(am['properties']['canonical_id']), closed)
    prev_closed = set()
    if a.prev_canonical:
        prev_closed = {f['properties']['canonical_id'] for f in json.load(open(a.prev_canonical, encoding='utf-8'))['features'] if f['geometry']}

    # ----- lodging review (0.2.0): the 268 proposals of the registry's lodging screen. The 79 new areas (LP-NEW) become
    # neighbourhoods of this demo (owner 2026-11-18); those with a review draft are appended after the registry's
    # outlines (none overlaps them: measured 0), the others are searchable. (0.2.1) The registry admitted all 79 as
    # central codes on 2026-11-18 (owner: “ทั้ง 79”): CMN-TH-<hex> replaces LP-NEW-<hex>, the old ids stay as aliases.
    lodging, lod_pending, lod_meta = {}, [], None
    admit, admitted_sha = {}, ''
    if a.admitted:
        spec = json.load(open(a.admitted, encoding='utf-8'))
        admit = {'LP-NEW-' + s_[0]: 'CMN-TH-' + s_[0] for s_ in spec['spec']}
        admitted_sha = spec['blockSha']
    if a.lodging:
        ledger = json.load(open(os.path.join(a.lodging, 'decision-ledger.json'), encoding='utf-8'))
        drafts = {f['properties']['proposal_group_id']: f for f in
                  json.load(open(os.path.join(a.lodging, 'boundaries', 'current-all268-review-drafts.geojson'), encoding='utf-8'))['features']}
        new_ids = {g['proposal_group_id'] for g in ledger if not g['existing_canonical_id']}
        if admit:  # the registry admitted exactly the screen's new areas, and drew the same 37
            assert set(admit) == new_ids, 'the registry admitted another set of lodging areas'
            assert {'LP-NEW-' + s_[0] for s_ in spec['spec'] if s_[4] < 0} == {gid for gid in new_ids if gid in drafts}
            assert not set(admit.values()) & {f['properties']['canonical_id'] for f in feats}, 'an admitted code collides'
        code_of = lambda gid: admit.get(gid, gid)
        _, lod_rows = registry_tables(a.registry)('ย่านที่พัก 268')
        lod_hdr = registry_tables(a.registry)('ย่านที่พัก 268')[0]
        lc = {h: k for k, h in enumerate(lod_hdr)}
        boundary_th = {str(r[lc['รหัสข้อเสนอ']]): str(r[lc['ผลทบทวนขอบ']]).strip() for r in lod_rows if r[lc['รหัสข้อเสนอ']]}
        blabels = sorted(set(boundary_th.values()))
        service_th = {}
        for g in ledger:
            for code, th in zip(g.get('support_positive_categories_800m') or [], g.get('support_category_labels_800m') or []):
                service_th.setdefault(code, th)
        status_th = {}
        whole = lambda v: int(v) if isinstance(v, (int, float)) and math.isfinite(v) else None
        for g in ledger:
            st = LODGING_STATUS[g['status']]
            status_th.setdefault(st, g['status_th'])
            gid = g['proposal_group_id']
            key = g['existing_canonical_id'] or code_of(gid)
            lodging[key] = {
                'st': st, 'h4': whole(g.get('hotel_count_400m_plus_review_allowance')), 'h8': whole(g.get('hotel_count_800m_plus_review_allowance')),
                'ru': whole(g.get('guarded_800_reported_room_units')), 'rx': whole(g.get('guarded_800_room_unknown_groups')),
                'sv4': list(g.get('support_positive_categories_400m') or []), 'sv8': list(g.get('support_positive_categories_800m') or []),
                'bd': blabels.index(boundary_th[gid]) if gid in boundary_th else None,
                'draft': gid in drafts,
            }
            if g['existing_canonical_id']:
                continue
            d = drafts.get(gid)
            if d is not None:
                geom = shape(d['geometry'])
                rp = geom.representative_point()
                area_m2 = d['properties'].get('draft_area_m2')
                if area_m2 is None:  # 11 retained drafts carry no area: measured in UTM 47N/48N as the registry does
                    area_m2 = utm_area(geom)
                closed.append({'type': 'Feature', 'geometry': d['geometry'], 'properties': {
                    'canonical_id': code_of(gid), 'name_th': g['name_th'], 'area_m2': area_m2,
                    'neighbourhood_reference_point': [rp.x, rp.y], 'source_province_codes': [],
                    'name_status': 'draft_pending_local_name_validation', 'field_verified': False, '_kind': 'lodging'}})
            else:
                lod_pending.append((code_of(gid), g['name_th'], (g.get('origin') or {}).get('xy'), g.get('province', '')))
        # (0.3.0) a lodging area's draft outline redrawn by the owner's rule, checked against every outline
        by_lodging = {f['properties']['canonical_id']: f for f in closed[n_registry:]}
        for am in deferred:
            amend(am, by_lodging.get(am['properties']['canonical_id']), closed)
        deferred = []
        # (0.2.4) an amended outline overlaps no lodging draft either
        for f in closed[n_registry:]:
            for am in amendments:
                if am['id'] not in by_code:
                    continue  # a lodging draft's own amendment, checked against every outline above
                both = shape(f['geometry']).intersection(shape(next(g for g in closed[:n_registry] if g['properties']['canonical_id'] == am['id'])['geometry']))
                if not both.is_empty and utm_area(both) >= 0.1:
                    sys.exit(f"{am['id']}: the amendment overlaps the lodging draft {f['properties']['canonical_id']}")
        lod_meta = {
            'title': 'ผลคัดย่านที่พัก', 'titleEn': 'Lodging neighbourhood screen',
            'source': f'ทะเบียนย่านกลาง CityMETER: แท็บ «{REGISTRY_TAB_READ.get("ย่านที่พัก 268", "ย่านที่พัก 268")}» และ lodging-held78-recovery-2026-11-18/decision-ledger.json ของ ZIP',
            'revision': json.load(open(os.path.join(a.lodging, 'implementation-contract.json'), encoding='utf-8')).get('revision', ''),
            'readOn': a.read_on, 'sourceRecords': 30730, 'proposals': len(ledger),
            'supported': sum(1 for g in ledger if not g['status'].startswith('H_')), 'held': sum(1 for g in ledger if g['status'].startswith('H_')),
            'onRegistry': sum(1 for g in ledger if g['existing_canonical_id']), 'newAreas': sum(1 for g in ledger if not g['existing_canonical_id']),
            'newAreasDrawn': sum(1 for g in ledger if not g['existing_canonical_id'] and g['proposal_group_id'] in drafts),
            'walkM': [400, 800], 'allowanceM': 50, 'admitted': len(admit), 'admittedOn': a.admitted_on if admit else None,
            'aliases': dict(sorted(admit.items())),
            'statuses': {k: {'th': status_th.get(k, ''), 'en': LODGING_STATUS_EN[k]} for k in LODGING_STATUS_ORDER},
            'boundaries': blabels, 'boundariesEn': [LODGING_BOUNDARY_EN.get(b, b) for b in blabels], 'services': {k: {'th': service_th.get(k, k), 'en': LODGING_SERVICE_EN.get(k, k)} for k in LODGING_SERVICE_ORDER},
            'boundaryTh': 'ระยะเดินตามข่ายทางเดินจากจุดเริ่มประเมินของทะเบียน นับเมื่อระยะเดินบวกเผื่อ 50 ม. ยังไม่เกิน 400 หรือ 800 ม.',
            'boundaryEn': 'walking distance on the path network from the registry\'s assessment start; counted when the walk plus a 50 m allowance stays within 400 or 800 m',
        }
    if deferred:
        sys.exit(f"{deferred[0]['properties']['canonical_id']}: no outline of that code to amend (a lodging draft's needs --lodging)")
    # ----- (0.5.0) the registry's commercial screen: the codes it admitted on 2026-11-25 and 26 (tab ชื่อกลาง, name source
    # SCREEN_NAME_SOURCE; owner 2026-11-25 01:04 “ใช้ 3 กองเลย …”), with the outlines the owner's rule drew from each code's
    # reference point (owner 2026-11-26 06:09 “ลุยตามพี่แนะนำเลยครับทุกข้อ”; scripts/rule-outlines.py new). An outline the rule
    # drew within 1 km of its seed is a neighbourhood of this demo (kind 'screen', drawn dotted, counted like the others);
    # a code with no outline yet (no buildings reached, a city's fabric, waiting for the owner's tick or his word) is
    # searchable only, like the registry's held codes.
    scr_pending, scr_meta, scr_codes = [], None, []
    if a.screen:
        sc = json.load(open(a.screen, encoding='utf-8'))
        _, central_ = registry_tables(a.registry)('ชื่อกลาง')
        scr_codes = [(str(r[0]), str(r[1]), str(r[2]), str(r[7])) for r in central_ if str(r[3]).strip() == SCREEN_NAME_SOURCE and str(r[0]).startswith('CMN-TH-')]
        drawn_ = {f['properties']['canonical_id']: f for f in sc['features']}
        known = {f['properties']['canonical_id'] for f in feats} | set(admit.values())
        clash = [c_ for c_, *_ in scr_codes if c_ in known]
        if clash:
            sys.exit(f'{clash[0]}: a code of the commercial screen is already a code of the bundle or of the lodging screen')
        stray = [k for k in drawn_ if k not in {c_ for c_, *_ in scr_codes}]
        if stray:
            sys.exit(f'{stray[0]}: an outline of {a.screen} has no row of the commercial screen in the registry')
        held_owner = set(a.screen_hold.split(',')) if a.screen_hold else set()
        # (0.7.7) a code the owner took off the commercial screen (the outline file's `removed`, his words with it): not a
        # commercial neighbourhood — neither drawn nor listed, counted apart so the registry's codes still add up
        removed_ = {r_['canonical_id']: r_ for r_ in sc.get('removed', [])}
        lost = [k for k in removed_ if k not in {c_ for c_, *_ in scr_codes}]
        if lost:
            sys.exit(f'{lost[0]}: removed in {a.screen} but no row of the commercial screen in the registry')
        tally = Counter()
        for code, name, prov_th, role_th in scr_codes:
            f = drawn_.get(code)
            if code in held_owner:
                tally['heldOwner'] += 1
                continue
            if code in removed_:
                tally['removedOwner'] += 1
                continue
            if f is not None and f['properties']['status'] == 'apply':
                if f['properties']['name_th'] and f['properties']['name_th'] != name:
                    sys.exit(f'{code}: the outline file names it {f["properties"]["name_th"]!r}, the registry {name!r}')
                geom = shape(f['geometry'])
                for g in closed:
                    both = shape(g['geometry']).intersection(geom)
                    if not both.is_empty and utm_area(both) >= 0.1:
                        sys.exit(f"{code}: the drawn outline overlaps {g['properties']['canonical_id']}")
                closed.append({'type': 'Feature', 'geometry': f['geometry'], 'properties': {
                    'canonical_id': code, 'name_th': name, 'area_m2': utm_area(geom),
                    'neighbourhood_reference_point': f['properties']['reference_point'], 'source_province_codes': [],
                    'name_status': 'draft_pending_local_name_validation', 'field_verified': False, '_kind': 'screen',
                    '_screen': {'on': f['properties']['outlined_on'], 'reachM': f['properties']['reach_m'], 'role': role_th,
                                # (0.6.1) drawn on the owner's word of 2026-11-26 10:02 over CityMETER Building V4 footprints
                                'cm': ((f['properties'].get('buildings') or {}).get('cm') or 0) > 0,
                                # (0.7.7) his tick of 2026-11-27 when it changed the drawing (narrow arms off, cut to 1 km)
                                'tick': (f['properties'].get('ticked') or {}).get('choice'),
                                'tickedOn': ((f['properties'].get('ticked') or {}).get('on') or '')[:10] or None}}})
                tally['drawn'] += 1
            else:
                why = (f['properties']['status'] if f is not None else 'none')
                tally['review' if why == 'review' else 'undrawn'] += 1
                scr_pending.append((code, name, prov_th, 'review' if why == 'review' else 'undrawn', role_th))
        scr_meta = {
            'title': 'ผลคัดย่านการค้า', 'titleEn': 'Commercial neighbourhood screen',
            'source': f'ทะเบียนย่านกลาง CityMETER: แท็บ «{REGISTRY_TAB_READ.get("ชื่อกลาง", "ชื่อกลาง")}» แถวที่มาของชื่อ “{SCREEN_NAME_SOURCE}”',
            'admitted': len(scr_codes), 'admittedOn': ['2026-11-25', '2026-11-26'], 'drawn': tally['drawn'], 'review': tally['review'],
            'undrawn': tally['undrawn'], 'heldOwner': tally['heldOwner'], 'removedOwner': tally['removedOwner'], 'outlinedOn': a.screen_on,
            'outlines': {'file': os.path.relpath(a.screen), 'sha256': sha256_file(a.screen), 'drawing': sc.get('drawing')},
            'reviewM': 1000,
        }
        print(f"screen            admitted={len(scr_codes)} drawn={tally['drawn']} review={tally['review']} undrawn={tally['undrawn']} heldOwner={tally['heldOwner']} removedOwner={tally['removedOwner']}", file=sys.stderr)
    polys = [shape(f['geometry']) for f in closed]
    prepared = [prep(p) for p in polys]
    tree = STRtree(polys)
    ids = [f['properties']['canonical_id'] for f in closed]
    area = [f['properties']['area_m2'] for f in closed]
    nprov = []
    for f in closed:
        codes = f['properties'].get('source_province_codes') or []
        p = dopa.get(str(codes[0])) if codes else ''
        ref = f['properties'].get('neighbourhood_reference_point')
        if not p and ref:
            p = province_of(*ref)
        nprov.append(p)

    # ----- registry tables: aliases, proposed roles, field question
    rows = registry_tables(a.registry)
    _, central = rows('ชื่อกลาง')
    aliases = defaultdict(list)
    for r in central:
        if r[9] and r[1] and r[11] != 'รหัสย่านหลักใช้งาน' and r[1] != r[10]:
            aliases[r[9]].append(str(r[1]))
    _, roles_ev = rows('หลักฐานบทบาท')
    role_th_to_id = {th: rid for rid, th, _, _ in ROLES}
    proposed = defaultdict(list)
    for r in roles_ev:
        if r[0] and r[3] and str(r[4]).startswith('เสนอจากหลักฐาน'):
            rid = role_th_to_id.get(str(r[3]).strip())
            if rid and rid not in proposed[r[0]]:
                proposed[r[0]].append(rid)

    # ----- datasets: extract, place in provinces (coverage) and in neighbourhoods
    datasets, per = [], {}
    inside_points = []
    records = defaultdict(list)  # neighbourhood index → [dataset, lon, lat, subgroup, key, name, nameEn, measure, sub]
    for di, (ds_id, path_, repo, rel, name, name_th, group, unit_th, unit_en) in enumerate(DATASETS):
        file_path = os.path.join(a.repos, repo, rel)
        scope, subgroups, measure, dates, pts = extract(ds_id, file_path)
        nsub = max(1, len(subgroups))
        counts = [0] * len(ids)
        sub = [[0] * nsub for _ in ids]
        msum = [0.0] * len(ids)
        mknown = [0] * len(ids)
        covered = Counter()
        for lon, lat, sg, mv, key, nm, nm_en, sub_ in pts:
            pr = province_of(lon, lat)
            if pr:
                covered[pr] += 1
            pt = Point(lon, lat)
            hit = -1
            for k in sorted(tree.query(pt)):
                if prepared[k].covers(pt):
                    hit = int(k)
                    break
            if hit < 0:
                continue
            s = sg if isinstance(sg, int) and 0 <= sg < nsub else nsub - 1
            counts[hit] += 1
            sub[hit][s] += 1
            if mv is not None:
                msum[hit] += mv
                mknown[hit] += 1
            inside_points.append([di, hit, round(lon, 6), round(lat, 6), s])
            records[hit].append([di, round(lon, 6), round(lat, 6), s, str(key), nm, nm_en if nm_en != nm else '',
                                 round(mv) if mv is not None else None, sub_])
        per[ds_id] = {'counts': counts, 'sub': sub, 'msum': msum, 'mknown': mknown, 'covered': set(covered)}
        datasets.append({
            'id': ds_id, 'path': path_, 'item': ITEM_KIND[ds_id], 'name': name, 'nameTh': name_th, 'group': group, 'unitTh': unit_th, 'unitEn': unit_en,
            'scope': {'th': scope['th'], 'en': scope['en']}, 'records': scope['records'], 'located': len(pts), 'inside': sum(counts),
            'neighbourhoodsWith': sum(1 for c in counts if c > 0),
            'byProvince': dict(sorted(covered.items())), 'subgroups': subgroups, 'measure': measure, 'dates': {k: v for k, v in dates.items() if v},
            'source': {'repo': f'montri-th/{repo}', 'file': rel, 'commit': commits[repo]['commit'], 'committed': commits[repo]['committed'],
                       'sha256': sha256_file(file_path)},
        })
        print(f"{ds_id:<17} records={scope['records']:>6} located={len(pts):>6} inside={sum(counts):>5} provinces={len(covered):>2}", file=sys.stderr)

    # ----- comparisons per dataset: count rank among the covered neighbourhoods, density rank among the ranked ones
    rank, crank, peers, rare = {}, {}, {}, {}
    for d in datasets:
        P = per[d['id']]
        cov = [nprov[i] in P['covered'] for i in range(len(ids))]
        elig = [i for i in range(len(ids)) if cov[i] and P['counts'][i] >= MIN_COUNT]
        dens = {i: P['counts'][i] / (area[i] / 1e6) for i in elig}
        rank[d['id']] = share_rank(elig, lambda i: dens[i])
        covered_idx = [i for i in range(len(ids)) if cov[i]]
        crank[d['id']] = share_rank(covered_idx, lambda i: P['counts'][i])
        peers[d['id']] = len(elig)
        covn = len(covered_idx)
        withany = sum(1 for i in covered_idx if P['counts'][i] > 0)
        rare[d['id']] = (withany, covn)
        d['peers'] = {'covered': covn, 'withAny': withany, 'ranked': len(elig)}

    # ----- national co-location of datasets (Spearman on density, neighbourhoods covered by both)
    pairs = []
    for x in range(len(datasets)):
        for y in range(x + 1, len(datasets)):
            A, B = datasets[x]['id'], datasets[y]['id']
            idx = [i for i in range(len(ids)) if nprov[i] in per[A]['covered'] and nprov[i] in per[B]['covered']]
            both = sum(1 for i in idx if per[A]['counts'][i] > 0 and per[B]['counts'][i] > 0)
            if len(idx) < 30 or both < PAIR_MIN_BOTH:
                continue
            va = [per[A]['counts'][i] / (area[i] / 1e6) for i in idx]
            vb = [per[B]['counts'][i] / (area[i] / 1e6) for i in idx]
            rho = spearman(va, vb)
            pairs.append({'a': A, 'b': B, 'rho': round(rho, 2), 'n': len(idx), 'both': both})
    pairs.sort(key=lambda p: -p['rho'])
    strong = {(p['a'], p['b']) for p in pairs if p['rho'] >= PAIR_MIN_RHO}

    # ----- rows
    out_rows = []
    for i, f in enumerate(closed):
        pr = f['properties']
        c, m, s, rk, hl = {}, {}, {}, {}, []
        for d in datasets:
            P = per[d['id']]
            if nprov[i] not in P['covered']:
                continue  # out of scope: no key at all
            n = P['counts'][i]
            c[d['id']] = n
            if n and d['measure'] and P['mknown'][i]:
                m[d['id']] = [round(P['msum'][i]), P['mknown'][i]]
            if n:
                s[d['id']] = P['sub'][i]
            ci = crank[d['id']].get(i)
            covn = rare[d['id']][1]
            entry = [ci or 0, covn]
            if i in rank[d['id']]:
                entry += [rank[d['id']][i], peers[d['id']]]
            if n:
                rk[d['id']] = entry
            # highlight candidates — each phrased by its own comparison, the strongest per dataset kept (percentile-like)
            if not n:
                continue
            share = n / d['located'] if d['located'] else 0
            withany = rare[d['id']][0]
            cands = []
            if share >= NATIONAL_SHARE:
                cands.append({'k': 'share', 'v': round(share, 4), 'p': 0.95 + min(share, 0.05)})
            if n >= MIN_COUNT and covn:
                cands.append({'k': 'count', 'v': ci, 'of': covn, 'p': 1 - (ci - 1) / covn})
            if i in rank[d['id']] and peers[d['id']] >= MIN_PEERS:
                rr = rank[d['id']][i]
                cands.append({'k': 'density', 'v': rr, 'of': peers[d['id']], 'p': 1 - (rr - 1) / peers[d['id']]})
            if covn and withany / covn <= RARE_SHARE:
                cands.append({'k': 'rare', 'v': withany, 'of': covn, 'p': 1 - withany / covn})
            if cands:
                b = max(cands, key=lambda x: x['p'])
                if b['p'] >= STRENGTH_MIN:
                    hl.append({'d': d['id'], **b, '_sh': share})
        # one highlight per dataset (the strongest), strongest first; equal strength: the larger share of the
        # dataset's located records nationwide first (18.6% of the country's luxury points before 5.1% of its camera shops)
        hls = sorted(hl, key=lambda h: (-round(h['p'], 3), -h['_sh']))[:MAX_HIGHLIGHTS]
        # in highlight order (a set's order changes with Python's string hashing from run to run; 0.1.3)
        best = [h['d'] for h in hls]
        together = [[a_, b_] for a_ in best for b_ in best if (a_, b_) in strong]
        row = {
            'id': pr['canonical_id'], 'name': pr['name_th'], 'province': nprov[i],
            'areaM2': round(pr['area_m2'], 2), 'ref': [round(v, 6) for v in pr['neighbourhood_reference_point']],
            'bbox': [round(v, 6) for v in polys[i].bounds],
            'nameStatus': pr.get('name_status', ''), 'fieldVerified': bool(pr.get('field_verified')),
            'aliases': sorted(set(aliases.get(pr['canonical_id'], [])) - {pr['name_th']}),
            'roles': proposed.get(pr['canonical_id'], []),
            'kind': pr['_kind'],
            **({'amended': pr['_amended']} if pr.get('_amended') else {}),
            'c': c, 'm': m, 's': s, 'r': rk,
            'hl': [{**{k: v for k, v in h.items() if k not in ('p', '_sh')}, 'p': round(h['p'], 3)} for h in hls],
            'pairs': together,
        }
        if pr['_kind'] in ('lodging', 'screen') or (prev_closed and pr['canonical_id'] not in prev_closed):
            row['added'] = True  # first drawn in this data release (0.2.0; the commercial screen's 0.5.0)
        if pr['_kind'] == 'screen':
            row['screen'] = {'on': pr['_screen']['on'], 'reachM': pr['_screen']['reachM'], **({'cm': True} if pr['_screen']['cm'] else {}),
                             **({'tick': pr['_screen']['tick'], 'tickedOn': pr['_screen']['tickedOn']} if pr['_screen']['tick'] in ('trimArms', 'cut1km') else {})}
            if not row['roles']:  # the roles the registry proposed for the code (ชื่อกลาง, “บทบาทที่เสนอจากหลักฐาน”, joined by ' · ')
                row['roles'] = [role_th_to_id[th] for th in (s_.strip() for s_ in pr['_screen']['role'].split('·')) if th in role_th_to_id]
        if pr['canonical_id'] in lodging:
            row['lodging'] = lodging[pr['canonical_id']]
        out_rows.append(row)

    pend = []
    for f in pending:
        pr = f['properties']
        codes = pr.get('source_province_codes') or []
        p_ = {'id': pr['canonical_id'], 'name': pr['name_th'], 'province': dopa.get(str(codes[0]), '') if codes else '',
              'status': 'collection' if pr.get('geometry_role') == 'collection' else 'held',
              'related': pr.get('related_canonical_ids', []) or []}
        if pr['canonical_id'] in lodging:
            p_['lodging'] = lodging[pr['canonical_id']]
        pend.append(p_)
    # the new lodging areas without a review draft: searchable, never counted (their start point only places the province)
    # (a start point at the shore falls outside the simplified province outlines: the screen's display province then)
    by_name = {f['properties']['name']: f['properties']['id'] for f in prov['features']}
    for gid, name, xy, pname in sorted(lod_pending):
        # (0.2.1) admitted by the registry: a held code (no closed outline), like the registry's own held codes
        pend.append({'id': gid, 'name': name, 'province': (province_of(*xy) if xy else '') or by_name.get(pname, ''),
                     'status': 'held' if admit else 'lodging', 'screen': 'lodging', 'related': [], 'lodging': lodging[gid]})
    # (0.5.0) the commercial screen's codes without an outline yet: searchable, never counted
    for code, name, prov_th, wait, role_th in sorted(scr_pending):
        pend.append({'id': code, 'name': name, 'province': by_name.get(prov_th, ''), 'status': 'held', 'screen': 'commercial', 'wait': wait, 'related': []})

    # ----- display outlines: simplified with shared edges kept (mapshaper), 6 decimals
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, 'in.geojson')
        json.dump({'type': 'FeatureCollection', 'features': [
            {'type': 'Feature', 'properties': {'id': f['properties']['canonical_id'], 'kind': f['properties']['_kind']}, 'geometry': f['geometry']} for f in closed]},
            open(src, 'w', encoding='utf-8'))
        dst = os.path.join(tmp, 'out.geojson')
        subprocess.run([a.mapshaper, src, '-simplify', 'interval=1.5', 'keep-shapes', '-o', 'precision=0.000001', dst],
                       check=True, capture_output=True)
        display = json.load(open(dst, encoding='utf-8'))
    display['metadata'] = {
        'source': 'CityMETER central neighbourhood registry — national-gis/canonical-boundaries.geojson of the owner bundle; kind=lodging: review drafts of its lodging screen (boundaries/current-all268-review-drafts.geojson); the registry admitted these areas as central codes on ' + a.admitted_on + ' (tab ' + registry_tab_on('ชื่อกลาง', a.admitted_on) + '), the outlines stay drafts' if admit else 'CityMETER central neighbourhood registry — national-gis/canonical-boundaries.geojson of the owner bundle; kind=lodging: review drafts of its lodging screen (boundaries/current-all268-review-drafts.geojson), not admitted by the registry',
        'features': len(display['features']),
        **({'amended': {'ids': [x['id'] for x in amendments], 'note': "owner's amendments of outlines (amendments/outline-amendments.geojson): drawn by the registry's rules (0.2.4) or redrawn by the owner's rule from the basemap (0.3.0, `rule`); every count uses them"}} if amendments else {}),
        'simplification': 'mapshaper -simplify interval=1.5 keep-shapes (display only; shared edges kept); every count uses the delivered outline',
        'status': 'draft outlines pending local confirmation; not an administrative boundary or a title',
        'license': '© OpenStreetMap contributors, ODbL 1.0 (roads, waterways and footprints used to draw the outlines)',
    }

    # ----- records inside each outline (for the map, its pins and cards), one file per neighbourhood (0.1.3)
    REC_FIELDS = ['dataset', 'lon', 'lat', 'subgroup', 'key', 'name', 'nameEn', 'measure', 'sub']
    shards = {}
    for i, f in enumerate(closed):
        rows_ = sorted(records.get(i, []), key=lambda r: (r[0], r[5], r[4]))
        shards[f['properties']['canonical_id']] = {'id': f['properties']['canonical_id'], 'fields': REC_FIELDS, 'rows': rows_}

    # ----- condominium display points (0.1.3): never counted, drawn in 0.1° cells round the open neighbourhood
    condo_meta, condo_cells = None, {}
    if a.condo:
        wb = openpyxl.load_workbook(a.condo, read_only=True, data_only=True)
        ws = wb['07_PRODUCTION']
        it = ws.iter_rows(values_only=True)
        hdr = next(it)
        ix = {h: k for k, h in enumerate(hdr) if h}
        need = ['ชื่อไทยใน production', 'จังหวัดของพื้นที่ค้น', 'พื้นที่ค้นตามแหล่ง', 'สถานะหมุดตามแหล่ง', 'ลองจิจูดตามแหล่ง', 'ละติจูดตามแหล่ง',
                'สถานะตรวจพื้นที่', 'จำนวนอาคารตามแหล่ง', 'จำนวนชั้นตามแหล่ง', 'ราคาประเมิน P25 บาท/ตร.ม.', 'ราคาประเมิน P50 บาท/ตร.ม.',
                'ราคาประเมิน P75 บาท/ตร.ม.', 'ตรวจเมื่อ']
        missing = [h for h in need if h not in ix]
        if missing:
            raise SystemExit(f'condo export lacks {missing}')
        def fnum(v):
            try:
                x = float(v)
            except (TypeError, ValueError):
                return None
            return x if math.isfinite(x) else None
        tally, checked = Counter(), Counter()
        for r in it:
            if not r or all(v in (None, '') for v in r):
                continue
            status, geo = str(r[ix['สถานะหมุดตามแหล่ง']] or ''), str(r[ix['สถานะตรวจพื้นที่']] or '')
            lon, lat = fnum(r[ix['ลองจิจูดตามแหล่ง']]), fnum(r[ix['ละติจูดตามแหล่ง']])
            if status != CONDO_SHOWN or geo.startswith('held') or not ok(lon, lat):
                tally['held' if status.startswith('held') or geo.startswith('held') else 'noPoint'] += 1
                continue
            tally['shown'] += 1
            checked[str(r[ix['ตรวจเมื่อ']] or '')[:10]] += 1
            whole = lambda v: int(round(v)) if v is not None else None
            row = [round(lon, 6), round(lat, 6), txt(r[ix['ชื่อไทยใน production']]), whole(fnum(r[ix['จำนวนอาคารตามแหล่ง']])),
                   whole(fnum(r[ix['จำนวนชั้นตามแหล่ง']])), whole(fnum(r[ix['ราคาประเมิน P25 บาท/ตร.ม.']])),
                   whole(fnum(r[ix['ราคาประเมิน P50 บาท/ตร.ม.']])), whole(fnum(r[ix['ราคาประเมิน P75 บาท/ตร.ม.']])),
                   txt(r[ix['พื้นที่ค้นตามแหล่ง']]), txt(r[ix['จังหวัดของพื้นที่ค้น']])]
            cell = f'{math.floor(lon / CONDO_CELL)}_{math.floor(lat / CONDO_CELL)}'
            condo_cells.setdefault(cell, []).append(row)
        for rows_ in condo_cells.values():
            rows_.sort(key=lambda r: (r[0], r[1], r[2]))
        condo_meta = {
            'id': 'condo', 'name': 'Condominium', 'nameTh': 'คอนโดมิเนียม', 'group': 'Land',
            'title': 'CityMETER Condominium Thailand — Research Master', 'kind': 'Google Sheet (internal)', 'tab': '07_PRODUCTION',
            'readOn': a.condo_read_on, 'checkedOn': max(checked) if checked else '', 'exportSha256': sha256_file(a.condo),
            'shown': tally['shown'], 'held': tally['held'], 'noPoint': tally['noPoint'], 'cell': CONDO_CELL, 'cells': sorted(condo_cells),
            'fields': ['lon', 'lat', 'name', 'buildings', 'floors', 'p25', 'p50', 'p75', 'area', 'province'],
            'unitTh': 'รายการ', 'unitEn': 'records',
            'scope': {'th': 'จุดของรายการอาคารชุดในฐานราคาประเมินที่แผนที่ CityMETER วาด ยังไม่ยืนยันพิกัดรายโครงการ ไม่นับเข้าย่าน',
                      'en': 'points of the condominium appraisal records the CityMETER map draws; not a confirmed project location; never counted in a neighbourhood'},
        }
        print(f"condo             shown={tally['shown']:>6} held={tally['held']:>4} noPoint={tally['noPoint']:>4} cells={len(condo_cells):>4}", file=sys.stderr)

    totals = {
        'closed': n_registry, 'lodgingDrawn': sum(1 for f in closed if f['properties']['_kind'] == 'lodging'), 'outlined': len(closed),
        'held': sum(1 for p in pend if p['status'] == 'held'), 'collections': sum(1 for p in pend if p['status'] == 'collection'),
        'lodgingUndrawn': sum(1 for p in pend if p.get('screen') == 'lodging'), 'added': sum(1 for r in out_rows if r.get('added')),
        'addedRegistry': sum(1 for r in out_rows if r.get('added') and r['kind'] == 'registry'),
        'screenDrawn': sum(1 for f in closed if f['properties']['_kind'] == 'screen'), 'screenUndrawn': len(scr_pending),
        'screenHeld': sum(1 for c_, *_ in scr_codes if c_ in (set(a.screen_hold.split(',')) if a.screen_hold else set())),
        'screenRemoved': (scr_meta or {}).get('removedOwner', 0),
        'codes': len(feats) + len(admit) + len(scr_codes), 'admitted': len(admit), 'areaKm2': round(sum(area) / 1e6, 2), 'provinces': len(set(nprov)),
        'thailandKm2': round(sum(f['properties']['areaSqm'] for f in prov['features']) / 1e6, 1), 'insidePoints': len(inside_points),
    }
    if totals['closed'] + totals['lodgingDrawn'] + totals['screenDrawn'] + totals['held'] + totals['collections'] + totals['screenHeld'] + totals['screenRemoved'] != totals['codes']:
        sys.exit(f'totals do not add up: {totals}')
    meta = {
        'dataset': 'CityMETER Commercial District', 'datasetTh': 'ย่านกลางและสิ่งที่อยู่ในย่าน', 'builtOn': date.today().isoformat(),
        # Owner 2026-11-16: the registry's internal working fields (field questions, source ids, merge notes, outline
        # policy versions) are not published — the registry is known here by its read date and export hash only.
        'registry': {'title': 'ทะเบียนย่านกลาง CityMETER', 'kind': 'Google Sheet (internal)', 'readOn': a.read_on,
                     'exportSha256': sha256_file(a.registry),
                     # (0.2.1) the rows added after that export, read back from the sheet and checked by SHA-256
                     'admitted': {'on': a.admitted_on, 'tab': registry_tab_on('ชื่อกลาง', a.admitted_on), 'codes': len(admit), 'rowsSha256': admitted_sha} if admit else None},
        'bundle': {'title': 'CityMETER • ทะเบียนย่าน ขอบเขต และหลักฐานล่าสุด.zip', 'sha256': sha256_file(a.bundle_zip) if a.bundle_zip else '',
                   'boundaries': 'national-gis/canonical-boundaries.geojson', 'boundariesSha256': sha256_file(canon_path),
                   'revision': {k: revision.get(k) for k in ('policy_version', 'canonical_codes', 'closed_neighbourhoods', 'pending_without_closed_geometry', 'collection_codes')}
                   | {'positive_area_overlap_pairs': next((v['positive_area_overlap_pairs'] for v in revision.values() if isinstance(v, dict) and 'positive_area_overlap_pairs' in v), None)}},
        'rules': {'minCount': MIN_COUNT, 'topShare': TOP_SHARE, 'strengthMin': STRENGTH_MIN, 'maxHighlights': MAX_HIGHLIGHTS, 'minPeers': MIN_PEERS, 'rareShare': RARE_SHARE, 'nationalShare': NATIONAL_SHARE,
                  'pairMinBoth': PAIR_MIN_BOTH, 'pairMinRho': PAIR_MIN_RHO, 'density': 'records per km² of the outline: the registry area_m2, or the area of an owner-amended outline measured in UTM 47N (meta.amendments)'},
        'totals': totals,
        'records': {'dir': 'records', 'fields': REC_FIELDS},
        'condo': condo_meta,
        'lodging': lod_meta,
        # (0.5.0) the registry's commercial screen: codes admitted 2026-11-25 and 26, outlines drawn by the owner's rule
        'screen': scr_meta,
        # (0.2.4) owner amendments of registry outlines, until the registry's next release carries them
        'amendments': {'file': 'amendments/outline-amendments.geojson', 'sha256': sha256_file(a.outline_amendments), 'items': amendments} if amendments else None,
        'added': {'since': 'ข้อมูลรุ่น 16 พ.ย. 2569 (343 ขอบปิด)', 'sinceEn': 'the data of 16 Nov 2026 (343 closed outlines)'} if prev_closed else None,
        'attribution': 'ขอบย่าน: ทะเบียนย่านกลาง CityMETER (ฉบับร่าง) · ถนน แนวน้ำ และอาคารที่ใช้วาดขอบ © OpenStreetMap contributors (ODbL)',
    }
    roles = [{'id': rid, 'th': th, 'en': en, 'datasets': ds} for rid, th, en, ds in ROLES]
    doc = {'meta': meta, 'datasets': datasets, 'roles': roles, 'pairs': pairs, 'rows': out_rows, 'pending': pend}

    os.makedirs(a.out, exist_ok=True)
    def dump(name, obj):
        p = os.path.join(a.out, name)
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
        return {'file': name, 'bytes': os.path.getsize(p), 'sha256': sha256_file(p)}
    files = [dump('neighborhoods.json', doc), dump('boundaries.geojson', display)]
    # shards: rewritten whole (a neighbourhood or a cell that is gone leaves no file behind)
    def shard_dir(name, items):
        folder = os.path.join(a.out, name)
        if os.path.isdir(folder):
            for old in os.listdir(folder):
                if old.endswith('.json'):
                    os.remove(os.path.join(folder, old))
        os.makedirs(folder, exist_ok=True)
        out = [dump(f'{name}/{k}.json', v) for k, v in sorted(items.items())]
        return {'dir': name, 'files': len(out), 'bytes': sum(x['bytes'] for x in out),
                'sha256': hashlib.sha256(''.join(x['file'] + x['sha256'] for x in out).encode()).hexdigest()}
    shard_report = [shard_dir('records', shards)]
    if condo_meta:
        shard_report.append(shard_dir('condo', {k: {'cell': k, 'fields': condo_meta['fields'], 'rows': v} for k, v in condo_cells.items()}))
        files.append(dump('condo/index.json', {k: condo_meta[k] for k in ('id', 'readOn', 'checkedOn', 'shown', 'cell', 'cells', 'fields')}))
    stale = os.path.join(a.out, 'points.json')
    if os.path.exists(stale):
        os.remove(stale)  # replaced by records/ (0.1.3)
    report = {'builtOn': meta['builtOn'], 'files': files, 'shards': shard_report, 'totals': totals,
              'datasets': [{k: d[k] for k in ('id', 'records', 'located', 'inside', 'neighbourhoodsWith', 'peers')} for d in datasets],
              'pairs': pairs[:20]}
    dump('build-report.json', report)
    for f_ in files:
        print(f"{f_['file']:<22} {f_['bytes']:>9} bytes", file=sys.stderr)
    for f_ in shard_report:
        print(f"{f_['dir'] + '/':<22} {f_['bytes']:>9} bytes in {f_['files']} files", file=sys.stderr)


if __name__ == '__main__':
    main()
