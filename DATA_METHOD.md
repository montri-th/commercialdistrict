# CityMETER · Commercial District — data and method

How every figure on the page is made, from which file, and where its limits are. Thai first for the reader; the rules
are the contract `scripts/build-data.py`, `js/model.js`, `js/profile.js` and the tests (`tests/data.test.js`,
`tests/views.test.js`) hold. Evidence labels follow Landometer MBB §3.7: **Observed fact** (counted from the files),
**Benchmark interpretation** (a place among named peers), **Inference** (this demo's reading, never a claim the source
makes).

## วิธีนับ — อ่านตัวเลขในหน้าอย่างไร

- **ย่าน** = ย่านกลางที่มีขอบปิดในทะเบียนย่านกลาง CityMETER (ฉบับร่าง ยังไม่ตรวจภาคสนาม) รหัสกลาง `CMN-TH-…`
- **จำนวนในย่าน** = จำนวนรายการของชุดข้อมูลนั้นที่มีพิกัดและพิกัดอยู่ในขอบย่าน แต่ละชุดใช้หน่วยของตัวเอง (แห่ง สาขา ร้าน จุดขาย ทะเบียน รายการ สถานี–สาย) และ **ไม่บวกข้ามชุด**
- **ต่อ ตร.กม.** = จำนวนในย่าน ÷ พื้นที่ย่านตามทะเบียน (`area_m2` ของทะเบียน ไม่คำนวณใหม่)
- **ไม่มีข้อมูลในจังหวัดนี้ (—)** = ชุดข้อมูลไม่มีรายการที่มีพิกัดเลยในจังหวัดของย่าน จึงไม่รู้ ไม่ใช่ 0 · **0** = ชุดข้อมูลมีรายการในจังหวัด แต่ไม่มีรายการใดอยู่ในขอบย่าน
- **สัดส่วน** = จำนวนในย่าน ÷ รายการที่มีพิกัดของชุดนั้น (ทั้งประเทศ หรือในจังหวัด) ตัวตั้งและตัวหารอยู่ข้างตัวเลขหรือในคำอธิบายของมัน
- **จุดเด่น** = ย่านติดกลุ่มบนของกลุ่มเทียบ ทุกข้อบอกกลุ่มเทียบและจำนวน (§5)
- **มาด้วยกัน** = คู่ชุดข้อมูลที่ความหนาแน่นขึ้นลงด้วยกันในย่านทั่วประเทศ (สหสัมพันธ์อันดับ ρ, §6) — ความสัมพันธ์ ไม่ใช่เหตุและผล
- จำนวนรายการไม่ใช่ยอดขาย คนเดิน รายได้ หรือความต้องการ

## 1. Sources

| Source | What is read | Identity |
|---|---|---|
| ทะเบียนย่านกลาง CityMETER (Google Sheet, internal; owner's export) | names and other names (ชื่อกลาง), the roles the registry proposes from its evidence rows (หลักฐานบทบาท), (0.2.0) the outline review of its lodging screen (ย่านที่พัก 268, column ผลทบทวนขอบ) | read 2026-11-18 (release 2026-11-17-commercial-recovery-9) · export SHA-256 `meta.registry.exportSha256` |
| Owner bundle «CityMETER • ทะเบียนย่าน ขอบเขต และหลักฐานล่าสุด.zip» (read 2026-11-18) | `national-gis/canonical-boundaries.geojson` (release 2026-11-17-commercial-recovery-9: 370 canonical codes, 358 closed draft outlines, 2 held, 10 collections; since 2026-11-18 stored as a lossless byte alias, restored with `scripts/restore-bundle-member.py`, every SHA-256 checked) and its revision summary (`gis/revision-summary.json`) · (0.2.0) the current lodging review `lodging-held78-recovery-2026-11-18`: `decision-ledger.json` (268 proposals) and `boundaries/current-all268-review-drafts.geojson` (130 review drafts) | zip SHA-256 `meta.bundle.sha256` · outlines SHA-256 `meta.bundle.boundariesSha256` · lodging revision `meta.lodging.revision` |
| 16 CityMETER demo datasets | each demo's own data file, read with the demo's own default scope (§3) | repository, file, commit and SHA-256 per dataset in `datasets[].source` |
| Province outlines | `data/provinces.geojson` (77 CityMETER production provinces) | copied unchanged from `montri-th/university@ed2f350` (SHA-256 `9f5b57ef…a8ce62`) |
| Building units | `data/building-units/` (where the 3D focus draws CityMETER Building V4 instead of OpenStreetMap) | copied unchanged from `montri-th/university@ed2f350` (index SHA-256 `b565ee80…01f75`) |

Neither the registry's address, its export nor its cells are in this repository; only the counts and the fields listed
in §9 are published.

## 2. Neighbourhoods

**Observed fact.** 395 outlines in 77 provinces, 94.99 km²: the registry's 358 closed outlines (80.81 km², registry
`area_m2` in its metric CRS, 0.05 ha to 217 ha) and, since 0.2.0, 37 lodging areas of its lodging screen (14.18 km², §2a).
The registry's partition has no overlap of positive area (`meta.bundle.revision.positive_area_overlap_pairs` = 0) and
the 37 lodging areas overlap none of its outlines (measured: 0), so a point belongs to at most one neighbourhood; a
point on a shared edge goes to the first outline in order — the registry's in canonical order, then the lodging areas
(shapely `covers`). 12 codes have no closed outline (2 held, 10 collection names) and 42 lodging areas have no draft;
they are searchable and listed, never counted or drawn.

**What changed with the registry of 2026-11-17 (Observed fact).** Against the data of 16 Nov 2026 (343 closed
outlines): 15 codes that were held now have a closed draft outline, most under a new name (`rows[].added`); the 343
outlines drawn before are the same shapes (131 were written out again with their vertices in another order: area and
shape unchanged, intersection over union 1.0); no code was added or removed.

## 2a. Lodging areas (0.2.0)

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

Ties share the better rank. A comparison is a highlight when `p ≥ 0.75`; a neighbourhood keeps at most four, one per
dataset, strongest first (equal strength: the larger share of the dataset's located records first). “เด่นหลายด้าน”
counts highlights with `p ≥ 0.9`. Rules and thresholds are `meta.rules`.

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
  release “ใหม่ในรุ่นนี้”. The filter ประเภทย่าน (`f.kind`: registry · lodging · added) narrows every view to one kind.
- The open neighbourhood shows its located records and its own buildings in 3D — inside its outline only (0.1.4; owner
  2026-11-16 23:28: “กับอาคาร 3d ที่ขึ้นรอบๆผมว่ามันแปลกๆ”), CityMETER Building V4 where `data/building-units/` says so, else OpenStreetMap; round it
  the basemap's buildings stay quiet and fade with distance, as in the Hotel demo. Records (0.1.3, §9a): one pin per
  dataset and exact point in the pillar's colour and shape.

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
  next neighbourhood. “ทั้งหมด” (`f.show=all`) draws every record alike; a chosen set (`f.show`) draws its pins larger with
  their names beside them (HTML, so Thai shapes correctly and every name is a keyboard target; a name never covers a pin
  of its set), every other record as a small neutral dot (`text.muted`, not a paler data colour). Reading a dataset
  (`m`) with a neighbourhood open chooses that set too. Colours and shapes stay the pillars' (LDS DATAVIZ-05): one set
  stands out at a time, so no two sets need telling apart by colour, and no glyph is drawn inside a pin.
- **Pointer and card.** A pointer over a pin names its records (a pile: the first names, then “and more”); a click
  opens a card: the record's name, set and subgroup, its figure under the dataset's own exact name, a link that opens the
  record in its own demo (`<demo>/?e=<kind>:<key>`, the kinds each demo's address reads), Google Maps by name and Street
  View at the point, and dataset · source · date · boundary. Several records at a point open as a list of names by set.
  No tip, list or card shows a total across datasets. On a phone the card docks under the bar.
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

## 10. Published fields

Per neighbourhood: code, name, other names, province, registry area, reference point, box, name status, whether the
outline was walked, the proposed roles, the kind (registry or lodging) and whether it is first drawn in this release, its
lodging screen when it has one (§2a), and the counts, measures, subgroup counts, ranks, highlights and pairs. Per held,
collection or undrawn lodging name: code, name, province, status, the related codes and its lodging screen. Per record (0.1.3, `data/records/`): dataset,
point, subgroup, the key and names its own public demo already publishes, its figure and a station's line. Per
condominium point (`data/condo/`): point, project name, buildings, floors, appraisal P25 / P50 / P75 and the source's
search area and province — not its production ids, observation ids, API addresses, pin roles or review notes, and not
the research master's address. Not published (owner 2026-11-16, “ตัดออก”): the
registry's internal working fields — field questions and the segments still to walk, the registry's source ids, merge
notes, outline policy versions and the bundle's review counts — nor the registry's address, its export, its evidence
rows' text, reviewer notes or any person's name.

## 11. Rebuild

```
# 1. the owner's .xlsx export of the registry (internal, never committed) and the bundle, unzipped into its own folder
# 2. the 16 demo repositories cloned side by side, their commits in commits.json ({repo: {commit, committed}})
# 3. (0.1.3) the condominium research master's .xlsx export (internal, never committed)
# 4. (0.2.0) restore the outlines the bundle stores as a byte alias, beside its revision summary
python3 -I scripts/restore-bundle-member.py <bundle dir> lodging-review-2026-11-17/inputs/canonical-boundaries-existing358.geojson \
  <outlines dir>/national-gis/canonical-boundaries.geojson
cp <bundle dir>/gis/revision-summary.json <outlines dir>/national-gis/revision-summary.json
python3 -I scripts/build-data.py --bundle <outlines dir> --bundle-zip <bundle.zip> --registry <export.xlsx> \
  --repos <clones at main> --commits commits.json --mapshaper <mapshaper> --condo <condominium export.xlsx> --condo-read-on 2026-11-16 \
  --lodging <bundle dir>/lodging-held78-recovery-2026-11-18 --prev-canonical <the previous release's canonical-boundaries.geojson> --out data
npm test
node scripts/check-lds-parity.mjs --lds <Landometer-Design-System-v0.9.7.md>
```

The build prints, per dataset, records · located · inside · provinces reached (and the condominium points shown, held and
without a point), and writes `data/build-report.json` (files with bytes and SHA-256, the shard folders with their file
count, bytes and a digest, totals, the strongest pairs). Rows' pairs follow the highlights' order (0.1.3; a set's order
changed with Python's string hashing before).
