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
| ทะเบียนย่านกลาง CityMETER (Google Sheet, internal; owner's export) | names and other names (ชื่อกลาง), the roles the registry proposes from its evidence rows (หลักฐานบทบาท) | read 2026-11-16 · export SHA-256 `meta.registry.exportSha256` |
| Owner bundle «CityMETER • ทะเบียนย่าน ขอบเขต และหลักฐานล่าสุด.zip» | `national-gis/canonical-boundaries.geojson` (370 canonical codes: 343 closed draft outlines, 17 held, 10 collections) and its revision summary | zip SHA-256 `meta.bundle.sha256` · outlines SHA-256 `meta.bundle.boundariesSha256` |
| 16 CityMETER demo datasets | each demo's own data file, read with the demo's own default scope (§3) | repository, file, commit and SHA-256 per dataset in `datasets[].source` |
| Province outlines | `data/provinces.geojson` (77 CityMETER production provinces) | copied unchanged from `montri-th/university@ed2f350` (SHA-256 `9f5b57ef…a8ce62`) |
| Building units | `data/building-units/` (where the 3D focus draws CityMETER Building V4 instead of OpenStreetMap) | copied unchanged from `montri-th/university@ed2f350` (index SHA-256 `b565ee80…01f75`) |

Neither the registry's address, its export nor its cells are in this repository; only the counts and the fields listed
in §9 are published.

## 2. Neighbourhoods

**Observed fact.** 343 closed outlines in 77 provinces, 80.22 km² (registry `area_m2`, metric CRS of the registry),
from 0.05 ha to 217 ha. The partition has no overlap of positive area (`meta.bundle.revision.positive_area_overlap_pairs`
= 0), so a point belongs to at most one neighbourhood; a point on a shared edge goes to the first outline in canonical
order (shapely `covers`). 27 codes have no closed outline (17 held, 10 collection names); they are searchable and listed
with the neighbourhoods they relate to, never counted or drawn.

The display outlines (`data/boundaries.geojson`) are the delivered outlines simplified with mapshaper
(`-simplify interval=1.5 keep-shapes`, shared edges kept, 6 decimals). Every count uses the delivered outline, never the
display copy. The outlines are drafts pending local confirmation — not an administrative boundary, a legal line or a
title — and the page says “ขอบย่านฉบับร่าง” in its provenance line.

## 3. Datasets and their default scope

| Pillar | Dataset | Unit | What is counted (the demo's default scope) | Records / located | Provinces reached | As of | Source |
|---|---|---|---|---:|---:|---|---|
| Land | ที่พัก (Hotel) | แห่ง | ทุกรายการที่พักในชุดข้อมูล | 30,729 / 29,149 | 77 | 2026-11-08 | `montri-th/hotel` `data/hotels.json` @`eae71fb` |
| Land | นิคมอุตสาหกรรม (Industrial Estate) | แห่ง | นิคม สวน และเขตอุตสาหกรรมที่มีขอบในเดโม ใช้จุดภายในขอบ | 106 / 46 | 16 | 2026-10-26 | `montri-th/factory` (industrialestate) @`d37f4ac` |
| Land | สำนักงาน (Office) | รายการ | ทุกรายการสำนักงาน หนึ่งรายการอาจเป็นบางชั้นของอาคาร | 608 / 427 | 19 | 2026-11-02 | `montri-th/office` @`c874f66` |
| Land | ศูนย์การค้าและตลาด (Shopping Center) | แห่ง | สถานที่ค้าปลีกที่นับได้และแหล่งยังระบุว่าเปิด | 6,153 / 6,141 | 77 | 2026-11-07 | `montri-th/shoppingcenter` @`a65bd04` |
| Location | ร้านกล้อง (Camera Shops) | สาขา | สาขาขายปลีกตามค่าเริ่มต้นของเดโม | 252 / 236 | 63 | 2026-10-23 | `montri-th/camera` @`5caee6e` |
| Location | โรงงาน (Factory) | ทะเบียน | ทะเบียนโรงงานทุกขนาด วางได้เฉพาะทะเบียนที่มีพิกัด | 74,047 / 15,654 | 70 | 2026-11-04 | `montri-th/factory` @`d37f4ac` |
| Location | ฟิตเนส (Fitness) | สาขา | สาขาที่แหล่งยังระบุ ณ วันตรวจ | 358 / 149 | 21 | 2026-10-26 | `montri-th/fitness` @`a6511b3` |
| Location | ร้านค้าปลีกของใช้ (Grocery) | ร้าน | จุดร้านของ 17 แบรนด์ ตำแหน่งจาก vector tile | 27,607 / 27,607 | 77 | 2026-10-22 | `montri-th/grocery` @`5905ade` |
| Location | แบรนด์หรู (Luxury Brands) | จุดขาย | จุดขายจากรอบ refresh ที่แหล่งยังระบุ | 345 / 345 | 9 | 2026-10-21 | `montri-th/luxurybrands` @`ddbbfcc` |
| Location | ร้านยา (Pharmacy) | ร้าน | ร้านที่มีใบอนุญาต ขย1 วางได้เฉพาะร้านที่มีจุด | 18,136 / 2,573 | 77 | 2026-10-22 | `montri-th/pharmacy` @`81e75aa` |
| Location | ร้านอาหาร (Restaurants) | ร้าน | ทุกร้านในชุดข้อมูล ตำแหน่งแสดงผลจาก tile | 70,214 / 70,214 | 7 | 2026-10-22 | `montri-th/restaurant` @`142a989` |
| Living | หน่วยงานรัฐ (Government Office) | แห่ง | ทุกจุดของชุดข้อมูลหน่วยงานรัฐ ทุกหมวด | 20,568 / 20,568 | 77 | 2026-11-06 | `montri-th/governmentoffice` @`7cadf90` |
| Living | สถานพยาบาล (Hospital) | แห่ง | สถานพยาบาลทุกประเภท วางได้เฉพาะที่มีจุด | 41,828 / 12,516 | 77 | 2026-11-01 | `montri-th/hospital` @`80d6e60` |
| Living | สถานศึกษา (School) | แห่ง | สถานศึกษาทุกสังกัดในฐานปี 2569 วางได้เฉพาะที่มีจุด | 40,827 / 33,077 | 77 | 2026-10-31 | `montri-th/school` @`80f13e8` |
| Living | สถานีราง (Transit) | สถานี–สาย | หนึ่งรายการต่อหนึ่งสาย ไม่รวมสถานีที่ยังยืนยันไม่ได้ | 301 / 301 | 17 | 2026-10-31 | `montri-th/transit` @`a305eee` |
| Living | มหาวิทยาลัย (University) | แห่ง | วิทยาเขตและพื้นที่ที่ทีมวิจัยตรวจ ไม่แบ่งนักศึกษาตามจุด | 190 / 188 | 59 | 2026-11-10 | `montri-th/university` @`ed2f350` |

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
- The open neighbourhood shows its located records (the pillar's colour and shape; the dataset being read larger with a
  dark edge) and its buildings in 3D with their surroundings (`js/regions.js`, CityMETER Building V4 where
  `data/building-units/` says so, else OpenStreetMap).

## 10. Published fields

Per neighbourhood: code, name, other names, province, registry area, reference point, box, name status, whether the
outline was walked, the proposed roles, and the counts, measures, subgroup counts, ranks, highlights and pairs. Per held
or collection code: code, name, province, status and the related codes. Not published (owner 2026-11-16, “ตัดออก”): the
registry's internal working fields — field questions and the segments still to walk, the registry's source ids, merge
notes, outline policy versions and the bundle's review counts — nor the registry's address, its export, its evidence
rows' text, reviewer notes or any person's name.

## 11. Rebuild

```
# 1. the owner's .xlsx export of the registry (internal, never committed) and the bundle, unzipped into its own folder
# 2. the 16 demo repositories cloned side by side, their commits in commits.json ({repo: {commit, committed}})
python3 -I scripts/build-data.py --bundle <bundle dir> --bundle-zip <bundle.zip> --registry <export.xlsx> \
  --repos <clones> --commits commits.json --mapshaper <mapshaper> --out data
npm test
node scripts/check-lds-parity.mjs --lds <Landometer-Design-System-v0.9.7.md>
```

The build prints, per dataset, records · located · inside · provinces reached, and writes `data/build-report.json`
(files with bytes and SHA-256, totals, the strongest pairs).
