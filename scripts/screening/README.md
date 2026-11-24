# Neighbourhood screening

Finds places that look like the registry's neighbourhoods but are not in it yet, from the demo datasets alone. It is a screen, not a decision: a candidate enters the registry only through the owner's word in the review tab's column «พี่ตัดสิน». Nothing here changes the site; the web update waits for the owner (decisions of 2026-11-25 in `AGENTS.md`).

## Run

```sh
SCREEN_SRC=/path/to/dataset-clones SCREEN_REGISTRY_XLSX=/private/registry-export.xlsx sh scripts/screening/run.sh
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `SCREEN_SRC` | `../src` beside this repository | Clones of the 16 dataset repositories at the commits named in `data/neighborhoods.json` `datasets[].source`. Step 1 stops when a file's SHA-256 differs. |
| `SCREEN_ALLOW_NEWER` | unset | `1` screens newer dataset files on purpose. |
| `SCREEN_WORK` | `/tmp/citymeter-screening` | Every output. Never a folder of this repository. |
| `SCREEN_REGISTRY_XLSX` | unset | A private export of the central neighbourhood registry. Only step 5 reads it, for the names in tabs «คัดย่านการค้า» and «ย่านที่พัก 268»; without it the candidates carry no registry name. Never commit it. |
| `SCREEN_LODGING` | `hotel,guesthouse,resort` | Hotel dataset types that count as lodging evidence (owner 2026-11-25 00:31: “นับรีสอร์ทด้วย”). `hotel,guesthouse` repeats the first review round of the same night. |
| `SCREEN_QUEUE` | `10` | Score of the review queue (owner 2026-11-25: “10”). |
| `SCREEN_SAMPLE` · `SCREEN_SEED` | `40` · `20261125` | Size and random seed of a first-round sample. |
| `SCREEN_DATE` | `2026-11-25` | Date in the names of the review files. |

Python 3.13 with numpy 2.5, scipy 1.18, shapely 2.2, pyproj 3.8, scikit-learn 1.9 and, for the registry export, openpyxl 3.1. A run takes about 20 seconds.

| Step | Reads | Writes |
| --- | --- | --- |
| `01_points.py` | dataset files through `scripts/build-data.py` | `points.pkl` |
| `02_seeds.py` | `points.pkl`, `data/boundaries.geojson`, `data/provinces.geojson` | `seeds.npz`, `layers.pkl` |
| `03_score.py` | `seeds.npz` | `score.npz`, `components.pkl` |
| `04_centres.py` | `seeds.npz`, `score.npz` | `centres.pkl` |
| `05_groups.py` | the above, `data/neighborhoods.json`, `amendments/outline-amendments.geojson`, optional registry export | `groups.json`, `regscreen.pkl` |
| `06_candidates.py` | the above | `candidates.json` |
| `07_facts.py` | the above | `facts.json` |
| `08_logit.py` | `seeds.npz`, `score.npz` | `logit.json` (cross-check only) |
| `09_review_rows.py` | `candidates.json`, `facts.json`, `layers.pkl` | the review rows, `.csv` and `.json` |

## Method

1. **Seeds.** A 200 m cell (UTM 47N, EPSG:32647) holding a point of the nine national commerce layers or a rail station: shopping centres (mall, community, outlet) · markets and retail venues (market, hoststore, other) · lodging · grocery · pharmacy · office · luxury brands · camera · fitness. Restaurants are left out (7 provinces only). Lodging counts the Hotel dataset's types `hotel`, `guesthouse` and `resort` (owner 2026-11-25: “โรงแรม + เกสต์เฮาส์”, then “นับรีสอร์ทด้วย”); apartments, bungalows, homestays and other lodging are not evidence.
2. **Measures at each seed.** Counts of every layer within 400 and 800 m; distinct positions (~11 m grid) and distinct layers of the nine within 400 m; the nearest outline within 1 km; the province.
3. **Score**, 17 components, 24 points at most:

| Id | Passes when | Points |
| --- | --- | --- |
| A1 | a shopping centre within 400 m | 3 |
| A2 | a market or retail venue within 400 m | 2 |
| A3 | 3 or more markets or retail venues within 800 m | 1 |
| H1 · H2 | 3 · 10 or more hotels, guesthouses and resorts within 400 m | 2 · 2 |
| O1 · O2 | 1 · 3 or more offices within 400 m | 1 · 1 |
| T1 | a rail station within 800 m | 2 |
| U1 | a university within 800 m | 1 |
| D1 | 3 or more grocery stores within 400 m | 1 |
| D2 | a pharmacy within 400 m | 1 |
| P1 | a luxury brand, camera or fitness point within 400 m | 1 |
| G1 | a government office within 400 m | 1 |
| M1 · M2 | 3 · 5 or more of the nine layers within 400 m | 1 · 1 |
| K1 · K2 | distinct positions at or above 90 % · 97 % of the province's other seeds | 2 · 1 |

   The province percentile is the share of the province's other seeds with strictly fewer positions (ties ranked lowest).
4. **Calibration.** A neighbourhood's core is the seed that counts for it as its nearest outline, inside it or within 150 m: inside first, then most layers, then most positions, then the lowest index. Background is every seed farther than 1 km from all outlines. The AUC of the score, cores against background, measures how well the score tells them apart.
5. **Centres.** Passing seeds kept when strongest within 600 m (score, then positions; stable order). A centre within 150 m of an outline is an existing neighbourhood, 150 m – 1 km an extension or merge, farther than 1 km a new candidate.
6. **Old rule, beside the score (owner 2026-11-25: “คู่กัน”).** The registry's “เข้าคิวก่อน” within 800 m: a centre or venue; 3 or more distinct positions among centres, venues, offices and hotels of type `hotel`; and 2 or more of those 4 groups or 3 or more venues. Same-name de-duplication within 100 m is not applied.
7. **Candidates.** Roles are the registry's codes (`retail_trade` A1 A2 A3 P1 · `office_business` O1 O2 · `housing_daily_life` D1 D2 · `hospitality_tourism_culture` H1 H2 · `education` U1 · `government_public_services` G1), ordered by points, ties in the registry's order; rail (T1) is context, not a role. Names within 400 m come from shopping centres and markets, rail stations and universities, else the lodging that counts.
8. **Review rows.** The queue (score ≥ `SCREEN_QUEUE`) with a sample of `SCREEN_SAMPLE`: half from Bangkok and NBI SPK PTE SKN NPT, half from the rest; within each, proportional to score bands 10–11, 12–13 and 14+ (largest remainder), drawn with `SCREEN_SEED`. A row's code is `SC-<cell x>-<cell y>` of its 200 m cell.
9. **Three groups (owner 2026-11-25 01:04: “ใช้ 3 กองเลย”).** Every candidate: A when it lies within 1 km of a point the registry ties to a central code (a start point of «ย่านที่พัก 268» whose proposal or existing code is in «ชื่อกลาง»; needs `SCREEN_REGISTRY_XLSX`), else B within 2 km of an outline, else C. A takes no new code; B needs the edge checked (extension or separate neighbourhood); C is the queue of new neighbourhoods. A B or C candidate the review confirms as new takes the code `CMN-TH-` + the first 10 hexadecimal digits, upper case, of SHA-256 of `commercial-screen-2026-11-25:<candidate code>` (`candidates.json` `code`).

## Figures

Observed on 2026-11-25 on the dataset files of `data/neighborhoods.json` and the registry export of 2026-11-24 (not committed); `facts.json` holds them all.

| Measure | Value |
| --- | --- |
| Seeds · seeds within 150 m of an outline | 44,384 · 4,403 |
| Neighbourhoods with a core · without | 378 · 17 of 395 |
| Background seeds | 34,586 |
| AUC of the score · cross-validated AUC of the logistic cross-check (35 variables) | 0.903 · 0.895 |
| Neighbourhoods found at score ≥ 6 · 8 · 10 · by the old rule | 272 · 232 · 186 · 278 |
| Centres at score ≥ 10: existing · extension or merge · new | 242 · 117 · 91 (450) |
| New candidates at score ≥ 10 | 91 in 42 provinces; first role `retail_trade` 87, `hospitality_tourism_culture` 4; 86 pass the old rule too |
| Groups A · B · C at score ≥ 10 · 8–9 · 6–7 | 8 · 34 · 49 · 5 · 44 · 118 · 11 · 92 · 263 |
| Centres of the old rule: existing · extension or merge · new | 540 · 711 · 1,587 (2,838) |
| Restaurants ≥ 10 within 400 m, 7 provinces: cores · background | 89 of 101 · 4,217 of 6,633 (lift 1.39; not in the score) |

The review ran in two rounds the same night. Round 1 (`SCREEN_LODGING=hotel,guesthouse`: 37,703 seeds, AUC 0.874, 80 new candidates in 36 provinces) wrote the review tab's first 80 rows: CSV SHA-256 `4d47a01241307a4ffa85cfa3ba2e929693fe3832fa4f46f5e28c6a4741037067`, codes SHA-256 `a220838fa8c24d42222fa50a3bd1b8c22f96574d629f184651712ab2c4508f66`. Round 2 brought the tab to the queue above without a new sample: each first-round row re-scored at its own cell, its place in the new queue (78 stay, 1 leaves at score 8, 1 joins a centre 633 m away), and the 13 new candidates appended and all checked. That change set was built outside this repository from the outputs of both runs.

## Limits

- The score reads located records of the demo datasets. A neighbourhood the data does not reach scores low; a high score is not a neighbourhood until someone checks the place.
- Counts are records within a straight-line radius, not walking distance, footfall or sales.
- The percentile ranks a seed against its own province, so a busy street in a small province can rank as high as a centre of Bangkok. It also moves with what counts as lodging, which changes both the positions at a seed and the pool it is ranked against: of the 13 candidates added when resorts were counted, 11 were already seeds and 8 of those gained K1 or K2.
- “New” alone means farther than 1 km from every drawn outline. The registry also ties located points to codes without an outline or with an outline farther away, which is why group A exists: in the first two review rounds none of its 5 checked places was a new neighbourhood. The groups' shares come from 53 desk-checked places (40 sampled, 13 not), not from field visits.
