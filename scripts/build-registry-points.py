#!/usr/bin/env python3
"""CityMETER · Commercial District — the registry's research datasets that have no demo web yet, as points (0.8.0).

    python3 -I scripts/build-registry-points.py --masters <folder of the masters' xlsx exports, <id>.xlsx>
        --venues <montri-th/shoppingcenter data/venues.json at the commit the data build pins> --out <private folder>
        [--built-on YYYY-MM-DD]

Owner 2026-11-28 20:12, VERBATIM: “ในขอบเขต 800 เมตรของย่านศูนย์สิริกิติ ควรจะมีสวนเบญจกิตติ ถูกนับด้วย / Parks
ขนาดใหญ่ขนาดนี้ควรมีผลกับความ "น่าอยู่" ของย่านมากๆ มากกว่า fitness เราจะมีวิธีปรับ logic อย่างไรให้ข้อมูลทั้ง 44 ชุดที่
เชื่อมต่อกับ registry [the Dataset Registry] นำมาใช้อธิบาย locale insight ของแต่ละย่านได้มากที่สุด แม้เป็น dataset ที่ยัง
ไม่ได้สร้าง demo web ครับ / เรื่องสวนสาธารณะเป็นตัวอย่างนึง หากมี logic ส่วนอื่นควรปรับด้วย ขอให้ leverage ข้อมูลที่เรามีให้
เต็มที่”

Each master is read by its own count rule, never by one of ours: the rule its tab MCP_SPATIAL_POLICY states
(`count_eligibility`), or the countable list it already prepared for Yolk MCP (MCP_COUNT_VIEW). A record is placed
  own    at its own point (latitude/longitude) when the master's geometry_status accepts it as a source point;
  host   at the point of the place it sits in, as the master recorded it (host_latitude/host_longitude, or a point the
         master marks as the host's);
  venue  at the Shopping Center demo's point of the centre the master links it to by a registry id
         (common_retail_venue_ids, citymeter_shopping_center_id, host_venue_id) — never by a name;
otherwise it is unplaced and counted by the province the master names (never a zero of a neighbourhood). The masters'
own spatial gate is still pending (MCP_SPATIAL_POLICY `spatial_gate`) and their rights gate keeps geometry from being
redistributed, so the points stay outside the repository: the page carries counts only (DATA_METHOD.md §20).

Outputs: <out>/<id>.json — {meta, groups, points: [[lon, lat, group, key, placed]], unplaced: {province (Thai): n}}.
"""
import argparse, hashlib, json, math, os, re, sys
from collections import Counter, defaultdict
from datetime import date

import openpyxl

TH_BOX = (97.0, 5.3, 106.0, 20.8)

# (0.9.0) statuses of the readiness brief (02-CityMETER__research-master-data-readiness-chatgpt-brief, 28 Nov 2026, §5) for a
# point the master now cites; `host_venue_linked` places a row by the centre id beside it (the venue columns), not by a point
READY_OWN = ('published_point_cited', 'osm_element_matched', 'address_point_matched')


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def num(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def ok(lon, lat):
    return lon is not None and lat is not None and TH_BOX[0] <= lon <= TH_BOX[2] and TH_BOX[1] <= lat <= TH_BOX[3]


def ids_of(v):
    """Registry ids in a cell: a JSON list or ids split on separators."""
    v = (v or '').strip()
    if not v:
        return []
    if v.startswith('['):
        try:
            return [str(x).strip() for x in json.loads(v) if str(x).strip()]
        except ValueError:
            pass
    return [x for x in re.split(r'[;,|\s]+', v) if x]


def table(wb, tab):
    ws = wb[tab]
    rows = [['' if x is None else str(x).strip() for x in r] for r in ws.iter_rows(values_only=True)]
    rows = [r for r in rows if any(r)]
    head = rows[0]
    return head, [dict(zip(head, r)) for r in rows[1:]]


def policy(wb):
    if 'MCP_SPATIAL_POLICY' not in wb.sheetnames:
        return {}
    return {str(r[0]): str(r[1]) for r in wb['MCP_SPATIAL_POLICY'].iter_rows(values_only=True) if r and r[0]}


# ---- the datasets: the master's tab, its count rule, how a record is placed and named, its kinds -------------------
# `rule` returns the countable rows of the tab; `key` the unit the master counts once; `own` the geometry_status values
# (a regex) that make a row's latitude/longitude its own point; `hostpt` the statuses whose point is the host's;
# `venue` the columns of registry ids to a centre; `seg` the kinds (id, th, en, regex on the column) in order, the last
# one catching the rest. Thai and English names are this demo's; the counting is the master's.
G = lambda *a: list(a)
DATASETS = {
    'bank': dict(reg='research.TH.bank', tab='02_VENUES', th='ธนาคาร', en='Banks', group='Location', unit=('สาขา', 'branches'),
                 view='bank', key=('venue_id',), own=r'^(provider_coordinates|coordinates_in_official_map_link|official_linked_google_map_destination)$',
                 venue=('host_venue_id', 'common_retail_venue_ids'), name=('venue_name',), brand='brand_name',
                 seg=('category_th', G(('commercial', 'ธนาคารพาณิชย์', 'Commercial banks', r'พาณิชย์|ต่างประเทศ'),
                                       ('state', 'ธนาคารรัฐและสถาบันการเงินเฉพาะกิจ', 'State and specialised banks', r'.'))),
                 rule_th='สาขาธนาคารในรายชื่อ ธปท. (รหัสธนาคาร + รหัสสาขาไม่ซ้ำ) ที่ทะเบียนเตรียมไว้ให้ Yolk',
                 rule_en='bank branches of the Bank of Thailand roster (distinct bank and branch codes) the register prepared for Yolk'),
    'gold': dict(reg='research.TH.gold', tab='02_STORES', th='ร้านทอง', en='Gold shops', group='Location', unit=('สาขา', 'branches'),
                 rule=lambda d: d['release_status'] == 'research_source_listed' and d['store_format'] == 'retail_branch' and d['source_type'] == 'official_brand_locator' and d['province'],
                 key=('outlet_id',), own=r'^(official_published_point|citymeter_host_representative)$', hostpt=r'^citymeter_host_representative$',
                 venue=('common_retail_venue_ids', 'citymeter_shopping_center_id'), name=('store_name',), brand='brand_name',
                 seg=('segment', G(('gold', 'ร้านทอง', 'Gold shops', r'.'))),
                 rule_th='สาขาขายปลีกทองจากตัวค้นหาสาขาของแบรนด์ (outlet ไม่ซ้ำ)', rule_en='gold retail branches from the brands’ store locators (distinct outlets)'),
    'optical': dict(reg='research.TH.optical', tab='02_STORES', th='ร้านแว่นตา', en='Optical shops', group='Location', unit=('ร้าน', 'shops'),
                    rule=lambda d: 'source_listing_retained' in d['dedup_status'] and d['province'],
                    key=('outlet_id',), own=r'^source_point_not_field_verified$', hostpt=r'^host_context_only$',
                    venue=('common_retail_venue_ids', 'citymeter_shopping_center_id'), name=('store_name',), brand='brand_name',
                    seg=('segment', G(('optical', 'ร้านแว่นตา', 'Optical shops', r'.'))),
                    rule_th='จุดขายที่ยังอยู่ในรายชื่อแหล่งหลักของร้านแว่น (outlet ไม่ซ้ำ)', rule_en='points of sale still in the optical retailers’ primary listings (distinct outlets)'),
    'salon': dict(reg='research.TH.salon_barber', tab='02_STORES', th='ร้านทำผมและตัดผม', en='Hair salons and barbers', group='Location', unit=('ร้าน', 'shops'),
                  rule=lambda d: d['operating_status'] == 'source_listed' and not re.search(r'held|hold', d['evidence_status'] + d['release_status']) and d['scope_status'] == 'approved',
                  key=('outlet_id',), own=r'^(explicit_source_point|publisher_point_unverified|publisher_branch_point_not_field_verified)$',
                  venue=('host_venue_id',), hostcols=('host_latitude', 'host_longitude'), name=('store_name',), brand='brand_name',
                  seg=('segment', G(('barber', 'ร้านตัดผมชาย', 'Barbers', r'(?i)barber'), ('salon', 'ร้านทำผม', 'Hair salons', r'.'))),
                  rule_th='ร้านที่แหล่งยังระบุ ไม่นับรายการที่พักไว้ (outlet ไม่ซ้ำ)', rule_en='shops the source still lists, held rows left out (distinct outlets)'),
    'furniture': dict(reg='research.TH.furniture', tab='02_STORES', th='เฟอร์นิเจอร์ ของแต่งบ้าน และ DIY', en='Furniture, home and DIY', group='Location', unit=('ร้าน', 'stores'),
                      view='pos', key=('outlet_id', 'physical_site_id'), own=r'^(official_published_point|source_point_selected)$',
                      venue=('common_retail_venue_ids', 'citymeter_shopping_center_id'), name=('store_name',), brand='brand_name',
                      seg=('segment', G(('diy', 'DIY และวัสดุซ่อมบ้าน', 'DIY and home improvement', r'(?i)diy|home'), ('kitchen', 'ครัวและเครื่องครัว', 'Kitchen', r'(?i)kitchen'),
                                        ('furniture', 'เฟอร์นิเจอร์', 'Furniture', r'.'))),
                      rule_th='จุดขายที่ทะเบียนนับได้ หนึ่ง count_key ต่อจุดขาย (รายการที่เตรียมให้ Yolk)', rule_en='countable points of sale, one count key each (the list prepared for Yolk)'),
    'sport': dict(reg='research.TH.sport', tab='02_STORES', th='ร้านกีฬา', en='Sport shops', group='Location', unit=('ร้าน', 'stores'),
                  view='pos', key=('canonical_outlet_id', 'outlet_id'), own=r'^(source_locator_point_unverified|provider_point_unverified|official_store_destination_point_unverified)$',
                  venue=('common_retail_venue_ids', 'citymeter_shopping_center_id'), name=('store_name',), brand='brand_name',
                  seg=('segment', G(('sport', 'ร้านกีฬา', 'Sport shops', r'.'))),
                  rule_th='จุดขายที่ทะเบียนนับได้ หนึ่ง count_key ต่อจุดขาย (รายการที่เตรียมให้ Yolk)', rule_en='countable points of sale, one count key each (the list prepared for Yolk)'),
    'apparel': dict(reg='research.TH.apparel', tab='02_STORES', th='ร้านเสื้อผ้า', en='Apparel shops', group='Location', unit=('ร้าน', 'stores'),
                    view='pos', key=('outlet_id',), own=r'^(source_point_unverified|official_locator_point_unverified)$', hostpt=r'^host_context_only$',
                    venue=('common_retail_venue_ids', 'citymeter_shopping_center_id'), name=('store_name',), brand='brand_name',
                    seg=('segment', G(('apparel', 'ร้านเสื้อผ้า', 'Apparel shops', r'.'))),
                    rule_th='จุดขายที่ทะเบียนนับได้ หนึ่ง count_key ต่อจุดขาย (รายการที่เตรียมให้ Yolk)', rule_en='countable points of sale, one count key each (the list prepared for Yolk)'),
    'beauty': dict(reg='research.TH.beauty', tab='02_STORES', th='ร้านเครื่องสำอางและความงาม', en='Beauty stores', group='Location', unit=('จุดขาย', 'points of sale'),
                   rule=lambda d: d['count_role'] == 'count_source_pos_candidate' and d['scope_group'] in ('approved_channel', 'approved_core') and d['operating_status'] == 'source_listed' and d['province'],
                   key=('canonical_outlet_id', 'outlet_id'), own=r'^(publisher_pin_unverified|publisher_point_unverified|publisher_host_marker_not_shopfront)$',
                   hostpt=r'^publisher_host_marker_not_shopfront$', venue=('common_retail_venue_ids', 'citymeter_shopping_center_id'), name=('store_name',), brand='brand_name',
                   seg=('segment', G(('beauty', 'ร้านความงาม', 'Beauty stores', r'.'))),
                   rule_th='จุดขายความงามที่แหล่งแบรนด์ระบุ canonical outlet ไม่ซ้ำ ในขอบเขตแบรนด์ที่รับแล้ว', rule_en='beauty points of sale the brands list, distinct canonical outlets of accepted brands'),
    'massage': dict(reg='research.TH.massage_spa', tab='02_STORES', th='นวด สปา และออนเซ็น', en='Massage, spa and onsen', group='Location', unit=('แห่ง', 'places'),
                    view='mcp', key=('outlet_id',), own=r'^source_published_role_not_field_verified$',
                    venue=('common_retail_venue_ids', 'citymeter_shopping_center_id'), name=('store_name',), brand='brand_name',
                    seg=('segment', G(('hotel', 'สปาในโรงแรมและรีสอร์ต', 'Hotel and resort spas', r'hotel'), ('spa', 'นวดและเดย์สปา', 'Massage and day spas', r'.'))),
                    rule_th='จุดบริการตามรายชื่อแหล่งหลัก (รายการที่เตรียมให้ Yolk)', rule_en='service points of the primary listings (the list prepared for Yolk)'),
    'nail': dict(reg='research.TH.nail', tab='02_STORES', th='ร้านทำเล็บ', en='Nail salons', group='Location', unit=('ร้าน', 'salons'),
                 rule=lambda d: d['operating_status'] == 'source_listed',
                 key=('canonical_outlet_id', 'outlet_id'), own=r'^(published_source_point.*|source_point_recovered)$', venue=('host_venue_id',), name=('store_name',), brand='brand_name',
                 seg=('segment', G(('nail', 'ร้านทำเล็บ', 'Nail salons', r'.'))),
                 rule_th='ร้านที่แหล่งยังระบุ หนึ่งร้านต่อ canonical outlet (กติกาที่เจ้าของตัดสิน 20 พ.ย. 2569)', rule_en='salons the source still lists, one per canonical outlet (the owner’s rule of 20 Nov 2026)'),
    'clinic': dict(reg='research.TH.beauty_clinic', tab='02_STORES', th='คลินิกความงาม', en='Beauty clinics', group='Location', unit=('สาขา', 'branches'),
                   rule=lambda d: d['operating_status'] == 'source_listed' and d['release_status'] == 'research_only' and d['evidence_status'] != 'held' and d['store_format'] == 'clinic_branch',
                   key=('outlet_id',), own=r'^selected_branch_point$', venue=('citymeter_shopping_center_id', 'host_venue_id', 'common_retail_venue_ids'), name=('store_name',), brand='brand_name',
                   seg=('segment', G(('clinic', 'คลินิกความงาม', 'Beauty clinics', r'.'))),
                   rule_th='สาขาคลินิกที่แหล่งยังระบุ ไม่นับรายการที่พักไว้ รูปแบบอื่น และชื่อซ้ำ', rule_en='clinic branches the source still lists; held rows, other formats and aliases left out'),
    'playground': dict(reg='research.TH.playground', tab='02_STORES', th='สนามเด็กเล่นและเกมเซ็นเตอร์', en='Play and family entertainment', group='Location', unit=('แห่ง', 'places'),
                       rule=lambda d: d['operating_status'] == 'source_listed' and d['scope_group'] not in ('nested_concept', 'research_context'),
                       key=('outlet_id',), own=r'^$^', venue=('common_retail_venue_ids', 'citymeter_shopping_center_id'), name=('store_name',), brand='brand_name',
                       seg=('segment', G(('play', 'ที่เล่นของเด็กและครอบครัว', 'Play and family places', r'.'))),
                       rule_th='สาขาที่แหล่งยังระบุ ไม่นับแนวคิดซ้อนและบริบท', rule_en='branches the source still lists; nested concepts and context left out'),
    'pet': dict(reg='research.TH.pet', tab='02_STORES', th='ร้านและบริการสัตว์เลี้ยง', en='Pet shops and services', group='Location', unit=('แห่ง', 'places'),
                rule=lambda d: d['count_role'] in ('source_listed_outlet_candidate', 'source_listed_facility'),
                key=('outlet_id',), own=r'^(source_published_point.*|held_host_point_not_storefront)$', hostpt=r'^held_host_point_not_storefront$',
                venue=('common_retail_venue_ids',), name=('store_name',), brand='brand_name',
                seg=('segment', G(('vet', 'โรงพยาบาลและคลินิกสัตว์', 'Animal hospitals and clinics', r'โรงพยาบาล|คลินิก'), ('pet', 'ร้านและบริการสัตว์เลี้ยง', 'Pet shops and care', r'.'))),
                rule_th='ร้านและบริการที่แหล่งยังระบุ หนึ่ง outlet ต่อแห่ง (กติกาที่เจ้าของตัดสิน 20 พ.ย. 2569)', rule_en='shops and services the source still lists, one outlet each (the owner’s rule of 20 Nov 2026)'),
    'car': dict(reg='research.TH.car_service', tab='02_STORES', th='บริการรถยนต์', en='Car services', group='Location', unit=('แห่ง', 'places'),
                rule=lambda d: d['evidence_status'] == 'source_listed',
                key=('outlet_id',), own=r'^(source_point_accuracy_unverified|source_point_selected)$', venue=('common_retail_venue_ids',), name=('store_name',), brand='brand_name',
                seg=('segment', G(('tyre', 'ยางและซ่อมบำรุงด่วน', 'Tyres and fast-fit', r'ยาง|Fast-fit|น้ำมันเครื่อง'), ('film', 'ฟิล์มกรองแสงและเคลือบสี', 'Window film and coating', r'ฟิล์ม|PPF|เคลือบ'),
                                  ('service', 'ศูนย์และอู่บริการ', 'Service centres and garages', r'.'))),
                rule_th='ร้านและจุดบริการที่แหล่งยังระบุ หนึ่ง outlet ต่อร้าน (กติกาที่เจ้าของตัดสิน 20 พ.ย. 2569)', rule_en='shops and service points the source still lists, one outlet each (the owner’s rule of 20 Nov 2026)'),
    'hobby': dict(reg='research.TH.hobby', tab='02_STORES', th='ร้านของขวัญ หนังสือ และงานอดิเรก', en='Gifts, books and hobbies', group='Location', unit=('ร้าน', 'stores'),
                  rule=lambda d: d['count_role'] == 'source_pos_candidate',
                  key=('outlet_id',), own=r'^(source_coordinate_not_field_verified|source_point_selected)$', venue=('common_retail_venue_ids', 'citymeter_shopping_center_id'), name=('store_name',), brand='brand_name',
                  seg=('segment', G(('books', 'หนังสือและเครื่องเขียน', 'Books and stationery', r'หนังสือ|เครื่องเขียน|ศิลปะ'), ('gift', 'ของขวัญ ไลฟ์สไตล์ และงานอดิเรก', 'Gifts, lifestyle and hobbies', r'.'))),
                  rule_th='ร้านที่แหล่งยังระบุ หนึ่ง outlet ต่อร้าน (กติกาที่เจ้าของตัดสิน 20 พ.ย. 2569)', rule_en='stores the source still lists, one outlet each (the owner’s rule of 20 Nov 2026)'),
    'services': dict(reg='research.TH.miscellaneous', tab='02_STORES', th='ไอที โทรคมนาคม และบริการ', en='Electronics, telecom and services', group='Location', unit=('แห่ง', 'places'),
                     rule=lambda d: d['operating_status'] == 'source_listed' and not d['release_status'].startswith('hold') and d['scope_group'] != 'scope_review' and not d['evidence_status'].startswith('held'),
                     key=('outlet_id',), own=r'^$^', venue=('common_retail_venue_ids', 'citymeter_shopping_center_id', 'source_venue_id'), name=('store_name',), brand='brand_name',
                     seg=('segment', G(('electronics', 'ร้านไอทีและเครื่องใช้ไฟฟ้า', 'Electronics', r'electronics'), ('telecom', 'ร้านโทรคมนาคม', 'Telecom shops', r'telecom'),
                                       ('laundry', 'ร้านซักอบรีด', 'Laundries', r'other_consumer'), ('other', 'บริการอื่น', 'Other services', r'.'))),
                     rule_th='ร้านที่แหล่งยังระบุ ไม่นับรายการที่พักไว้ด้วยสิทธิ์หรือขอบเขต', rule_en='shops the source still lists; rows held for rights or scope left out'),
    'arts': dict(reg='research.TH.arts_edutainment', tab='02_STORES', th='พิพิธภัณฑ์ ศิลปะ และแหล่งเรียนรู้', en='Museums, arts and learning', group='Living', unit=('แห่ง', 'places'),
                 view='mcp', key=('outlet_id',), own=r'^$^', venue=('common_retail_venue_ids', 'citymeter_shopping_center_id'), links='20_VENUE_LINKS', name=('store_name',), brand='brand_name',
                 seg=('segment', G(('arts', 'พิพิธภัณฑ์และหอศิลป์', 'Museums and galleries', r'.'))),
                 rule_th='สถานที่เข้าชมอิสระในขอบเขตที่ตรวจ (รายการที่เตรียมให้ Yolk)', rule_en='independent visitor sites of the checked scope (the list prepared for Yolk)'),
    'cinema': dict(reg='research.TH.cinema_theatre', tab='02_STORES', th='โรงภาพยนตร์และโรงละคร', en='Cinemas and theatres', group='Location', unit=('แห่ง', 'sites'),
                   rule=lambda d: d['count_role'] == 'source_distinct_site_candidate' and not d['store_format'].startswith('held'),
                   key=('outlet_id',), own=r'^$^', venue=('common_retail_venue_ids', 'citymeter_shopping_center_id'), name=('store_name',), brand='brand_name',
                   seg=('segment', G(('cinema', 'โรงภาพยนตร์', 'Cinemas', r'cinema'), ('theatre', 'โรงละครและหอแสดง', 'Theatres and halls', r'.'))),
                   rule_th='สถานที่ฉายและแสดงที่แหล่งยังระบุ หนึ่งแห่งต่อสถานที่', rule_en='screening and performance sites the source still lists, one per site'),
}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--masters', required=True)
    ap.add_argument('--venues', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--only', default='')
    ap.add_argument('--provinces', default='data/provinces.geojson', help='a point farther than about 5 km from every province is unplaced (a wrong pin)')
    ap.add_argument('--built-on', default=date.today().isoformat())
    ap.add_argument('--worklist', default='', help='(private, for the masters\' owners) every record not placed, with why, and every placed one '
                    'whose point lies in another province than the one it names; never part of the page')
    a = ap.parse_args()
    import shapely
    from shapely.geometry import shape
    prov_f = json.load(open(a.provinces, encoding='utf-8'))['features']
    ptree = shapely.STRtree([shape(f['geometry']) for f in prov_f])
    pgeo = [shape(f['geometry']) for f in prov_f]

    def in_thailand(lon, lat):
        pt = shapely.Point(lon, lat)
        if any(pgeo[k].covers(pt) for k in ptree.query(pt)):
            return True
        return len(ptree.query_nearest(pt, max_distance=0.05)) > 0

    def province_at(lon, lat):
        pt = shapely.Point(lon, lat)
        return next((prov_f[k]['properties'] for k in ptree.query(pt) if pgeo[k].covers(pt)), None)

    def same_province(p, label):
        n = re.sub(r'^(จังหวัด|จ\.)\s*', '', (label or '').strip())
        if n in ('กรุงเทพฯ', 'กทม.', 'กทม', 'กรุงเทพ'):
            n = 'กรุงเทพมหานคร'
        return n in (p['name'], p['nameEn'], p['id']) or n.lower() == p['nameEn'].lower()
    work = {}
    sc = json.load(open(a.venues, encoding='utf-8'))['rows']
    venue_pt = {r['id']: (r['lon'], r['lat']) for r in sc if r.get('located') and ok(num(r.get('lon')), num(r.get('lat')))}
    os.makedirs(a.out, exist_ok=True)
    only = set(x for x in a.only.split(',') if x)
    report = {}
    for ds_id, spec in DATASETS.items():
        if only and ds_id not in only:
            continue
        path = os.path.join(a.masters, f'{ds_id}.xlsx')
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        pol = policy(wb)
        head, rows = table(wb, spec['tab'])
        # the countable rows: the master's rule, or its prepared list for Yolk joined back to the tab by id
        view = spec.get('view')
        if view:
            vh, vrows = table(wb, 'MCP_COUNT_VIEW')
            if view == 'pos':
                vrows = [v for v in vrows if v.get('count_eligible') == 'True' and v.get('status') == 'source_listed']
            elif view == 'mcp':
                vrows = [v for v in vrows if v.get('count_eligibility', '').startswith('eligible') and v.get('status') == 'source_listed']
            ids = {}
            for r in rows:
                for c in ('outlet_id', 'canonical_outlet_id', 'physical_site_id', 'venue_id', 'source_observation_id', 'source_record_id'):
                    if r.get(c):
                        ids.setdefault(r[c], []).append(r)
            units = []
            for v in vrows:
                cand = [v['id']] + ids_of(v.get('source_ids_json') or v.get('source_ids'))
                hit = []
                for c in cand:
                    c = c.split(':', 1)[1] if c.startswith(('VE:', 'OBS:')) else c
                    hit += ids.get(c, [])
                units.append((v['count_key'] or v['id'], v.get('province_label', ''), v.get('name', ''), hit))
        else:
            keep = [r for r in rows if spec['rule'](r)]
            by = {}
            for r in keep:
                k = next((r[c] for c in spec['key'] if r.get(c)), '') or f"row{len(by)}"
                by.setdefault(k, []).append(r)
            units = [(k, rs[0].get('province', ''), '', rs) for k, rs in by.items()]
        # links of 20_VENUE_LINKS (arts): outlet → centre id
        link = defaultdict(list)
        if spec.get('links') and spec['links'] in wb.sheetnames:
            _, L = table(wb, spec['links'])
            for x in L:
                if x.get('common_retail_venue_id'):
                    link[x['outlet_id']].append(x['common_retail_venue_id'])
        # (0.9.0) the point statuses the readiness brief of 28 Nov 2026 (§5) asked every master to use for a point it cites:
        # a brand's or an agency's published point, an OpenStreetMap element, an address point — the master's own point
        own_re = re.compile(f"(?:{spec['own']})|^(?:{'|'.join(READY_OWN)})$")
        host_re = re.compile(spec.get('hostpt', r'^$^'))
        seg_col, segs = spec['seg']
        points, unplaced, placed_by, kinds = [], Counter(), Counter(), Counter()
        wl_items = []
        for k, prov, vname, rs in units:
            where = None
            for r in rs:   # own (or the master's host point) first
                lon, lat = num(r.get('longitude')), num(r.get('latitude'))
                if ok(lon, lat) and own_re.match(r.get('geometry_status', '')):
                    where = (lon, lat, 'host' if host_re.match(r.get('geometry_status', '')) else 'own')
                    break
            if not where:
                for r in rs:
                    hc = spec.get('hostcols')
                    for c in spec.get('venue', ()):
                        for vid in ids_of(r.get(c)):
                            if vid in venue_pt:
                                where = (*venue_pt[vid], 'venue')
                                break
                        if where:
                            break
                    if not where:
                        for vid in link.get(r.get('outlet_id', ''), []):
                            if vid in venue_pt:
                                where = (*venue_pt[vid], 'venue')
                                break
                    if not where and hc:
                        lon, lat = num(r.get(hc[1])), num(r.get(hc[0]))
                        if ok(lon, lat):
                            where = (lon, lat, 'host')
                    if where:
                        break
            r0 = rs[0] if rs else {}
            seg_v = r0.get(seg_col, '')
            g = next(i for i, s in enumerate(segs) if re.search(s[3], seg_v or '') or i == len(segs) - 1)
            kinds[segs[g][0]] += 1
            prov = prov or r0.get('province', '') or r0.get('province_label', '')
            wrong_pin = False
            if where and not in_thailand(where[0], where[1]):
                where, wrong_pin = None, True   # a pin farther than about 5 km from every province is a wrong pin: unplaced, by its province label
            if a.worklist:
                name = vname or next((r0.get(c) for c in spec.get('name', ()) if r0.get(c)), '') or r0.get('name', '')
                item = {'key': k, 'name': name, 'brand': r0.get(spec['brand'], '') if spec.get('brand') else '', 'province': prov,
                        'geometry_status': r0.get('geometry_status', ''), 'latitude': r0.get('latitude', ''), 'longitude': r0.get('longitude', ''),
                        'venue_ids': sorted({v for r in rs for c in spec.get('venue', ()) for v in ids_of(r.get(c))})[:5]}
                if not where:
                    has_ll = any(ok(num(r.get('longitude')), num(r.get('latitude'))) for r in rs)
                    item['reason'] = ('point_outside_thailand' if wrong_pin else 'point_status_not_accepted' if has_ll
                                      else 'venue_id_without_point' if item['venue_ids'] else 'no_point')
                    wl_items.append(item)
                elif prov and where[2] != 'venue':
                    at = province_at(where[0], where[1])
                    if at and not same_province(at, prov):
                        item['reason'] = 'point_in_other_province'
                        item['point_province'] = at['name']
                        wl_items.append(item)
            if where:
                points.append([round(where[0], 6), round(where[1], 6), g, hashlib.sha256(f'{ds_id}:{k}'.encode()).hexdigest()[:16], where[2]])
                placed_by[where[2]] += 1
            else:
                unplaced[prov or '-'] += 1
        out = {
            'meta': {'id': ds_id, 'registry': spec['reg'], 'tab': spec['tab'], 'th': spec['th'], 'en': spec['en'], 'group': spec['group'],
                     'unit': list(spec['unit']), 'ruleTh': spec['rule_th'], 'ruleEn': spec['rule_en'], 'countRule': 'view' if view else 'policy',
                     'exportSha256': sha256_file(path), 'builtOn': a.built_on,
                     'policy': {k: pol.get(k, '')[:400] for k in ('count_unit', 'count_eligibility', 'rights_gate', 'service_readiness', 'spatial_gate')},
                     'records': len(units), 'placed': len(points), 'placedBy': dict(placed_by), 'kinds': dict(kinds)},
            'groups': [{'id': s[0], 'th': s[1], 'en': s[2]} for s in segs],
            'points': points, 'unplaced': dict(unplaced),
        }
        with open(os.path.join(a.out, f'{ds_id}.json'), 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        share = len(points) / len(units) if units else 0
        report[ds_id] = (len(units), len(points), round(100 * share, 1), dict(placed_by), sum(unplaced.values()))
        if a.worklist:
            work[ds_id] = {'registry': spec['reg'], 'tab': spec['tab'], 'th': spec['th'], 'en': spec['en'], 'exportSha256': out['meta']['exportSha256'],
                           'countRule': out['meta']['countRule'], 'ruleTh': spec['rule_th'], 'records': len(units), 'placed': len(points),
                           'placedBy': dict(placed_by), 'reasons': dict(Counter(x['reason'] for x in wl_items)), 'items': wl_items}
        print(f"{ds_id:10s} records {len(units):5d} placed {len(points):5d} ({100 * share:5.1f}%) {dict(placed_by)} unplaced {sum(unplaced.values())}")
    json.dump(report, open(os.path.join(a.out, 'report.json'), 'w'), ensure_ascii=False, indent=1)
    if a.worklist:
        with open(a.worklist, 'w', encoding='utf-8') as f:
            json.dump({'builtOn': a.built_on, 'datasets': work}, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
