#!/usr/bin/env python3
"""Build the metric-tile pictogram subset of Material Symbols Rounded (Apache 2.0).

Static instance at the LDS axes for this family (FILL 0, wght 300, GRAD 0, opsz 24),
subset to the pictogram glyphs below, written as WOFF2 next to the approved nav-7
subset (which stays byte-identical). The source variable font is not committed;
pass its path. Requires fonttools + brotli.

  python3 scripts/build-pictogram-font.py "MaterialSymbolsRounded[FILL,GRAD,opsz,wght].ttf"

Pictogram roles (test exception approved by the owner 2026-10-22 for the CityMETER
demos, to be folded into LDS if it proves itself): area = map, province =
location_city, segment = category, venue = local_mall; Fitness 0.3.0 added ai =
auto_awesome, streetview, maps = location_on, building = apartment (owner
2026-10-29: show icons and symbols to keep the panel text short). Hotel 0.1.0
adds hotel (records), rooms = bed, rail = train, meeting = groups, price =
payments, chain = account_tree and compare = compare_arrows. Hotel 0.2.0 adds
sea = waves, elevation = landscape, relief = height and forest (owner 2026-11-01:
icons instead of long text on the map). Hotel 0.3.1 adds rank = leaderboard,
date = event, distance = straighten (straight line), construction and dataset =
database (owner 2026-11-01, “เรื่องภาษา”: symbols, logos, icons and charts keep
the text short). School 0.1.0 replaces the hotel roles (hotel, bed, groups as
meeting rooms, payments as recorded price, account_tree as chain, local_mall)
with school (records), students = groups, teacher = co_present, classroom =
meeting_room, level = stairs, fee = payments, quality = verified, programme =
menu_book, history = trending_up, aff = account_tree (สังกัด) and closed =
event_busy. School 0.2.0 adds learning = auto_stories (เรียนเสริม records) and the
four services tutor = edit_note (กวดวิชา), language = translate (ภาษา), arts =
palette (ศิลปะ) and child = child_care (พัฒนาการเด็ก). Commercial District 0.6.0 (owner 2026-11-26, D-V4 B) adds a
glyph per dataset (the five shops and industrial estates with glyphs of their own) and home · luggage · payments for the
axes อยู่ · เที่ยว · ค้าขาย; trade shares payments with fee. No star glyph: a star would read as a rating. Outbound links
keep the nav-7 open_in_new mark.
"""
import hashlib, json, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

GLYPHS = {
    'area': ('map', 0xE55B),
    'province': ('location_city', 0xE7F1),
    'segment': ('category', 0xE72C),
    # Fitness 0.3.0 (owner 2026-10-29: icons and symbols instead of long text): contextual actions and the building view.
    'ai': ('auto_awesome', 0xE65F),
    'streetview': ('streetview', 0xE56E),
    'maps': ('location_on', 0xE0C8),
    'building': ('apartment', 0xEA40),
    # School 0.1.0: the two measures and the facts of a school.
    'school': ('school', 0xE80C),
    'students': ('groups', 0xF233),
    'teacher': ('co_present', 0xEAF0),
    'classroom': ('meeting_room', 0xEB4F),
    'level': ('stairs', 0xF1A9),
    'fee': ('payments', 0xEF63),
    'quality': ('verified', 0xEF76),
    'programme': ('menu_book', 0xEA19),
    'history': ('trending_up', 0xE8E5),
    'aff': ('account_tree', 0xE97A),
    'closed': ('event_busy', 0xE615),
    'rail': ('train', 0xE570),
    'compare': ('compare_arrows', 0xE915),
    # Hotel 0.2.0 (owner 2026-11-01: symbols and icons instead of long text, above all on the map): the terrain
    # facts of a place — sea distance, ground elevation, relief within 500 m and tree cover.
    'sea': ('waves', 0xE176),
    'elevation': ('landscape', 0xE564),
    'relief': ('height', 0xEA16),
    'forest': ('forest', 0xEA99),
    # Hotel 0.3.1 (owner 2026-11-01, “เรื่องภาษา … ใช้ symbol, logo, icon, charts มาช่วยทำให้ text กระชับ”): ranks,
    # the date and the dataset of the provenance line, straight-line distances and stations under construction.
    'rank': ('leaderboard', 0xF20C),
    'date': ('event', 0xE878),
    'distance': ('straighten', 0xE41C),
    'construction': ('construction', 0xEA3C),
    'dataset': ('database', 0xF20E),
    # School 0.2.0 (owner 2026-11-06: เรียนเสริมและพัฒนาทักษะ from the same research master): the learning-service
    # records and their four services.
    'learning': ('auto_stories', 0xE666),
    'tutor': ('edit_note', 0xE745),
    'language': ('translate', 0xE8E2),
    'arts': ('palette', 0xE40A),
    'child': ('child_care', 0xEB41),
    # Commercial District 0.6.0 (owner 2026-11-26 11:43, “ทำตามที่เสนอให้ครบทุกข้อพร้อม publish”, D-V4 B of the visual-first
    # panel proposal): one glyph per dataset beside its name — the glyphs Shopping Center's «รอบศูนย์นี้» gives the same
    # datasets, plus one of its own for each of the five shops (camera, fitness, grocery, pharmacy, restaurant) and for
    # industrial estates (a factory glyph already marks the factory registrations) — and the three axes อยู่ · เที่ยว · ค้าขาย.
    'hotel': ('bed', 0xEFDF),
    'estate': ('warehouse', 0xEBB8),
    'office': ('corporate_fare', 0xF1D0),
    'venue': ('local_mall', 0xE54C),
    'camera': ('photo_camera', 0xE412),
    'factory': ('factory', 0xEBBC),
    'fitness': ('fitness_center', 0xEB43),
    'grocery': ('local_grocery_store', 0xE8CC),
    'brand': ('diamond', 0xEAD5),
    'pharmacy': ('local_pharmacy', 0xE550),
    'restaurant': ('restaurant', 0xE56C),
    'gov': ('account_balance', 0xE84F),
    'hospital': ('local_hospital', 0xE548),
    'university': ('history_edu', 0xEA3E),
    'home': ('home', 0xE9B2),
    'luggage': ('luggage', 0xF235),
    'trade': ('payments', 0xEF63),
    # Commercial District 0.8.0 (owner 2026-11-28 20:12, “… ให้ข้อมูลทั้ง 44 ชุดที่เชื่อมต่อกับ registry นำมาใช้อธิบาย locale insight
    # ของแต่ละย่านได้มากที่สุด …”): one glyph for each dataset the page reads from then on — public parks, the registry's
    # research datasets without a demo web, Housing Estate and Tourism.
    'park': ('park', 0xEA63),
    'bank': ('savings', 0xE2EB),
    'optical': ('eyeglasses', 0xF6EE),
    'salon': ('content_cut', 0xE14E),
    'nail': ('back_hand', 0xE764),
    'pet': ('pets', 0xE91D),
    'car': ('car_repair', 0xEA56),
    'services': ('devices', 0xE326),
    'furniture': ('chair', 0xEFED),
    'gold': ('toll', 0xE8E0),
    'apparel': ('apparel', 0xEF7B),
    'beauty': ('health_and_beauty', 0xEF9D),
    'sport': ('sports_basketball', 0xEA26),
    'hobby': ('interests', 0xE7C8),
    'clinic': ('dermatology', 0xE0A7),
    'massage': ('spa', 0xEB4C),
    'playground': ('attractions', 0xEA52),
    'museum': ('museum', 0xEA36),
    'cinema': ('movie', 0xE404),
    'temple': ('temple_buddhist', 0xEAB3),
    'housing': ('holiday_village', 0xE58A),
    'tour': ('tour', 0xEF75),
}
AXES = {'FILL': 0, 'wght': 300, 'GRAD': 0, 'opsz': 24}
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'icons' / 'material-pictogram-300.woff2'
MANIFEST = ROOT / 'assets' / 'icons' / 'material-pictogram-300.json'

def main(src):
    font = TTFont(src)
    static = instancer.instantiateVariableFont(font, AXES, inplace=False, updateFontNames=False)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = []  # codepoint access only (CSS content), no ligatures needed
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.drop_tables += ['GSUB', 'GPOS']
    sub = subset.Subsetter(options)
    sub.populate(unicodes=[cp for _, cp in GLYPHS.values()])
    sub.subset(static)
    static.flavor = 'woff2'
    # (0.6.0) keep the source's head.modified, so the same source and glyphs give the same bytes on every run
    static.recalcTimestamp = False
    OUT.parent.mkdir(parents=True, exist_ok=True)
    static.save(OUT)
    data = OUT.read_bytes()
    check = TTFont(OUT)
    cmap = check.getBestCmap()
    missing = [n for n, (_, cp) in GLYPHS.items() if cp not in cmap]
    if missing:
        raise SystemExit(f'missing glyphs: {missing}')
    manifest = {
        'family': 'LDS Material Symbols Rounded Pictogram',
        'file': OUT.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        'source': 'google/material-design-icons variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].ttf',
        'sourceSha256': hashlib.sha256(Path(src).read_bytes()).hexdigest(),
        'license': 'Apache-2.0 (assets/icons/material-symbols-Apache-2.0.txt)',
        'axes': AXES,
        'glyphs': {role: {'name': name, 'codepoint': f'U+{cp:04X}'} for role, (name, cp) in GLYPHS.items()},
        'status': 'test exception to LDS nav-7 (owner 2026-10-22; actions and building added 2026-10-29; terrain glyphs 2026-11-01 for the map labels; rank, date, distance, construction and dataset 2026-11-01 for short copy; school glyphs 2026-11-05; learning glyphs 2026-11-06; dataset and axis glyphs 2026-11-26, D-V4 B); nav-7 subset unchanged',
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'wrote {OUT} ({len(data)} bytes, sha256 {manifest["sha256"]}) and {MANIFEST.name}')
    print('unicode-range:', ', '.join(f'U+{cp:04X}' for _, cp in GLYPHS.values()))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
