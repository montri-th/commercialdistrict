# CityMETER · Commercial District — data and method

How every figure on the page is made, from which file, and where its limits are. Thai first for the reader; the rules
are the contract `scripts/build-data.py`, `js/model.js`, `js/profile.js` and the tests (`tests/data.test.js`,
`tests/views.test.js`) hold. Evidence labels follow Landometer MBB §3.7: **Observed fact** (counted from the files),
**Benchmark interpretation** (a place among named peers), **Inference** (this demo's reading, never a claim the source
makes).

## วิธีนับ — อ่านตัวเลขในหน้าอย่างไร

- **ย่าน** = ย่านกลางที่มีขอบปิดในทะเบียนย่านกลาง CityMETER (ฉบับร่าง ยังไม่ตรวจภาคสนาม) รหัสกลาง `CMN-TH-…`
- **จำนวนในย่าน** = จำนวนรายการของชุดข้อมูลนั้นที่มีพิกัดและพิกัดอยู่ในขอบย่าน แต่ละชุดใช้หน่วยของตัวเอง (แห่ง สาขา ร้าน จุดขาย ทะเบียน รายการ สถานี–สาย) และ **ไม่บวกข้ามชุด**
- **ต่อ ตร.กม.** = จำนวนในย่าน ÷ พื้นที่ย่านตามทะเบียน (`area_m2` ของทะเบียน ไม่คำนวณใหม่) · ย่านที่ขอบปรับเพิ่ม (นิมมาน–เมญ่า
  18 พ.ย. 2569 §2b และย่านที่ขอบปรับตามหลักที่เจ้าของกำหนด §2c) ใช้พื้นที่ของขอบที่ปรับ วัดใน UTM แบบที่ทะเบียนวัดของตัวเอง
- **พื้นที่ย่าน** = บอกเป็นไร่ (1 ไร่ = 1,600 ตร.ม.; หน้า English เขียน rai) ตั้งแต่ 0.2.5 ตามคำเจ้าของ 18 พ.ย. 2569 ไม่ใช้เฮกตาร์ ·
  ชี้ที่ตัวเลขพื้นที่ในการ์ดจะเห็น ตร.กม. (และโปรแกรมอ่านหน้าจออ่าน) เพราะความหนาแน่นทั้งหน้าคิดต่อ ตร.กม. · พื้นที่รวมของประเทศหรือจังหวัดบอกเป็น ตร.กม.
- **ไม่มีข้อมูลในจังหวัดนี้ (—)** = ชุดข้อมูลไม่มีรายการที่มีพิกัดเลยในจังหวัดของย่าน จึงไม่รู้ ไม่ใช่ 0 · **0** = ชุดข้อมูลมีรายการในจังหวัด แต่ไม่มีรายการใดอยู่ในขอบย่าน
- **สัดส่วน** = จำนวนในย่าน ÷ รายการที่มีพิกัดของชุดนั้น (ทั้งประเทศ หรือในจังหวัด) ตัวตั้งและตัวหารอยู่ข้างตัวเลขหรือในคำอธิบายของมัน
- **จุดเด่น** = ย่านติดกลุ่มบนของกลุ่มเทียบ ทุกข้อบอกกลุ่มเทียบและจำนวน (§5)
- **มาด้วยกัน** = คู่ชุดข้อมูลที่ความหนาแน่นขึ้นลงด้วยกันในย่านทั่วประเทศ (สหสัมพันธ์อันดับ ρ, §6) — ความสัมพันธ์ ไม่ใช่เหตุและผล
- **ขอบที่ปรับตามหลักที่เจ้าของกำหนด** (0.3.0) = ขอบย่านที่วาดใหม่จากแผนที่ฐาน: กลุ่มอาคารที่ต่อจากขอบเดิม ภายในพื้นที่ที่แผนที่ฐานไม่ได้ระบุเป็นป่า ทุ่ง
  หรือน้ำ แบ่งครึ่งทางกับย่านข้างเคียงเมื่อพื้นที่ต่อกัน (§2c) แทนขอบเดิมทั้งชั้น ตัวเลขทุกตัวของย่านนั้นนับในขอบใหม่
- จำนวนรายการไม่ใช่ยอดขาย คนเดิน รายได้ หรือความต้องการ
- **ในย่านนี้** (0.4.0) = แถว 4 ช่องใต้ตัวเลขของย่าน ช่องละหนึ่งชุดข้อมูล: คนอยู่ (แบบจำลอง ยังไม่ถึงรอบข้อมูล) · นักเรียนที่ชุดสถานศึกษาบันทึก · ห้องที่ชุดที่พักบันทึก · ศูนย์การค้าและตลาด
  มาตรวัด 5 ขั้นคือระดับเทียบกับชุดย่านอ้างอิงของรุ่น (§12) ไม่ใช่คะแนน
- **ขอบเดินถึง 400 ม. / 800 ม.** (0.4.0 ชื่อ «รอบย่าน»; ชื่อนี้ตั้งแต่ 0.4.1, D-10) = รายการที่อยู่นอกขอบย่าน และห่างจากเส้นขอบไม่เกินระยะนั้น วัดเส้นตรง อีกฝั่งแม่น้ำวัดผ่านทางข้าม (0.7.5, §17) ไม่ใช่ระยะเดิน · ไม่ใช่พื้นที่ให้บริการของย่าน (พื้นที่ให้บริการ 1 · 3 · 5 กม. จากขอบ สำหรับตัวเลขคน อยู่ในแผนรอบ 2) · ค่า 800 ม. รวมค่า 400 ม. ·
  รวมรายการที่อยู่ในย่านข้างเคียง · ไม่บวกกับค่าในย่าน และไม่บวกข้ามย่าน (§12)
- **อันดับร่วม** (0.4.0) = ย่านที่มีค่าเท่ากันได้อันดับเดียวกัน จุดเด่นจึงบอกว่ากี่ย่านได้อันดับนั้นร่วมกัน (“มากอันดับ 4 ร่วม 5 ย่าน”, §5)
- **\*** (0.4.0) = ชุดข้อมูลที่มีพิกัดไม่ถึง 90% ของรายการ ในส่วน «ในย่านนี้» และ «รอบย่านนี้» แสดงจำนวนที่พบ ไม่จัดอันดับหรือระดับ (§12)

## 1. Sources

| Source | What is read | Identity |
|---|---|---|
| ทะเบียนย่านกลาง CityMETER (Google Sheet, internal; owner's export) | names and other names (ชื่อกลาง), the roles the registry proposes from its evidence rows (หลักฐานบทบาท), (0.2.0) the outline review of its lodging screen (ย่านที่พัก 268, column ผลทบทวนขอบ) | read 2026-11-24 for the data of 0.3.0 and 0.4.0 (`meta.registry.readOn`; first read 2026-11-18, release 2026-11-17-commercial-recovery-9) · export SHA-256 `meta.registry.exportSha256` · the tabs were renamed on 2026-11-25 (ชื่อกลาง → `01_NEIGHBOURHOODS`, หลักฐานบทบาท → `08_ROLE_EVIDENCE`, ย่านที่พัก 268 → `19_LODGING_SCREEN`; gids unchanged; the table of contents is in the registry's `00_README`): `scripts/build-data.py` reads either name and checks the headers of the columns it reads by position; the data built before the rename names the old tabs |
| Owner bundle «CityMETER • ทะเบียนย่าน ขอบเขต และหลักฐานล่าสุด.zip» (read 2026-11-18) | `national-gis/canonical-boundaries.geojson` (release 2026-11-17-commercial-recovery-9: 370 canonical codes, 358 closed draft outlines, 2 held, 10 collections; since 2026-11-18 stored as a lossless byte alias, restored with `scripts/restore-bundle-member.py`, every SHA-256 checked) and its revision summary (`gis/revision-summary.json`) · (0.2.0) the current lodging review `lodging-held78-recovery-2026-11-18`: `decision-ledger.json` (268 proposals) and `boundaries/current-all268-review-drafts.geojson` (130 review drafts) | zip SHA-256 `meta.bundle.sha256` · outlines SHA-256 `meta.bundle.boundariesSha256` · lodging revision `meta.lodging.revision` |
| 16 CityMETER demo datasets | each demo's own data file, read with the demo's own default scope (§3) | repository, file, commit and SHA-256 per dataset in `datasets[].source` |
| Province outlines | `data/provinces.geojson` (77 CityMETER production provinces) | copied unchanged from `montri-th/university@ed2f350` (SHA-256 `9f5b57ef…a8ce62`) |
| Building units | `data/building-units/` (where the 3D focus draws CityMETER Building V4 instead of OpenStreetMap) | copied unchanged from `montri-th/university@ed2f350` (index SHA-256 `b565ee80…01f75`) |
| Basemap tiles (0.3.0, §2c) | OpenFreeMap planet vector tiles at zoom 14 (building, landcover, park, landuse, water of OpenStreetMap), read in the page to redraw outlines by the owner's rule | build 20261122_124456_pt, recorded in each amendment (`amendments/outline-amendments.geojson`, `osm`) |

Neither the registry's address, its export nor its cells are in this repository; only the counts and the fields listed
in §9 are published.

## 2. Neighbourhoods

**Observed fact.** 534 outlines in 77 provinces since 0.7.8, 318.09 km² as the page draws them (§2d–§2f: 139 of the registry's commercial screen, 111.46 km²; in 0.6.1, 469 and 233.03 km² with 74 of them, 26.39 km²; in 0.5.0, 451 and 212.11 km² with 56 of them, 5.48 km²). The 395 before it, 95.03 km²: the registry's 358 closed outlines (80.86 km², registry
`area_m2` in its metric CRS, 473 m² to 2.17 km² — 0.3 to 1,358 ไร่ as the page writes it since 0.2.5; since 0.2.4 one of them extended on the owner's word, §2b) and, since
0.2.0, 37 lodging areas of its lodging screen (14.18 km², §2a). Since 0.3.0, 235 of the 395 (220 of the registry's, 15 lodging
areas) are redrawn by the owner's rule (§2c): as drawn, 206.63 km² (the registry's 182.83, the lodging areas 23.80), 1,592 m² to
10.61 km² (1.0 to 6,633 ไร่).
The registry's partition has no overlap of positive area (`meta.bundle.revision.positive_area_overlap_pairs` = 0) and
the 37 lodging areas overlap none of its outlines (measured: 0), so a point belongs to at most one neighbourhood; a
point on a shared edge goes to the first outline in order — the registry's in canonical order, then the lodging areas
(shapely `covers`). 12 codes have no closed outline (2 held, 10 collection names) and 42 lodging areas have no draft;
they are searchable and listed, never counted or drawn.

**What changed with the registry of 2026-11-17 (Observed fact).** Against the data of 16 Nov 2026 (343 closed
outlines): 15 codes that were held now have a closed draft outline, most under a new name (`rows[].added`); the 343
outlines drawn before are the same shapes (131 were written out again with their vertices in another order: area and
shape unchanged, intersection over union 1.0); no code was added or removed.

## 2a. Lodging areas (0.2.0; central codes since 0.2.1)

The registry's lodging screen (`ย่านที่พัก 268`, revision `lodging-held78-recovery-2026-11-18-r1`) proposes 268 lodging
cores from a lodging register of 30,730 records by walking 400 and 800 m on the path network from an assessment start
point, with services reached on foot; 193 are supported by the model, 75 held. 189 proposals sit on existing codes; 79
are new areas (`LP-NEW-…`). The registry has admitted none as a central code (`canonical_codes_admitted` 0; its rule:
a walking context or a draft outline does not assign a neighbourhood). Owner 2026-11-18, VERBATIM: “2 และ update เป็นย่านในทะเบียน”
— the 79 new areas are neighbourhoods of this demo: the 37 with a review draft are drawn (dotted outline) and counted,
ranked and compared like the registry's outlines; the 42 without one are searchable only. Their area is the draft's
`draft_area_m2`; 11 drafts carry none and are measured the same way (UTM 47N/48N; on the 106 drafts that carry it, the
largest difference is 1.4 × 10⁻⁶ of the area). A start point at the shore that falls outside the simplified province
outlines takes the screen's display province.

(0.2.1) Owner 2026-11-18, VERBATIM: “update เป็นย่านในทะเบียน”, then, asked how many of the 79, “ทั้ง 79”. The same day
the 79 new areas were added to the registry sheet itself, tab `ชื่อกลาง`, after its 431 rows (through the owner's
browser, read back whole and checked by SHA-256, `meta.registry.admitted.rowsSha256`): code `CMN-TH-<hex>` for the
screen's `LP-NEW-<hex>` (no collision with an existing code), the screen's name and province, name source
“ร่างชื่อจากผลคัดย่านที่พัก”, the proposal id as the linked source id, the role “ที่พัก ท่องเที่ยว และวัฒนธรรม” where the
screen found a lodging core (A, B, C, HS), and an outline status that keeps the evidence: the 37 with a review draft
“ขอบร่างจากผลคัดย่านที่พัก — รอตรวจตามหลักเกณฑ์ขอบย่าน” (with “ผลคัดยังพักไว้: หลักฐานบริการที่เชื่อมถึงยังไม่ครบ” for
the 9 the screen holds for services), the 42 without one “ยังพักไว้ — หลักฐานไม่พอปิดขอบ” with the screen's outline review
(5 of them overlap an existing neighbourhood and need a joint review). The start tab `เริ่มที่นี่` records the admission in
one dated row. The bundle's GIS files still carry 358 outlines until the registry's next release, so the demo still
takes the 37 outlines from the screen's drafts. In the data the 37 are rows with their central code (`kind: 'lodging'`
keeps the outline's origin, drawn dotted), the 42 are held codes (`pending[].status: 'held'`, `screen: 'lodging'`), and
`meta.lodging.aliases` maps each 0.2.0 id to its code, so a 0.2.0 link (`f.neighborhood=LP-NEW-…`, `cmp`) opens the same
area and the old id still finds it in the search.

Every proposal publishes, on its neighbourhood (`rows[].lodging`) or its searchable name (`pending[].lodging`): the
status (`st`, labels of the registry's ledger in `meta.lodging.statuses`), lodging places reached within 400 and 800 m
counted when the walk plus a 50 m allowance stays within the distance (`h4`, `h8`), the rooms/units the sources report
within 800 m and the places with no room figure (`ru`, `rx`), the service categories reached within 400 and 800 m
(`sv4`, `sv8`), the state of its outline review (`bd`, the registry's own label) and whether a draft is drawn (`draft`).
A blank figure is unknown, never 0. These are a walking model: not a survey of what is open, not available rooms,
guests or revenue, and their boundary is the walk from the start point, not the neighbourhood's outline — the Hotel
count inside the outline is the separate figure of §3. Not published: the start points, the evidence and its names and
links, reviewers, dates of review, field questions and notes.

The display outlines (`data/boundaries.geojson`) are the delivered outlines simplified with mapshaper
(`-simplify interval=1.5 keep-shapes`, shared edges kept, 6 decimals). Every count uses the delivered outline, never the
display copy. The outlines are drafts pending local confirmation — not an administrative boundary, a legal line or a
title — and the page says “ขอบย่านฉบับร่าง” in its provenance line.

## 2b. An outline extended on the owner's word (0.2.4)

Owner 2026-11-18 17:05, VERBATIM: “ขอปรับย่าน นิมมาน-เมญ่า เชียงใหม่ ควรรวม ศูนย์การค้า Maya, กาดรินคำ,
วิทยาลัยสารพัดช่างเชียงใหม่เข้าเป็นส่วนหนึ่งของย่านนี้ด้วย”.

**Observed fact.** The registry's outline of `CMN-TH-FB55C19EF1` นิมมาน–เมญ่า (265,550.82 m²) stops at the south side
of Huay Kaew Road; Maya, Kad Rin Kham and Chiang Mai Polytechnic College stand across it. `amendments/outline-amendments.geojson`
holds the extended outline (308,121.72 m², +42,570.90 m², one polygon, no hole), drawn by
`scripts/draw-outline-amendment.py` from the registry outline and four OpenStreetMap ways kept in
`amendments/osm-rincome-2026-11-18.json` (Overpass, osm_base 2026-11-18T10:08:51Z, © OpenStreetMap contributors, ODbL 1.0):
way/249154472 เมญ่า (Maya Lifestyle Shopping Center, a mall building), way/470067655 กาดรินคำ (retail ground),
way/580288757 วิทยาลัยสารพัดช่างเชียงใหม่ (the college campus) and way/580288714 The Wall (retail ground between the campus
and the market).

**Inference** — how the registry's outline rules (หลักเกณฑ์ขอบย่าน, policy 2026-11-17-commercial-recovery-9) read here;
the registry itself has not ruled on it:
- CONTEXT: membership follows the name people use, and the neighbourhood's own name says Maya.
- WHOLE: the sites whole; a campus is not left out for being a school. The Wall is taken in so the block reads as one:
  without it the campus would join only along the road.
- CROSSING: the road between the outline and the sites is joined where crossings are mapped on Huay Kaew (OSM
  node/11786310252 in front of Kad Rin Kham, node/11786310251 and node/11786310253 in front of Maya, the signals of the
  Rin Kham junction node/6464982677, node/6465042941 and node/6465042942): a closing of 25 m of the outline and the
  sites, kept within 45 m of both.
- BAY: the lane between Kad Rin Kham and Maya (narrower than 20 m) is closed along its length.
- OVERLAP: no other registry outline within 1.2 km (the nearest, ท่าแพ–เมืองเก่าเชียงใหม่, is 1,272 m away); the lodging
  screen's draft ช้างเผือก–เสริมสุข (`CMN-TH-5CAEA7F9C8`) lies 13 m to the east, as it did from the registry's outline,
  and the extension overlaps it nowhere.

The registry's own outline stays whole inside the extended one, and its reference point (Google Maps, Street View) is
unchanged. The build (`--outline-amendments`) refuses an amendment drawn from an outline the registry has since changed
(the SHA-256 of its geometry), one that would take area from it, and one that overlaps another outline or a lodging
draft. In the data: the row's `amended` (the date) and `areaM2` measured in UTM 47N as the registry measures its own
(the registry's figure stays in `meta.amendments.items[].registryAreaM2`); `meta.amendments` (the file and its SHA-256,
the places taken in with their OpenStreetMap ids, the rules, the crossings, the OpenStreetMap release);
`data/boundaries.geojson` `metadata.amended`. The panel says “ปรับเพิ่ม 18 พ.ย. 2569 … รอทะเบียนรับในรุ่นถัดไป” where the
outline is described and “ขอบย่านฉบับร่าง ปรับเพิ่ม … จาก OpenStreetMap” in the provenance line; the map's credit line
already names OpenStreetMap for the outlines (ODbL). When the registry's next release carries an outline for this code, the amendment is dropped.

**What changed (Observed fact, against 0.2.3).** Six records came inside, all at Maya or Kad Rin Kham: Rincome night
market (SC-015705) and NightOut Market (SC-015704) of ศูนย์การค้าและตลาด, BIG CAMERA at Maya (ร้านกล้อง), Rimping Maya
(ร้านค้าปลีกของใช้), GENTLEWOMAN at Maya (แบรนด์หรู) and Watsons at Maya (ร้านยา). The neighbourhood's first highlight is
now ศูนย์การค้าและตลาด (4 records, 23rd of 395 by count); before it was ที่พัก. Every other neighbourhood keeps its
counts; ranks, highlight strengths and the pairs of §6 move where this one passes others, as peers do (§5). Maya itself
is not a record of the shopping-centre dataset. The college's point in the School demo (its ONESQA registration point)
lies 184 m west of the extended outline and stays outside: that point is the School demo's, not moved here.

## 2c. Outlines redrawn by the owner's rule (0.3.0)

Owner 2026-11-24 08:15, VERBATIM: “ผมอยากให้ดูเรื่องขอบเขตย่าน โดยเฉพาะย่าน ท่องเที่ยวชายหาดเป็นตัวอย่าง ว่า ย่าน ป่าตอง กะตะ กะรน
น่าจะคลุมพื้นที่อาคารมากกว่านี้มั้ย อย่างป่าตอง ทำไมไม่นับรวมทุกอาคารในป่าตองเลย อย่างกมลา เราจะเห็นบน basemap เป็นขอบเขตสีดำๆ
เราใช้ขอบเขตนั้นมาช่วยกำหนดขอบเขตย่านด้วยได้มั้ย … อยาก apply กับที่อื่นๆ และย่านรูปแบบอื่นๆ ที่ relevant กันด้วยทั้ง dataset นี้”;
08:19, with a sketch round the whole of the town: “อย่างป่าตองก็น่าได้ประมาณนี้มั้ย”. A two-layer trial followed (10:12
“ลุยเลย”); at 13:00, on four questions, VERBATIM: “แทนขอบเดิมไปเลย เรียบง่ายกว่า” · “ใช้ชื่อป่าตอง” · “แบ่งเป็น 2 ย่าน” ·
“เลือกใช้แบบ B โดยมี A เป็นขอบนอกสุดอีกชั้นนึงกั้นไว้ไม่ให้เกิน ยกเว้นถ้ามีกรณีพิเศษให้มาถาม” · “ดูย่านอื่นๆทั่วประเทศด้วย
ว่าสามารถ apply หลักเดียวกันได้มั้ย ติดตรงไหนให้มาถาม”.

**What changes.** One layer. Where the rule applies, the neighbourhood's outline is replaced by the redrawn one — an owner
amendment as in §2b (`rule` set), checked and applied by the build the same way — so every count, density, share, rank,
highlight, pair and similar mix of the page uses it. The name stays the registry's: ป่าตอง names the whole town;
กะรน and กะตะ stay two neighbourhoods. The two-layer trial (พื้นที่ย่าน (ทดลอง), `data/extents.json`) never shipped.

**The rule** (Inference: a reading of the basemap the page already shows, not the registry's outline rules, which have
not ruled on it). On a grid of 0.0001° (about 11 m), for a neighbourhood and every outline within reach (registry
outlines and lodging drafts):
- **line A, the dark ground**: the ground the basemap leaves free of forest, grassland, farmland, rock, wetland, sand,
  an urban park, sports and green land use, and water (ocean, lake, river, pond); a national park or protected area is
  not used (its forest is land cover already, and its legal edge can take in a town). Opened by 2 cells, so a road's
  thin verge does not join two places; the part continuous with an outline, widened back by 2 cells, water removed,
  holes filled.
- **line B, the buildings**: the basemap's buildings that reach an outline, joined across gaps up to about 90 m (a
  dilation of 4 cells), trimmed back 3 cells (about 11 m round the outermost buildings), water removed, holes filled.
- **the outline**: B within A, with the outlines themselves, holes filled; the part continuous with this
  neighbourhood's outline. Where that part reaches other outlines, it is split between them halfway along the ground
  (each cell goes to the outline it is the shorter way from, inside the area; at an equal distance, to the outline
  earlier in the registry's order). Every share of a split area comes from one drawing (the first of its
  neighbourhoods in the registry's order), so the outlines of one area meet without a gap or an overlap of their own.
- **reach**: the drawing box is the outline ± 2 km; an area touching it is drawn again within 5 km, unless the built-up
  ground already fills more than 35 % of the box (a city's continuous fabric). An area that still touches the box runs
  on beyond a town and is not redrawn: the registry's outline stays.

**Which neighbourhoods take it.** Drawn for all 395 neighbourhoods with an outline on 2026-11-24 (18.9 minutes, none
failed): 197 grew and stopped by themselves, 40 grew into a neighbour's built-up ground and were split, 49 ran to the 2 km
box with the ground more than 35 % built (a city's continuous fabric), 8 still ran on at 5 km, 101 did not grow (an
area no more than 2 % plus 200 m² over the registry's, or a gain too small for the trace to keep). Owner 2026-11-24,
14:47–15:11, choosing among options written after this drawing: “ให้ผมติ๊กรายย่าน” for the 45 whose redrawn outline
reaches more than 1 km from the registry's (the discrete Hausdorff distance in UTM, measured on the display copy), “คงขอบ
ทะเบียนเดิม” for the 57 of a city's fabric, “คงแขนไว้ตามหลัก” for arms along roads and valleys. So the 192 that reach no
more than 1 km take the rule; each of the 45 takes it when the owner picks “ใช้หลักใหม่” in the review sheet (or “ตัดแขนแคบ”:
the same outline less its arms narrower than 150 m, an opening of 75 m that keeps the parts still meeting the registry's
outline), and keeps the registry's outline until then; a share that a neighbour's drawing gives to a code whose own drawing
does not apply is used only where the owner ticks that code too. At 17:00 he ticked the sheet row by row: “ใช้หลักใหม่” for
the 192, for 36 of the 45 and for ลาดพร้าว 83 (its share of ลาดพร้าว 71's drawing); “คงขอบเดิม” for พหลโยธิน 24 and วัดเกต–
เจริญเมือง; “ดูอีกที” with a note for 7, which keep the registry's outline until the limits in his notes are drawn and he has
seen them. The 57 of a city's fabric have no redrawn outline to take, whatever the tick; ลาดพร้าว, ticked to take a
neighbour's share against his 15:00 answer, waits for his word. The picks: `amendments/outline-rule-choices-2026-11-24.json`.

**The owner's limits and industrial land (2026-11-24, 17:43 and 18:1x).** The seven he noted are drawn again within the
limits he set (`amendments/outline-rule-limits-2026-11-24.json`): an area or a road the outline does not take, a corridor it
stays in (แบริ่ง: within 300 m of ถนนแบริ่ง), water it may cross (a canal up to 44 m), or his own area (บ่อผุด: the strip from
end to end of the OpenStreetMap beach หาดบ่อผุด to the road behind it, land only). A limit is light ground taken out after every
fill. Since 18:1x industrial land (OpenMapTiles landuse `industrial`) is light ground for every place, so an industrial estate
is never a commercial district: it trims 12 redrawn outlines by at most 2 %, ตลาดยิ่งรวย–สิรัชชา ดอนหัวฬ่อ gains nothing, and
ฉลองกรุง–ตลาดนครฉลองกรุง keeps the registry's outline on his word (what remains beyond the industrial land reads as factories
on the map). จอมเทียน ends 100 m north of ถนนเทพประสิทธิ์ on his word. Drawn again, 388 of the 389 places without limits match
the reviewed drawing cell for cell once industrial land is set aside; จอมเทียน's reviewed drawing had stopped at 2 km on tiles
not fully loaded (on complete tiles its built-up ground runs on into Pattaya). `amend --choices` reads the drawing made with
these limits, `amendments/outline-rule-2026-11-24-r2.json`: the reviewed drawing with the 24 places whose drawing or shares
changed replaced from the page's export (SHA-256 in the file), every place marked with the options it was drawn with; it
would refuse to run while `redraw.status` in the choices is `pending`. By the review step the redrawn drawing holds 196
places that grow and stop by themselves, 40 split, 49 city, 8 that run on and 102 unchanged.

The drawn cells are traced (Douglas–Peucker at 1.2 cells) and, for the map, their steps rounded off
(`scripts/rule-outlines.py amend`: a closing of 12 m kept within 6 m of the cells, simplified at 2 m). The amendment is
the registry's own outline (its geometry from the bundle, by SHA-256) with the drawn share added, less every other
outline: it only adds area and overlaps nothing, which the build checks again.

**Sources.** The basemap's vector tiles as the page loads them: OpenFreeMap planet build 20261122_124456_pt (OpenMapTiles
schema, zoom 14: building, landcover, park, landuse, water; © OpenMapTiles © OpenStreetMap contributors, ODbL 1.0).
The outlines of release 0.2.6 (`data/boundaries.geojson`, SHA-256 `106ab3bf…befb3`). For the check figures only, the
Hotel demo's `data/hotels.json` at `montri-th/hotel@7fde352` (SHA-256 `0d63ba36…fec107`). Drawn on 2026-11-24 in the live
demo in Chrome (`scripts/draw-outline-rule.browser.js`, SHA-256 `0aad564a…e140`, pasted in its console: the script and
both input files were checked by SHA-256 in the page, the export carried out byte for byte, its SHA-256 in
`amendments/outline-rule-2026-11-24.json`); `scripts/draw-outline-rule.py` repeats it headless where the network reaches
the tiles. The distance to the sea (for the review only) is measured in the page from the basemap's ocean at zoom 10.

## 2d. Neighbourhoods of the commercial screen (0.5.0)

Owner 2026-11-25 01:04, VERBATIM with the sheet's address left out: “ใช้ 3 กองเลย พี่สั่ง ChatGPT ให้ research ให้เลยครับ
ให้ได้จำนวนย่านครบสมบูรณ์ที่สุด ในมาตรฐานที่ Yolk MCP นำไปใช้งานได้ด้วย แล้วบันทึกผลใน [the registry, tab ชื่อกลาง]”; 2026-11-26
06:09, VERBATIM: “ลุยตามพี่แนะนำเลยครับทุกข้อ” on Claude's four next steps, among them “วาดขอบ 228 ย่านใหม่ตามหลักเกณฑ์ของพี่
ขั้นนี้ทำให้ Yolk ใช้ย่านเหล่านี้ได้จริง” and “อัปเดตเว็บ”.

**The codes (Observed fact).** The registry admitted 228 codes from its commercial screen on 2026-11-25 and 26: tab
`01_NEIGHBOURHOODS`, name source “ร่างชื่อจากผลคัดย่านการค้า” (`SCREEN_NAME_SOURCE`), each with its name, province and the
roles it proposes; their reference point, district and other names are in `05_REVIEW_QUEUE`. Read from the owner's
export of 2026-11-26 (`meta.registry`, SHA-256 only). One of them, ย่านตลาดไท, is held until the owner decides: its point
marks a place 2.8 km from the market its name says (a read-only check against Google Maps on 2026-11-26), so it is not
drawn, listed or counted here (Claude's hold, `--screen-hold`; he was advised to withdraw it from the registry).

**The outline (Inference: the owner's rule of §2c applied from a point).** A new code has no outline to grow from, so
the rule starts from its reference point: a 24-gon of 8 m round it (about one grid cell), drawn in the live demo with
the same script, tiles and options as the redraw of 2026-11-24 (`lightLanduse: ['industrial']`, no limits), every other
outline of the demo in place. Where that reaches no building (the nearest one more than about 45 m from the point), the
other drawing, from a 24-gon of 40 m, is used, but only when its outline is at least 2.5 times that circle, so an outline
is never a circle with a building or two (Claude's threshold, `WIDE_MIN`). `scripts/rule-outlines.py new` traces the
cells as §2c does, gives each shared area to one drawing (the first new code of it in the registry's order), leaves out
every outline the build already draws and keeps the parts that touch the seed. The outline reaches at most 1 km from
the reference point (the discrete Hausdorff distance in UTM from the 8 m seed): it is a neighbourhood of this demo
(`kind: 'screen'`), drawn dotted like the lodging drafts, counted, ranked and compared like every other outline, marked
new. Beyond 1 km it waits for the owner's tick, as on 2026-11-24 (“ให้ผมติ๊กรายย่าน”). The file:
`amendments/outline-new-2026-11-26.geojson` (both drawings' SHA-256 in `drawing.exports`; derived from OpenStreetMap,
ODbL). The two drawings sat beside it in `amendments/` until 0.7.8, when the owner had them deleted: their grids locate the
reference points of the codes without an outline (§2f).

**The count (Observed fact).** 56 codes take an outline (44 from the point, 12 from the 40 m
circle), 3,424 ไร่ in all, 2.0 to 426 ไร่; 17 reach further than 1 km and wait for his tick; 141
have no outline because the basemap has no building, or too few, near the point; 13 run into a city's continuous
fabric or on beyond 5 km, which the rule does not outline (§2c). The 171 without an outline on the page are searchable names
(`pending[].screen: 'commercial'`, `wait: 'review' | 'undrawn'`), never counted or drawn. Of the codes the basemap left
without buildings, 119 lie in an อปท. where the map already draws CityMETER Building V4 because it has at least
1.15 times OpenStreetMap's buildings (`data/building-units`); drawing their outline from those buildings would be a
change of the rule and waits for the owner's word.

**What it changes.** The ranks and highlights of §5 are among more neighbourhoods (451 outlines, 77
provinces); the counts inside the 395 earlier outlines do not change (their outlines are as before). The glance of §12
still ranks against the 395 of release 0.4.0 (D-8); a neighbourhood of the screen takes a level against them without
joining them. The registry sheet is not written: the outline status of these codes there stays “ยังพักไว้ … รอวาดขอบตาม
หลักเกณฑ์ของเจ้าของ” until the owner's word. Release 0.6.1 applies his answers on these outlines (§2e).

## 2e. The owner's answers on those outlines (0.6.1)

Owner 2026-11-26 10:02, VERBATIM, as he numbered them: “1) ตามที่พี่แนะนำ” · “2) ใช้ Building v4” · “3) ผมไม่เห็นรูปร่าง
พื้นที่ แต่อยากคงไว้ ควรรวมร้านค้าต่างรอบๆตลาดด้วย และควรเชื่อมโยงไปถึงตลาดไอยรา” — on Claude's questions of about 08:10: the 17
outlines over 1 km (with a recommendation per code, the tick sheet and its 17 images), drawing the codes the basemap left
without buildings from CityMETER Building V4, and ย่านตลาดไท (withdraw it, correct its name and point, or keep it). His
answers are kept in `amendments/outline-new-choices-2026-11-26.json` and read by `scripts/rule-outlines.py revise`, which
writes `amendments/outline-new-2026-11-26-r2.geojson`; the file of 0.5.0 stays as it was, and every outline it applied
keeps its geometry.

**The 17 over 1 km (Owner-stated; Inference: “ตามที่พี่แนะนำ” takes Claude's recommendation for each).** 13 take their
outline as drawn and are neighbourhoods of the demo like the 56 of 0.5.0. Three take none (หางดง–ตลาดสดเทศบาล, ตลาดกองทุน,
หลาดชุมทางทุ่งสง): searchable names. ชุมชนซอยพหลโยธิน 94 takes its outline less its narrow arms: the opening of 75 m of §2c
(arms narrower than 150 m off), the opened part nearest its point along the drawing and the strip of the drawing that joins
the point to it (5 m cells whose walk from the point is within 150 m of the shortest), so it still holds its point
(`trim_arms_seed`). The tick sheet said Claude would show that draft before the web, and it still reaches 1,495 m: it
waits for his look like the outlines over 1 km.

**CityMETER Building V4 (Owner-stated: a change of the rule's buildings).** The 141 codes 0.5.0 left without a
building near the point, or with too few, were drawn again in the live demo with the drawing's option `cm`: inside a unit of
`data/building-units` (an อปท., in Bangkok a เขต, where V4 holds at least 1.15 times OpenStreetMap's buildings; the map
already draws V4 there) the buildings are CityMETER Building V4's, read from the production tiles the map reads (layer
`building-detail`), in place of the OpenStreetMap buildings whose interior point stands in the unit; elsewhere they stay
OpenStreetMap's. The ground (line A), the seeds, the options (`lightLanduse: ['industrial']`), the 1 km tick and the
order are those of §2d; every outline of the demo is in place, with the 13 now used and the trimmed one before its trim,
and the screen's codes without an outline as seeds of 8 m. A seed of 8 m covers about one cell and can fall between cells:
in 0.5.0, 18 of the 228 covered no cell by half and vanished, so those codes were drawn from the 40 m seed only; since 0.6.1
the script keeps the cell of the point. Result (Observed fact): 5 take an outline within 1 km (4
from the 8 m seed, 1 from the 40 m one), 64 reach further and wait for his tick, 47 run into a
city's fabric or on beyond 5 km, 25 still reach no building or too few (21 of these lie outside every V4
unit). V4 holds every building, houses included, so a town's fabric joins up more often than with OpenStreetMap's.

**ย่านตลาดไท (Owner-stated: keep; Inference: the outline his words describe).** Its registry point marks a place 2.8 km
from the market (§2d). The outline starts from 40 m seeds at the OpenStreetMap points of ตลาดไท and ตลาดไอยรา (basemap layer
`poi`); the market's own area, OpenStreetMap's retail land use that holds ตลาดไท, joins whole (`take`); the shops round it
are the buildings the rule reaches within 250 m of that area and of the line to ตลาดไอยรา (`near`), with V4 as above. Its
reference point here is the market's OpenStreetMap point; the registry is not written. It takes 1,245 ไร่ over 1,124 V4 buildings and reaches 1,040 m from those points: over 1 km, so it waits for his tick with a picture, as the other outlines over 1 km do; its name is listed meanwhile, no longer held.

**What it changes.** 469 outlines in 77 provinces, 233.0 km² (0.045% of the provinces' area): the 358 of the registry, the 37 lodging drafts and 74 of the screen (the 56 of 0.5.0, the 13 he chose to use, 5 drawn with V4). Of the screen's 228 codes, 66 wait for his tick (64 drawn with V4, the trimmed one, ย่านตลาดไท) and 88 have no outline (the 3 he set aside, 25 without buildings, 47 in a fabric, and the 13 of 0.5.0 in a fabric, not drawn again); none is held. The glance still ranks against the 395 of 0.4.0 (D-8). The registry sheet is not written: the outline status and ย่านตลาดไท's reference point there stay as they are until his word. The logo shards are built again for the 469 (§13).

## 2f. The owner's ticks on the outlines over 1 km (0.7.8)

Owner 2026-11-27 10:44, VERBATIM: “1 แก้แล้วในช่องสีเหลือง / 2 รับ / 3 แก้ / 4 ลบ” — on Claude's four questions of 26 Nov
(VERBATIM in `amendments/outline-new-choices-2026-11-27.json`, `owner.asked_th`): (1) the 66 outlines 0.6.1 left waiting,
in the tab «ติ๊กขอบ V4 (0.6.1)» of the tick sheet with Claude's recommendation per code, his column in yellow and four
pictures; (2) a new rule, an outline cut to the part within 1 km of its reference point; (3) ย่านตลาดไท's reference point
in the registry set to the OpenStreetMap point its outline is drawn from; (4) the 0.5.0 drawing exports deleted from this
repository. His answers and ticks are kept in that file and read by `scripts/rule-outlines.py ticks`, which writes
`amendments/outline-new-2026-11-27-r3.geojson` from the file of 0.6.1; every outline 0.6.1 applied keeps its geometry.

**The recommendation (Inference, Claude's, shown to him in the sheet).** Measured on each drawing: 85% or more of the
outline within 1 km of its point — use it as drawn; within 1 km once its narrow arms are off (`trim_arms_seed`, §2e) —
take them off; else cut it to the part within 1 km. Two were written apart: ย่านตลาดไท, drawn on his words of 26 Nov, and
ชุมชนซอยพหลโยธิน 94, already trimmed — use as drawn.

**His ticks (Owner-stated).** “ตามข้อเสนอ” in 65 rows and “ไม่นับเป็นย่านการค้า ลบทิ้ง” in the row of ชุมชนซอยพหลโยธิน 94
(CMN-TH-33E737E0D0); the column was read back at 10:55 (SHA-256 of the 66 rows in the file). Each code once: 13 used as
drawn (ย่านตลาดไท among them; 1,015 to 1,580 m from their seeds, 13.32 km²), 11 with their narrow arms off (at most 985 m,
6.16 km²), 41 cut to the part within 1,000 m of the reference point (`cut_within`: the drawing intersected with the circle
of 1 km in UTM, 128 segments a quarter, keeping the parts that hold the point; 992 m from the 8 m seed, 65.58 km²) — 65
outlines, 85.07 km², 82 to 1,663 ไร่. Every one holds its point. The page says when his tick changed a drawing: “ตัดแขนแคบ
ตามที่เจ้าของติ๊ก 27 พ.ย. 2569” or “ตัดเหลือในวง 1 กม. จากจุดอ้างอิง ตามที่เจ้าของติ๊ก 27 พ.ย. 2569” in the outline words
(`rows[].screen.tick`, `tickedOn`); used as drawn says nothing more.

**The code he took off (Owner-stated).** Not a commercial neighbourhood: neither drawn, listed nor searchable (the outline
file's `removed`, with his words); `meta.screen.removedOwner` and `meta.totals.screenRemoved` count it so the registry's
677 codes still add up on the page (“เจ้าของให้ไม่นับเป็นย่านการค้า 1”). On his answers the same morning (“บันทึกช่อง «พี่
ตัดสิน» (แนะนำ)”, then “เลือก «ไม่ใช่ย่าน» (แนะนำ)”, that column taking four words only) the registry's review row
(05_REVIEW_QUEUE) carries «ไม่ใช่ย่าน» in «พี่ตัดสิน» and his words with the date at the end of «หมายเหตุ», written in his
Chrome and read back about 11:55; the code stays in the registry.

**ย่านตลาดไท's point (“3 แก้”).** The registry's reference point of the code (05_REVIEW_QUEUE, «จุดอ้างอิงย่าน») is now
the OpenStreetMap point of ตลาดไท its outline starts from, with a note that keeps the old point in the sheet; written in
his Chrome and read back at 11:01. The outline and the point the page uses do not change; the outline file says the point
is the registry's since 27 Nov.

**The exports (“4 ลบ”).** `amendments/outline-new-2026-11-26-point.json` and `-wide.json` are deleted: their grids locate,
within about 20 m, the reference points of the codes without an outline. Their SHA-256 stay in `drawing.exports` of the
0.5.0 file and git history before 0.7.8 keeps their bytes; the V4 drawings of 0.6.1 stayed private all along.

**What it changes (Observed fact).** 534 outlines in 77 provinces, 318.1 km² (0.062% of the provinces' area): the 358 of
the registry, the 37 lodging drafts and 139 of the screen (the 74 of 0.6.1 and the 65 he ticked; 70 drawn with V4). Of the
screen's 228 codes, 88 have no outline and are searchable names, one is taken off; none waits for a tick and none is held.
14,513 records inside the outlines (13,407 in 0.6.1). The glance still ranks against the 395 of 0.4.0 (D-8).

## 3. Datasets and their default scope

| Pillar | Dataset | Unit | What is counted (the demo's default scope) | Records / located | Provinces reached | As of | Source |
|---|---|---|---|---:|---:|---|---|
| Land | ที่พัก (Hotel) | แห่ง | ทุกรายการที่พักในชุดข้อมูล | 30,729 / 29,149 | 77 | 2026-11-08 | `montri-th/hotel` `data/hotels.json` @`7fde352` |
| Land | นิคมอุตสาหกรรม (Industrial Estate) | แห่ง | นิคม สวน และเขตอุตสาหกรรมที่มีขอบในเดโม ใช้จุดภายในขอบ | 106 / 69 | 18 | 2026-10-26 | `montri-th/factory` (industrialestate) @`2c206d1` |
| Land | สำนักงาน (Office) | รายการ | ทุกรายการสำนักงาน หนึ่งรายการอาจเป็นบางชั้นของอาคาร | 608 / 427 | 19 | 2026-11-02 | `montri-th/office` @`d3bcf6b` |
| Land | ศูนย์การค้าและตลาด (Shopping Center) | แห่ง | สถานที่ค้าปลีกที่นับได้และแหล่งยังระบุว่าเปิด | 6,153 / 6,141 | 77 | 2026-11-07 | `montri-th/shoppingcenter` @`3711e6e` |
| Location | ร้านกล้อง (Camera Shops) | สาขา | สาขาขายปลีกตามค่าเริ่มต้นของเดโม | 252 / 236 | 63 | 2026-10-23 | `montri-th/camera` @`a7d211f` |
| Location | โรงงาน (Factory) | ทะเบียน | ทะเบียนโรงงานทุกขนาด วางได้เฉพาะทะเบียนที่มีพิกัด | 74,047 / 15,654 | 70 | 2026-11-16 | `montri-th/factory` @`2c206d1` |
| Location | ฟิตเนส (Fitness) | สาขา | สาขาที่แหล่งยังระบุ ณ วันตรวจ | 358 / 149 | 21 | 2026-10-26 | `montri-th/fitness` @`8e74768` |
| Location | ร้านค้าปลีกของใช้ (Grocery) | ร้าน | จุดร้านของ 17 แบรนด์ ตำแหน่งจาก vector tile | 27,607 / 27,607 | 77 | 2026-10-22 | `montri-th/grocery` @`14294f3` |
| Location | แบรนด์หรู (Luxury Brands) | จุดขาย | จุดขายจากรอบ refresh ที่แหล่งยังระบุ | 345 / 345 | 9 | 2026-10-21 | `montri-th/luxurybrands` @`378e58a` |
| Location | ร้านยา (Pharmacy) | ร้าน | ร้านที่มีใบอนุญาต ขย1 วางได้เฉพาะร้านที่มีจุด | 18,136 / 2,573 | 77 | 2026-10-22 | `montri-th/pharmacy` @`44da829` |
| Location | ร้านอาหาร (Restaurants) | ร้าน | ทุกร้านในชุดข้อมูล ตำแหน่งแสดงผลจาก tile | 70,214 / 70,214 | 7 | 2026-10-22 | `montri-th/restaurant` @`ca24f2f` |
| Living | หน่วยงานรัฐ (Government Office) | แห่ง | ทุกจุดของชุดข้อมูลหน่วยงานรัฐ ทุกหมวด | 20,568 / 20,568 | 77 | 2026-11-06 | `montri-th/governmentoffice` @`102839b` |
| Living | สถานพยาบาล (Hospital) | แห่ง | สถานพยาบาลทุกประเภท วางได้เฉพาะที่มีจุด | 41,828 / 12,516 | 77 | 2026-11-01 | `montri-th/hospital` @`c6ff706` |
| Living | สถานศึกษา (School) | แห่ง | สถานศึกษาทุกสังกัดในฐานปี 2569 วางได้เฉพาะที่มีจุด | 40,827 / 33,077 | 77 | 2026-10-31 | `montri-th/school` @`f253f56` |
| Living | สถานีราง (Transit) | สถานี–สาย | หนึ่งรายการต่อหนึ่งสาย ไม่รวมสถานีที่ยังยืนยันไม่ได้ | 301 / 301 | 17 | 2026-10-31 | `montri-th/transit` @`25711bc` |
| Living | มหาวิทยาลัย (University) | แห่ง | วิทยาเขตและพื้นที่ที่ทีมวิจัยตรวจ ไม่แบ่งนักศึกษาตามจุด | 190 / 188 | 59 | 2026-11-10 | `montri-th/university` @`f610edb` |

The 16 demo repositories are read at their `main` of 2026-11-18 (0.2.0); two data files changed since 0.1.x: Factory
(`data/factories.json`, checked 2026-11-16) and Industrial Estate (`industrialestate/data/estates.json`, built 2026-11-17).

The pillar of each dataset is the dataset registry's `R01_DATASETS.dataset_group` as the shell's demo list carries it
(`js/shell/datasets.js`, read 2026-11-12). The exact scope text of every dataset, Thai and English, is
`datasets[].scope`; the figures of this table are those of `data/neighborhoods.json` `datasets[]` (records, located,
`byProvince`, dates, source) in this release.

## 4. Placement and coverage

- A record counts in a neighbourhood when its point lies inside the delivered outline. Records without a point (or with a
  point outside Thailand's box) are never placed: “located” is the denominator of every national share.
- A dataset **reaches** a province when at least one of its located records lies in the province's production outline
  (`datasets[].byProvince`). For a neighbourhood in a province the dataset does not reach, the dataset has no key in
  `rows[].c`: the page shows “ไม่มีข้อมูลในจังหวัดนี้” / “—”, never 0. A few located records fall outside every province
  outline (at sea, past a simplified coast: hotels 268, government offices 11, others ≤ 8): they count in the national
  denominator only.
- Measures some datasets carry (rooms, workers, beds, students, recorded staff) are summed per neighbourhood over the
  records that state one (`rows[].m = [sum, known]`) and shown only in the closed “ข้อมูลทะเบียนย่านและตัวเลขเพิ่มเติม”,
  with the dataset's own note (e.g. “ห้องที่แหล่งบันทึก ไม่ใช่ห้องว่างต่อคืน”).

## 5. Highlights (Benchmark interpretation)

For each dataset in scope, a neighbourhood gets the strongest of four comparisons, each with a strength `p` in 0–1:

| Kind | Comparison | Peers (always named with their number) | Strength |
|---|---|---|---|
| `share` | ≥ 5% of the dataset's located records nationwide lie in this neighbourhood | the dataset's located records | 0.95 + min(share, 0.05) |
| `count` | rank by count, ≥ 3 records | the neighbourhoods of the provinces the dataset reaches | 1 − (rank − 1) / peers |
| `density` | rank by records per km², ≥ 3 records | the neighbourhoods holding ≥ 3 (at least 10 of them) | 1 − (rank − 1) / peers |
| `rare` | the dataset is present in ≤ 15% of the neighbourhoods it covers | the neighbourhoods of the provinces the dataset reaches | 1 − holders / peers |

Ties share the better rank; since 0.4.0 the page says how many share it (“มากอันดับ k ร่วม t ย่าน” / “Rank k, shared by t”:
`js/around.js#sharedBy`, the neighbourhoods of the same peer group with the same count, or with at least `minCount` and
the same density). A comparison is a highlight when `p ≥ 0.75`; a neighbourhood keeps at most four, one per
dataset, strongest first (equal strength: the larger share of the dataset's located records first). “เด่นหลายด้าน”
counts highlights with `p ≥ 0.9`. Rules and thresholds are `meta.rules`.

Since 0.6.0 (D-V2, §14) a highlight stands only on a dataset with points for at least 90 % of its records: the page
draws the highlights again by this rule over those datasets (`js/model.js#highlightsOf`), then keeps four. The file's
own lists stay in `data/neighborhoods.json` (`hl`, `pairs` of a row; `hlBuild`, `pairsBuild` once decoded).

## 6. What comes together (Inference from a correlation)

For every pair of datasets: Spearman's ρ of density over the neighbourhoods both datasets cover, kept when at least 30
neighbourhoods are covered by both and at least 8 hold both (`pairs[]`: ρ, n, both). Pairs with ρ ≥ 0.35 are shown as
“มาด้วยกัน” nationwide, and a neighbourhood lists the strong pairs whose two datasets are both its highlights. ρ says
the two rise together across neighbourhoods; it does not say one causes the other.

## 7. Roles (Inference)

The registry proposes roles for some neighbourhoods (18 neighbourhoods, 44 proposals in the snapshot). This demo maps
each role to the datasets that can speak to it (`roles[]`): จับจ่ายและการค้า → ศูนย์การค้าและตลาด · ร้านค้าปลีกของใช้ ·
ร้านอาหาร · แบรนด์หรู · ร้านกล้อง; สำนักงานและธุรกิจ → สำนักงาน; อยู่อาศัยและชีวิตประจำวัน → ร้านค้าปลีกของใช้ · ร้านยา ·
ฟิตเนส; ที่พัก ท่องเที่ยว และวัฒนธรรม → ที่พัก; การศึกษา → สถานศึกษา · มหาวิทยาลัย; สุขภาพและการดูแล → สถานพยาบาล ·
ร้านยา; อุตสาหกรรมและการผลิต → นิคมอุตสาหกรรม · โรงงาน; ราชการและบริการสาธารณะ → หน่วยงานรัฐ. A proposed role is
“ข้อมูลชี้ตรง” when one of its datasets is a highlight of the neighbourhood, else “ข้อมูลยังไม่ชี้” with the counts; a
role the registry does not propose but a highlight speaks to is listed as “ข้อมูลชี้บทบาทเพิ่ม”. The mapping is this
demo's reading, not the registry's.

## 8. Similar mix (Inference)

`js/profile.js#similarRows`: the cosine of log(1 + density) centred on each dataset's mean over the neighbourhoods it
covers, over the datasets in scope for both neighbourhoods (at least 8, three of them held by both). 1 means the same
shape of mix; the three highest above 0 are listed nationwide. Similar mix is a starting point for a comparison, not a
claim that two places perform alike.

## 9. Map and colour

- Two readings, switched by “อ่านแผนที่ด้วย” (`m`): **จุดเด่นของย่าน** — the LDS categorical series of the pillar of the
  neighbourhood's first highlight (Land series 4 diamond · Location series 7 hexagon · Living series 1 circle, the shape
  is the non-colour cue; a ring for none); **a dataset** — LDS `density.area`, all 41 samples, by rank among the
  neighbourhoods in scope (equal values share a sample; the highest closes the ramp), measured zero = sample 0 + the zero
  outline, out of scope = no fill. Same HEX on light and dark (`npm run check:lds`).
- A data colour is never made paler: no opacity on a fill; neighbourhoods outside the province or the search go quiet as
  an outline and a small hollow pin. Up close (from zoom 14) the fill gives way to the same colour on the outline so the
  streets and buildings stay readable.
- A lodging area of the screen (§2a) is drawn with a dotted outline, apart from the registry's solid outlines and the
  compared ones' long dashes; the panel names it “ย่านที่พัก · ขอบร่างจากผลคัด”, and a neighbourhood first drawn in this
  release “ใหม่ในรุ่นนี้”. The filter ย่านที่แสดง (`f.kind`: registry = outlines by the registry's rules · lodging = draft
  outlines from the lodging screen · added; 0.2.1 words) narrows every view to one group.
- The open neighbourhood shows its located records and its own buildings in 3D — inside its outline only (0.1.4; owner
  2026-11-16 23:28: “กับอาคาร 3d ที่ขึ้นรอบๆผมว่ามันแปลกๆ”), CityMETER Building V4 where `data/building-units/` says so, else OpenStreetMap; round it
  the basemap's buildings stay quiet and fade with distance, as in the Hotel demo. Records (0.1.3, §9a): one pin per
  dataset and exact point in the pillar's colour and shape.
- Choosing a neighbourhood fits the map to it (0.2.3; owner 2026-11-18 15:43: “เวลาเลือกย่านควรต้อง zoom to fit ในแผนที่ด้วย”):
  its own outline, a margin of 8 % of its size on each side, centred in the map that the toolbar, the dataset bar, the
  legend and a phone's sheet leave free and filling 94 % of it (the family's fit, `js/shell/camera.js#fitBuilding`),
  never narrower than 200 m and never closer than zoom 19. Until 0.2.2 the view framed a square of at least 880 m round
  the outline, so the 173 outlines under 640 m across read small. Measured on the real map with the basemap stubbed
  (`handoff/VERIFICATION.md`): every outline inside the free map; an outline over 200 m across takes 73–78 % of it,
  on a desktop and at 393 px, in 3D and in plan (before: 4–42 % in 3D on a desktop).
- Rail runs under the neighbourhoods as context (0.2.3, §9b): lines and stations in one neutral ink, darker and wider
  since 0.2.4.

## 9a. Records of the open neighbourhood (0.1.3)

Owner 2026-11-16: “จุดในย่าน ตอนนี้คลิกไม่ได้ ช่วยทำให้ click ดูรายละเอียดที่เกี่ยวข้องได้หน่อย และควรแสดงจุด
Condominium ด้วย / icon หมุดต่างๆตอนนี้ดูยากมาก … / หรือ mouse hover ที่หมุดก็ควรมี popup ให้รู้ว่ามันคืออะไร / เอา condo
จาก dataset ใน registry ไง”; on the first draft (a dataset glyph inside each pin) “icon ใน symbol ที่ทำอยู่ไม่ช่วยเท่าไรนะครับ”,
then the choice **“เลือกดูทีละชุด”**.

- **Shards.** `data/records/<CMN-TH code>.json` holds, per neighbourhood, the records counted in it (§4): dataset, point,
  subgroup, the record's key in its own demo, the names that demo publishes (an office's Thai name is its `alt`, a grocery
  store is its banner and branch, a factory its registered or operator name — a natural person's never reaches a demo),
  the dataset's figure (rooms, workers, staff, beds, students) and a station's line. It loads when the neighbourhood
  opens. The counts it holds equal `rows[].c` (`tests/data.test.js`).
- **One set at a time.** A bar on the map names the sets in the open neighbourhood (its highlights first, then the
  pillar order; no number on it). A neighbourhood opens on its first highlight with records (0.1.4; owner 2026-11-16
  23:27: “เวลาคลิกย่าน ควรจะเห็น venue ที่ highlighted ก่อนมั้ย”), or on the dataset the map is read by (`m`) when it has records there; a pick does not follow to the
  next neighbourhood. “ทั้งหมด” (`f.show=all`) draws every record alike, a centre above the rest (0.4.1); a chosen set (`f.show`) draws its pins larger with
  their names beside them (HTML, so Thai shapes correctly and every name is a keyboard target; a name never covers a pin
  of its set), every other record as a small neutral dot (`text.muted`, not a paler data colour). Reading a dataset
  (`m`) with a neighbourhood open chooses that set too. Colours and shapes stay the pillars' (LDS DATAVIZ-05): one set
  stands out at a time, so no two sets need telling apart by colour, and no glyph is drawn inside a pin.
- **Pointer and card.** A pointer over a pin names its records (a pile: the first names, then “and more”); a click
  opens a card: the record's name, set and subgroup, its figure under the dataset's own exact name, a link that opens the
  record in its own demo (`<demo>/?e=<kind>:<key>`, the kinds each demo's address reads), Google Maps by name and Street
  View at the point, and dataset · source · date · boundary. Several records at a point open as a list of names by set.
  No tip, list or card shows a total across datasets. On a phone the card docks under the bar.
- **Centres first (0.4.1, owner 2026-11-25 23:01 “ทำตามที่พี่เสนอเลยครับ”, D-11).** A shopping centre or market (the dataset whose
  `item` is `venue`) is drawn above every other pin of its view (`symbol-sort-key` + `VENUE_LIFT` 0.5: in the all view
  2.5 against 2; with a set chosen the chosen pins stay above a quiet centre), so the pins of records its sources place
  at the centre's own point (a gym, a boutique, a camera shop) no longer hide it; in 0.4.0 data 68 of the 627 centres
  inside 227 outlines shared their exact point with a pin drawn after them and were hidden in the all view, and 73 more
  had another pin within 15 m (True Digital Park in ปุณณวิถี under a gym's pin). A point holding records of several
  datasets reads as a pile (the second outline) whichever pin is on top; the pointer reads every pin under it, and the
  tip says «ตรงนี้มีหลายชุดซ้อนกัน» in words — never a total across datasets (INV-01). The all view names the centres
  beside their pins, as a chosen set's names are. Counting is unchanged (§4). `tests/venue-pins.test.js` checks every
  neighbourhood.
- **The panel.** “รายชื่อในย่าน” (closed) lists every name by set; each opens its card (the reading without the map).
- **Condominium (display only).** The dataset registry's condominium dataset (group Land; CityMETER Condominium
  Thailand — Research Master, tab 07_PRODUCTION, read 16 Nov 2026, export SHA-256 in `meta.condo`): the points the
  CityMETER condominium appraisal map draws, checked 5 Nov 2026. Drawn: the 7,887 rows the source marks as observed in the
  production map (`observed_in_provider_tile_not_independent_site_confirmation`) whose search area is not held; not
  drawn: 328 held for a geography conflict or a duplicate and 131 with no unambiguous point. They are a set of the bar of
  their own (shown when points lie within 1 km of the outline), drawn round the open neighbourhood by 0.1° cell in view
  (`data/condo/`), with a dashed outline. **Never counted** in a neighbourhood, a share, a rank or a role: the
  dataset's own spatial policy says a display point does not make an area membership (Observed fact: the policy row
  `spatial_gate`). The card shows the source's buildings and floors and the appraisal per unit (median P50 and the
  P25–P75 range, baht per m²; an appraisal, not a sale price) with the source's search area as its boundary.

## 9b. Rail context of the map (0.2.3)

Owner 2026-11-18 15:32: “ในแผนที่อยากให้แสดง สถานีและแนวเส้นทางระบบรางเพิ่มเติม เพื่อให้เห็น context และการเชื่อมโยงรอบๆ
และระหว่างแต่ละย่านการค้า ใน visual อาจจะให้ quiet กว่าตัวย่านการค้าเล็กน้อย”.

- **What** (`data/rail.json`, `scripts/build-rail.py`): copied as published from CityMETER · Transit (montri-th/transit,
  its commit and the SHA-256 of each file in `meta.from`). Lines: `data/rail-lines.geojson`, the parts of each line and
  status merged, coordinates rounded to 5 decimals — the urban lines in service in Bangkok and its vicinity (10) and the
  projects under construction with a station list (7, among them the Thai–Chinese HSR and the new northern and
  north-eastern lines; one, Map Kabao–Thanon Chira, has stations but no alignment). Stations: `data/transit.json`, one
  row per station of a line (305), status as published (in service · under construction · not confirmed, an existing
  junction a project names). Interchanges: Transit's groups of stations a current network map connects (its words: a
  network map, not a confirmed walkway). National stops: `data/layer-srt.json`, the stops of conventional rail with
  scheduled trips in the OTP GTFS (176, nationwide; not SRT's whole station list). Railway lines outside the Transit
  data: the basemap's own OpenStreetMap railway (main lines; sidings, yards and tunnels left out).
- **The same stations as the dataset สถานีราง.** That dataset counts Transit's station–line records per neighbourhood
  like every dataset (§3; 301 — the 305 less the 4 not confirmed); `data/rail.json` is built from the same file, byte
  for byte (`tests/rail.test.js`). The rail context itself counts nothing: no share, rank, role or density reads it.
- **Quiet by role, never by opacity.** One neutral ink (`--text-secondary` since 0.2.4) for every line and station, never a line's
  identity colour or a categorical series (those mark the pillars here); the neighbourhoods' fills sit under it, their
  outlines, pins and records above it. Line and shape tell the kinds apart: in service = solid line on a ground-coloured
  casing and a filled dot · under construction = dashed line (the Transit demo's dash) and a hollow dot (also the
  stations not confirmed) · railway = thin solid line · national stop = small square (the Transit demo's shape). The
  basemap's own rail and transit lines are hidden on this map: they drew the same lines a second time. Lines from zoom 9
  (the outlines' zoom), stations from 11, names from 14 (national stops from 12); lines and dots under the 3D buildings,
  squares and names above them under the basemap's labels.
- **Legible (0.2.4).** Owner 2026-11-18 17:05, VERBATIM: “ระบบรางเงียบไปนิดครับ แทบมองไม่เห็น ปรับหน่อย”. 0.2.3 drew it in
  `--text-muted` at 1–3.2 px, lost among the basemap's roads. Now `--text-secondary` (the ink of the outlines' own line;
  light #5F635A, dark #C4CECA): a line in service 1.4 px at zoom 9, 2.2 at 12, 3.2 at 15 and 4.6 at 18 on a casing
  about 2–3 px wider (`js/rail.js` `RAIL_WIDTH`), under construction 0.85 of it, the railway 0.9–2.8 px, stations
  2.6–6 px in radius, squares and names a step larger. It stays neutral and under the outlines: their data colours lead,
  and their coloured edge (3–5 px from zoom 14) stays wider than a line in service.
- **Reading it.** A pointer resting on a station shows its name, its lines as published, a status other than in
  service and, at an interchange, the stations it connects with; a national stop shows its province. The legend's
  ระบบราง and the map's credits carry the dataset, sources, date and boundary from `data/rail.json`
  (GTFS © OTP, CC BY 4.0; alignments and railway © OpenStreetMap contributors, ODbL).

## 10. Published fields

Per neighbourhood: code, name, other names, province, registry area (for an outline extended on the owner's word, its
own area and the date, `amended`, §2b), reference point, box, name status, whether the
outline was walked, the proposed roles, the kind (registry or lodging: the outline's origin) and whether it is first
drawn in this release, its lodging screen when it has one (§2a), and the counts, measures, subgroup counts, ranks,
highlights and pairs. Per held or collection name: code, name, province, status, the related codes, its lodging screen
and, for an admitted lodging area without an outline, `screen: 'lodging'`. `meta.lodging.aliases`: the 0.2.0 ids of the
lodging areas and their central codes (0.2.1). Per record (0.1.3, `data/records/`): dataset,
point, subgroup, the key and names its own public demo already publishes, its figure and a station's line. Per
condominium point (`data/condo/`): point, project name, buildings, floors, appraisal P25 / P50 / P75 and the source's
search area and province — not its production ids, observation ids, API addresses, pin roles or review notes, and not
the research master's address. Not published (owner 2026-11-16, “ตัดออก”): the
registry's internal working fields — field questions and the segments still to walk, the registry's source ids, merge
notes, outline policy versions and the bundle's review counts — nor the registry's address, its export, its evidence
rows' text, reviewer notes or any person's name. Rail context (0.2.3, `data/rail.json`): per line its id, names and status;
the merged alignments; per station point, names, lines and status; Transit's interchange groups by name; per national
stop point, name and province — no ridership, operator records or source addresses. Outline amendments (0.2.4,
`meta.amendments`): per amended code its date, both areas, the places taken in with their OpenStreetMap ids and
names, the rules, the crossings and the OpenStreetMap release; `amendments/` holds the outline and the OpenStreetMap
ways it was drawn from (public data, ODbL). Since 0.3.0 the same holds for an outline redrawn by the owner's rule (§2c): its date, both areas, the rule in words, whether it was shared halfway, the basemap release; `amendments/` holds the outline (derived from OpenStreetMap, ODbL) and the drawing's export (`amendments/outline-rule-2026-11-24.json`: per outline its check figures, not published on the page).

Surroundings (0.4.0, §12, `data/around.json`): per neighbourhood and dataset in scope the two figures around; the
mid-rank percentiles of the glance; the codes of the centres with a «รอบศูนย์นี้» page inside and near, with their public
names and the distance in metres; `data/rings/<id>.json`: the two lines drawn on the map. No record list around a
neighbourhood is published in this release.

## 11. Rebuild

```
# 1. the owner's .xlsx export of the registry (internal, never committed) and the bundle, unzipped into its own folder
# 2. the 16 demo repositories cloned side by side, their commits in commits.json ({repo: {commit, committed}})
# 3. (0.1.3) the condominium research master's .xlsx export (internal, never committed)
# 4. (0.2.0) restore the outlines the bundle stores as a byte alias, beside its revision summary
# 5. (0.2.1) the rows the registry admitted after that export, read back from the sheet: {spec: [[hex, name, province,
#    status, outline review]], blockSha} (internal, never committed); the build checks they are the screen's 79 new areas
#    and that the outline review is negative exactly where the registry drew a review draft (the 37)
python3 -I scripts/restore-bundle-member.py <bundle dir> lodging-review-2026-11-17/inputs/canonical-boundaries-existing358.geojson \
  <outlines dir>/national-gis/canonical-boundaries.geojson
cp <bundle dir>/gis/revision-summary.json <outlines dir>/national-gis/revision-summary.json
python3 -I scripts/build-data.py --bundle <outlines dir> --bundle-zip <bundle.zip> --registry <export.xlsx> --read-on <its export date> \
  --repos <clones at main> --commits commits.json --mapshaper <mapshaper> --condo <condominium export.xlsx> --condo-read-on <its export date> \
  --lodging <bundle dir>/lodging-held78-recovery-2026-11-18 --prev-canonical <the previous release's canonical-boundaries.geojson> \
  --admitted <read-back.json> --admitted-on 2026-11-18 --outline-amendments amendments/outline-amendments.geojson --out data
# 6. (0.2.3) the rail context, from the Transit clone (clean in data/; its commit and file hashes go into meta)
python3 -I scripts/build-rail.py --transit <clone of montri-th/transit> --out data/rail.json
# 7. (0.2.4) an outline extended on the owner's word (§2b) is drawn once, from the registry outline and the OpenStreetMap
#    ways kept in amendments/, before step 5; redraw it only if the registry changes that outline (the build says so)
python3 -I scripts/draw-outline-amendment.py <outlines dir> amendments/osm-rincome-2026-11-18.json amendments/outline-amendments.geojson
# 8. (0.3.0) outlines redrawn by the owner's rule (§2c): drawn once from the basemap tiles (headless, or in the live
#    demo's console) from release 0.2.6's outlines, written into amendments/ with the bundle's own geometry, before
#    step 5; redraw only to change the rule or the places (the build refuses an outline the registry has changed)
python3 -I scripts/draw-outline-rule.py draw --out <export.json>   # or the browser script in the live demo (§2c)
python3 -I scripts/rule-outlines.py review <export.json> --out <review.json>
python3 -I scripts/rule-outlines.py amend amendments/outline-rule-2026-11-24-r2.json --bundle <bundle> --lodging <lodging folder> \
  --on 2026-11-24 --choices amendments/outline-rule-choices-2026-11-24.json   # the owner's picks (§2c); the drawing is the
#    one the choices name as `drawing` (r2: his limits and industrial land), and amend refuses while a redraw is pending
# 8a. (0.5.0) the commercial screen's codes (§2d): drawn twice in the live demo from seeds round their reference points
#    (8 m, and 40 m), both exports in amendments/ until 0.7.8 (deleted on the owner's word, §2f: git history before it
#    keeps them); then, with the registry's export read privately for names and points,
python3 -I scripts/rule-outlines.py new amendments/outline-new-2026-11-26-point.json --wide amendments/outline-new-2026-11-26-wide.json \
  --seeds <[code, lat, lon] list the page drew from> --seeds-sha <16 hex digits the page reported> --info <names, provinces, districts> \
  --bundle <outlines dir> --lodging <lodging folder> --hold CMN-TH-BAFFB5235F --on 2026-11-26 \
  --out amendments/outline-new-2026-11-26.geojson --report <report.json>
#    and step 5 takes --screen amendments/outline-new-2026-11-26.geojson --screen-on 2026-11-26 --screen-hold CMN-TH-BAFFB5235F
# 8b. (0.6.1) the owner's answers of 2026-11-26 10:02 (§2e): the codes without buildings drawn again in the live demo with the
#    option cm (8 m seeds, then 40 m for the ones that drawing left unchanged) and ย่านตลาดไท with its own seeds and limits; the
#    two V4 drawings stay private (they locate codes the registry has not outlined; their SHA-256 are in the r2 file), the
#    market's is in amendments/; then
python3 -I scripts/rule-outlines.py revise --prior amendments/outline-new-2026-11-26.geojson --choices amendments/outline-new-choices-2026-11-26.json \
  --point <V4 drawing from 8 m> --wide <V4 drawing from 40 m> --special amendments/outline-new-2026-11-26-talad.json \
  --seeds <[code, lat, lon] list the page drew from> --seeds-sha <16 hex digits the page reported> --info <names, provinces, districts> \
  --bundle <outlines dir> --lodging <lodging folder> --on 2026-11-26 --out amendments/outline-new-2026-11-26-r2.geojson --report <report.json>
#    and step 5 takes --screen amendments/outline-new-2026-11-26-r2.geojson --screen-on 2026-11-26 (nothing held)
# 8c. (0.7.8) the owner's ticks of 2026-11-27 on the r2 file (§2f): used as drawn, narrow arms off, cut to 1 km, or taken off
python3 -I scripts/rule-outlines.py ticks --prior amendments/outline-new-2026-11-26-r2.geojson \
  --choices amendments/outline-new-choices-2026-11-27.json --on 2026-11-27 --out amendments/outline-new-2026-11-27-r3.geojson --report <report.json>
#    and step 5 takes --screen amendments/outline-new-2026-11-27-r3.geojson --screen-on 2026-11-26 (nothing held, one removed)
# 9. (0.4.0) the surroundings (§12): after data/neighborhoods.json, data/boundaries.geojson and data/records/ are built,
#    from the same 16 files (flat, <dataset id>.json; the estates with the demo's boundaries.geojson in industrialestate_dir/)
python3 -I scripts/build-around.py --sources <the 16 files> --shoppingcenter <clone of montri-th/shoppingcenter> --built-on <YYYY-MM-DD>
npm test
node scripts/check-lds-parity.mjs --lds <Landometer-Design-System-v0.9.7.md>
```

The build prints, per dataset, records · located · inside · provinces reached (and the condominium points shown, held and
without a point), and writes `data/build-report.json` (files with bytes and SHA-256, the shard folders with their file
count, bytes and a digest, totals, the strongest pairs). Rows' pairs follow the highlights' order (0.1.3; a set's order
changed with Python's string hashing before).

## 12. Surroundings «รอบย่านนี้» (on the page «ขอบเดินถึง» since 0.4.1) and the glance «ในย่านนี้» (0.4.0)

(0.4.1, owner 2026-11-25 23:01 “ทำตามที่พี่เสนอเลยครับ”, D-10) The 400 m and 800 m from the outline's edge are named «ขอบเดินถึง» on
the page — a straight line from the edge (across a river through the crossings since 0.7.5, §17), not a walking route —
so they are not read as the neighbourhood's service area.
The service area, 1, 3 and 5 km from the edge for the figures of people, is round 2 (handoff/implementation-plan.json
`around.amendments`): a neighbourhood is larger than any venue in it, and from the edge its service area holds every
such venue's at the same distance. Measured (data/rings, 0.4.0): the median outline (0.21 km²) grown by 800 m covers
4.26 km², the area of a circle of 1.16 km — about a venue's smallest circle (1 km, 3.1 km²), against 28.3 and 78.5 km²
for 3 and 5 km. `data/around.json` (built for 0.4.0) still names the section «รอบย่านนี้» in its notes.

Owner 2026-11-25 08:15, VERBATIM: “พี่ช่วยปรับ web demo ตามที่แนะนำเลยครับ” — the recommended options of decisions D-1 …
D-9 of the proposal `02-CityMETER__commercialdistrict-neighbourhood-locale-insight-proposal__v1__2026-11-25`
(`handoff/around/`: `decisions.json`, `contracts.json`, the plan byte for byte in `plan.json`).

**Around (Observed fact, counted).** For each neighbourhood and each dataset in scope (a key of `rows[].c`), the located
records outside its outline and no farther than 400 m and 800 m from its edge, straight line (D-1; across a river through
the crossings since 0.7.5, §17): `data/around.json`
`rows[<id>].a[<dataset>] = [r400, r800]`, cumulative (r800 holds r400). Built by `scripts/build-around.py`:

- the record points are read from the 16 files `data/neighborhoods.json` pins (`datasets[].source`, every SHA-256
  checked) with the data build's own reader (`scripts/build-data.py#extract`), so every dataset keeps its scope;
- a record the data build counted inside the outline (`data/records/<id>.json`, matched by dataset, key and point) is
  never around it — so the inside and the around never hold the same record;
- distances are measured on the outline the map draws (`data/boundaries.geojson`: the delivered outline simplified at
  1.5 m with shared edges kept) in an azimuthal equidistant projection centred on the neighbourhood's reference point;
  the line on the map is that outline grown by 400 m or 800 m and simplified at 2 m (`data/rings/<id>.json`, display
  only), so it can sit a few metres off the exact distance; the counts never use it. In release 0.4.0, 6 records sit on
  the other side of the drawn outline from the data build's count — 5 inside the drawn outline that the build did not
  count inside (they are around, at 0 m) and 1 counted inside that lies just outside it (it stays inside, never around):
  the 1.5 m simplification, recorded in `meta.acrossTheDrawnLine`;
- a dataset with no located record in the neighbourhood's province has no key (out of scope, never 0).

The figures of two neighbourhoods can hold the same record (a shop between two outlines is around both): never add
figures across neighbourhoods, never add the inside to the around, never add two datasets (INV-01, D-3). Around is not
a catchment, a walking distance or a trade area. It is not the registry's lodging screen (§2a: walking distance along
the path network from its own start points, with a 50 m allowance) nor Yolk's reading (a straight radius from the
neighbourhood's reference point).

**The glance «ในย่านนี้» (one dataset per tile, D-3).** In the order of «รอบศูนย์นี้» of Shopping Center:

| Tile | Value inside the outline | Evidence | Level |
|---|---|---|---|
| คนอยู่ · Living here | registered residents, modelled — round 2 of the plan (D-9), not in this release: the tile says so (EVID-05 `not_yet`) | modelled | — |
| นักเรียน · Students | students the school dataset records for its schools inside (`rows[].m.school`) | source-listed | none: the school dataset has points for 81% of its records (D-4) |
| ห้องพัก · Rooms | rooms the lodging dataset records for its places inside (`rows[].m.hotel`), with the places that have a figure | source-listed | yes |
| ศูนย์และตลาด · Centers and markets | records of the Shopping Center dataset inside (`rows[].c.shoppingcenter`) | counted | yes |

States (LDS EVID-05): a dataset with no record in the province is out of scope (“— นอกขอบเขตข้อมูล”); none inside is a
measured zero (“ไม่พบ” with the zero count beside it); records inside without any figure are no data (“— ไม่มีข้อมูล” and
how many records lack it). The level is the five-step meter of «รอบศูนย์นี้», copied verbatim from
`montri-th/shoppingcenter` `js/venue-locale.js` @ `dfcc6cd`: `levelOf(p, count) = min(5, floor(p / 20) + 1)` for a value
above zero, 0 for a measured zero; `p` is the mid-rank percentile, 100 × (below + ½ equal) / n, among the neighbourhoods
of the reference set that have a value (rooms: 394 of 395 — one neighbourhood's lodging places carry no room figure;
centers: 395). `p` is stored to six decimals; the build stops if that would move a level or the colour sample from the
exact value's. The filled bars take the LDS `count` sample of `p`; every bar has an outline. The key under the tiles
names the peers of each level by their number (rooms 394 · centers 395).

**Reference set (D-8).** The 395 outlined neighbourhoods of release 0.4.0, codes in the order of
`data/neighborhoods.json` joined by a line feed: `meta.referenceSet` (id, n, SHA-256). It stays until a release names
the one it replaces; a neighbourhood added later is ranked against it. Release 0.5.0 keeps it (`REFERENCE` in
`scripts/build-around.py`, which stops if those 395 outlines change): the 56 outlines of the commercial screen (§2d)
take a level against the 395 without joining them (`meta.referenceSet.added`).

**Datasets with points for under 90% of their records (D-4).** factory, fitness, hospital, industrialestate, office,
pharmacy and school (`meta.lowLocated`): in the glance and the table of «รอบย่านนี้» they carry a star and show their
count and density, never a rank or a level. Their highlights elsewhere on the page are unchanged in this release
(reviewing them is a task of its own).

**Shopping centres with a «รอบศูนย์นี้» page.** The centres of Shopping Center's own set — countable, status supply, group
mall, community or outlet, with a point (`js/venue-locale.js#inLocaleSet`; 492 in `montri-th/shoppingcenter` @ `dfcc6cd`)
— inside the outline only as the data build counted them (a centre the pinned Shopping Center file has no point for:
inside the outline the drawn line covers it in; 4 in release 0.4.0, `meta.venues.notInPinnedFile`), and outside it
within 800 m, nearest first (a centre of the pinned file the build did not count inside is near, at its distance:
under 1 m reads “ไม่ถึง 1 ม.”), so the inside and the around never hold the same centre: `rows[<id>].v = {in: [venue
id], near: [[venue id, metres]]}`, `byVenue` (each centre's neighbourhood and nearest outline) and `venues` (public
names). Joined by id, never by name. Both Shopping Center files are checked against their SHA-256 (`SC_PINNED` in the
script). In release 0.4.0: 166 inside 93 outlines, 356 centre–neighbourhood pairs within 800 m, 256 centres linked.

**On the page.** The section's switch reads inside · within 400 m · within 800 m (`f.around` = in · 400 · 800; inside is
the default and is never written in the address); the table stresses that column, the map draws the line at that
distance in one neutral ink in long dashes (`[6, 3]`, apart from the short dashes of rail under construction and of
compared outlines), under the outlines (never a data colour, never a fill), and frames it whole once its line has
loaded — a reader who moves the map meanwhile keeps the view. A rank in the table names its peers and how many
neighbourhoods share it (“มากอันดับ k จาก N ย่าน · ร่วม t ย่าน”); a starred dataset shows no rank and no colour
swatch. A neighbourhood with no highlight leads with how many datasets have records inside and within 800 m around —
a number of datasets, never one dataset ranked against another. On a narrow screen the table shows the inside column
beside the chosen one. Without `data/around.json` the table keeps the inside column alone and the page says what did
not load; a file of another data release (its neighbourhoods differ) is dropped the same way. The section ends with
its own provenance line: dataset · source · the data's dates · boundary (the outline and up to 800 m beyond it) ·
method.

## 13. Logos of the records and of the centres (0.5.1, 2026-11-26)

Owner 2026-11-26 06:14, VERBATIM: “เช็คหน่อยว่า โลโก้ขึ้นหรือยัง ใน web demo ทุกๆ dataset รวม transit ด้วย / เรื่องโลโก้นี้ ให้แสดงใน Commercial district ในลักษณะเดียวกับ venue ด้วย โดยเฉพาะ venue และ POI สำคัญ / แก้จุดที่แก้ง่ายก่อน / ติดตรงไหนให้ข้ามก่อน แล้วทำข้อเสนอปรับปรุงมาเป็นข้อๆเป็น .md”

- No logo is collected here. Every file is one a demo of the family already ships, checked against the SHA-256 of the record that ships it, through the family's logo kit (`scripts/logo-kit`, citymeter-logos 1.1.0, the same bytes as in Shopping Center, Pharmacy, Fitness and Luxury Brands; `tests/test_logo_kit.py` comes with it).
- Joined by ids only (`scripts/build-logos.py`): a record's key in its own demo → the brand id that demo gives it → the logo that demo's registry gives that id (the kit's own id or the same id in another dataset; never a name rewrite, never fuzzy) for Hotel, Fitness, Restaurants, Grocery, Camera Shops, Luxury Brands, Pharmacy and University; a shopping centre — and every centre «รอบย่านนี้» names — by its Shopping Center venue id through the kit's venue pool, roles `venue_specific` and `parent_complex` only (a shared department-store or chain banner is not a centre's own mark, so it is left out); an office by its Office ID (montri-th/office `data/office-logos.json`, 0.6.0); a station record by its line → the line's mark (montri-th/transit `data/operator-logos.json`, 0.4.0: a line in service whose GTFS names its operator). The source files are read at the commits recorded in `data/logos-report.json` (`inputs`); a brand file that differs from the one the records were built from (`neighborhoods.json` → `source.sha256`) is joined only where the key reads the same name (none differed on 2026-11-26).
- Build of 2026-11-26 (on the 451 neighbourhoods of 0.5.0): 3,186 of the 12,975 records inside the outlines carry a logo — every Grocery, Luxury Brands and Fitness record, 108 of 109 Camera Shops, 88 of 94 station records, 519 of 3,403 restaurants, 139 of 5,053 accommodation records (most have no brand), 135 of 278 pharmacies, 56 of 691 centres and markets, 29 of 189 offices; Factory, Government Office, Hospital, School and University records have no logo source yet (University's 13 sites belong to universities without a collected logo). 163 of the 537 centre names «รอบย่านนี้» lists carry one, counted per neighbourhood (73 of the 270 distinct centres). 452 files, 5.1 MB in all, 329 of 451 neighbourhoods with at least one.
- Display (the family rule): SVG and rasters ≤ 512 px and ≤ 64 KB keep their bytes; larger rasters are scaled uniformly to 384 px on the longest side as WebP (119 files; `sourceSha256` keeps the original's). Plates: the family's (`#FFFFFF`, `#E5E9E6`, `#182327`) as the source registry chose them, the same in both themes; never recoloured.
- Build of 2026-11-26 for 0.6.1 (on its 469 neighbourhoods, the family's checkouts at the commits of the 0.5.1 build, `data/logos-report.json` `inputs`): 3,353 of the 13,407 records inside the outlines carry a logo, 166 of the 543 centre names around them, 458 files, no SHA-256 issue; the shards of the 451 earlier neighbourhoods are byte for byte those of 0.5.1. Since 0.6.1 a raster still over 64 KB once scaled and saved lossless is saved at the first WebP quality of 90, 80, 70 that fits, alpha kept (one University mark, 76 KB lossless); no file of 0.5.1 changes by it.
- Build of 2026-11-27 for 0.7.8 (on its 534 neighbourhoods, the same checkouts: `inputs` equal to 0.6.1's): 3,700 of the 14,513 records inside the outlines carry a logo, 166 of the 544 centre names around them, 459 files (one Restaurant brand mark new), no SHA-256 issue; 410 of the 534 shards hold a logo; the shards of the 469 earlier neighbourhoods are byte for byte main's.
- Where: the card's head (32 px), the tip of one record (20 px), the names at a point and the panel's names (16 px), a spot's name on the map (14 px, only when every record of the spot has the same logo), and the centres «รอบย่านนี้» names (16 px). Decorative (`alt=""`): the name beside it is the identity. One shard per neighbourhood (`data/logos/<id>.json`, empty maps where none), loaded when the neighbourhood opens; a shard that fails to load is said (`partial('logos')`) and the names show alone.
- A logo identifies a brand or a place. It counts nothing, ranks nothing and is never evidence of a tenancy, an operator or a status beyond what its own demo says. The marks belong to their owners; showing one is not a trademark licence.

Rebuild (after `scripts/build-data.py` and `scripts/build-around.py`, with the family's checkouts side by side under one folder):

```sh
python3 -I scripts/build-logos.py --root <folder of the family's checkouts> --built-on YYYY-MM-DD
node --test tests/logos.test.js
```

## 14. The visual-first panel: levels, the fingerprint, the axes and the matrix (0.6.0, 2026-11-26)

Owner 2026-11-26 11:43, VERBATIM: “ทำตามที่เสนอให้ครบทุกข้อพร้อม publish” — every recommended option of the proposal
`02-CityMETER__commercialdistrict-visual-first-panel-proposal__v1__2026-11-26` (owner's words of 06:21 · 06:47 · 07:56 ·
09:56 · 10:26 · 11:26 · 11:43, the decisions and Claude's reading in `handoff/visual/decisions.json`).

**The level of a dataset in a neighbourhood (D-V1 = D, D-V1c; an Inference: this demo's own index).** Peers: the
neighbourhoods of the release holding at least `minCount` (3) records of the dataset, nationwide — the peers of
“แน่นอันดับ k/N” (`r[3]` of a row, the build's density rank). In those peers, the count level and the density level
are each a mid-rank percentile, 100 × (below + ½ equal) / n; the level is their mean, 0–100, equal weights, no unit.
The rank of the level among the peers is 1 for the highest; equal levels share a rank (`js/levels.js#levelModel`). One
function gives the same value to every part of the panel: the fingerprint, the matrix of neighbourhoods × 16 datasets,
the dots of the axes and of the comparison. A dataset with points for under 90 % of its records (D-4) has no level.
Why a mean: the outlines run from about 1 ไร่ to 6,633 ไร่, so a count mostly says “a large neighbourhood” and a density
“a small one”; their mean cancels part of each. It is a level within a declared group, never a total, a rate, footfall,
sales or demand.

**Colour (D-V1d).** The level takes the LDS 0.9.7 `count` LUT, all 41 samples (`js/levels.js#levelFill`, index
round(level × 40 / 100)), the same HEX on both themes, with a token outline and no opacity: an exception to DATAVIZ-02
(which keeps `count` for totals) that the owner approved for these dots and cells only (2026-11-26 11:26, VERBATIM
“ใช้ A ใน V1 แล้วทำ C ใน LDS รุ่นถัดไป”), until the next LDS release has a scale for a level within a declared group;
then the dots and cells move to it. The map keeps `density.area` among the neighbourhoods in view (D-V1b), so a map
colour and a dot can differ; the map key's title says so.

**Cells of the fingerprint and of the matrix (§4.1).** One per dataset, in the order of the datasets (Land 4 ·
Location 7 · Living 5, D-V7b): *ranked* (≥ 3 records of a complete dataset) — coloured by its level · *few* (1–2
records) and *starred* (points for under 90 %) — neutral with a dot (in the top corner where the head's cell carries
the dataset's pictogram) · *edge* (none inside, some outside within 800 m of the edge; only with `data/around.json`) —
a dashed edge · *zero* (none inside, and with the surroundings file none within 800 m) — a thick outline in
`--data-zero-outline`, where a ranked cell has a hairline edge, so a light level never reads as none · *out* (no
located record in the province) — a hatch in `--data-no-data`, never 0 · a highlight of the neighbourhood (§5, D-V2) —
a thick ring. The fingerprint's key counts datasets in each state (they make 16), never records (INV-01): every number
in it and in the image's name carries its unit (ชุด, datasets). A matrix cell reads to a screen reader as its figure and
level (or its state); pointing at it, tapping it or focusing it writes its full words — level, peers, count rank,
density rank — under its table (`js/app.js#matrixReadout`). A matrix is one stop of the Tab key; the arrows move from
cell to cell, Home and End to the row's ends, Ctrl+Home and Ctrl+End to the table's (`js/app.js#matrixKeys`).

**The axes อยู่ · เที่ยว · ค้าขาย (D-V6, D-V7 A; an Inference: placing a dataset on an axis is this demo's reading,
not the source's).** อยู่ (ชีวิตประจำวัน): grocery, pharmacies, hospitals, schools, government offices, rail stations,
fitness · เที่ยว (คนมาเยือน): lodging, shopping centres and markets, restaurants, luxury brands · ค้าขาย (คนทำงานและ
กิจการ): offices, universities, camera shops, factories, industrial estates (`js/axes.js#AXES`). An axis has no score,
no total and never ranks a neighbourhood; “ระดับสูง:” names its datasets at level 75 or more (“เด่น” stays the word of the
highlights, §5, which follow another rule: a highlight's level can be lower, and a level of 75 need not be a highlight).
A “?” at its head marks the
indicators it has no data for yet, named in the closed part with the open or CityMETER source looked at — a mark that
says “not yet”, never a promise; no partner is named. Rows: the dataset's name (it colours the map by the dataset), a
track with the dot at its level and a dashed line at 50, the count in its unit, the rank of the level `k/N`, and the
dataset's own demo at the province. At 400 or 800 m a dashed chip beside the count gives the records outside within
that distance (§12), never added to the inside; datasets found only there get rows of their own. The 0.4.0 table with
every figure at every distance stays whole in the closed part (D-V5).

**The matrix (§4.5).** Wherever several neighbourhoods show together — the similar mixes, the neighbourhoods that
stand out on several fronts, a province's or a search's list (its first 30, the most distinctive first; the rest by
name), the comparison — a `<table>`: a column per dataset named by its pictogram, its title and its words for screen
readers, a row header per neighbourhood. Its answer line (the similar mixes and the comparison) names the datasets
where every neighbourhood shown stands above level 50, with its peers by their number. Under the overview's and the
comparison's matrices a key names every dataset beside its pictogram (LDS ICON-01); under the similar mixes the axes
above already do.

**The comparison (§4.6).** One row per dataset that at least one compared neighbourhood ranks, each neighbourhood a
shape (circle, triangle, square, diamond) in its own lane at its level, coloured by it; the shapes are on the
neighbourhood's chip (which takes it out of the comparison) and its row of the matrix. The table of counts and
densities (since 0.1.0) is closed under it.

**The first finding (§4.7).** The most concentrated dataset's share of its located records inside the neighbourhoods
and the neighbourhoods' share of the area as two bars, the next three datasets as bars in their pillar's colour; each
with its numerator and denominator in words (INV-03).

**Pictograms (D-V4 B).** One glyph per dataset, from the family's subset of Material Symbols Rounded (FILL 0 · wght 300
· GRAD 0 · opsz 24; `scripts/build-pictogram-font.py`, source font SHA-256 `7e74e365…`): the glyphs Shopping Center's
«รอบศูนย์นี้» gives the same datasets, and glyphs of their own for the five shops (camera shops, fitness, grocery,
pharmacies, restaurants) and for industrial estates; home · luggage · payments for the axes. Every pictogram stands
beside its name, or in a title, a column key and words for screen readers.

Measured on the code of 0.6.0 against 0.5.1, every neighbourhood at the default view, 400 px, dark theme, visible
characters without spaces (screen-reader words and closed parts left out): median text 2,216 → 2,321 (+4.5 %; 101 of
451 shorter), median panel height 2,745 → 2,681 px (−2.9 %; 327 of 451 shorter); by part (medians): the head 158 → 142,
highlights 108 → 58, what comes together 93 → 108, the axes (the 0.4.0 table before) 897 → 906, similar mixes 132 →
415 (`handoff/VERIFICATION.md` 0.6.0).

<a id="people"></a>

## 15. «ใครอยู่ตรงนี้»: residents, people who come to work and study, overnight visitors (0.7.0, 2026-11-26)

Owner 2026-11-26 14:03, VERBATIM (item 1): “คนอยู่ แบบจำลองยังไม่ถึงรอบข้อมูลรอรุ่นแบบจำลองผู้อยู่อาศัย (รอบ 2)
ทำยังไงถึงจะเห็นปริมาณคน residents, visitors, commuters ได้ อยากได้วิธีง่ายๆตรงไปตรงมาไม่ซับซ้อนมาก ช่วยนำเสนอมาให้เลือกหน่อย”;
his answers 14:31–14:40 (D-12 “A ตัวเลขทางการแบ่งลงย่าน (แนะนำ)”, D-13, D-14; every word in `handoff/around/decisions.json`).
Files: `data/people/<id>.json` and `data/people/meta.json` from `scripts/build-people.py`; the residents from
`scripts/residents/build-residents.py`, whose output (`--out`) and cache (`--cache`) stay outside the repository.

**Three groups, three figures, never added together (INV-01).** Each is a model or a sum of recorded people. A modelled
figure reads “ราว” (about), rounded — 10 000 or more to the thousand, 1 000 or more to the hundred, 10 or more to the ten;
under 10 it reads “ไม่ถึง 10”. The at-least figure is rounded down by the same steps and never says ราว (under 10 it is
exact). A measured 0 reads 0 and has no level beside it. A part whose records within the distance carry no figure at all
is unknown — “ไม่มีตัวเลข (n แห่ง)”, never 0 — and a part some of whose records carry one says how many (“มีตัวเลข k จาก n”):
government staff are unknown at 1 km for 123 neighbourhoods. A university counts only when every site of it is located and
within the distance (its students are never split between campuses), so one with a site in reach that cannot be counted
reads “ยังนับไม่ได้ (n มหาวิทยาลัย)” and a partial part “นับได้ k จาก n มหาวิทยาลัย” (0.7.3; before it, “ไม่มีตัวเลข”): at
1 km for 35 neighbourhoods, at 3 km for 56, at 5 km for 70. Lodging without any room figure leaves rooms and guests unknown in the same way. None is
footfall, a number of customers or sales.

**Where (D-13; the river rule of §17 since 0.7.5).** ในย่าน = inside the outline the map draws (for a dataset, the
records the data build counted inside); 1 · 3 · 5 km = inside and within that distance of the edge (`f.reach`, 1 km by
default); the axis rows read the same file at 400 and 800 m («ขอบเดินถึง», §12), whose counts equal `data/around.json`
record for record (`tests/people.test.js`). Distances are measured in an azimuthal equidistant projection centred on the
neighbourhood's reference point, from the edge, so a figure does not compare one to one with a centre's circle of
«รอบศูนย์นี้». On the neighbourhood's bank they are straight lines; across a barrier river they go through the nearest
crossing (§17, the Shopping Center page's D70 rule from the same OpenStreetMap file by its SHA-256, D-14), and the page
says “วัดจากขอบย่าน อีกฝั่งแม่น้ำนับผ่านทางข้าม”. Expressways, rail lines and canals are not barriers, and no distance is a
walking or driving time. The walk edges of 400 and 800 m («ขอบเดินถึง») take the same rule: owner 2026-11-27 06:51,
VERBATIM “คิดด้วย”, under the question “ระยะ 400/800 ม. จะคิดเรื่องสิ่งกีดขวางด้วยไหม” (D-13; before it, an author
judgement). From 0.7.0 to 0.7.4 every distance was a straight line from the edge.

**คนอยู่ (modelled).** The method of «รอบศูนย์นี้» (variant A): production's `popCount` of each subdistrict, the civil
register's total of the latest month, spread over every building of CityMETER Building V4 in it by floor area —
footprint × estimated floors from production's vector tiles (z15, `hideWithParts`), or production's own GFA weight for a
building drawn from OpenStreetMap parts — over production's GFA total of the subdistrict; a building counts where the
centre of its footprint (of the union of its parts) lies. Run of 2026-11-26 (Observed): population month 2026-10, the
register's total equal to `popCount` in all 791 of the 792 subdistricts the outlines touch that carry one; 1,318,420 buildings read in 3,665 tile ×
subdistrict requests, 262 of them drawn from parts; none without an estimated floor. Seven outlines hold no building of
Building V4 (islands and hill villages among them): their figure is unknown — “ยังไม่มีข้อมูลอาคารในขอบนี้”, never 0.
Check against the Shopping Center page (`montri-th/shoppingcenter@78cf457`, `data/residents/049.json` and `100.json`,
`n[0]`, 1 km round the centre's point): SC-000337 8,887 against 8,858 (+0.32 %, 1,765 buildings against 1,778) ·
SC-002835 15,178 against 15,132 (+0.30 %, 2,229 against 2,235). Hypothesis for the gap: the buildings in production changed
between the two runs; not checked. The page says what the model is not: people who live here without being registered
are not in it, and a commercial building takes people by its floor area like a house, so a commercial area can read more
people than live there. 0.7.0 has the residents inside the outline and within 400 m, 800 m and 1 km of it (a second run
of 2026-11-26, `--reach 1000`: 10,697 tile × subdistrict requests over 1,063 subdistricts, 2,879,381 buildings of which
575 from parts, the register total equal to `popCount` in all 1,062 that carry one; the figures inside equal the first
run's for every neighbourhood). 0.7.3 adds 3 and 5 km and the residents map (V7-07; a run of 26–27 November 2026,
`--reach 5000`: 59,219 tile × subdistrict requests over 2,106 subdistricts, 7,213,960 buildings of which 638 from parts,
none without an estimated floor, the register's total equal to `popCount` in all 2,105 that carry one; the figures inside
and within 400 m, 800 m and 1 km equal the 1 km run's for every neighbourhood). 0.7.8 adds the 65 outlines of the owner's
ticks (§2f) from a run of 27 November 2026 in the session that built 0.7.4–0.7.6 (population month 2026-10, as before):
74,280 requests over 2,500 subdistricts, 8,044,674 buildings of which 644 from parts, the register's total equal to
`popCount` in all 2,499 compared; the people files of the 469 others are byte for byte main's. Every neighbourhood has residents within
3 and 5 km (the fewest, 41 within 5 km on an island; the median 61,603; the most 1,010,976 in central Bangkok, all
modelled, in a straight line; across a river through the crossings since 0.7.5, §17: 41, 60,830 and 1,010,475; in 0.7.8,
on 534 outlines: 41, 48,609.5 and 1,010,475, the 65 new ones between 8,986 and 179,961); the tiles
round them as above. The run's plan takes the subdistricts' extents as one array (0.7.3): the same
requests, in seconds rather than minutes.

**คนมาทำงานและเรียน (at least; D-12 amends INV-01 for this group only).** The sum of the parts the sources record, each
shown beside it: students the school register records for 2569 · students of a university when every site of the
university is located and within the distance (a university's students are never split between campuses) · workers on
the factory register · staff the government offices record (some kinds only) · office workers by the model of the
Shopping Center page (§26 there): the building's area (leasable, else the source's, unless the two conflict) × its
occupancy (its own, else 0.764) ÷ 12 or 10 m² a person, rounded outward, from `montri-th/office` `data/offices.json` at
`8e8d8be` (SHA-256 `4d225abb…`, `meta.parts.off.model`) — the low end in the sum, the range in the parts. Only records with
a point count. Shop, hotel and hospital workers are not in it, so the figure is a floor. When half or more of it comes
from datasets with points for under 90 % of their records (`meta.levels.lowLocated`: factory, fitness, hospital,
industrialestate, office, pharmacy, school) it carries a star and no level (the rule of «รอบศูนย์นี้» §30) — at 1 km that is
400 of the 469 neighbourhoods (Observed, this build).

**ผู้มาเยือนค้างคืน (guests a year, modelled).** A year, not a night as option A of D-12 worded it: the table gives the
year's guests, and a night would need the length of stay, which it does not hold (Claude's reading, recorded in D-12 for
the owner to confirm). The province's guests of the year (Ministry of Tourism and Sports, Table
17.1, 2024, published by the National Statistical Office; `scripts/people/mots-t17.1-2567.tsv`, its SHA-256 in the meta)
shared by recorded rooms: rooms of the Hotel dataset's lodging within the distance × the province's guests ÷ the
province's recorded rooms. A lodging place takes the province whose outline holds it, else the nearest within 0.05°; 6
places outside every province are left out. Day visitors are not counted; the map of places visitors use (§16) stands
for them as an inference.

**ศูนย์และตลาด.** The Shopping Center dataset's located records within the distance (places, not people).

**Levels.** Per figure and distance, the mid-rank percentile among the reference set of 0.4.0 (395, D-8), “ระดับเทียบ
N/100” with the five steps of «รอบศูนย์นี้» (`levelOf`); a starred figure or a figure without data has none.

<a id="maps-and-topics"></a>

## 16. The round maps and the topic rows of น่าอยู่ · น่าเที่ยว · น่าค้าขาย (0.7.0, 2026-11-26)

Owner 2026-11-26 14:03, VERBATIM (items 2 and 2.4): “น่าอยู่ น่าเที่ยว น่าค้าขาย ผมว่าน่าจะคงคำไว้แบบนี้แล้วเรามาพยายามทำ
ข้อมูลให้สามารถตอบความ "น่า" ให้ได้จริง เพิ่มเติมจากข้อมูลที่พี่ทำขึ้นมาแล้ว ให้เห็นทั้ง เชิงปริมาณ และ คุณภาพ” ·
“charts ใน sidebar ตอนนี้ยังดูยากอยู่มาก ตัวเล็ก ตัวเลขต่างไม่รู้ว่ามีความหมายอย่างไร ยังไม่ consistent กับ venue locale
insight เท่าที่ควร พวก heatmap กลมๆก็ไม่มี ทำยังไงจะมีได้และ relevant กับ case ของ commercial district นี้ด้วย”
(D-V6b in `handoff/visual/decisions.json`; D-16 in `handoff/around/decisions.json`).

**The round maps (D-16, Claude's reading under his 14:03 words; his check pending).** As «รอบศูนย์นี้» draws them (D55,
D59 of the Shopping Center page): the places within 5 km of the edge, straight line (a cell across a river beyond 5 km
through the crossings is hatched and kept out of the directions, §17), counted in cells of 250 × 250 m of
the neighbourhood's local projection (a cell on the 5 km line can have its centre a little beyond it). ที่ผู้มาเยือนใช้ = located places of eight datasets per cell (lodging, centres and
markets, groceries, restaurants, pharmacies, fitness, luxury brands, camera shops) on the LDS `activity` scale ·
ที่ทำงานและที่เรียน = places of seven (offices, government offices, factories, industrial estates, universities,
hospitals, schools) on `count` · คนอยู่ = registered residents (modelled) per cell on `density.area` (0.7.3, the run over
5 km): the residents of every building of Building V4 within 5 km of the edge added in the cell its footprint's centre
falls in; modelled, so the lead reads “ราว”, the table rounds by the steps of «ใครอยู่ตรงนี้» and reads “ไม่ถึง 10” under
ten, the legend's ends too, and a map whose 5 km holds no building of Building V4 reads “ยังไม่มีข้อมูลอาคารในระยะ 5 กม.”,
never 0; its provenance names the register's month and Building V4, its boundary the buildings within 5 km. Adding places of the listed datasets per cell amends INV-01 for these two maps only:
the map, its legend, its direction line and its table read those cells; the heading says อนุมาน (an inference of where
people go, not people or visits); no other figure on the page adds places across datasets. Colours: all 41 samples of
the map's scale, ranked within that one map, the same HEX on both themes; a pale cell keeps a hairline edge. Over the
cells: the outline, the walk edges 400 · 800 m and the 1 · 3 · 5 km lines with their labels, north up. The line under the
map names the direction holding the most (eight directions from the reference point); “อ่านแผนที่เป็นตาราง” gives every
direction by distance band (inside · to 1 km · 1–3 km · 3–5 km) as the reading without the map; a band without places
reads 0, and the datasets of the map that do not reach the province are named under it.

**What a reader finds the way by (0.7.1, D-17).** Owner 2026-11-26 17:51, VERBATIM: “แผนที่รัศมีควรจะมี โครงร่างถนน ทะเล
ลำน้ำ กายภาพ ให้ดูแบบเดียวกับ shopping center ด้วยได้มั้ยครับ”; on the file, “ดึงจาก Mac ของผม (แนะนำ)”. Every round map
draws, from OpenStreetMap (`scripts/build-context-map.py`, embedded by `scripts/build-people.py --context` as `map.ctx`;
the people meta keeps the source as `context`): the sea (the ground the coastline leaves on its right, never where the
reference point stands) and water areas of 10,000 m² (6.25 ไร่) or more (natural=water, landuse=reservoir,
waterway=riverbank), both filled in the basemap's water and shore tones *under* the cells, so a cell keeps its colour
where it meets water; and *over* the cells, in the ink and paper of the map's label chips as «รอบศูนย์นี้» draws them:
rivers (waterway=river, in the map's role blue), roads of four classes (motorway, trunk, primary, secondary), rail
(rail, subway, light rail, monorail; no service track, nothing for industry, the military, tourism or tests), the
operating stations of CityMETER Transit and the national rail stops with scheduled trips the main map draws
(`data/rail.json`; a national stop within 150 m of a Transit station is that station), and at most one sea, one river,
four road and three station names, placed so that on a map 360 px wide none overlaps another, the outline, the 1 · 3 ·
5 km labels or the north mark (the station nearest the reference point that has room first; a name OpenStreetMap gives
only in Thai stays Thai on the English page). The panel draws the map 250–440 px wide, so the page fits the names again
at the width it draws (0.7.2, `js/people.js#fitMapNames`, again whenever the map changes size): a name that would cover
an earlier one in that order, a ring label or the north mark, would sit on the outline or would leave the map is hidden
(2 px of touching allowed) — the live check of 0.7.1 found names touching on a map 325 px wide. Lines are clipped to the 5 km ground and simplified to 12 m, in the map's
own 25 m units. The file is the Shopping Center page's (D-14): Geofabrik's extract `thailand-261124.osm.pbf`, data to
2026-11-24T21:21:23Z, SHA-256 `62b496bf2383ddd266cfcd3456cd03064db1887399f2a4c869bbf953bfd12d24`, checked by the build and
kept outside the repository; © OpenStreetMap contributors, ODbL 1.0, credited on the map's provenance line with its
date. The lines are to read the map by: they are never counted and never a distance. The barrier rivers and crossings the
distances go through (§17, since 0.7.5) are built apart from the same file by `scripts/crossing/`, not from these lines. The key names only what the map draws. Rebuild: `python3 -I scripts/build-context-map.py --repo . --osm <the
extract> --out <outside the repository> [--cache <outside>]`, then `scripts/build-people.py … --context <that file>`;
the same inputs give the same bytes, and a context drawn on another frame stops the people build.

**The topic rows (D-V6b, binding; supersedes D-V6).** The axes keep the owner's words น่าอยู่ · น่าเที่ยว · น่าค้าขาย; the
guard D-V6 kept by leaving “น่า” off the screen moves into the rows (`js/indicators.js`): (1) every row is one sentence with
its number, its unit and what it means, and its label (แบบจำลอง · อย่างน้อย · a star); (2) no score, no total and no rank of
a neighbourhood per axis (D-V7 A stays); (3) a topic without data reads “ยังไม่มีข้อมูล” and what would fill it, never 0, and
a dataset that does not reach the province says so beside the one that does; (4) placing a topic on an axis is this
demo's reading (an Inference), not a verdict on the neighbourhood. Rows (counts at the axis distance: inside, or inside and
within 400 / 800 m): **น่าอยู่** — กิน (restaurants and groceries, the kinds of restaurant inside) · ของจำเป็นใกล้ตัว (how
many of seven everyday datasets are present, the ones not found by name) · การเดินทาง (rail stations; buses and boats: no
data yet) · คนและความแน่น (registered residents inside and per km²) · ความคึกคัก (the restaurant level of §14) · ออกกำลังกาย
และสีเขียว (fitness; parks: no data yet) · อากาศและความสงบ (no data yet: PM2.5, noise). **น่าเที่ยว** — ที่พัก (rooms inside,
kinds of lodging, guests a year) · ช้อปปิ้งและแฟชั่น (centres and markets, luxury brands and their product groups) ·
ความหลากหลาย (how many of the counted kinds are present) · พิพิธภัณฑ์ ศิลปะ แหล่งเรียนรู้ · ประวัติศาสตร์ · กลางคืน คอนเสิร์ต
โรงภาพยนตร์ · ธรรมชาติ หาด ภูเขา น้ำตก (no data yet, each with the open or CityMETER source looked at). **น่าค้าขาย** — ผู้ซื้อ
(the three groups of §15 side by side, “สามกลุ่มไม่รวมกัน · ไม่ใช่จำนวนลูกค้า”) · กำลังจ่าย (luxury points of sale; land prices
and rents not in this demo, never the income of the people here) · คนทำงาน (offices and office workers, modelled) ·
กิจการรอบตัว (factories, industrial estates, camera shops) · คู่แข่ง พันธมิตร สาขาของเรา (the business type and brand
picker of D-15: “ยังไม่มีข้อมูล” until the page offers it). Every count carries its dataset's unit and, under 90 %, its star;
a dataset a row reads that does not reach the province is named on the row (“ยังไม่มีข้อมูลในจังหวัดนี้: …”); the modelled
figures say แบบจำลอง. The datasets' levels of §14 fold under the rows of each axis. The sentences of the people block, the
maps and the rows are 14 px; tags, keys and table heads 13 px; the provenance lines keep the panel's 12 px (V7-05).

<a id="river-crossings"></a>

## 17. Across a river: distances through the crossings (0.7.5, 2026-11-27)

Owner 2026-11-27 07:09, VERBATIM, with his screenshot of ปุณณวิถี's residents map: “คนอยู่ไม่น่าจะข้ามแม่น้ำจากบางกระเจ้า
มาที่ปุณณวิถีได้นะครับ” — the straight line of 0.7.0–0.7.4 counted the people of Bang Krachao, across the Chao Phraya,
within 3 and 5 km of ปุณณวิถี. The rule that answers it is the Shopping Center page's D70 (its DATA_METHOD §32), the one
D-13 already asked for (1 · 3 · 5 km on 26 Nov 14:40; 400/800 m on 27 Nov 06:51, “คิดด้วย”). Ferries count as that page
counts them: owner 2026-11-27, the option «นับเรือแบบหน้าศูนย์การค้า» in Claude's question, over «ไม่นับเรือ» (D-18 in
`handoff/around/decisions.json`).

**The rule (Inference: a model of reach, not a route).** On the neighbourhood's bank, the straight line from the edge as
before. Across a barrier river, a place, a building or a cell is reached through the nearest crossing — edge → crossing
→ place, each leg a straight line, crossings chained when the way runs over more than one river — and it counts at a
distance only when that sum is within it; it is never nearer than the straight line. Not walking or driving time, not a
timetable: a ferry counts whatever its hours.

- **Barrier rivers**: OpenStreetMap `waterway=river` ways whose name is “แม่น้ำ…” (and the misspelling “แม้น้ำ…”) or whose
  English name holds “River”, a Thai name that is not คลอง or ห้วย; the name of a river relation when the way has none; an
  unnamed way that closes the gap between named parts of one river; a mouth within 2 km of the coast drawn on 20 km
  along its last segment, so the sea end leaves no way round.
- **Crossings**: highways of every class that cross a barrier river (not marked under construction, proposed, planned,
  abandoned, disused, razed or demolished, nor `highway=no`; a way marked `access=no` or `private` only when a tag opens
  it to people on foot, bicycles or vehicles), footbridges, fords, metro
  lines (subway, light rail, monorail) and rail tunnels, and ferries up to 1.6 km long that are not express boats (a name
  with “ด่วน” or “express”, or a way in an express route).
- **Banks**: per neighbourhood, a window of its outline's bounds plus 10 km on each side, the rivers drawn on a 20 m raster
  (lines 8-connected) and the banks the regions between them (4-connected). A crossing links two banks at each change
  of bank along it (the Shopping Center's §32 speaks of a crossing's two ends; a crossing over two rivers links three
  banks here), at its exact intersection with the river nearest that change. The neighbourhood's own banks are the banks
  of the raster cells inside its outline; a bank holding fewer than 6 of them or under 2 % — a sliver where an outline
  is drawn over the river's line — is left out, and an outline too small to hold a cell takes the bank of a point inside
  it. (Until the independent review of 27 November, points on the edge added banks too, and for four riverside outlines
  that took in the far bank: ธานี–ประเวศนคร สุโขทัย, วัดเกต–เจริญเมือง, จันทนิมิต–ตรีรัตน์ and ถนนแม่น้ำแคว–แกนเกสต์เฮาส์บ้านเหนือ.)

**Counts (Observed fact, of the file).** The extract of the Shopping Center page (D-14): `thailand-261124.osm.pbf`,
SHA-256 `62b496bf2383ddd266cfcd3456cd03064db1887399f2a4c869bbf953bfd12d24`, 330,871,226 bytes, © OpenStreetMap
contributors, ODbL 1.0; the file and the cache built from it stay outside the repository (cache SHA-256 in
`data/people/meta.json` `crossing.cacheSha256`). Barriers: 1,277 named ways, 42 gap ways, 29 mouths; crossings 3,264 —
2,744 bridges, 190 other roads, 227 footways, 5 fords, 8 metro lines and tunnels, 90 ferries. The Shopping Center page
publishes 1,437 named ways, 209 gap ways, 33 mouths and 3,411 crossings from the same file (bridges 2,840, other roads 243,
footways 225, fords 4, metro 8, ferries 91). The scripts here are this repository's own reading of the written rule, not
that page's scripts, and the difference is not traced to a rule; so the agreement is measured on what both publish, and
one place does not always give the same figure on both pages.

**Agreement with the Shopping Center page (Observed fact, `scripts/crossing/parity.py`).** From each of its 267 centres
with a river within 5 km, over the 250 m cells of its residents map: of the 73,460 cells it publishes across a river,
73,187 are across here too (99.63 %), and 229 more are across here only; of the 73,187, the distance through the crossings
is the same to 10 m for 94.50 %, within 20 m for 99.55 %, farther apart for 294, and reached through a crossing on one
side only for 35 (on the other side no crossing in the window reaches that bank).

**What changes in 0.7.5 (Observed fact, against 0.7.3).** 208 neighbourhoods have land across a barrier river in their
5 km map (a cell on another bank).

- Residents (§15) within 400 m, 800 m, 1, 3 and 5 km lose the people across a river whose way through the crossings is
  longer than the distance: the figure is lower than 0.7.3's in 70, 94, 100, 154 and 189 neighbourhoods, higher in
  none; inside the outline nothing changes. The other people figures (students, workers, rooms and guests, centres and
  markets) take the same rule, and the levels are computed again from the new figures. Within 5 km the fewest residents
  are 41 (on an island), the median 60,830 and the most 1,010,475 (modelled).
- The 400/800 m counts of `data/around.json` («ขอบเดินถึง»): 178 dataset figures in 65 neighbourhoods are lower (222 of
  their 400 m and 800 m values), none higher; the centres near the edge take the same rule.
- The four riverside outlines whose far bank the first build of 27 November took as home now count it through the
  crossings: within 1 km ธานี–ประเวศนคร สุโขทัย 16,435 → 14,763, วัดเกต–เจริญเมือง 29,569 → 28,440, จันทนิมิต–ตรีรัตน์ 19,501 →
  18,273, ถนนแม่น้ำแคว–แกนเกสต์เฮาส์บ้านเหนือ 19,115 → 19,034 (0.7.3 → 0.7.5).
- The round maps (§16): the cells across a river within the distance the tiles read in a straight line but beyond it
  through the crossings (or reached by none) are hatched in the map's ink — a cell already beyond it in a straight line
  is not the river's doing and stays plain, as on the neighbourhood's own bank; the nearest crossings within 5 km, at
  most 12, are small diamonds; and a cell across, within 5 km in a straight line and beyond it through the crossings
  (both read in tens of metres, as the hatch reads them), carries band 4 in its record and is left out of the
  directions, while a rim cell past 5 km in a straight line stays band 3 on either bank. Under the tiles, when at least
  1 % of the straight-line residents live across a river, a line names the river (nearest first, one name per river; a
  river OpenStreetMap names only in English keeps that name on the Thai page), that share and the crossing through which
  the distance of most of those still counted is measured — “วัดระยะผ่าน …”, a distance and never people the crossing
  carries (owner 2026-11-27 08:57, VERBATIM “เรือขนได้ 16,000 คนเลยเหรอ”; the line read “ข้ามที่ …” before) — or the
  nearest crossing when none is counted at that distance; a fold sets the four figures through the crossings beside the
  straight ones (`st` in `data/people/<id>.json`: the straight figures at every distance where one differs; the fold
  reads 1, 3 and 5 km).
- ปุณณวิถี within 5 km: 18,777 of the 453,771 residents of the straight line live across the Chao Phraya; 16,588 still
  count through the crossings, the distance of 15,494 of them measured through เรือข้ามฟากวัดบางน้ำผึ้งนอก - วัดบางนานอก
  (way 40346702) — how far they live by that way, not how many the ferry carries — so the figure is 451,583. Without ferries it would be 434,994 (built for the owner's question, not published).

**0.7.8 (Observed fact, against main).** With the 65 outlines of §2f, from the same OpenStreetMap file and river cache:
227 of the 534 neighbourhoods have land across a barrier river in their 5 km map (19 of the 65), 207 people files have a
figure through the crossings other than the straight one (18 of the 65), and 195 dataset figures of `data/around.json`
are moved by the rule (17 in the new rows). The 469 earlier rows, people files and maps are byte for byte main's.

**Records.** `data/people/meta.json` `crossing` {rule, kinds, osm, counts, method, cacheSha256, neighbourhoods} and
`maps.x`; per neighbourhood `map.x` {k: [cell, tens of metres through the crossings (−1: no crossing in the window
reaches that bank), tens of metres in a straight line] for the cells across; c: the nearest crossings reached within
5 km, at most 12, in the map's 25 m units; r: the rivers within 5 km, nearest first, one entry per river; a: the share
across per distance; u: the crossing through which the distance of most of those counted is measured}; `data/around.json`
`meta.crossing`, and `meta.release` the page's release (it read 0.6.1, the release that first built the file, until the
review of 27 November).

**Limits (Inference).** A building within about 20 m of a river's line can be read on the wrong bank (the 20 m raster).
190 crossings are ways OpenStreetMap draws over a barrier river without a bridge or tunnel tag — dams, weirs, culverts
or drawing errors among them — and they count as crossings, named on the page as a bridge or by the road they carry, as
on the Shopping Center page. A ferry counts whatever its timetable or capacity. Expressways, rail lines and canals are
not barriers. A neighbourhood whose 5 km holds a barrier river but no land across it (the river ends there, or the
outline sits on both banks) has no river line and no `map.x`.

**Rebuild.** Outside the repository: `python3 -I scripts/crossing/rivers.py --osm <thailand-261124.osm.pbf> --out
<rivers cache>` (about 90 s), then `scripts/residents/build-residents.py … --reach 5000 --crossing <rivers cache>` (the
request cache of §15; about 10 minutes), `scripts/build-people.py … --residents <that file> --crossing <rivers cache>` and
`scripts/build-around.py … --crossing <rivers cache>`; `--crossing-kinds no-ferry` builds the variant without ferries.
The people build reads the cache only when its SHA-256 is the one the residents file was built with, and stops when the
residents file was built from another cache or other kinds. `python3 -I
scripts/crossing/parity.py --cache <rivers cache> --shoppingcenter <a checkout of montri-th/shoppingcenter>` prints the
agreement above.
