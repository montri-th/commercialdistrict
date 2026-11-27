# CityMETER Commercial District — verification

## Release 0.7.9 — 27 พ.ย. 2569 (not published): the round map without url(#…) references

The owner's words (VERBATIM): 16:10 “heatmap นี้ไม่ขึ้นใน mobile นะครับ (safari) เช็คที่ citymeter.pages.dev”; he chose
«แก้แบบกันไว้ก่อนเลย» in Claude's question (the option: the map stops depending on clip-path and pattern referenced
through url(#…), he tries it on his iPhone once it is live, and this may not be the cause).

- Before the change, on citymeter.pages.dev (0.7.8) in Claude in Chrome: at 393 px the map draws once the sheet is
  expanded; at rest the sheet hides the section, by design. Cause in Safari not confirmed. Hypotheses: the clip past the
  5 km line and the hatch were url(#…) references, which can stop resolving after a page rewrites its address (this page
  calls history.replaceState right after drawing the panel); the inline map had a viewBox but no width or height.
- `js/people.js`: no `<defs>`, `<clipPath>` or `<pattern>`; a frame (`.pm-frame`, a rectangle round the map with the
  5 km line as its hole, `fill-rule="evenodd"`) in the panel's paper `--surface-card` covers what lies past the line,
  over the cells and the context, under the lines; the hatch of 0.7.5 drawn as its 45° lines square by square
  (`hatchSquare`), the same lines as the pattern (4.2 units apart on the map, 3 in the key); `width` and `height` equal
  to the viewBox; `fitMapNames` takes a failing `isPointInFill` as “not on the outline”. `styles.css`: `.pm-frame`, and
  the hatch's stroke moves to `.pm-cross-out`.
- `npm test`: 233 of 233 pass (0.7.8's 230 and the 3 of `tests/round-map-refs.test.js`, which draws 2,961 maps — every
  tab with data of the 534 neighbourhoods at 5 km, and in · 1 km · 5 km for the 227 with a crossing — none with a
  reference, 1,716 of them hatched, every crossed-out cell hatched). LDS parity (`check:lds`, LDS 0.9.7 `d3085cbc…`):
  145 ok, 0 failed. `data/around.json` and `data/people/meta.json` differ from main only in the release field.
- Old against new in headless Chromium (Playwright; main's markup with main's CSS, this tree's with its own; 9 maps, light
  and dark, at 2×): the same size; pixels apart by more than 24 levels 0 to 0.43 % of a map, all on the hatch lines,
  none along the 5 km line.
- The page served locally (Playwright Chromium; โขงเจียม–ภู่กำชัย–แก้วประดิษฐ์, อุบลราชธานี, at 1 km; 393 × 740 with
  the sheet expanded and 1,440 × 900, light and dark): no url(#…) in the section; the map 365 × 350 px on the phone and
  370 × 355 on desktop; the frame's fill equal to the panel's background (rgb(252, 252, 250) light, rgb(32, 41, 45)
  dark); the hatch in the map and in the key; no page error (only the outside requests the container cannot reach).
- Preview: deploy run 45977210851 (16:51–16:52, Commercial District at `8690169` as the override): family check pass,
  120 / 120 live checks on preview.citymeter.pages.dev. There, in the owner's Chrome (1,710 px, and a 393 × 740 frame of
  the same origin in dark with the sheet expanded): cache tag `20261127-r7`, no url(#…) in the map's section, the frame's
  fill equal to the panel's background, the hatch in the map and in the key, no horizontal overflow.
- Not verified: Safari or any WebKit (not installable here), a real iPhone. The owner's test on his iPhone is the check.
- The roadmap's V7-08 moves to 0.7.10.

## Release 0.7.8 — 27 พ.ย. 2569 (not published): the owner's ticks on the commercial screen's outlines

The owner's words (VERBATIM): 10:44 “1 แก้แล้วในช่องสีเหลือง / 2 รับ / 3 แก้ / 4 ลบ”, on Claude's four questions of 26 Nov
(`amendments/outline-new-choices-2026-11-27.json`, `owner.asked_th`); then, on Claude's questions that morning, «ส่งต่อแชท
0.7.x (แนะนำ)» (the session that built 0.7.4–0.7.6 rebuilds «รอบย่านนี้», the logos and «ใครอยู่ตรงนี้» with its caches),
«บันทึกช่อง «พี่ตัดสิน» (แนะนำ)» and, the column taking four words only, «เลือก «ไม่ใช่ย่าน» (แนะนำ)». Method: `DATA_METHOD.md` §2f.

### The sheets (his Chrome, read back)

- Tick sheet `02-CityMETER__outline-rule-screen-check__v1__2026-11-26`, tab «ติ๊กขอบ V4 (0.6.1)», read at 10:55: 66 rows,
  column «พี่ตัดสิน» “ตามข้อเสนอ” × 65 and “ไม่นับเป็นย่านการค้า ลบทิ้ง” × 1 (CMN-TH-33E737E0D0); the rows as read hash to
  `13f3f9c5…` (`sheet.readBack` of the ticks file).
- Registry, tab 05_REVIEW_QUEUE (“3 แก้”), 11:01: the row whose รหัสกลางที่รับ is CMN-TH-BAFFB5235F (checked in the row first):
  «จุดอ้างอิงย่าน» set to the OpenStreetMap point of ตลาดไท its outline starts from, «หมายเหตุ» a dated note with the old
  point (in the sheet only); read back, both cells as written, the rows above and below as in the export of 26 Nov.
- Registry, tab 05_REVIEW_QUEUE, about 11:55: the row of CMN-TH-33E737E0D0 (checked first): «พี่ตัดสิน» = «ไม่ใช่ย่าน» (his
  free words were refused by the column's list, nothing written, nothing spilled; the list itself not touched), his words
  and the date added at the end of «หมายเหตุ» (read back: the old note plus the new words, character for character); the
  notes of the rows above and below equal the export of 26 Nov (SHA-256 of both).

### Outlines and data (container, 27 Nov)

- `scripts/rule-outlines.py ticks` on `outline-new-2026-11-26-r2.geojson` (`09129f0e…`): use 13 · trimArms 11 · cut1km 41 ·
  remove 1; 139 outlines, every one applied, each holding its point; cut ones 992 m and trimmed ones at most 985 m from
  their 8 m seeds; the 74 of 0.6.1 unchanged. → `outline-new-2026-11-27-r3.geojson` (`e90f1c4c…`), ticks file `6c0b5a77…`.
- `scripts/build-data.py` with the inputs of 0.6.1 (registry export of 26 Nov `3b9cabbd…`, the bundle, the 16 clones at
  the same commits) and `--screen` r3: 534 outlines (screen 139 drawn, 88 without an outline, 1 removed, none held or
  waiting); 14,513 records inside; 65 new records shards, the 469 others byte for byte unchanged, `data/boundaries.geojson`
  only grows by the 65. The same command with the r2 file gave main's `data/neighborhoods.json` again except `builtOn`,
  and main's `data/boundaries.geojson` and records byte for byte.
- `js/model.js#fixed` now rounds as Python's `round` (ties to even): the first exact tie of the data, 1 − 24/128, read
  0.813 on the page and 0.812 in the file. Checked on 326,407 values against Python: no difference.
- `npm test` before the rebuild of the people files: the tests of the outlines, the screen and the data pass; the 22 that
  read `data/around.json`, `data/rings/`, `data/logos/` and `data/people/` wait for them.

### «รอบย่านนี้», the logos and «ใครอยู่ตรงนี้» (the 0.7.x session, merged here)

- Built from `6cf2e28` in the session that made 0.7.4–0.7.6 (session_012D2wn48aQKvsMjMiuv91Wt), branch
  `release-0.7.7-people` (`f6666fc`, 13:48), on this release's prompt: around (`--crossing`), logos, residents
  (`--reach 5000 --crossing`), context maps and people, with the river cache of `thailand-261124.osm.pbf` (`62b496bf…`;
  cache `cd1e1442…`, as in 0.7.5). Added: 65 rings, 65 logo shards, 65 people files, one logo image (a Restaurant brand
  mark); rebuilt: `data/around.json`, `data/logos-report.json`, `data/people/meta.json`; pinned numbers in
  `tests/around.test.js` and `tests/logos.test.js`. Merged here in `dead6c4`.
- Where it went beside the prompt (its report, relayed by the owner at 13:56): the Shopping Center model of
  «ใครอยู่ตรงนี้» is `scripts/build-visitors-map.py` as main's meta records it (`e2218957…`), not the file at `dfcc6cd`
  (`dd9d0f9f…`) that `build-around.py` checks by its pin — 0.7.6 was built with the first, the second would change the
  model's figures; the pin did not move and Shopping Center 0.13.0 was not used. The context maps take their frames from
  the people files, which the 65 did not have: a first people build with the context of 0.7.6 gave the frames, the
  context was then drawn for all 534, then the final people build; the result is the prompt's order. Its OpenStreetMap
  cache and residents output stay outside the repository, in its container.
- Figures (Observed fact, from the files; main in brackets): residents for 534 outlines from 74,280 requests (59,219) over
  2,500 subdistricts (2,106), 8,044,674 buildings (7,213,960) of which 644 from parts (638), month 2026-10, the register's
  total equal to `popCount` in all 2,499 compared; within 5 km the fewest 41, the median 48,609.5 (60,830), the most
  1,010,475, the 65 new ones 8,986–179,961, each with residents inside. Across a river: 227 maps with land across (208),
  207 people files with a figure through the crossings (189), 195 dataset figures of `data/around.json` moved (178).
  Context maps with a main road 488 (423), rail 252 (234), stations 196 (189), a river 485 (428), water 508 (445), the sea
  136 (127). Logos: 3,700 of the 14,513 records inside (3,353 of 13,407), 166 of the 544 centre names around (166 of
  543), 459 files, no SHA-256 issue. Around: 534 rows, three centres added to its list (one inside a new outline, two
  nearest to one); the reference set of D-8 unchanged (395, `d9ae2a5b…`), 139 ranked against it.

### Checks on the merged tree (container, 27 Nov)

- The 469 against main `55187e2`: `data/rings/`, `data/logos/` and `data/people/` 469 of 469 byte for byte (git blob
  ids); `data/around.json` rows 469 of 469 equal, main's centres and their `byVenue` entries equal; in
  `data/people/meta.json` the frames of the 469 equal, the other fields that moved are counts over 534 and the release.
- `npm test`: 230 of 230 pass, the 22 that waited for the rebuild among them. LDS parity (`check:lds`, LDS 0.9.7
  `d3085cbc…`): 145 ok, 0 failed.
- The release number: main took 0.7.7 at 13:30 (citymeter-shell 0.6.6, below), so this release is 0.7.8 with cache tag
  `20261127-r6` (main's 0.7.7 serves r5), and the roadmap's V7-08 moves to 0.7.9.

## Release 0.7.7 — 27 พ.ย. 2569: citymeter-shell 0.6.6 (main, another session)

- Recorded from commit `a27559a` (PR #48, merged 13:30 from session_012D2wn6355CHPN75KZ8qKG7): the dataset picker lists
  Tourism (Location; montri-th/tourism), so the menu matches the 19 demos of the hub; `js/shell/datasets.js`, its
  manifest and `tests/shell.test.js`; cache tag `20261127-r4` → `20261127-r5`; the release field of `data/around.json`
  and `data/people/meta.json`; no count changes.
- 0.7.8 (above) was in progress when it landed: merged into it in `8dbad62`, the two release fields the only conflicts;
  the shell tests of 0.6.6 pass on 0.7.8.

## Release 0.7.6 — 27 พ.ย. 2569 (not published): citymeter-shell 0.6.5

The owner's words (VERBATIM): 08:23 “EN บนเวบผมคลิกไม่ได้”; 08:47 “citymeter.pages.dev ใน Safari”; he chose «แก้ทุกเดโมพร้อมกัน»
in Claude's question. On citymeter.pages.dev (0.7.3, Claude in Chrome, his Chrome at 1,710 px) a real click on EN opened the
English page; the link is the element at its own centre at every width from 768 to 1,710 px. The cause in Safari is the
shell's refresh of the link on `pointerdown`: it wrote the words “EN” again, Safari replaces a text node even for the same
text (WebKit bug 244559) and drops a click whose press landed on a text node removed before the release (WebKit bug
252810). Not reproduced in Safari here: WebKit could not be installed in the container.

- `js/shell/header.js` `updateLanguageLink`: only what changed is written; the words once, when they change. Manifest
  0.6.5; `tests/shell.test.js` (the family's file) gains the test of it. The same bytes in all 17 repositories and in
  `factory/industrialestate/`.
- `npm test` here: 229 tests, 229 pass, 0 fail (with 0.7.5 after its review); every other repository passed its own
  tests with 0.6.5 (Shopping Center after installing `pyahocorasick`, which two of its tests need).
  `data/people/meta.json` and `data/around.json` carry release 0.7.6 and nothing else new.
- The live site (0.6.4) in Chrome: a hover and a press on EN wrote its words twice (a counter on the link's
  `textContent`); on this tree with Playwright and Google Chrome, the same press wrote them 0 times and opened the English
  page at the same neighbourhood, at 1,440 px and in the phone's menu at 393 px.

## Release 0.7.5 — 27 พ.ย. 2569 (not published)

The owner's words (VERBATIM): 07:09, with his screenshot of ปุณณวิถี's residents map, “คนอยู่ไม่น่าจะข้ามแม่น้ำจากบางกระเจ้า
มาที่ปุณณวิถีได้นะครับ”; on ferries, the option «นับเรือแบบหน้าศูนย์การค้า» (D-18, between 08:31 and 08:40); 08:57 “เรือขนได้
16,000 คนเลยเหรอ” (the river line now says the distance is measured through the crossing). The rule and the counts are in
`DATA_METHOD.md` §17.

### Data (container, 27 Nov; second build after the independent review)

- `scripts/crossing/rivers.py` on `thailand-261124.osm.pbf` (SHA-256 `62b496bf…2d24`, outside the repository): 1,277 named
  ways, 42 gap ways, 29 mouths, 3,264 crossings; the cache (SHA-256 `cd1e1442…69fc`) outside the repository.
- `scripts/crossing/parity.py` against `montri-th/shoppingcenter` `data/crossing/`: 267 centres; 73,187 of the 73,460
  published cells across a river found (99.63 %), 229 more here; distance equal to 10 m 94.50 %, within 20 m 99.55 %,
  294 farther, 35 reached through a crossing on one side only — the same numbers again after the home-bank change below
  (a centre is a point: it takes the bank of its own cell, as before).
- `build-residents.py --reach 5000 --crossing <cache>` (the same 59,219 requests and 62,196 responses as 0.7.3, their
  digest `acdfd81e…b2df` equal), `build-people.py --crossing`, `build-around.py --crossing`: 208 neighbourhoods with land
  across a barrier river in their 5 km map; residents lower than 0.7.3 in 70, 94, 100, 154 and 189 neighbourhoods at
  400 m, 800 m, 1, 3 and 5 km, higher in none; «ขอบเดินถึง»: 178 dataset figures lower in 65 neighbourhoods (222 values),
  none higher; `data/around.json` `meta.release` 0.7.5. The straight figures the build keeps — inside (469) and `st`
  (1,117 values over 400 m to 5 km) — equal 0.7.3's.
- ปุณณวิถี within 5 km: 453,771 in a straight line, 18,777 of them across the Chao Phraya, 16,588 counted through the
  crossings (the distance of 15,494 measured through เรือข้ามฟากวัดบางน้ำผึ้งนอก - วัดบางนานอก, way 40346702): 451,583.
  Built with `--crossing-kinds no-ferry --only CMN-TH-FC9F0B73B3` for the owner's question: 0 counted, 434,994 (not
  published).

### The independent review (27 Nov; a fresh agent, read-only) and what was done

- Must-fix: (1) «ขอบเดินถึง» named release 0.6.1 — `build-around.py` takes the page's release, a test holds it; (2) four
  riverside outlines took the far bank as home through a window round their edge — home banks now come from the cells
  inside the outline, slivers under 6 cells or 2 % left out (`banks.py` `_home`), checked on all 469 before the change:
  exactly those four; (3) wrong figures in the records — the counts above are read again from the second build, the 35
  worded as `parity.py` counts it, the crossing marks counted on the map only, `st` described as it is.
- Should-fix done: the map count's name (`acrossInMap`, not “a river within 5 km”); D-13 and D-18 say the scripts are
  this repository's reading of the rule (3,264 crossings against 3,411); stale straight-line words in
  `handoff/PRODUCT_BRIEF.md`, `handoff/around/contracts.json` (an amendment beside the contract's words),
  `handoff/around/README.md`, `llms.txt`, the docstrings and the V7-09 title; rivers listed nearest first, one entry per
  river, an English-only name kept on the Thai page; band 4 and the hatch read one rule in tens of metres (within the
  distance in a straight line, beyond it through the crossings; a rim cell stays band 3), with `map.x.k` carrying the
  straight distance; the records' wording of `u`; the limits of §17.
- Minor done: the crossing exclusions listed in full; diamonds “the nearest, up to 12”; −1 explained; the fold names
  English “… River” rivers and fords; the cache's SHA-256 checked before it is read; `updatedOn`; the README's kinds; a
  crossing the outline runs onto reads “ที่ขอบย่าน” instead of “0 ม.”.
- Not done: the sheet ledger `12_LAYER_RELEASES` row NLR-002 (`around_counts`) still describes straight-line counts; a
  new row waits for the owner's word (the registry is written only on his word). The pre-existing rim cells of
  `CMN-TH-FBBE98C253` past its frame stay filtered out as in 0.7.3.

### Local (container, 27 Nov)

- `npm test`: 228 tests, 228 pass, 0 fail (new in `tests/crossing.test.js`: band 4 ⇔ the hatch's test at 5 km for every
  cell of every map; one entry per river; no river line without a name; the hatch at 1, 3 and 5 km as the rule says;
  the around release).
- Playwright with Google Chrome on `python3 -m http.server` over this tree, cache tag `20261127-r3`, at 5 km, the fold
  opened, after the second build: ปุณณวิถี in Thai 1,440 light, English 1,440 dark, Thai 393 dark and English 393 light;
  สุรศักดิ์ in Thai 1,280 dark; ปากน้ำโพ–ถนนโกสีย์ in English 1,280 light; สายลวด in Thai 393 light; ธานี–ประเวศนคร สุโขทัย and
  CMN-TH-E184AACBEC in Thai 1,280 light. In every case: the tiles residents, visitors, commuters, centres; the residents
  map first; `__citymeterI18n.missing` empty; no element wider than its box; no page error.
  - ปุณณวิถี: “อีกฝั่งแม่น้ำเจ้าพระยา 4.1% ของคนอยู่ใน 5 กม. · วัดระยะผ่าน เรือข้ามฟากวัดบางน้ำผึ้งนอก - วัดบางนานอก (2.1 กม.)”;
    English “Across the Chao Phraya River: 4.1% of the residents within 5 km · measured through Wat Bang Namphueng Nok -
    Wat Bang Na Nok Ferry (2.1 km)”; the fold: about 452,000 through the crossings, 454,000 straight; 3 crossing marks,
    25 hatched cells.
  - สุรศักดิ์: 32 %, measured through a footbridge (750 m), 703,000 against 724,000, 12 marks, 48 hatched cells.
  - ปากน้ำโพ–ถนนโกสีย์: “Across the Ping River and the Chao Phraya River: 43% …”, the bridge of Phahon Yothin Road (1.9 km),
    75,000 against 89,000, 8 marks, 245 hatched cells.
  - สายลวด: 14 %, เรือข้ามฟากพระสมุทรเจดีย์-วิบูลย์ศรี (2.2 กม.), 239,000 against 258,000, 2 marks, 204 hatched cells.
  - ธานี–ประเวศนคร สุโขทัย: “อีกฝั่งแม่น้ำยม 54% …”, สะพานพระร่วง at the edge, 7 marks, 23 hatched cells; CMN-TH-E184AACBEC:
    “อีกฝั่งแม่น้ำน้อย 43% …” (one name; it read “แม่น้ำน้อย และ” before).
- Not checked: the live site (not published), Safari and phone browsers; the basemap does not load in the container, so
  the 3D map was not seen.

## Release 0.7.4 — 27 พ.ย. 2569 (not published)

The owner's words (VERBATIM): 07:15 “ควรจะเรียงลำดับ Resident > Visitor > Commutor และให้มีภาษาอังกฤษด้วย
ตอนนี้คลิกไม่ได้”; 08:23, after each of Claude's two questions, “EN บนเวบผมคลิกไม่ได้”. The release is the order only;
Claude's first reading (English words beside the Thai names, tiles that open their maps; pull request #44 at `b6920fb`)
was taken out before release (D-V9 in `handoff/visual/decisions.json`).

### Local (container, 27 Nov)

- `npm test`: 220 tests, 220 pass, 0 fail (the order of the tiles in every neighbourhood and of the map tabs, the
  residents tab first, in the tests changed by `008749e`).
- Data: only `release` in `data/people/meta.json` changed (0.7.3 → 0.7.4); no other file under `data/`.
- Playwright with Google Chrome on `python3 -m http.server` over this tree, cache tag `20261127-r2`, ปุณณวิถี
  (`CMN-TH-FC9F0B73B3`), Thai 1,440 light, English 1,440 dark, Thai 393 dark, English 393 light: the tiles read
  residents, visitors, commuters, centres, with no control inside a tile; the tabs residents, visitors' places, work and
  study, the residents tab pressed on opening; a pointer click on the visitors' tab pressed it and wrote `f.map=visit`;
  `__citymeterI18n.missing` empty, no tile wider than its box, no page error.

### The EN link on citymeter.pages.dev (0.7.3 live, Claude in Chrome, 27 Nov 08:2x)

- The tab at 1,710 × 875 and same-origin frames at 768 × 1,024, 820 × 1,180, 1,024 × 768, 1,180 × 820, 1,280 × 720,
  1,280 × 800, 1,366 × 768, 1,440 × 900 and 1,536 × 864, ปุณณวิถี: the EN link (`a.lang-link`, 44 × 44 px in the header)
  is the element at its own centre.
- Frames at 393 × 740, 430 × 932 and 375 × 667 (portrait, below 761 px): EN sits in the menu “Commercial District ▾”, in
  the theme row at 147, 65 (44 × 44 px); with the menu open it is the element at its own centre while the note
  «แผนที่แบบเบา» is folded or absent. With the note open (393 × 740; the note opens once per tab when the map stops and
  restarts light), the note's body (8, 50, 377 × 142 px) lies over the menu's first row and its text is the element at
  EN's centre: EN cannot be tapped until the note is folded. Frames in desktop Chrome, not a phone's browser.
- The note and the menu belong to the shared shell (`navigation.css`, `js/shell/launch.js`, `js/shell/header.js`), so
  the fix is a shell release for every demo (D-V9b, open for the owner).

## Release 0.7.3 — live (2026-11-27)

- Merged on the owner's word (06:50, VERBATIM: “merge and publish”): pull request #42, merge commit `2c73636`.
- GitHub Pages: deployment 8098235319 of `2c73636`, success at 06:51 (23:51:20 UTC). `npm run verify:live` against a
  manifest made at `2c73636` (2,835 files, 50,048,951 bytes): 2,765 ok, 0 failed.
- Cloudflare: run 45913366195 (workflow_dispatch 06:51, success 06:52) published `2c73636`; the demo family check passed on
  the site and live; 114 / 114 live checks passed.
- Claude in Chrome on citymeter.pages.dev, cache tag `20261127-r1`: พร้อมพงษ์ in Thai on desktop, 5 km and the residents
  tab: the tile “ราว 565,000 คน ระดับเทียบ 87/100”, the lead “1,503 ช่องที่มี · มากสุด ราว 2,400 คนต่อช่อง”, no names
  overlapping; นิมมาน–เมญ่า in English in a 393 × 740 frame of the same origin (dark), 5 km: the map 363 px, the lead
  “about 860 people per cell”, the tile 147,000 with level 71/100, no names overlapping, `__citymeterI18n.missing` empty;
  zoomed in, roads, rail and the river lie over the residents cells (density.area).

## Release 0.7.3 — 27 พ.ย. 2569

The night run of V7-07 (scheduled 26 Nov 21:30 ICT; the plan as told to the owner: the buildings within 5 km, then the
residents within 1 · 3 · 5 km and the residents map). No answer from the owner on D-16, the guests per year or the
400/800 m barriers was found in the chat or on GitHub before the run; they stay open.

### Data (container, 26 Nov 21:37 – 27 Nov 01:47 ICT)

- `scripts/residents/build-residents.py --reach 5000` (pace 0.25 s, 4 then 8 workers, the same requests): 469 outlines,
  59,219 tile × subdistrict requests over 2,106 subdistricts, 62,196 responses kept by SHA-256 in the cache outside the
  repository; population month 2026-10, the register's total equal to `popCount` in all 2,105 subdistricts that carry
  one; 7,213,960 buildings (638 from parts), none without an estimated floor, no subdistrict without a floor-area total.
  Output 6,259,974 bytes. The plan now takes the subdistricts' extents as one array: for 1 km it gives the 10,697
  requests of the run of 26 Nov exactly, in 0.8 s.
- Against the 1 km file: the figures inside and within 400 m, 800 m and 1 km equal for all 469; every map frame equals
  `data/people/<id>.json` `map.cell`; every neighbourhood has residents within 3 and 5 km (fewest 41, median 61,603, most
  1,010,976 within 5 km, modelled) and a residents map (no empty one).
- People: `scripts/build-people.py` with `--residents <the 5 km file> --context <the context of 0.7.1> --built-on
  2026-11-27`: every file equal to 0.7.2's but the residents at 3 and 5 km, their levels and `map.res` (checked file by
  file); 469 files, 16,156,895 bytes (median 27 KB, largest 122 KB).

### Local (container, 27 Nov)

- `npm test`: 220 tests, 220 pass, 0 fail (new: the university wording and 36/100; the residents map's “ราว”, rounding,
  “ไม่ถึง 10” and “ยังไม่มีข้อมูลอาคารในระยะ 5 กม.”).
- `npm run check:lds -- --lds Landometer-Design-System-v0.9.7.md`: 145 ok, 0 failed. English harvest: 5,785 views, 0 left
  (the legend sentence of the residents map reads “under 10” through `js/lang-en.js`).
- Headless Chrome on the page served locally, the residents tab at 3 and 5 km: พร้อมพงษ์ Thai 1,440 px light, ป่าตอง
  English 1,440 px dark, คลองสาน–ไอคอนสยาม Thai 393 px dark, นิมมาน–เมญ่า English 393 px light, เกาะราชาใหญ่ Thai
  1,280 px light: the tab enabled, the lead with “ราว”, the tile with its figure and level, the provenance with the
  register's month, Building V4 and OpenStreetMap, no name overlapping another, no page error, no Thai left in English.
- Not checked here: the live release.

## Release 0.7.2 — live (2026-11-26)

- Merged on the owner's word (19:54, VERBATIM: “merge PR #41 และ publish 0.7.2”): pull request #41, merge commit `2948e16`.
- GitHub Pages: deployment of `2948e16` success at 19:55. `npm run verify:live` against a manifest made at `2948e16`
  (2,835 files, 43,807,001 bytes): 2,765 checks, all equal at the first fetch.
- Cloudflare: run 45824283714 (dispatched 19:56, success 19:59) published `2948e16`; the demo family check passed on the
  site and live; 114 / 114 live checks passed.
- Claude in Chrome on citymeter.pages.dev, frames of the same origin, cache tag `20261126-r8` in every one:
  หัวหิน–ตลาดโต้รุ่ง in English at a 1,280 px frame (map 325 px): 3 names, none hidden; คลองสาน–ไอคอนสยาม in Thai at
  1,024 px (294 px): 5 shown, 2 hidden (ทางพิเศษศรีรัช, ถ.พระรามที่ 4), all 7 back at 1,600 px (407 px); พร้อมพงษ์ in Thai
  at 820 px (247 px): 7 shown, 1 hidden (สถานีสยาม), all 8 back when widened; พร้อมพงษ์ in English at 360 px (330 px): 8
  names; จอมเทียน in Thai at 393 px (363 px): 5 names. No visible names overlapping by more than 2 px anywhere;
  `__citymeterI18n.missing` empty.

## Release 0.7.2 — 26 พ.ย. 2569

Found on the live check of 0.7.1 (below): the panel draws the round map 250–440 px wide, the build fits the names for
360 px. The page now fits them again at the width it draws (`js/people.js#fitMapNames`, through `watchMapNames` after
every panel render, on every change of the map's size and once the fonts load): a name that would cover an earlier one,
a ring label, the north mark or the outline, or leave the map, is hidden; 2 px of touching is allowed. Data unchanged:
`data/people/` equal to 0.7.1 file by file but the release in `meta.json`.

### Local (container, 2026-11-26)

- `npm test`: 218 tests, 218 pass, 0 fail (new: the fitting, with stand-in elements: a name covering an earlier one, one
  touching by 1 px, one off the map, one on a ring label, one on the outline, one only on a hidden name).
- `npm run check:lds -- --lds Landometer-Design-System-v0.9.7.md`: 145 ok, 0 failed. English harvest: 5,785 views, 0 left.
- Headless Chrome on the page served locally, 7 cases at windows 360–1440 px (maps 247–370 px): no visible names
  overlapping by more than 2 px; หัวหิน–ตลาดโต้รุ่ง keeps its three names at 316 and 325 px; คลองสาน–ไอคอนสยาม hides 2 of
  7 at 295 px, พร้อมพงษ์ 1 of 8 at 247 px; after widening the window to 1,600 px (map 407 px) every name is back.
- Not checked here: the live release.

## Release 0.7.1 — live (2026-11-26)

- Merged on the owner's word (18:46, VERBATIM: “Merge and publish”): pull request #40, merge commit `ed11410`.
- GitHub Pages: deployment of `ed11410` success at 18:47. `npm run verify:live` against a manifest made at `ed11410`
  (2,835 files): 2,765 checks, 2,759 equal at the first fetch; the other 6 answered 503 and were equal byte for byte on a
  second fetch.
- Cloudflare: run 45813787175 (dispatched 18:47, success 18:54) published `ed11410`; the demo family check passed on the
  site and live; 114 / 114 live checks passed.
- Claude in Chrome on citymeter.pages.dev: ป่าตอง in Thai at 1,710 px (light): cache tag `20261126-r7`, the sea, water,
  roads and 5 names drawn, the key and the provenance line with “© ผู้ร่วมให้ข้อมูล OpenStreetMap (ODbL)” and “OpenStreetMap
  24 พ.ย. 2569”; คลองสาน–ไอคอนสยาม in English in a 393 × 740 frame of the same origin (dark): 7 names, the water
  `#18333E`, the provenance in English, `__citymeterI18n.missing` empty; พร้อมพงษ์ in Thai at 393 px: 8 names, none
  overlapping; หัวหิน–ตลาดโต้รุ่ง in English at a 1,280 px window: the map 325 px wide and “Sea” touching “Phetkasem Rd” —
  fixed in 0.7.2 (above). An estimate from the build's character widths (not a browser measurement) put names
  overlapping by more than 2 px on 56 maps at 340 px, 85 at 325 px and 257 at 300 px.

## Release 0.7.1 — 26 พ.ย. 2569

Owner 2026-11-26 17:51 ICT (VERBATIM): “แผนที่รัศมีควรจะมี โครงร่างถนน ทะเล ลำน้ำ กายภาพ ให้ดูแบบเดียวกับ shopping center
ด้วยได้มั้ยครับ”; on the file, “ดึงจาก Mac ของผม (แนะนำ)” (D-17 in `handoff/around/decisions.json`).

### Data (container, 2026-11-26)

- The file: `thailand-261124.osm.pbf` from the owner's Downloads folder, staged with his approval and kept outside the
  repository: 330,871,226 bytes, SHA-256 `62b496bf…2d24`, MD5 `522d459b…8988`, replication timestamp
  2026-11-24T21:21:23Z — the same SHA-256 and MD5 as `montri-th/shoppingcenter@4bb7522` `data/crossing/meta.json` `osm`
  (D-14). The build stops on any other file.
- Context: `python3 -I scripts/build-context-map.py --repo . --osm <the file> --cache <outside> --out <outside>`. One read of
  the extract (21 s): 56,186 ways (47,509 roads, 4,867 rivers, 2,398 rail, 1,412 coastline) and 14,664 water areas near the
  neighbourhoods. 469 maps: the sea on 127, water areas on 445, rivers on 428, roads on 423, rail on 234, stations on 189;
  names: 118 sea, 330 river, 1,132 road, 352 station; no sea dropped at a reference point. Output 4,484,380 bytes,
  SHA-256 `024b42fe…c388`; a second run from the cache and a run with a fresh read give the same bytes.
- People: `scripts/build-people.py` as in 0.7.0 with `--context <that file>`: every file equal to 0.7.0's but `map.ctx`
  (checked file by file), `meta.json` adds `context` (the source, the counts, no frames) and release 0.7.1. 469 files,
  9,961,659 bytes (5,513,843 before; median 14 KB, largest 91 KB).

### Local (container, 2026-11-26)

- `npm test`: 217 tests, 217 pass, 0 fail (new: `tests/context.test.js`, 4 tests — the file by SHA-256, the shape and
  name limits of every map, water under and lines over the cells with every cell unchanged and no colour but the
  stylesheet's tokens, the key and the provenance credit; `tests/around.test.js` holds D-17 and the owner's words).
- `npm run check:lds -- --lds Landometer-Design-System-v0.9.7.md` (SHA-256 `d3085cbc…2d96`): 145 ok, 0 failed.
- English harvest (`tests/english-check.mjs 1`): 5,785 views, 0 Thai left but the names (a name OpenStreetMap gives only
  in Thai is kept Thai, `js/lang.js#registerPlaceNames`).
- Headless Chrome on the page served locally: ป่าตอง (Thai 1440 light, English 1440 dark), พร้อมพงษ์ (Thai 393 dark),
  คลองสาน–ไอคอนสยาม (English 393 light), หัวหิน–ตลาดโต้รุ่ง (Thai 1440 light, the work map): maps 365–370 px wide, no name
  overlapping another, a ring label or the north mark, none outside the map; the sea and water `#CFDDE7` light and
  `#18333E` dark, roads `#F6F7F3` on both themes; the key lists only what each map draws; the provenance line ends
  “© ผู้ร่วมให้ข้อมูล OpenStreetMap (ODbL)” and “OpenStreetMap 24 พ.ย. 2569”; `__citymeterI18n.missing` empty in English.
- Not checked here: the live release.

## Release 0.7.0 — 26 พ.ย. 2569

Owner 2026-11-26 14:03 ICT (VERBATIM in `handoff/around/decisions.json` and `handoff/visual/decisions.json`), his question
of 14:13 and his answers of 14:31–14:40 (D-12 … D-15); D-16 is Claude's reading of item 2.4 and waits for his check.

### Data (container, 2026-11-26)

- Residents: `python3 -I scripts/residents/build-residents.py --repo . --cache <outside> --out <outside> --built-on 2026-11-26`
  (reach 0: inside the outlines). Production API read only, paced at 4 requests a second: population month 2026-10, its
  register total equal to `popCount` in all 791 of the 792 subdistricts touched that carry one (0 differ); 3,665 tile × subdistrict requests,
  1,318,420 buildings (262 drawn from parts, with production's GFA weight), none without floors; 7 outlines hold no
  building (“ยังไม่มีข้อมูลอาคารในขอบนี้”). 4,952 responses, the SHA-256 of their list `86006747…` (`meta.residents.responses`);
  output SHA-256 `b2d72d04…b3b5` (kept outside the repository).
- Residents within 400 m · 800 m · 1 km: the same script with `--reach 1000`, 16:14–16:47: 10,697 tile × subdistrict
  requests over 1,063 subdistricts (1,062 with a register figure, 0 differ), 2,879,381 buildings (575 from parts), 12,568
  responses; the inside figures equal the first run's for all 469; the figures grow with the distance for every
  neighbourhood; one outline has no building within 400 m and 800 m. 3 and 5 km wait for the run over 5 km (59,219
  requests, planned for the night).
- Check of the method against the Shopping Center page (`montri-th/shoppingcenter@78cf457`, `data/residents`, 1 km):
  SC-000337 8,887 against 8,858 (+0.32 %) · SC-002835 15,178 against 15,132 (+0.30 %); 13 and 6 buildings fewer. Hypothesis:
  production's buildings changed between the runs (not checked).
- People (rebuilt after the review, see below): `python3 -I scripts/build-people.py --sources <16 pinned demo files> --office <office 8e8d8be> --shoppingcenter
  <montri-th/shoppingcenter@78cf457> --residents <the file above> --built-on 2026-11-26`: 469 files (about 5.4 MB) and
  `meta.json`; the inside figures equal `rows[].m` for every row (the script stops otherwise); the counts at
  400 and 800 m equal `data/around.json` for all 5,747 neighbourhood × dataset pairs; 6 lodging places outside every
  province left out.

### Local (container, 2026-11-26)

- `npm test`: 212 tests, 212 pass, 0 fail (new: `tests/people.test.js`; the glance, the axes' names, the decisions and the
  English harvest updated for 0.7.0).
- `npm run check:lds -- --lds Landometer-Design-System-v0.9.7.md` (SHA-256 `d3085cbc…2d96`): 145 ok, 0 failed (`activity`
  added for the visitors' map).
- English harvest (`tests/english-check.mjs 1`, now with the people files at every scale and map): 5,785 views, 0 Thai left
  but the names.
- Headless Chrome on the page served locally (the map library cannot load here, the panel can): พร้อมพงษ์ in Thai and
  English, 1440 × 900 and 393 × 852, light and dark: the people block, the scale switch and the map tabs write
  `f.reach=3000&f.map=work` and keep the focus on the button pressed; no text in the people block or the axis rows under
  13 px after the `#panel small` override; the map's table fits the panel (365 px at 393 px wide).
- Not checked here: the map on the page (WebGL and the basemap need the live site), the live release.

### Independent review (2026-11-26, a reviewer that did not write the release; read only, on c9e33cc)

12 items: 3 must fix, 7 should fix, 2 groups of minor points. Handled in 137dbdc:

| # | Finding | Handling |
|---|---|---|
| 1 | Missing shown as 0: government staff, university students, rooms and guests where records carry no figure | Fixed: unknown parts are null with `<part>N` = [with a figure, all]; the tile says “ไม่มีตัวเลข (n แห่ง)” or how many carry one |
| 2 | Labels missing on the rows (แบบจำลอง, the star), datasets out of the province dropped from rows | Fixed: labels and stars on the rows; every dataset a row reads that does not reach the province is named |
| 3 | Provenance incomplete (centres, dates, the parts, the map, the axes' line) | Fixed: the people block and the map end with dataset · source · date · boundary; the axes' line names the register and the tourism figures |
| 4 | Wrong words while the people file loads or fails | Fixed: “กำลังโหลดตัวเลขคน” and “โหลดตัวเลขคนไม่สำเร็จ” |
| 5 | A level beside a measured 0; “<10” against “ไม่ถึง 10”; the at-least figure rounded up | Fixed: no level beside 0; “ไม่ถึง 10”; the at-least figure rounded down, without ราว |
| 6 | Counts without units; the Thai liveliness words; “มีครบ”; numbers wrapping from units | Fixed: units of each dataset, neutral words, “มี k จาก n”, number and unit kept together |
| 7 | The whole panel re-renders: folds close, focus lost | Fixed: the same view keeps open folds and the focused control; retry moves the focus to the section |
| 8 | The maps do not name the datasets the province lacks; “–” for a measured 0 | Fixed: named under the map; the table reads 0 |
| 9 | Guests a year, while option A of D-12 says a night | Kept a year (the table's unit; a night needs the length of stay); recorded in D-12 for the owner to confirm |
| 10 | Weak tests | Strengthened: units, labels, province gaps, loading and error states, unknown parts, provenance parts, no level beside 0 |
| 11 | Doc mismatches (792/791 subdistricts, cells beyond 5 km, text sizes, `data/people.json`, MB) | Fixed in DATA_METHOD.md, AGENTS.md, this file and the decisions |
| 12 | `f.map=res` kept while the tab is off; a version promised on a row; an unused argument; ties | Fixed |

## Release 0.6.1 — 26 พ.ย. 2569

Owner 2026-11-26 10:02 ICT, VERBATIM with line breaks shown as “ / ”: “1) ตามที่พี่แนะนำ / 2) ใช้ Building v4 / 3) ผมไม่เห็นรูปร่างพื้นที่ แต่อยากคงไว้ ควรรวมร้านค้าต่างรอบๆตลาดด้วย และควรเชื่อมโยงไปถึงตลาดไอยรา / 4) ผมไม่เห็นว่าต้องกดตรงไหน” — his answers to Claude's questions of about 08:10 (the fourth is about the Yolk session, not this release). `DATA_METHOD.md` §2e.

### Drawing (ICT, 2026-11-26)

- Where: the live demo on montri-th.github.io in the owner's Chrome through Claude in Chrome, OpenFreeMap tiles of build `20261122_124456_pt`, the rule script with the option `cm` and `lightLanduse: ['industrial']`: commit `ce411f8` (SHA-256 `005e4360…`) for the first 48 places of the 8 m drawing, `23a7005` (`6f7fe660…`: the V4 tiles of a box fetched 8 at a time, read in the same order) for the rest, the 40 m drawing and ย่านตลาดไท. Every other outline of the demo was in place, with the 14 outlines of 0.5.0 his first answer keeps (the trimmed one before its trim) and the screen's other codes as 8 m seeds; the seeds list of 141 codes had SHA-256 `83c90ad2…fe9f` and the page reported the same 16 digits.
- A first start at 10:14 without the industrial option was stopped and discarded; the drawing restarted at 10:28 with the options of §2c and §2d.
- Chrome was unreachable from about 10:55 to 11:25 (the computer asleep). Two places failed on a V4 tile (`CMN-TH-35C8354D32`, `CMN-TH-9F7E2ECA26`) and one was half drawn (`CMN-TH-DE7A4EE2C8`); all three were drawn again. From 11:26 each place was kept in the page's storage as it was drawn; from about 12:00 a V4 request in the page had a 20 s limit, then the script's own retries.
- From 8 m seeds: 141 places, 0 errors; export 213,657 bytes, SHA-256 `87750778…e512`: 57 grew alone, 7 shared, 32 into a city's fabric, 13 ran on, 32 unchanged (no seed fell between cells). From 40 m (the 32 unchanged): 19,612 bytes, `56462786…6660`. ย่านตลาดไท with its three limits: 1,065 bytes, `99f71d68…2a87`. Carried out at 13:19–13:21 in parts of 45,000 characters through a second tab of the same site, each part checked against the page's SHA-256 prefix; each joined export matched the page's SHA-256. The two V4 exports are kept privately (they locate codes the registry has not outlined); the market's is in `amendments/`.
- `scripts/rule-outlines.py revise`: the 56 of 0.5.0 as they were; 13 used; 3 set aside; ชุมชนซอยพหลโยธิน 94 trimmed to 298 ไร่, still 1,495 m from its point: waits for his look. V4: 5 within 1 km (4 from the 8 m seed, 1 from the 40 m one; 17 to 158 ไร่), 64 farther (230 to 6,258 ไร่, median about 1,390; 1,015 to 5,904 m, median about 2,075), 34 city, 13 run on, 24 without a building, 1 with too few. ย่านตลาดไท: 1,245 ไร่ over 1,124 V4 buildings, 1,040 m from its seeds: waits for his tick. 140 outlines in `amendments/outline-new-2026-11-26-r2.geojson` (2,119,373 bytes); every drawn outline holds its point (one waiting outline, คลองคาง–ตลาดท่าเรือ, passed 6.6 m off its point once rounded, so its 8 m seed joins it); the build stops on any overlap and found none.

### Local

- Build: `scripts/build-data.py` with the registry export of 2026-11-26 as in 0.5.0 and `--screen amendments/outline-new-2026-11-26-r2.geojson`, nothing held: 469 outlines; the screen 74 drawn, 66 waiting, 88 without an outline. The records shards of the 451 earlier neighbourhoods are unchanged byte for byte; 18 are new. `scripts/build-around.py`: the reference set of 0.4.0 (395) unchanged, release 0.6.1. `scripts/build-logos.py` with the family's checkouts at the commits of 0.5.1: 469 shards, the 451 earlier byte for byte, 6 new files (one University mark over 64 KB lossless saved at WebP quality 90, alpha kept, 49,256 bytes).
- The rebuild of 0.5.1's data, surroundings and logos from the same inputs (with `outline-new-2026-11-26.geojson` and the hold) reproduced every committed file byte for byte before this release's changes.
- `npm test` 196: 196 pass, 0 fail (195 with the pinned counts of 0.6.1, and one new test of the owner's answers).
- `node scripts/check-lds-parity.mjs --lds Landometer-Design-System-v0.9.7.md` (SHA-256 `d3085cbc…2d96`): 130 ok, 0 failed.
## Release 0.6.0 — 26 พ.ย. 2569

Owner 2026-11-26 11:43 ICT, VERBATIM: “ทำตามที่เสนอให้ครบทุกข้อพร้อม publish” — every recommended option of the proposal `02-CityMETER__commercialdistrict-visual-first-panel-proposal__v1__2026-11-26` (his earlier words of the day and Claude's reading of each decision in `handoff/visual/decisions.json`). Branch `release/0.6.0-visual-first` from `2155352` (0.5.1).

### Local (container, 2026-11-26)

- `npm test` 205 / 205 · `npm run check:lds -- --lds Landometer-Design-System-v0.9.7.md` (SHA-256 `d3085cbc…2d96`): 130 ok, 0 failed.
- Headless Chrome at 1440 × 900 and 393 × 740 with touch, light and dark, Thai and English; the map library cannot load in the container, so the panel, the overview and the comparison were walked without the map: สยาม (inside and 800 m), ป่าตอง, ท่าเตียน–ปากคลองตลาด, ปุณณวิถี (English, dark, 400 m), the whole country, กรุงเทพมหานคร, a lens (Luxury Brands), a search and a comparison of four. Every new control at least 44 × 44 px (highlight cards, the axes' dataset buttons and demo links, the matrix's neighbourhood buttons — 42 of them in Bangkok's list at 393 px, narrowest 44 px — and the comparison's chips); a 3 px focus ring on each, and on a matrix cell after the arrow keys moved the focus there (one Tab stop per table in the markup; the readout follows the focus; End goes to the row's last cell); the matrix fits 393 px (scroll width 365 = client width).
- English: `tests/english-check.mjs` renders 1,961 views (every neighbourhood at every distance, with and without the surroundings file, every province's overview with and without a dataset, a comparison) and passes 16,656 Thai texts through the shell's own `translate()`: none left but the names kept in Thai; `window.__citymeterI18n.missing` empty on the views walked in Chrome.
- Measured on the code of 0.6.0 against 0.5.1 (`2155352`), all 451 neighbourhoods at the default view, panel 400 px, dark theme, visible characters without spaces (screen-reader words and closed parts left out), each version with its own stylesheet: median text 2,216 → 2,321 (+4.5 %; p10 −2.0 %, p90 +13.0 %; 101 of 451 shorter), median panel height 2,745 → 2,681 px (−2.9 %; 327 of 451 shorter); by part (medians): head 158 → 142, highlights 108 → 58, what comes together 93 → 108, the axes (the table before) 897 → 906, similar mixes 132 → 415. The 395 of the reference set: +4.3 % text, −2.4 % height. The proposal's mockup gave −5.2 % text and −16.0 % height for the axis cards: its whole-panel figures used a list for the similar mixes (the matrix of §4.5 is longer) and 30 px rows (the real rows are buttons, 44 px); before the review's fixes the code measured +3.1 % and −3.9 % (the units in the key, the visible evidence of a role, the keyboard's words under a matrix).

### Independent review (2026-11-26, before the merge)

An agent that did not write the code reviewed `2155352..5f44bfa` read-only from a snapshot (`npm test` 202 / 202 there): 1 must-fix, 6 should-fix, 5 minor. Claude re-ran its numbers with a script of its own before fixing (397 highlights of ranked datasets below level 75 in 228 neighbourhoods; 43 of 688 ranked cells at LUT index ≤ 6; shopping centres: 79 of 96 neighbourhoods ≥ 10 LUT samples apart between the glance tile and the dot, 70 by ≥ 2 of the five steps; บางลำพู–ข้าวสาร: the tile at sample 39, the dot at level 68.5, sample 27).

- Fixed: the head's few and starred cells keep a dot (in the top corner, beside the pictogram); a level's cell has a hairline edge and none a 2 px outline (on the light theme the level's edge and the outline of none had the same value) · the axes' line of datasets at level ≥ 75 reads “ระดับสูง:” — “เด่น” stays the highlights' word (D-V2), a different rule · every number of the fingerprint's key and of its image name carries ชุด / datasets · a role's evidence is visible, not only in a title · a matrix is one Tab stop and the arrows move through its cells, writing the readout (`js/app.js#matrixKeys`) · tests: the dots' colours are now checked (688 dots, the old pattern matched none), the highlight cards hold INV-03 and INV-04, `midPct` by fixed cases, the answer line where it must show, the roles' evidence, and the English page (`tests/english.test.js`); each new check was broken on purpose once and failed · `.mx-who` at least 44 px wide · one ink function (`js/scales.js#inkFor`) · the key's “thick ring” only where a ring is drawn · a matrix's sub-row spans from the corner · an axis's section and list named by the axis alone.
- Open for the owner (D-V1e, `handoff/visual/decisions.json#openForOwner`): the glance «ในย่านนี้» (0.4.0, its reference set by D-8) and the axes' dots colour a dataset on the same count LUT from two values. D-V1c named the fingerprint, the matrix, the comparison and the axes, not the glance, so this release keeps both.

## Release 0.5.1 — 26 พ.ย. 2569

Owner 2026-11-26 06:14 ICT, VERBATIM: “เช็คหน่อยว่า โลโก้ขึ้นหรือยัง ใน web demo ทุกๆ dataset รวม transit ด้วย / เรื่องโลโก้นี้ ให้แสดงใน Commercial district ในลักษณะเดียวกับ venue ด้วย โดยเฉพาะ venue และ POI สำคัญ / แก้จุดที่แก้ง่ายก่อน / ติดตรงไหนให้ข้ามก่อน แล้วทำข้อเสนอปรับปรุงมาเป็นข้อๆเป็น .md”; on merging and publishing (answered before the merges at 08:45 ICT): “Merge และ publish ทั้งสาม (Recommended)” (with Transit 0.4.0 and Office 0.6.0).

- Logos beside the names (`DATA_METHOD.md` §13): pull request #30 merged as `862069c` after main's own 0.5.0 (#31) was merged into it — the logos release took 0.5.1, cache tag `20261126-r3`, and its shards were rebuilt on the 451 neighbourhoods: 3,186 of 12,975 records inside the outlines, 163 of 537 centre names around them (73 of 270 distinct centres), 452 files, 0 SHA-256 issues; `npm test` 195 / 195.
- GitHub Pages deployment of `862069c` succeeded; publish run 45738071278 assembled the site at 01:47:33 UTC (`/release.json`: commercialdistrict `862069c` 0.5.1 `20261126-r3`, transit `76d4f83` 0.4.0, office `0cb883c` 0.6.0).
- `npm run verify:live` (manifest 2,286 files, commit `862069c`): 2,225 ok in each of two runs; the one other file answered GitHub Pages 503 once in each run (`data/building-units/PKN.json`, then `assets/logos/5a58da17d7253e917d1c.svg`) and matched its SHA-256 on a direct retry.
- On citymeter.pages.dev in the owner's Chrome, 26 พ.ย. 2569 08:49–08:52 ICT, desktop, light theme: ย่านสยาม opens on Luxury Brands — the 6 names on the map all carry their logo, every image loaded (Richard Mille, Greyhound, Frank., Freitag, Gentlewoman, and Rolex on “SIAM SWISS”, a Rolex point of sale of the Luxury Brands data); Grocery 10 / 10 names with a logo; Shopping Center: Siam Discovery, Siam Paragon, Siam Center and MBK Center with their logo, Siam Square without one (no venue logo in the family); «รอบย่านนี้» shows 4 centre logos. In English (`lang=en`): 6 / 6 names with a logo, 4 centre logos, `__citymeterI18n.missing` empty.
- Seen, not fixed: the Siam Center name overlaps the neighbourhood's own name chip a little (the record labels avoid the map's controls and the pins, not the area chips); Siam Discovery's light grey logo reads faintly on its `#E5E9E6` plate (Shopping Center's venue registry; proposal P11 of `02-CityMETER__logo-coverage-audit-and-proposals__v1__2026-11-26`).
- Not verified: 393 px on the live site (checked locally at 393 px, light and dark, before release), a real phone, browsers other than Chrome.

## Release 0.5.0 — 26 พ.ย. 2569

Owner 2026-11-26 06:09 ICT, VERBATIM: “ลุยตามพี่แนะนำเลยครับทุกข้อ” — Claude's four next steps: check the names of round 9 against Google Maps (read only), draw the outlines of the 228 new codes by his rule, make the Yolk import pack, update the web and merge pull request #25 once it reads the renamed tabs. Pull request #25 merged first (`d4393a0`). This release: branch `release-0.5.0-screen-areas` from `d4393a0`.

### Drawing (2026-11-26)

- Where: the live demo on montri-th.github.io in the owner's Chrome through Claude in Chrome, with the rule script of §2c (`scripts/draw-outline-rule.browser.js`, OpenFreeMap tiles of build `20261122_124456_pt`) and every other outline of the demo in place, seeded from the list of 228 codes (SHA-256 `51e04360…693f`; the page reported the same first 16 digits).
- From 40 m seeds: 228 places, 0 errors; export 118,493 bytes, SHA-256 `759ad29a…18fb`, carried out 06:53–06:57 ICT (the page stamps `drawnOn` with the UTC date: 2026-11-25 for a drawing before 07:00 ICT). From 8 m seeds: 228 places, 0 errors; export 111,748 bytes, SHA-256 `2dc47d3f…0cbd`, carried out 07:14–07:17 ICT. Each came out of the page byte for byte (gzip and base64 in 3,000-character slices, each slice checked against the page's SHA-256 prefix); both are in `amendments/`.
- Basemap check: at ตลาดแม่กลอง, one of the places left without buildings, the z14 tile had loaded in the page and holds 4 building features; the tile at สยาม holds 149. The places left without an outline lack OpenStreetMap buildings; their tiles did load.
- `scripts/rule-outlines.py new`: 56 apply (44 from the 8 m seed, 12 from the 40 m one), 17 review (over 1 km), 134 without a building (ย่านตลาดไท among them, held), 8 with too few (the 40 m outline under 2.5 times its circle), 8 city, 5 run on. All 73 drawn outlines hold their reference point; the build stops on any overlap and found none.

### Local

- Build: `scripts/build-data.py` with the registry export of 2026-11-26 (SHA-256 in `meta.registry`), the bundle as before, `--screen amendments/outline-new-2026-11-26.geojson`: 451 outlines; the counts inside the 395 earlier outlines are unchanged (`c`, `m`, `s` and areas equal to 0.4.1 row by row); ranks and highlights move with the larger universe. `scripts/build-around.py`: the reference set of 0.4.0 kept (its SHA-256 checked), 5,533 cells. The same script run on 0.4.1's data (`d4393a0`, built-on 2026-11-25) gave its 395 ring files byte for byte and its `data/around.json` equal apart from `meta.release` and the reference-set note (`meta.referenceSet.rule`, `.added`).
- `npm test` 191: 191 pass, 0 fail (184 + 7 in `tests/screen.test.js`).
- `node scripts/check-lds-parity.mjs --lds Landometer-Design-System-v0.9.7.md` (SHA-256 `d3085cbc…2d96`): 130 ok, 0 failed.

### Preview (ICT, 2026-11-26)

- citymeter-pages-deploy, dispatched through the GitHub API with preview on, publish off and one override: run 194 (45729126461) at `89bb10e`, 07:29:42–07:30:42, success; the walk found the count sentence below. Run 195 (45729969879) at `3bf5b51`, 07:36:45–07:37:45, success: 18 sources (17 from GitHub Pages, `commercialdistrict` by hand), 114 / 114 live checks. `preview.citymeter.pages.dev/release.json`: Commercial District `3bf5b51`, 0.5.0, cache tag `20261126-r2`, shell 0.6.4.
- Desktop, Thai, the owner's Chrome (1710 × 819): the whole country reads 451 ย่าน · 212.1 ตร.กม. · 16 ชุดข้อมูล · 77 จังหวัด, the finding 69% of the luxury points of sale (239 of 345) in 0.041% of the country. The filter «ขอบร่างจากผลคัดย่านการค้า»: 56 ย่าน · 5.5 ตร.กม. · 29 จังหวัด; its list 56 rows, each marked «ผลคัดย่านการค้า» and «ใหม่». ท่าน้ำนนท์ (`CMN-TH-A901D04498`): «ย่านจากผลคัดย่านการค้า · นนทบุรี», the badge «ผลคัดย่านการค้า · ขอบร่างตามหลักของเจ้าของ», 77 ไร่ «0.12 ตร.กม. ตามขอบร่างที่วาดตามหลักของเจ้าของ», «ในย่านนี้» levels against 394 and 395 neighbourhoods (D-8), the outline «ขอบร่างตามหลักที่เจ้าของกำหนด วาดจากจุดอ้างอิงของผลคัดย่านการค้า 26 พ.ย. 2569 ทะเบียนยังไม่รับขอบนี้ ยังไม่ตรวจภาคสนาม», the name a draft. Unselected, the outline is dotted; selected, it takes the solid selection line as every outline does.
- Search: ตลาดแม่กลอง finds no outline and the name «ตลาดแม่กลอง สมุทรสงคราม · รหัสกลางจากผลคัดย่านการค้า ยังไม่มีขอบ»; เซ็นทรัลพระราม 2 «… ขอบที่วาดไกลจากจุดอ้างอิงเกิน 1 กม. รอเจ้าของตรวจ»; ตลาดไท only ตลาดไทยศิริ 1 (บ้านโนนขมิ้น), อุดรธานี. ย่านตลาดไท (`CMN-TH-BAFFB5235F`, held) is in neither the rows nor the names. No console error on load.
- Found at run 194 and fixed: the sentence of the data sources listed the registry's 677 codes by parts that added to 676 (the held code unnamed), with a double space. `3bf5b51` names it («· พักไว้รอเจ้าของตัดสิน 1», «1 awaiting the owner's decision») and the test reads the whole sentence; seen in Thai and English on run 195.
- English: the filter chip «Draft outlines from the commercial screen», the legend, the overview, ท่าน้ำนนท์ («Commercial screen · draft outline by the owner's rule», «New in this release») and the names without an outline («central code from the commercial screen, no outline yet»); `window.__citymeterI18n.missing` 0 on each.
- 393 px: a same-origin frame 393 × 740 in the same tab. The first frame opened the light map: the page it replaced never ended (no pagehide), so the shell read a page stopped on screen; with the tab's session mark cleared the frame opens the full map. The harness, not the release. Thai with the screen filter and ท่าน้ำนนท์'s sheet, English ท่าน้ำนนท์: scroll width 393, `missing` 0.
- Seen, not this release's: the hotel dataset names one record «Bed by Boat Hotel & Apartment 2.5 จากทั้งหมด 5.0» (a rating in the name as the source has it); it is listed in ท่าน้ำนนท์.

## Release 0.4.1 — 25 พ.ย. 2569

Owner 2026-11-25 23:01 ICT, VERBATIM: “ทำตามที่พี่เสนอเลยครับ” — Claude's table of 22:21: centre pins on top (D-11), «ขอบเดินถึง» and the service area for round 2 (D-10), pull request #27 first. Pull request #28, head `4088074`, stacked on pull request #27.

### Local

- `npm test` 184: 184 pass, 0 fail (182 + 2 in `tests/venue-pins.test.js`). Mutation checks: with `VENUE_LIFT` 0 the new test fails; with the 0.4.0 naming rule of `labelItems` it fails.
- `node scripts/check-lds-parity.mjs --lds Landometer-Design-System-v0.9.7.md` (SHA-256 `d3085cbc…2d96`): 130 ok, 0 failed.
- No local render: this container cannot reach unpkg.com or tiles.openfreemap.org.

### Preview (UTC, 2026-11-25)

- preview.citymeter.pages.dev, preview mode (never production), override `commercialdistrict` → `4088074`: run 188 (45652099503), run in the owner's Chrome, publish off; assembled 16:15:34, 1 min 0 s, success. Commercial District 0.4.1, cache tag `20261125-r2`, shell 0.6.4; 114 / 114 live checks; the demo family check passed on the built site and live (hub 18, shell 0.6.4).
- The owner's Chrome, desktop, dark theme. ปุณณวิถี (`?at=BKK&f.neighborhood=CMN-TH-FC9F0B73B3`), all view: True Digital Park's pin on top of the pile at its point and named «ทรู ดิจิทัล พาร์ค» beside it. In the page: the centre's pin `sort` 2.5, icon `poi:s4:stack`, three other pins within 15 m, none at or above it. With only the centre's icon swapped for the quiet dot (then restored), the dot showed on top of the pile. The pointer on it lists สำนักงาน (อาคารทรู ดิจิทัล พาร์ค), ศูนย์การค้าและตลาด (ทรู ดิจิทัล พาร์ค), ฟิตเนส (True Digital Park) and ร้านอาหาร (Nittaya Grilled Chicken), then «ตรงนี้มีหลายชุดซ้อนกัน · กดเพื่อดูรายชื่อ», no count.
- Words, Thai: no «รอบย่าน» on the page; the lead «ขอบเดินถึง 800 ม. พบรายการ 10 จาก 16 ชุด»; the section «ขอบเดินถึง» with «ในย่าน · ขอบเดินถึง 400 ม. · ขอบเดินถึง 800 ม.» and the columns «ขอบ 400 ม. · ขอบ 800 ม.»; with 800 m chosen, the dashed line round the outline and the legend «แนวขอบเดินถึง 800 ม.».
- English: «Walkable edge 800 m» in the legend and the buttons, the section «The walkable edge», the lead «walkable edge 800 m: records of 10 of the 16 datasets»; the tip «Several datasets here · Click for the list»; the pin named «True Digital Park»; `window.__citymeterI18n.missing` 0.
- คลองสาน–ไอคอนสยาม (`CMN-TH-97C4FC0AAD`): it opens with its first highlight, แบรนด์หรู, chosen, whose pins stay above the centres (D-11). In the all view its six centres have `sort` 2.5 and are named on the map: ไอคอนสยาม, ไอซีเอส, เดอะ ล้ง 1919 ริเวอร์ไซด์, ตลาดท่าดินแดง, Phaya Mai Market, เดอะไลฟ์เฮ้าส์ เจริญนคร.
- 393 px: two same-origin frames 393 × 740 in one tab, ปุณณวิถี in Thai and English: the centre named beside its pin in both; the page does not scroll sideways (scroll width 393); the sheet's «ขอบเดินถึง» buttons on one row in Thai, two rows in English, nothing cut. The shell fell back to its light map in the frames (three maps in one tab), which is the harness, not the release.

### Not done

- Production: waits for the owner's word on pull requests #27 and #28 and the publish; `npm run verify:live` and the live walk follow.
- Light theme not walked on the preview; not walked on a phone itself.
- This section is the only change after `4088074`; the preview ran at `4088074`.

## Release 0.4.0 — 25 พ.ย. 2569

Owner 2026-11-25 08:15 ICT, VERBATIM: “พี่ช่วยปรับ web demo ตามที่แนะนำเลยครับ / และพี่ช่วยสั่ง ChatGPT ปรับปรุง Google sheet [ทะเบียนย่านกลาง CityMETER] / ตอนนี้ชีทนี้ จัด tab ได้สับสนมาก อยากให้จัดใหม่ให้สะอาดเรียบร้อย ในรูปแบบที่เทียบเคียงเข้ากันได้กับ dataset อื่นๆที่เชื่อมโยงกันใน registry ด้วย / ให้รองรับการปรับปรุงนี้”. The web: the recommended option of each of D-1 … D-9 of the proposal (`handoff/around/decisions.json`). The sheet: below. Built on main after 0.3.0 (`24a3017`).

### Local

- `npm test` 182: 182 pass, 0 fail. `node scripts/check-lds-parity.mjs` against `Landometer-Design-System-v0.9.7.md` (SHA-256 `d3085cbc…2d96`): 130 ok, 0 failed.
- Local renders: Thai and English at desktop and 393 px, light and dark (pull request #26).

### Independent review

- A read-only reviewer rebuilt `data/around.json` byte for byte, recomputed all 4,806 cells in UTM and checked the D-4 rule, the level rule, accessibility and English: 1 must-fix, 4 should-fix, 11 minor, all fixed in `93676c2`. The must-fix: Ekkamai Corner, 0.2 m outside เอกมัย, was listed inside while the table counted it around; it is near at under 1 m now (166 centres inside 93 outlines, 356 pairs near, 256 linked). The last three points of its re-check: `e1ae969`.

### Live (UTC, 2026-11-25)

- The owner at 11:08 ICT, VERBATIM: “merge และ publish”. Pull request #26 merged 04:09:01 as `f72036b`. `npm run verify:live` (GitHub Pages) 04:15:00: 1206 ok, 0 failed. A first pass had 3 mismatches (`PRODUCT_STATEMENT.md`, `js/app.js`, `js/panel.js`) against a manifest built at `93676c2`; rebuilt at `f72036b`, 1206 / 1206.
- citymeter.pages.dev: this session's own access to the publisher was refused twice and not worked around. On the owner's word (11:31 ICT, VERBATIM: “ให้ Claude กด Run workflow publish ใน Chrome”), once he had signed in to GitHub in his Chrome (12:39 ICT), the workflow was run there by hand with publish on: run 185 (45555162326), 51 s, success; release assembled 05:40:32; the demo family check passed on the built site and live (hub = 18, shell 0.6.4).
- Chrome on citymeter.pages.dev, 05:41–05:51: `release.json` names `f72036b`, version 0.4.0, cache tag `20261125-r1`. Bytes against the manifest of `f72036b`, SHA-256 per file: `data/around.json`, `data/neighborhoods.json`, `data/boundaries.geojson` equal; `data/rings/` and `data/records/`, 395 files each, equal as one sha256sum list each (`5548fe62…`, `51f03665…`); `data/condo/` 227 and `data/building-units/` 77, their paths read from the live index files, equal as one list each; the other 81 published files equal as one list (about 06:44, after a first pass on the start of each hash). Three files are rewritten by the publisher's assembler (its README: modules under versioned `r/<digest>/` paths): `index.html` (88 versioned paths, the site's own origin), `js/shell/datasets.js` (the site's origin), `js/shell/launch.js` (the difference not examined). Not served there (served by GitHub Pages): `AGENTS.md`, `README.md`, `amendments/` (6), `docs/BUILD_CARD.md`, `handoff/` (15). The page sends a Content-Security-Policy and `X-Robots-Tag: noindex, nofollow`.
- Desktop, 1710 px window: สยาม in Thai and English — «ในย่านนี้» with four tiles (คนอยู่ ยังไม่ถึงรอบข้อมูล · นักเรียน ไม่พบ, สถานศึกษา 0 แห่ง · ห้องพัก 1,261 ห้อง, ที่พัก 7 แห่ง, with its level · ศูนย์และตลาด 5 แห่ง, with its level), the level line naming 394 and 395 neighbourhoods, the highlights with their links to the demos.
- 393 px: resizing the owner's window to 393 px cut the browser's connection (he brought it back at 13:39 ICT); the walk was then done in a same-origin frame 393 × 852 in one tab. สยาม in Thai (dark, then light) and English (light, then dark), the sheet expanded: «ในย่านนี้» with its four tiles in two columns and the level line; «รอบย่านนี้» with 800 m chosen and the inside column beside it (ที่พัก 7 · 105 · สำนักงาน* 2 · 14 · ศูนย์การค้าและตลาด 5 · 22); in English the three switch buttons wrap to two lines. Scroll width 393 every time; `__citymeterI18n.missing` 0. The demo's theme setting in his browser was put back to «auto», as it was.
- Desktop with `f.around=800`: the line at 800 m round สยาม in long dashes, under the outline, and the map framed to it.

### Registry sheet (ICT, 2026-11-25)

- The owner at 11:08, VERBATIM: “รอบตรวจจบแล้ว จัดแท็บได้” (the condition of D-6: the candidate review no longer writes the sheet). Layout round: ChatGPT (Work mode, the 02 CityMETER project) from the brief `02-CityMETER__neighbourhood-registry-tab-layout-chatgpt-brief__v1__2026-11-25` (Drive, 03_OUTPUTS_AND_EXAMPLES), sent 11:20. It stopped once at its own check on nine display labels of links that still named old tabs (eight open by gid, one a PDF); Claude, who wrote the brief, answered that they are no stop condition, and it went on.
- Read back by Claude (about 11:47) through the sheet's own read-only view: 33 tabs, their names, gids and order as the brief; `00_README` rows 2–36 equal to the brief, row 37 the document-check label; `06_DATA_DICTIONARY` 32 × 6 equal; `12_LAYER_RELEASES` the header only; the other 30 tabs keep their row counts. ChatGPT reported 11,134 formulas checked and 369 references in `04_SOURCE_CROSSWALK` updated by Sheets on the rename (its report, not counted here).
- Ledger rows (NL-S1). The owner at 13:40 chose “ยืนยัน ไม่มีรอบอื่นเขียน”, asked whether any other round would write the sheet before this job reported; the sheet's last change was then the layout round's (11:36:33). Brief `02-CityMETER__neighbourhood-registry-layer-release-rows-chatgpt-brief__v1__2026-11-25` (Drive), built at `f72036b` from the live check above, sent 13:42. ChatGPT reported that its T0 passed and that it stopped, its Sheets tool not writing USER_ENTERED. Claude answered: write RAW, with F and Q as the numbers 46350 and 46351 formatted yyyy-mm-dd. It wrote `12_LAYER_RELEASES` A2:S5 (Drive last modified 13:47:04; its report: a batch update with updateCells and repeatCell) and reported reading 76 of 76 back.
- Claude's read-back (about 13:50) through the sheet's read-only view, as the query endpoint the plan names (gviz) refused it: A1:S5 equal to the brief, 76 of 76 cells (NLR-001 `inside_counts` · NLR-002 `around_counts` · NLR-003 `venue_links` · NLR-004 `glance_levels`, all `serving_derivative`); F2 shows 2026-11-24, F3:F5 and Q2:Q5 show 2026-11-25, all right-aligned as numbers are (that they are date values is an inference; ChatGPT's read gives 46350 and 46351); the 33 tabs keep their row counts but `12_LAYER_RELEASES` (1 → 5 rows) — the other tabs were compared by row count only, and ChatGPT reports it wrote nothing else. The values written are the repository's own (its layer names, files, hashes and dates); no other cell of the registry is quoted here.

### Not done

- The Dataset Registry's sheet map (`R02_SHEET_MAP`) still names this sheet's old tabs; a brief for it waits for the owner's word.
- Not walked on a phone itself: 393 px was a frame in a desktop browser.
- No preview before the publish: the publisher was not attached to this session.
- No registry export made after the rename has been built yet; the build now checks the headers of the columns it reads by position.

## Release 0.3.0 — 24 พ.ย. 2569

Owner 2026-11-24 08:15 ICT, VERBATIM: “ผมอยากให้ดูเรื่องขอบเขตย่าน โดยเฉพาะย่าน ท่องเที่ยวชายหาดเป็นตัวอย่าง ว่า ย่าน ป่าตอง กะตะ กะรน น่าจะคลุมพื้นที่อาคารมากกว่านี้มั้ย อย่างป่าตอง ทำไมไม่นับรวมทุกอาคารในป่าตองเลย อย่างกมลา เราจะเห็นบน basemap เป็นขอบเขตสีดำๆ เราใช้ขอบเขตนั้นมาช่วยกำหนดขอบเขตย่านด้วยได้มั้ย … อยาก apply กับที่อื่นๆ และย่านรูปแบบอื่นๆ ที่ relevant กันด้วยทั้ง dataset นี้”; 08:19 “อย่างป่าตองก็น่าได้ประมาณนี้มั้ย”; 10:12 “ลุยเลย” on a two-layer trial; 13:00, VERBATIM: “แทนขอบเดิมไปเลย เรียบง่ายกว่า” · “ใช้ชื่อป่าตอง” · “แบ่งเป็น 2 ย่าน” · “เลือกใช้แบบ B โดยมี A เป็นขอบนอกสุดอีกชั้นนึงกั้นไว้ไม่ให้เกิน ยกเว้นถ้ามีกรณีพิเศษให้มาถาม” · “ดูย่านอื่นๆทั่วประเทศด้วย ว่าสามารถ apply หลักเดียวกันได้มั้ย ติดตรงไหนให้มาถาม”. The two-layer trial was taken out unreleased (`ce7b1f7`). Built on main after 0.2.6 (`f730ccc`).

### Drawing (2026-11-24)

- Where: the live demo at citymeter.pages.dev in the owner's Chrome through Claude in Chrome, `scripts/draw-outline-rule.browser.js` pasted in the page (SHA-256 `0aad564a…e140`; the fingerprint of its functions in the page, `941f36ae8ef31377`, equals the repository script's).
- Inputs read in the page, each checked by SHA-256: `/commercialdistrict/data/boundaries.geojson` = release 0.2.6's `data/boundaries.geojson` (`106ab3bf…befb3`); `/hotel/data/hotels.json` = montri-th/hotel@7fde352 `data/hotels.json` (`0d63ba36…c107`, check figures only). Basemap OpenFreeMap planet build `20261122_124456_pt`, zoom 14.
- Beach pilot (ป่าตอง, กะรน, กะตะ, กมลา, อ่าวนาง with นพรัตน์ธารา) looked at on the live basemap and sent to the owner as a picture.
- Every neighbourhood with an outline: 395 in 18.9 minutes, none failed. The export (346,432 bytes, SHA-256 `f8cf48d9…10a8`) carried out of the page in eight gzip + base64 parts, each part's SHA-256 checked against the page's, joined and decoded to the same SHA-256: `amendments/outline-rule-2026-11-24.json`.
- Classes (`scripts/rule-outlines.py review`): 197 grew and stopped, 40 split halfway in 19 shared areas, 49 ran to the 2 km box in a city's fabric, 8 ran on at 5 km, 101 unchanged (one of them a gain too small for the trace to keep: อ่าวใหญ่–เกาะพยาม).
- Preview of the amendments with the display copy standing in for the bundle (`amend --display`): 239 outlines, every one only adding area; no overlap with another outline beyond the display copy's own (10 pairs of at least 0.1 m² there, from its simplification); 192 reach at most 1 km from their registry outline (25,204 → about 40,259 ไร่), 45 further (11,017 → about 83,855 ไร่). Nothing from the preview is in the release.
- Review for the owner, in his Drive (03_OUTPUTS_AND_EXAMPLES): the sheet 02-CityMETER__outline-rule-nationwide-check__v1__2026-11-24 (395 rows, a column for his pick) and two pictures from the live demo (four examples; the 45 that reach beyond 1 km, numbered as in the sheet).

### Owner's picks (2026-11-24, 14:47–15:11 and 17:00)

- On options written after the drawing: the 45 → “ให้ผมติ๊กรายย่าน (แนะนำ)”; the 57 of a city's fabric → “คงขอบทะเบียนเดิม (แนะนำ)”; arms along roads and valleys → “คงแขนไว้ตามหลัก (แนะนำ)”. Written into `amendments/outline-rule-choices-2026-11-24.json` (apply 192, pending 45, keep 57), read by `amend --choices`.
- 17:00 ICT, VERBATIM: “ผม update ใน google sheet ให้แล้วพร้อม หมายเหตุ พี่ช่วยศึกษาแล้วมาบอกหน่อยว่าจะปรับยังไงดี”. Read from the sheet (export of 17:2x): ใช้หลักใหม่ 386 rows, คงขอบเดิม 2 (พหลโยธิน 24, วัดเกต–เจริญเมือง), ดูอีกที 7 with notes (หน้านิคมลำพูน–บิ๊กซี, คานหาม–แยกทางเข้าโรจนะ, แบริ่ง–สุขุมวิท 107, ตลาดอินโดจีน–สำราญชายโขง, หอนาฬิกา–ไนท์บาซาร์เชียงราย, ปาย–ถนนคนเดิน, บ่อผุด–ฟิชเชอร์แมนวิลเลจ). Choices file: apply 192, applyTicked 37, pending 8, keep 58, unchanged 100. The 7 were redrawn in the page with his limits (industrial land use as light ground for the two by industrial estates; roads, a corridor and points for four) and shown to him as `02-CityMETER__outline-rule-owner-notes-adjusted__v1__2026-11-24.png`; four questions and the ลาดพร้าว conflict asked at 17:30.
- 17:43 ICT, VERBATIM: “มุกดาหาร ทิศตะวันตกใช้ ไม่เกินโรงเรียนมุกดาลัยแทน” · “ย่านที่เหลือตามที่พี่เสนอได้เลย”. Drawn in the page: มุกดาหาร west of the school ground's west edge (about 810 rai), บ่อผุด with the strip along the whole OSM beach to roads 4169/4171 (about 510 rai); picture `02-CityMETER__outline-rule-owner-notes-round2__v1__2026-11-24.png` (Drive).
- About 18:1x ICT, on two questions: industrial land for every place → “ใช้ทั้งประเทศ ฉลองกรุงคงขอบเดิม (แนะนำ)”; จอมเทียน → “100 เมตรเหนือถนนเทพประสิทธิ์” (drawn: about 2,455 rai, stopping by itself at 2 km, no neighbour's share).
- Drawing all 395 again with industrial land as light ground (19.3 min, no error): 373 identical to the reviewed drawing; 22 differ — 6 noted places on purpose, 15 by industrial land only (drawn again without it they match the reviewed drawing exactly), and จอมเทียน, whose reviewed drawing came from tiles not fully loaded (on complete tiles: 2,835 rai at 5 km, still touching the box).
- The browser extension disconnected at 18:20 and came back with the page's state intact. Export of the 24 places whose drawing or shares changed, with every limit: 70,083 B, SHA-256 3121632c656efd5aabce7f9935a48b81b88db900d3d3b9902ef698396ef8db6e, gzip + base64 pasted into the owner's Drive sheet `02-CityMETER__outline-rule-redraw-export__v1__2026-11-24` and read back as CSV: SHA-256 matched. `amendments/outline-rule-2026-11-24-r2.json` (353,355 B, SHA-256 9d131d49…272c) is the reviewed drawing with those 24 replaced; review step: clean 196, split 40, city 49, runs-on 8, unchanged 102 (the reviewed drawing: 197 / 40 / 49 / 8 / 101 — ตลาดยิ่งรวย–สิรัชชา no longer grows).
- On the registry bundle on his Mac he answered “Try again”: the request for his Downloads folder was refused by the session's automatic check, as before, and was not worked around; he was asked to add the folder in the Claude app (+ › Add folder) or attach the files.
- 18:32 ICT, VERBATIM: “ผมไม่รู้อยุ่ไหน”: the bundle was found in his Drive; the Drive connector stops at 10 MB, so on his word (18:56, VERBATIM: “ทำเลย”) it was downloaded through his Chrome into his Downloads, which he connected to the session himself (20:15, “ต่อครับ”) and from which it was staged.

### Amend and rebuild (2026-11-24, 20:15–20:45 ICT)

- Inputs, each checked against release 0.2.6: the bundle `CityMETER • ทะเบียนย่าน ขอบเขต และหลักฐานล่าสุด.zip` (SHA-256 `f0a93400…3f6f`, as the release read it; its canonical outlines `9d1c1db7…2469`); the registry sheet exported through the Drive connector (`7fc44f7c…4dbc`, read 2026-11-24; aliases and roles as in the release; the 79 admitted codes read back again, `blockSha` `735033…`, the outline review negative exactly for the 37 drawn); the 16 demo clones at the release's commits (their dataset files' SHA-256 as in the release); the condominium research master exported the same way (`34feee42…43e1`, cells as in the release); the previous data release's outlines reproduce the release's 52 “new” marks.
- `scripts/rule-outlines.py amend amendments/outline-rule-2026-11-24-r2.json … --choices …` (1 min 43 s): 235 outlines amended (apply 190, applyTicked 38, applyNoted 7; ตลาดยิ่งรวย–สิรัชชา gains nothing), 3 drawn but kept as the registry's on his word (ฉลองกรุง–ตลาดนครฉลองกรุง, พหลโยธิน 24, วัดเกต–เจริญเมือง). Each only adds area and overlaps no other outline (the script's checks); each names the pick it answers to (`choice`), the drawing it was read from (`drawing`, the one the choices name, by SHA-256; amend refuses another) and, for the 8 he wrote about, his own words (`owner_note_th`). 235 places: 35,626 → 105,377 ไร่. Largest now: ตลาดเมืองศรีสะเกษ–สถานีรถไฟ 692 → 6,633 ไร่, ตลาดโรงเกลือ–บ้านคลองลึก 375 → 5,626, อ่างศิลา 53 → 4,264 (all three ticked by him in the sheet).
- `scripts/build-data.py` (31 s): `amendments/outline-amendments.geojson` `21272d28…c6e0`; 395 outlines, 206.63 km² (95.03 before); 178 files of `data/` change. The 160 places not redrawn keep their counts; their highlights, pairs and ranks move only where a redrawn neighbour moved the comparison; their display outlines are identical but one (พหลโยธิน 24, about 4 m² along an edge shared with a redrawn neighbour). Overview: 69% of the luxury points of sale (239 of 345) in 0.04% of the 77 provinces' area.
- Docs brought to the shipped outlines and the new figures: `README.md`, `PRODUCT_STATEMENT.md`, `llms.txt`, `DATA_METHOD.md` §2 and §11, `handoff/PRODUCT_BRIEF.md`, `IMPLEMENTATION_PLAN.md`, `product-brief.json`, `implementation-plan.json` (the 0.3.0 trial layer they still described never shipped).

### Local

- `npm test` 170: 170 pass, 0 fail, 0 skipped. `node scripts/check-lds-parity.mjs` against `Landometer-Design-System-v0.9.7.md` (SHA-256 `d3085cbc…2d96`, the Project's): 130 ok, 0 failed.
- Chromium through Playwright, this session (basemap tiles blocked here, so the page shows its incomplete-data notice): Thai and English at 1440 × 900 and 393 × 852 for จอมเทียน, บ่อผุด–ฟิชเชอร์แมนวิลเลจ, ตลาดอินโดจีน–สำราญชายโขง, หน้านิคมลำพูน–บิ๊กซี, แบริ่ง–สุขุมวิท 107 and ป่าตอง: the record's outline line reads “… ป่า ทุ่ง น้ำ หรือพื้นที่อุตสาหกรรม …” / “… forest, field, water or industrial land …”, with “และตามขอบที่เจ้าของกำหนด” / “and within limits the owner set” only where he set limits; no page error; no sideways scroll at 393 px, the phone sheet expanded and read in both languages.
- Not yet: the basemap under the redrawn outlines, on the preview.

### Preview (UTC, 2026-11-24)

- At 13:55 the owner found ป่าตอง, จอมเทียน and บ่อผุด still on their old outlines (142, 905, 96 ไร่): the preview had last been assembled on 2026-11-20 17:41 with Commercial District `f730ccc` (0.2.6), as its `release.json` said; nothing had run it with the pull request's head. On his word (“ให้ผมรันเอง (แนะนำ)”) the publisher was attached to the session and run in preview mode (never production) with the override `{"commercialdistrict": "75da6cf005e0927dc115dec1ed2de3cef7942058"}`.
- Run 45409052859 stopped at fetching the sources: HTTP 503 from montri-th.github.io/factory, not this release. Run 45409189636 (13:59:44–14:01): 18 sources, 17 from their latest GitHub Pages deployment and Commercial District `75da6cf` by override; release SHA-256 `27c8eb53…445e`; the demo family check passed on the built site and live (hub = 18, shell 0.6.4); 187 files uploaded, 11,371 already there; 114 / 114 live checks.
- Chrome on preview.citymeter.pages.dev: cache tag `20261124-r3`; ป่าตอง 3,097 ไร่ (ที่พัก 653 แห่ง, the most of the 395), จอมเทียน 2,473 ไร่, บ่อผุด–ฟิชเชอร์แมนวิลเลจ 513 ไร่, each over the basemap with the record's outline line as written (with “และตามขอบที่เจ้าของกำหนด” for จอมเทียน and บ่อผุด).

### Live (UTC, 2026-11-24)

- The owner at 21:49 ICT, VERBATIM: “merge and publish”. Pull request #23 merged as `8ab0a71` (main `f730ccc` was already inside the branch, so main is exactly what the preview showed, plus the record of the preview); GitHub Pages deployment of `8ab0a71` 14:50:14; `npm run verify:live` 803 ok, 0 failed (a first pass had two record shards at HTTP 503, both 200 and equal on the second).
- citymeter.pages.dev: run 45419112203 (14:53:18–14:54:35, publish on): 18 sources from their latest GitHub Pages deployments (Commercial District `8ab0a71`, shell 0.6.4); release SHA-256 `1ef2acc3…b5f2`; the demo family check passed on the built site and live (hub = 18); 2 files uploaded, 11,556 already there (the preview had sent the rest); 114 / 114 live checks.
- Chrome on citymeter.pages.dev: `release.json` assembled 14:53:42 names `8ab0a71`, cache tag `20261124-r3`, data built 2026-11-24; ป่าตอง 3,097 ไร่, “ที่พัก 653 แห่ง — มากที่สุด จาก 395 ย่าน…”, the record's outline line as written. In two same-origin frames 393 px wide in one tab (389 px inside their border): จอมเทียน in English (“2,473 rai”, “… forest, field, water or industrial land and within limits the owner set …”) and บ่อผุด in Thai (“… และตามขอบที่เจ้าของกำหนด …”); no sideways scroll, no unfilled text. The frames fell back to the light map (two maps in one tab), which is the harness, not the release.
- Not done: not walked on a phone.

### Registry sheet (2026-11-24, 21:57–22:03 ICT)

- The owner at 21:57 ICT, VERBATIM: “เขียนบันทึกเลยครับ” (asked whether to note the 235 redrawn outlines in their registry rows as was done for นิมมาน–เมญ่า in 0.2.4).
- Tab «ชื่อกลาง», column G (สถานะขอบกลาง), the 235 rows whose code has a rule amendment: the note is inserted before the row's release tag, as in G109: “เจ้าของให้ปรับเพิ่ม 24 พ.ย. 2569 ตามหลักคลุมกลุ่มอาคาร: คลุมกลุ่มอาคารที่ต่อจากขอบเดิม ภายในพื้นที่ที่แผนที่ฐานไม่ได้ระบุเป็นป่า ทุ่ง น้ำ หรือพื้นที่อุตสาหกรรม[ แบ่งครึ่งทางกับย่านข้างเคียง][ ตามขอบที่เจ้าของกำหนด (…)] — <ไร่ของทะเบียน> → <ไร่ที่วาดใหม่> ไร่ (ขอบปรับใน montri-th/commercialdistrict amendments/outline-amendments.geojson) รอรับในรุ่นถัดไป”; the limits named for the 6 places that have them.
- How: read A1:L511 through the sheet's own CSV query in the owner's Chrome; codes and column G equal this morning's export (SHA-256); the column built in the page from the amendments and checked against the block computed here (SHA-256 equal); one paste into G2:G511 through the Name Box (checked at G2 of «ชื่อกลาง» before pasting). Read back: G2:G511 equal to the expected block, 235 cells changed, no other cell of A1:L511 changed, nothing below row 511; G109 (นิมมาน–เมญ่า) as it was. Drive: modified 2026-11-24 15:02:56 UTC by the owner's account.
- Not written: the bundle ZIP, other tabs, the registry's own outlines.

## Release 0.2.5 — 18 พ.ย. 2569

Owner 2026-11-18 17:44 ICT, VERBATIM: “หน่วย เฮกตาร์ ไม่มีคนเข้าใจ ควรใช้เป็นไร่ หรือ ตารางกิโลเมตร จะเข้ากับบริบทไทยมากกว่า”; at 17:57 he chose “1” — release it as 0.2.5 through preview and live as before. Built on main after the 0.2.4 live record (`b4b579e`).

- Code: `js/model.js` (`rai`, `km2Text`, `RAI_M2` in place of `hectares`), `js/panel.js` (list line, area tile and its km² hover text, provenance, comparison head, table cell and header). Data, colours and the shell are unchanged.
- Tests 165 / 165 (`tests/data.test.js`: the formats, no row printing 0 ไร่ or 0 km², no hectare left in the page's sources).
- Local render over the shipped data, Thai and English: นิมมาน–เมญ่า reads “193 ไร่ · 0.31 ตร.กม. ตามขอบที่ปรับเพิ่ม 18 พ.ย. 2569” (“193 rai · 0.31 km² per the outline extended on 18 Nov 2026”); the smallest outline (ขัวมุงท่าสิงห์–ชุมชนเวียงยอง, 472.99 m²) “0.3 ไร่ · 0.00047 ตร.กม. ตามทะเบียน”, where 0.2.4 printed its km² as 0; the overview keeps 95 ตร.กม.; the comparison heads read “194 rai”, “312 rai”, “136 rai”; no hectare in any rendered view.

### Preview (UTC, 2026-11-18)

- preview.citymeter.pages.dev, preview mode (never production), override `commercialdistrict` → `8e1ad2c` (pull request #20): run 44290724765 (11:00:48–11:01:58), 18 sources, 114 / 114 live checks, the demo family check passed on the built site and live (shell 0.6.3); 10 files uploaded, 9,953 already there.
- The owner's Chrome (1,710 × 819, dark): cache tag `20261118-r6`. `?at=CMI&f.neighborhood=CMN-TH-FB55C19EF1`: area tile “193 ไร่” with the hover text “0.31 ตร.กม. ตามขอบที่ปรับเพิ่ม 18 พ.ย. 2569”, the provenance line ending “193 ไร่”; `?at=CMI&cmp=CMN-TH-FB55C19EF1`: the list “1,358 ไร่ · 603 ไร่ · 193 ไร่ · 530 ไร่”, the comparison head “เชียงใหม่ · 193 ไร่”, the table header “พื้นที่ (ไร่)”; English: “193 rai”, hover “0.31 km² per the outline extended on 18 Nov 2026”, provenance “… 193 rai”, the English harvest empty (`__citymeterI18n.missing` = []); no hectare in either language.
- 393 px: the window cannot be resized, so the page was read in two same-origin frames 393 px wide in one tab — Thai dark and English light: the tile reads “193 ไร่” / “193 rai”, no overflow, number and unit never split. The shell fell back to its light map in the frames (two maps in one tab), which is the harness, not the release.

### Live (UTC, 2026-11-18)

- GitHub Pages (the owner's “1” at 17:57 ICT: preview, then live): pull request #20 merged as `f5beb48`; deployment 7881423991 succeeded (created 11:06:13); `npm run verify:live` 799 ok, 0 failed.
- citymeter.pages.dev: run 44291811340 (11:07:41–11:08:34, publish on): 18 sources from the latest GitHub Pages deployments (Commercial District `f5beb48`, shell 0.6.3), 114 / 114 live checks, the demo family check passed on the built site and live; 4 files uploaded, 9,959 already there.
- The live site in the owner's Chrome (1,710 px wide, dark): cache tag `20261118-r6`; `?at=CMI&f.neighborhood=CMN-TH-FB55C19EF1&cmp=CMN-TH-FB55C19EF1`: tile “193 ไร่”, hover text “0.31 ตร.กม. ตามขอบที่ปรับเพิ่ม 18 พ.ย. 2569”, the provenance line ending “193 ไร่”, the comparison head “เชียงใหม่ · 193 ไร่”; English in a frame 393 px wide: “193 rai”, hover text “0.31 km² per the outline extended on 18 Nov 2026”, the English harvest empty; no hectare in either language.

## Release 0.2.4 — 18 พ.ย. 2569

Owner 2026-11-18 17:05 ICT, VERBATIM: “ยอดเยี่ยม ระบบรางเงียบไปนิดครับ แทบมองไม่เห็น ปรับหน่อย / ขอปรับย่าน นิมมาน-เมญ่า เชียงใหม่ ควรรวม ศูนย์การค้า Maya, กาดรินคำ, วิทยาลัยสารพัดช่างเชียงใหม่เข้าเป็นส่วนหนึ่งของย่านนี้ด้วย”. Built on main after 0.2.3 (`bc3c730`).

- Outline: `scripts/draw-outline-amendment.py` from the bundle's `canonical-boundaries.geojson` and the OpenStreetMap ways read through Overpass (osm_base 2026-11-18T10:08:51Z) → `amendments/outline-amendments.geojson`: CMN-TH-FB55C19EF1 265,550.82 → 308,121.72 m², one polygon, no hole, the registry outline wholly inside; Maya, Kad Rin Kham, the college campus and The Wall 0 % outside the display outline; no registry outline within 1.2 km; the lodging draft ช้างเผือก–เสริมสุข 13.36 m away (13.4 m from the registry outline), overlap 0.
- Data: a rebuild with the 0.2.1 inputs and no amendment reproduced the shipped data byte for byte (only `rail.json` and `building-units/` are not the build's); with `--outline-amendments` only `neighborhoods.json`, `boundaries.geojson`, `build-report.json` and `records/CMN-TH-FB55C19EF1.json` change: six records inside (SC-015705, SC-015704, CAM-O-0e17daca5f3e17, f22dde57, POS-a75590100646, PHO-48d82bc21b7dc7d2), area 94.99 → 95.03 km², 147 other rows keep their counts with ranks or highlight strengths moved by the new peer.
- Code: `js/rail.js` (ink `--text-secondary`, `RAIL_WIDTH`), `styles.css` (legend swatch, tip marks), `js/panel.js` (`amendmentOf`, outline line, area tile, provenance), `js/app.js` (legend words), `scripts/build-data.py` (`--outline-amendments`). Tests 164 / 164 (`tests/amendment.test.js` new, a rail legibility test, one overview fixture 237 → 238). LDS parity 130 ok, 0 failed (LDS 0.9.7 file SHA-256 `d3085cbc…2d96`).
- Local, on the real map with the basemap stubbed: TH and EN × light and dark — the outline line, area tile and provenance read as written; rail paint `#5F635A` light, `#C4CECA` dark.

### Preview (UTC, 2026-11-18)

- preview.citymeter.pages.dev, preview mode (never production), override `commercialdistrict` → `67bf57f` (pull request #18): run 44286014114 (10:30:14–10:31:17), 18 sources, 114 / 114 live checks, the demo family check passed on the built site and live (shell 0.6.3).
- On the real basemap, the owner's Chrome (1,710 × 819): cache tag `20261118-r5`. Bangkok in plan at zoom 12 and 15, light and dark: the rail reads apart from the roads (dark grey on white roads in light, light grey on dark roads in dark) and stays under the coloured outlines. `?at=CMI&f.neighborhood=CMN-TH-FB55C19EF1`: plan (light, Thai) and 3D (dark, English) both frame the extended outline across Huay Kaew Road with Rincome night market and NightOut Market inside; the panel reads “ฉบับร่าง ปรับเพิ่ม 18 พ.ย. 2569 ให้รวมเมญ่า กาดรินคำ The Wall และวิทยาลัยสารพัดช่างเชียงใหม่ ตามหลักเกณฑ์ขอบย่าน รอทะเบียนรับในรุ่นถัดไป ยังไม่ตรวจภาคสนาม” and in English “draft, extended on 18 Nov 2026 to take in Maya Lifestyle Shopping Center, Kad Rin Come Night Market, The Wall and Chiang Mai Polytechnic College under the registry's outline rules; awaiting the registry's next release; not yet walked”; nothing left in Thai. The theme switch was set back to the reader's “auto”. Not walked at 393 px.

### Live (UTC, 2026-11-18)

- GitHub Pages (the owner's “Merge และ publish เลย”, answering the preview report; he also kept The Wall in the outline): pull request #18 merged as `83255fd`; deployment 7880840695 succeeded (created 10:39:09); `npm run verify:live` 799 ok, 0 failed.
- citymeter.pages.dev: run 44287626174 (10:40:31–10:41:24, publish on): 18 sources from the latest GitHub Pages deployments (Commercial District `83255fd`, shell 0.6.3), 114 / 114 live checks, the demo family check passed on the built site and live; 2 files uploaded, 9,961 already there from the preview.
- The live site in the owner's Chrome (1,710 px wide, dark): cache tag `20261118-r5`; `?at=CMI&f.neighborhood=CMN-TH-FB55C19EF1` opens the extended outline in 3D at zoom 16.35 with Rincome night market and NightOut Market inside, the first highlight ศูนย์การค้าและตลาด 4 แห่ง (23rd of 395), the outline line, area tile and provenance as on the preview; rail ink `#C4CECA`, widths 1.4 / 2.2 / 3.2 / 4.6 px; Siam in English at zoom 15.62 with the 8 rail layers, the legend “Rail”, nothing left in Thai. Not walked at 393 px.
- Registry sheet (the owner's “เขียนบันทึก”): tab ชื่อกลาง, row 109 (`A109` = CMN-TH-FB55C19EF1, checked in the Name Box before writing), column สถานะขอบกลาง (`G109`) only: the note goes before the outline version, as the sheet's other notes do — “ขอบร่างปิดตามแนวจริง — ไม่ทับย่านอื่น • เจ้าของขอปรับเพิ่ม 18 พ.ย. 2569: รวมเมญ่า กาดรินคำ The Wall และวิทยาลัยสารพัดช่างเชียงใหม่ ข้ามถนนห้วยแก้ว (ขอบปรับใน montri-th/commercialdistrict amendments/outline-amendments.geojson) รอรับในรุ่นถัดไป • 2026-11-15-context-2”. Pasted through the owner's Chrome (skill `edit-google-sheet-of-record`) and read back: the cell's SHA-256 matches the text written (265 characters), and of the tab's 511 lines only line 109 changed, in that one column.

## Release 0.2.3 — 18 พ.ย. 2569

Owner 2026-11-18 15:32 ICT, VERBATIM: “ในแผนที่อยากให้แสดง สถานีและแนวเส้นทางระบบรางเพิ่มเติม เพื่อให้เห็น context และการเชื่อมโยงรอบๆและระหว่างแต่ละย่านการค้า ใน visual อาจจะให้ quiet กว่าตัวย่านการค้าเล็กน้อย”; 15:43: “เวลาเลือกย่านควรต้อง zoom to fit ในแผนที่ด้วย”. Built on main after 0.2.2 (citymeter-shell 0.6.3, merged by the family sync at 07:57Z).

- Rail data: `scripts/build-rail.py` from montri-th/transit @`ad857b0` → `data/rail.json` (104,660 bytes): 17 lines (10 in service, 7 under construction; 16 with an alignment), 305 station rows (195 · 106 · 4 not confirmed), 18 interchange groups, 176 national stops. `data/transit.json`, `data/rail-lines.geojson` and `data/layer-srt.json` are byte-identical at `25711bc` (the commit the dataset สถานีราง was built from) and `ad857b0`; `transit.json` SHA-256 `0916636a…bb18` equals the dataset's own (`tests/rail.test.js`).
- Code: `js/rail.js` (new module, in the import map), `js/app.js` (rail load and install on every style; station tip; legend item; `fitNb` through the shell's `fitBuilding`; the phone sheet opens before the fit and is read at rest), `js/layers.js` (`framePoints`, `convexHull`, `FIT_*`), `index.html`, `styles.css`, `js/lang-en.js`; `js/panel.js` (the lodging provenance link points at §2a). Tests 160 / 160 (`tests/rail.test.js`, `tests/frame.test.js` new). LDS parity 130 ok, 0 failed (LDS 0.9.7 file SHA-256 `d3085cbc…2d96`).
- Local, on the real map (MapLibre 5.6.2 from the local copy with the pinned SRI hashes; the basemap stubbed — this sandbox cannot reach the tile host — so streets, the OpenStreetMap railway and map text do not draw here):
  - Framing, share of the free map the outline takes (the larger of width and height), before → after, desktop 1440 × 900 / phone 393 × 852: 3D desktop 0.04–0.42 → 0.23 (68 m outline, held at the 200 m view) and 0.73–0.77; plan desktop 0.07–0.89 → 0.31 and 0.74–0.78; 3D phone 0.02–0.48 → 0.12 and 0.76; plan phone 0.05–0.66 → 0.28 and 0.76. Every outline wholly inside the free map before and after, also when the phone's sheet was closed before the tap. Six outlines from 68 m to 2,965 m across.
  - Rail: layer order lines and dots between the basemap's roads and the 3D buildings, squares and names above the buildings under the basemap's labels, the neighbourhood outlines on top; the basemap's `rail` and `transit` hidden; light and dark, desktop and 393 px; the tip at Sukhumvit (MRT) reads “สุขุมวิท · MRT สายสีน้ำเงิน · เชื่อมกับ อโศก (BTS สายสุขุมวิท) ตามผังเครือข่าย” and in English “Sukhumvit · MRT Blue Line · Connects with Asok (BTS Sukhumvit Line) on the network map”; the map credits carry the rail line.
  - English harvest (national, Bangkok, Siam, Siam under สถานีราง, lodging, a comparison): nothing left in Thai, no page error.

### Preview (UTC, 2026-11-18)

- preview.citymeter.pages.dev, the family's publisher in preview mode (never production) with the override `commercialdistrict` → the pull request's head: run 44274008705 (09:14:07–09:14:56, `7bf7965`) and run 44274480583 (`f4203b2`): 18 sources, 114 / 114 live checks, the demo family check passed on the built site and live (shell 0.6.3).
- On the real basemap, the owner's Chrome (1,720 × 819, dark): cache tag `20261118-r4`; Bangkok at zoom 12.4 draws the OpenStreetMap railway (12 pieces in view), 16 urban line pieces, 92 stations and 17 national stops, the basemap's `rail` and `transit` hidden, the legend's ระบบราง shown; Siam opens framed in 3D at zoom 15.71 with the station names สนามกีฬาแห่งชาติ and สยาม drawn; the tip at Asok reads “อโศก · BTS สายสุขุมวิท · เชื่อมกับ สุขุมวิท (MRT สายสีน้ำเงิน) ตามผังเครือข่าย” — “ตามผังเครือข่าย” wrapped at `7bf7965` and stays on one line at `f4203b2`.

### Live (UTC, 2026-11-18)

- GitHub Pages (the owner's “Merge และ publish เลย”, answering the preview report): pull request #16 merged as `5daef49`; deployment 7879454269 succeeded (created 09:35:46); `npm run verify:live` 797 ok, 0 failed (the first pass had two 503s on `data/records/CMN-TH-CE586C2DBC.json` and `CMN-TH-X6FC536C3BF.json`; the rerun was clean).
- citymeter.pages.dev: run 44277784553 (09:38:14, publish on): 18 sources from the latest GitHub Pages deployments (Commercial District `5daef49`, shell 0.6.3), 9,962 files, 114 / 114 live checks, the demo family check passed on the built site and live; 2 files uploaded, 9,960 already there from the previews.
- The live site in the owner's Chrome (1,720 px wide, dark): cache tag `20261118-r4`; `?f.neighborhood=CMN-TH-0001` opens Siam framed in 3D at zoom 15.79 with the 8 rail layers, the station names สนามกีฬาแห่งชาติ and สยาม, the basemap's `rail` and `transit` hidden and the rail credit first in the map's credits; in English, ตลาดพลู opens framed at zoom 16.49, the legend reads “Rail”, the credits read “Rail: CityMETER Transit 31 Oct 2026, from OTP GTFS (CC BY 4.0) and OpenStreetMap (ODbL)”, nothing left in Thai. Not walked on the live site at 393 px (the window kept its width); the phone framing was measured locally with the same map code (above).

## Release 0.2.1 — 18 พ.ย. 2569

Owner 2026-11-18 14:08 ICT, VERBATIM, answering three questions of the 0.2.0 report: “1 publish / 2 update เป็นย่านในทะเบียน / 3 อัปโหลดไฟล์ใหม่ชื่อเดิมแล้วทิ้งไฟล์เก่า”; then, asked how many of the lodging screen's 79 new areas the registry should admit and how the demo should follow: “ทั้ง 79” and “ปรับและ publish เลย (แนะนำ)”.

- Registry (the sheet itself, through the owner's Chrome, skill `edit-google-sheet-of-record`): tab `ชื่อกลาง` rows 433–511 appended after its 431 rows — 79 rows × 12 columns (854 cells with a value): code `CMN-TH-<hex>` for the screen's `LP-NEW-<hex>` (no collision), name and province of the screen, name source “ร่างชื่อจากผลคัดย่านที่พัก”, the proposal id as linked source id, outline status (37 “ขอบร่างจากผลคัดย่านที่พัก — รอตรวจตามหลักเกณฑ์ขอบย่าน”, 9 of them with “ผลคัดยังพักไว้: หลักฐานบริการที่เชื่อมถึงยังไม่ครบ”; 42 “ยังพักไว้ — หลักฐานไม่พอปิดขอบ” with the screen's outline review), role “ที่พัก ท่องเที่ยว และวัฒนธรรม” where the screen found a lodging core (64) and “รอประเมินบทบาท” otherwise (15), status “รหัสย่านหลักใช้งาน”. The rows were built in the page from a compact spec and pasted as one block; read back through the sheet's own CSV query, their SHA-256 equals the local one (`52b7164e69d8242a…`, `meta.registry.admitted.rowsSha256`) and row 432 is unchanged; the sheet's table extended to row 511; no validation dialog. Tab `เริ่มที่นี่`: B40 (the lodging row) now ends “บริเวณใหม่ 79 แห่งรับเป็นรหัสกลางแล้ว 18 พ.ย. 2569 ดูแถว «รับย่านที่พักเข้าทะเบียน»” in place of “ยังไม่รับเป็นรหัสหรือขอบย่านใหม่”, and A50:B50 records the admission; both read back exactly. One go-to-range jump left L433 in an empty cell editor; Escape closed it and the read-back of L432:L434 was still exact. Not changed: the bundle ZIP in Drive (its GIS files keep 358 outlines until the registry's next release), the lodging tab and every other row.
- Code: `scripts/build-data.py` (`--admitted`, `--admitted-on`; the build checks the admitted set is the screen's 79 new areas, the drawn 37 match, no code collides; `meta.lodging.admitted`, `admittedOn`, `aliases`; `meta.registry.admitted`; held codes with `screen: 'lodging'`; totals `codes` 449, `admitted` 79), `js/model.js` (`canonicalId`, the old id in the search, `scopePending` by `screen`), `js/app.js` (filter words; `f.neighborhood` and `cmp` through `canonicalId`), `js/panel.js` (outline line “รับเป็นรหัสกลาง 18 พ.ย. 2569 รอตรวจตามหลักเกณฑ์ขอบย่าน”, held lodging names, totals copy, “ย่านที่พักรับเข้าทะเบียน”), `index.html` (filter ย่านที่แสดง, legend title, help step, description), `js/lang-en.js`, `js/layers.js` (note only).
- Data: the same 395 outlines and counts as 0.2.0; the 37 lodging rows and the 42 held names carry their central codes; `data/records/` renames the 37 shards. Deterministic (PYTHONHASHSEED 1 and 77 give the same bytes).
- Local (Chromium through Playwright, no basemap here): the national view says “ย่านที่พักรับเข้าทะเบียน 37 ย่าน” and “ทะเบียนย่านกลาง 449 รหัส …”; ย่านที่แสดง lists ขอบตามหลักเกณฑ์ทะเบียน (358) · ขอบร่างจากผลคัดที่พัก (37) · ใหม่ในรุ่นนี้ (52); `?f.neighborhood=LP-NEW-0FE7CF185C` opens วัดเกต–เจริญเมือง as `CMN-TH-0FE7CF185C` and rewrites the address; `cmp` with two 0.2.0 ids keeps both; searching บางน้ำจืด lists “รหัสกลางจากผลคัดย่านที่พัก ยังพักการปิดขอบ”; searching `LP-NEW-0FE7` finds the area; English: no missing string in any view (harvest); 393 px: no horizontal scroll; no page error. `npm test` 147 pass, 0 fail · `check:lds` 130 ok · ESLint clean on the changed files.

### Live (UTC, 2026-11-18)

- Preview before merging: run 44260848564 stopped at its first step (an override named `montri-th/commercialdistrict`; the publisher takes the repository's own name); run 44260939066 (07:42:10–07:43:04, preview, override `commercialdistrict` → `dc27903`): 108 / 108 live checks, the family check passed before upload and live. The owner's Chrome, 07:43–07:45: a `release.json` fetched past the cache (assembled 07:42:34) names Commercial District `dc27903`, version 0.2.1, tag `20261118-r2`; the first open still showed the cached 0.2.0 page, the second stayed on its loading card for more than 20 s (console tracking not yet on), the next opened normally: `?neighborhood=LP-NEW-0FE7CF185C` became `?at=CMI&f.neighborhood=CMN-TH-0FE7CF185C`, the outline line reads “ขอบร่างจากผลคัดย่านที่พัก รับเป็นรหัสกลาง 18 พ.ย. 2569 รอตรวจตามหลักเกณฑ์ขอบย่าน ยังไม่ตรวจภาคสนาม”, both lodging areas of Chiang Mai draw dotted under their central codes; the national view says “ย่านที่พักรับเข้าทะเบียน 37 ย่าน ขอบร่างจากผลคัด รับเป็นรหัสกลาง 18 พ.ย. 2569” and ย่านที่แสดง (358 · 37 · 52); searching บางน้ำจืด lists “รหัสกลางจากผลคัดย่านที่พัก ยังพักการปิดขอบ”; no console error.
- GitHub Pages: pull request #13 merged as `26f968f` (07:45:16); deployment succeeded 07:45:59; `npm run verify:live` 795 ok, 0 failed (the first pass had one 503 on `js/breadcrumb.js`; the file answered 200 with 1,359 bytes on a re-fetch and the rerun was clean).
- citymeter.pages.dev (the owner's “ปรับและ publish เลย”): run 44261697746 (07:48:00–07:49:03, publish on): 17 sources, 9,571 files, release SHA-256 `8758c0eb…101a`; the family check passed before upload and on the live site (hub=17, shell 0.6.2, Commercial District `26f968f`); 2 files uploaded, 9,569 already there; 108 / 108 live checks. The owner's Chrome, 07:49–07:50: `release.json` (assembled 07:48:26) names Commercial District `26f968f`, version 0.2.1, tag `20261118-r2`, shell 0.6.2, and all 17 demos on shell 0.6.2; `?neighborhood=LP-NEW-0FE7CF185C` opens วัดเกต–เจริญเมือง as `CMN-TH-0FE7CF185C` with the address rewritten, the outline line above, its badges and three figures, and both lodging areas of Chiang Mai dotted under their central codes; English: no missing string, “37 lodging areas admitted to the registry · draft outlines from the screen, central codes since 18 Nov 2026”, filter “Show”; a 393 × 852 frame: no horizontal scroll, the figures in one column, nothing past 393 px; no console error.

## Release 0.2.0 — 18 พ.ย. 2569

Owner 2026-11-18 13:09 ICT, VERBATIM: “@[ไฟล์ส่งออกทะเบียน] เช็ค [ทะเบียนย่านกลาง] ว่ามีย่านใหม่อัพเดทมาเพิ่มอย่างไรบ้าง แล้ว ปรับ web demo ให้สอดคล้อง และส่งเสริม user's benefit ตาม product statement”. On the lodging screen's 268 proposals (asked: show none, the 189 on existing neighbourhoods, or the 79 new areas too): “2 และ update เป็นย่านในทะเบียน”. Download of the bundle through the owner's Chrome: “เอาเลย”.

- Inputs: the owner's export of the registry sheet (release 2026-11-17-commercial-recovery-9, read 2026-11-18, export SHA-256 `6e233a5a…`); the bundle «CityMETER • ทะเบียนย่าน ขอบเขต และหลักฐานล่าสุด.zip» from Drive (102,984,550 bytes, modified 2026-11-18 05:56 UTC, SHA-256 `f0a93400…`), its outlines restored from the lossless literal with every SHA-256 of the recipe checked (`9d1c1db7…`); the 16 demo repositories at their `main` of 2026-11-18.
- Registry against the data of 16 Nov (Observed fact): 370 codes, none added or removed; 15 held codes now closed (most renamed); 2 still held; 10 collections; the 343 outlines drawn before are the same shapes (131 re-serialised, area and intersection over union unchanged). Lodging screen: 268 proposals (193 supported, 75 held), 189 on existing codes, 79 new areas of which 37 have a review draft, none admitted as a central code; the 37 drafts overlap no registry outline (measured).
- Upstream data changed since 0.1.x: Factory (`data/factories.json`, checked 2026-11-16) and Industrial Estate (`industrialestate/data/estates.json`, 46 → 69 located estates, built 2026-11-17).
- Code: `scripts/build-data.py` (`--lodging`, `--prev-canonical`, `--condo-read-on`; lodging areas appended after the registry's outlines; `rows[].kind`, `added`, `lodging`; pending lodging names), `scripts/restore-bundle-member.py` (new), `js/model.js` (`KINDS`, `kindMatch`, kind in `scopeRows`/`scopePending`), `js/app.js` (`f.kind`, filter, chips, set-kind/clear-kind), `js/panel.js` (lodging screen section with its four-part provenance, kind badges, “ย่านใหม่ในข้อมูลรุ่นนี้”, kind words in lists and the table, totals copy), `js/layers.js` (dotted outline for lodging areas), `index.html` (filter ประเภทย่าน, legend, help step, description), `styles.css` §14, `js/lang-en.js`.
- Data: 395 outlines (358 + 37), 94.99 km², 8,193 records inside; 54 names without an outline (2 held, 10 collections, 42 lodging areas); 395 record shards. The build is deterministic (PYTHONHASHSEED 1 and 77 give the same bytes). Nothing internal of the lodging screen in the data (tests/lodging.test.js).
- Local (Chromium through Playwright, no basemap here): the national view opens with “69% … อยู่ในย่าน 395 แห่ง … 0.018%” and “ย่านใหม่ในข้อมูลรุ่นนี้” (15 + 37); ประเภทย่าน lists ย่านในทะเบียนกลาง (358) · ย่านที่พักจากผลคัด (37) · ใหม่ในรุ่นนี้ (52); “ดูย่านใหม่บนแผนที่” writes `f.kind=added` (52 rows); a lodging area (วัดเกต–เจริญเมือง) opens with its badges and the screen first; นานา shows the screen after “จุดเด่นที่สัมพันธ์กัน”; searching บางน้ำจืด lists the undrawn lodging area with its status; English has no missing string; 393 × 852: no horizontal scroll, the figures in one column; no page error. `npm test` 146 pass, 0 fail · `check:lds` 130 ok · ESLint clean on the changed files.

### Live (UTC, 2026-11-18)

- Preview before merging: run 44252982702 (06:39–06:40, preview, override `5c6924e`) to preview.citymeter.pages.dev; `release.json` names Commercial District `5c6924e`, version 0.2.0, tag `20261118-r1`. The owner's Chrome: the national view opens with “69% … อยู่ในย่าน 395 แห่ง … 0.018%” and “ย่านใหม่ในข้อมูลรุ่นนี้” (15 + 37); วัดเกต–เจริญเมือง (`LP-NEW-0FE7CF185C`) opens with its two badges, buildings inside its outline only, the screen's section (5 and 29 lodging places within 400 and 800 m, 1,016 rooms/units, the services, “ร่างบริเวณใหม่ รอตรวจชื่อและขอบ”) and its provenance; `?at=CMI&f.kind=lodging` keeps the 2 lodging areas of Chiang Mai, chips ย่านที่พักจากผลคัด and เชียงใหม่, filter count (2).
- After the preview, one commit `7d3366c`: in the lodging figures a distance and its unit stay on one line (`nw()` round “400 ม.” and “800 ม.”). Checked locally (`npm test` 146 pass; the three labels whole; one column at 393 px); not on the preview.
- GitHub Pages: pull request #11 merged as `213b73d` (06:42:44); deployment succeeded 06:43:22; `npm run verify:live` 795 ok, 0 failed (the first pass had one 503 on `js/shell/navigation.js`; the file answered 200 with 18,460 bytes on a re-fetch and the rerun was clean). The owner's Chrome on montri-th.github.io, 06:46–06:49: `?neighborhood=LP-NEW-0FE7CF185C` becomes `?at=CMI&f.neighborhood=LP-NEW-0FE7CF185C`, title “ย่านวัดเกต–เจริญเมือง · CityMETER”, every tag `20261118-r1`, the badges “ย่านที่พัก · ขอบร่างจากผลคัด” and “ใหม่ในรุ่นนี้”, the three figure labels each with “400 ม.” or “800 ม.” in one `.nowrap`, the status and the four-part provenance. At zoom 14.1 the layer `nb-line-lodging` draws both lodging areas of Chiang Mai (`LP-NEW-5CAEA7F9C8` ช้างเผือก–เสริมสุข and `LP-NEW-0FE7CF185C`) with dash 0.1/2 and round caps and `nb-line` only registry outlines; ช้างเผือก–เสริมสุข seen dotted on screen; the open neighbourhood's own outline is the solid selection line.
- citymeter.pages.dev: the first production dispatch from the session (about 06:45) was refused by the session's permission check; the owner then answered, VERBATIM, “1 publish” (07:08). Run 44256714066 (07:09:47–07:10:47, publish on): 17 sources, 9,571 files, release SHA-256 `c6b58bd1…af7`; the family check passed before upload and on the live site (hub=17, shell 0.6.2, Commercial District `213b73d`); 5 files uploaded, 9,566 already there (the preview had uploaded the bytes of 0.2.0); 108 / 108 live checks. The owner's Chrome, 07:11–07:13: `release.json` (assembled 07:10:09) names Commercial District `213b73d`, version 0.2.0, tag `20261118-r1`, shell 0.6.2, and all 17 demos on shell 0.6.2; the national view reads “… อยู่ในย่าน 395 แห่ง ที่กินพื้นที่ 0.018% ของประเทศ” with “ย่านใหม่ในข้อมูลรุ่นนี้” and ประเภทย่าน (358 · 37 · 52); วัดเกต–เจริญเมือง from its address opens with its badges, the three figures with “400 ม.” and “800 ม.” whole, the status and the provenance, and both lodging areas of Chiang Mai on `nb-line-lodging`; English (`lang=en`): no missing string, the badges, figures, status and filter in English; a 393 × 852 frame: no horizontal scroll, the figures in one column, nothing of the lodging section past 393 px, the light theme's badge text rgb(95, 99, 90) on rgb(252, 252, 250) (inside the frame the map showed its lighter-map notice: a second map in the same tab); no console error.

## Release 0.1.4 — 16 พ.ย. 2569

Owner 2026-11-16, looking at 0.1.3 on citymeter.pages.dev (23:27 and 23:28 ICT), VERBATIM: “เวลาคลิกย่าน ควรจะเห็น venue ที่ highlighted ก่อนมั้ย” and “กับอาคาร 3d ที่ขึ้นรอบๆผมว่ามันแปลกๆ”. Seen in Chrome on production at Siam before the change: the bar opened on “ทั้งหมด” (every pin alike, no names), and the focus tier rose as a square 2,645 m wide round the neighbourhood (the University rule of a campus's surroundings: max(1,000 m, half the outline's box + 800 m) from its centre; Siam's box is 1,045 × 725 m), wider than the neighbourhood itself.

- Code: `js/records.js#resolveChosen` (new; the bar's “ทั้งหมด” is `ALL`, `f.show=all`), `js/app.js` (`selectNb` clears a pick made elsewhere, `setLens`, `chosenSet`, `subjectRegions` and `massingRegions`: the outline only, the camera's cell an anchor of the fade), `js/regions.js` (`siteContextRegions` and its two figures removed). No data changed.
- Local (Chromium through Playwright, no basemap here): Siam opens with แบรนด์หรู pressed and five names beside its pins, no `f.show` in the address; choosing ร้านอาหาร writes `f.show=restaurant`; opening คลองสาน–ไอคอนสยาม from the panel returns to its own first highlight (แบรนด์หรู); “ทั้งหมด” writes `f.show=all` and stays after a reload; reading by Hotels (`m=hotel`) chooses the hotels; English reads the same; no page error. `npm test` 140 pass, 0 fail · `check:lds` 130 ok · ESLint clean on the changed files.

### Live (UTC, 2026-11-16)

- Preview before merging: run 43909786491 (16:38, preview, override `16504d0`) to preview.citymeter.pages.dev; `release.json` names Commercial District `16504d0`, version 0.1.4, tag `20261116-r5`. The owner's Chrome (dark theme, page 1710 × 871), the same path as the owner: Bangkok → search สยาม → Siam. แบรนด์หรู opens pressed, names beside its pins (Richard Mille Siam Kempinski…, SIAM SWISS Siam Square, GENTLEWOMAN Siam Square…, FREITAG Store Siam by Pronto…), the other sets as small dots; buildings rise inside the outline only; one zoom step out, no block of buildings round it; no failed request.
- GitHub Pages: pull request #8 merged as `bd0c695` (16:41:04); deployment succeeded 16:41:47; `npm run verify:live` 743 ok, 0 failed.
- citymeter.pages.dev: run 43910520250 (16:42, publish on): 108 / 108 live checks; the family check passed before upload and on the live site (hub=17, shell 0.6.2, nothing missing or extra). The owner's Chrome, before 16:44: `release.json` names Commercial District `bd0c695`, version 0.1.4, tag `20261116-r5`, shell 0.6.2; Siam from its address opens with แบรนด์หรู pressed and five names, no failed request.

## Release 0.1.3 — 16 พ.ย. 2569

Owner 2026-11-16 (20:55–20:57 ICT): “จุดในย่าน ตอนนี้คลิกไม่ได้ ช่วยทำให้ click ดูรายละเอียดที่เกี่ยวข้องได้หน่อย และควรแสดงจุด Condominium ด้วย / icon หมุดต่างๆตอนนี้ดูยากมาก สีสัญลักษณ์คล้ายกันเกินไปดูยากมาก มี design ที่ดีกว่านี้มั้ย / หรือ mouse hover ที่หมุดก็ควรมี popup ให้รู้ว่ามันคืออะไร ตอนนี้ใช้ยากมาก / เอา condo จาก dataset ใน registry ไง”. On a draft with a dataset glyph inside each pin (21:21): “icon ใน symbol ที่ทำอยู่ไม่ช่วยเท่าไรนะครับ”; asked for a direction, the owner chose **“เลือกดูทีละชุด (แนะนำ)”**.

- Data: `data/records/` (343 shards, one per closed outline; the counts equal `rows[].c`), `data/condo/` (7,887 points in 227 cells of 0.1°; 328 held and 131 without a point not drawn); `data/points.json` retired. Every count, rank, highlight and pair unchanged from 0.1.2 (rows compared field by field; only the order of a row's pairs changed, now the highlights' order and the same on every run).
- Code: `js/records.js` (new), `js/layers.js`, `js/map-layers.js#installRecordLabels`, `js/app.js`, `js/cues.js` (a second outline behind a pile, a dashed outline), `styles.css` §13. The glyph draft was removed before release.
- Local (Chromium through Playwright, no basemap here), Siam: the bar lists ทั้งหมด, the four highlights, the other sets and คอนโดมิเนียม; choosing แบรนด์หรู draws its pins larger with names (no name over a pin of the set), the rest as dots, writes `f.show`; the pointer names the records at Siam Paragon (luxury only while luxury is chosen); a click lists them; a record card links to its own demo with `?e=`, Google Maps and Street View, and ends with dataset · source · date · boundary. Phone 393 × 852: the card docks under the bar. English and dark theme with the condominium set: names stay as the source writes them, `missing` empty. `npm test` 139 pass, 0 fail.

### Live (UTC, 2026-11-16)

- Preview before merging: run 43888692619 (14:43, preview, override `ca502e7`) to preview.citymeter.pages.dev. The owner's Chrome (dark theme, page 1710 × 871): Siam with แบรนด์หรู chosen — the set's pins with names over the real basemap and 3D buildings; the pointer at Siam Square named TUDOR Siam Square and SIAM SWISS Siam Square; the click listed them; TUDOR's card (นาฬิกา, “เปิดในเดโม Luxury Brands”, Google Maps, Street View, dataset · source · date · boundary) opened TUDOR Siam Square in Luxury Brands on the same origin. คอนโดมิเนียม chosen: 1,153 points round Siam with names; the card of เดอะ รีเซิร์ฟ: 2 อาคาร · 8 ชั้น, appraisal median 137,900 baht/m², P25–P75 135,775–140,625, boundary “พื้นที่ค้นตามแหล่ง วังใหม่, กรุงเทพมหานคร · ไม่นับในตัวเลขของย่าน”. In a 393 × 852 frame of the same origin: the card of After You Dessert Cafe – Siam Center docked under the bar.
- GitHub Pages: pull request #6 merged as `c4cac3a` (14:47); deployment succeeded 14:48:35; `npm run verify:live` 743 ok, 0 failed (a first pass met one transient 503 on one shard, read again with the same bytes).
- citymeter.pages.dev: run 43890465189 (14:53, publish on): 108 / 108 live checks; the family check passed before upload and on the live site (hub=17, shell 0.6.2, nothing missing or extra). The owner's Chrome 14:55: `release.json` names Commercial District `c4cac3a`, tag `20261116-r4`, shell 0.6.2; English with Restaurants chosen: 127 pins, 6 names in view, `missing` empty.

## Release 0.1.2 — 16 พ.ย. 2569

Found on the live 0.1.1 (citymeter.pages.dev, a 393 × 852 frame of the same origin in the owner's Chrome, English, light theme): with the comparison open, “Compare neighbourhoods”, the count and three buttons were wider than the phone, and the last button (“List”) was cut at the right edge (369–411 px of 391).

- Fix (`styles.css`): in the tray header the buttons and the count keep their width and the title and the names give way with an ellipsis.
- Local (Chromium through Playwright), every visible control and heading inside the viewport in the overview, a neighbourhood, the comparison, a lens and the table, Thai and English at 393 × 852 and 360 × 780; the same probe on the live 0.1.1 found the cut button in English (comparison and lens views). `npm test` 131 pass, 0 fail.

### Live (UTC, 2026-11-16)

- GitHub Pages: deployment of `68d9e64` (pull request #2) succeeded 11:59:08; `npm run verify:live` 172 ok, 0 failed. The phone probe on that site, 393 × 852: English clean (the tray header fits); Thai with no control cut. In the table view the headless browser placed map labels at the left edge, under the table; the owner's Chrome on citymeter.pages.dev had shown no label outside the screen with the table open (0.1.1, English, between 11:54 and 11:58).
- citymeter.pages.dev: run 43862544908 (11:59:31, publish on): 17 sources, 8,947 files, release SHA-256 `004a0517…facc`, 108 / 108 live checks; the family check passed before upload and on the live site (hub=17, shell 0.6.2, nothing missing or extra).
- SSO portal (sso-citymeter.pages.dev, which takes four of these demos and the hub): run 43863093244 (12:03, publish off) selected the new production sources, passed its tests, assembled and verified the four-dataset portal; it publishes on its next scheduled run. Not deployed by this release.
- The owner's Chrome once it reconnected, citymeter.pages.dev, 12:09:23–12:09:44: 17 / 17 pages consistent (Commercial District `68d9e64`, 0.1.2, tag `20261116-r3`, key `0204115a…`); in a 393 × 852 frame of the same origin, English, dark theme, the comparison open: “Compare neighbour…”, 3/4, Clear, Collapse and List all inside the screen (List ends at 383 px), no horizontal scroll, no map label outside the screen with the table open, `missing` empty.

## Release 0.1.1 — 16 พ.ย. 2569

Found on the live 0.1.0 (citymeter.pages.dev, the owner's Chrome, page 1710 × 871, after 18:40 ICT): “เทียบ 3 ย่านที่เด่นหลายด้าน” opened the comparison, but the camera framed the three neighbourhoods as if the tray were closed, so the southernmost (กิมหยง–ลีการ์เดนส์, Songkhla) sat under the tray. The legend moves above the tray only after it opens (`syncBottomPanel`, next frame), and the camera read the legend before it moved.

- Fix (`js/app.js`): with the comparison open on a wide screen, `cameraPadding()` frames the strip above the tray and right of the legend (the phone keeps its own rule); opening the tray from its own button frames the compared neighbourhoods again (`openInsights`). Cache tag `20261116-r2`.
- Local (Chromium through Playwright, no basemap here), the compared neighbourhoods' outlines projected with the map: all inside the strip (above the tray, below the toolbar, clear of the legend) after “เทียบ 3” and again after closing and reopening the tray — 1710 × 871, 1540 × 784 and 1440 × 900 for the whole country, 1440 × 900 in Bangkok, 393 × 852. No page error. `npm test` 131 pass, 0 fail; ESLint 0 errors.

### Live (UTC, 2026-11-16)

- GitHub Pages: deployment of `c919bd1` (pull request #1) succeeded 11:51:29; `npm run verify:live` 172 ok, 0 failed.
- citymeter.pages.dev: run 43861441168 (11:51:51, publish on): 17 sources, 8,947 files, release SHA-256 `02227a76…e229`, 108 / 108 live checks; the family check before upload passed. The family check on the live site warned (exit 2): 3 seconds after the upload it still read Commercial District's previous page and its static key `bb4eeb1c…`, a path the new deployment no longer has. Read again 11:53:21–11:53:34: 17 / 17 pages consistent (static key, cache tag, shell 0.6.2, a menu of 17 equal to the hub); Commercial District `c919bd1`, 0.1.1, key `5bf56c45…`, the fix in its `app.js`.
- Desktop, the owner's Chrome, page 1710 × 871: “เทียบ 3” frames the three neighbourhoods at zoom 4.17, all inside the strip (Songkhla's outline ends at 422 px, the tray starts at 470).
- English (`?at=BKK&lang=en`): the overview → ย่านสยาม → similar mixes (4 in the comparison) → the Restaurants lens → the table: `__citymeterI18n.missing` empty.
- 393 × 852 frame of the same origin (391 px inside its border): Bangkok overview in the dark theme with the Aha line and the legend in one dock; ย่านสยาม with its sheet at 34 % of the height, buildings in 3D and its records; no horizontal scroll. Light theme in English with the comparison open: `missing` empty, no horizontal scroll — and the cut button above. The test set the demo's theme back to `auto` in that browser.

## Release 0.1.0 — 16 พ.ย. 2569

From the owner (16 Nov 2026): a demo of the central neighbourhood registry “ในลักษณะเดียวกับ demo web อื่นๆ”, comparing each neighbourhood with the records of every Land · Location · Living demo, published as part of citymeter.pages.dev under Location. Owner's answers the same day: the address `commercialdistrict`; publish the whole set (this repository, the dataset picker of every demo, the hub, the deploy system); the registry's internal fields cut from the public build (`DATA_METHOD.md` §10).

### Local

This container, Chromium through Playwright; no basemap or building tiles here (OpenFreeMap stubbed), MapLibre 5.6.2 from npm with its Subresource Integrity values checked.

- `npm test`: 131 pass, 0 fail. ESLint: 0 errors; 2 warnings, both in `tests/terrain.test.js`, the family's file kept byte-identical to University's.
- LDS parity (`npm run check:lds -- --lds <file>`): 130 ok, 0 failed against `Landometer-Design-System-v0.9.7.md` (SHA-256 `d3085cbc…2d96`): the density.area and count 41-sample LUTs, their anchors and the cue shapes.
- Data (`data/build-report.json`): 370 codes, 343 closed outlines, 17 held without a closed outline, 10 collections; 7,636 located records inside an outline; 16 datasets. `neighborhoods.json` 321,007 bytes, `boundaries.geojson` 1,049,977, `points.json` 227,131. No registry address, export, cell, field question, source id or merge note in any published file (`tests/release.test.js`).
- One walk, 1440 × 900, Thai: search “ท่าแพ” → ย่านท่าแพ–เมืองเก่าเชียงใหม่ (`?at=CMI&f.neighborhood=CMN-TH-4FC0B8E374`) → add to the comparison → similar mixes (4 in the comparison) → the Hotel lens (`m=hotel`) → the province crumb → browser back to the neighbourhood → the table (8 rows) → a neighbourhood opened from the table. No page error.
- English: every view harvested, `__citymeterI18n.missing` empty.
- Dataset picker, citymeter-shell 0.6.2, served at `/commercialdistrict/` as on GitHub Pages, Thai and English at 1440 × 900 and 393 × 852: Commercial District under LOCATION between Camera Shops and Factory, marked as the current page, its link carries `?at=` (and `lang=en` from English); the hub link reads “ดูเดโมทั้งหมด” / “All demos”. No page error.

### Live (all times UTC on 2026-11-16; ICT is UTC+7)

- GitHub Pages: deployment of `8ecbc4f` succeeded 11:10; `npm run verify:live` 172 ok, 0 failed.
- The family release with it (skill `citymeter-demo-family-sync`): citymeter-shell 0.6.2 merged in the 15 other demo repositories 11:31:10–11:32:06 (Industrial Estate inside Factory), the hub (montri-th/CityMETER #32) 11:31:06 and the deploy repository (montri-th/citymeter-pages-deploy #9) 11:31:02; every GitHub Pages build succeeded by 11:33.
- Preview first: run 43857945672 (11:27, the open pull requests as overrides) published preview.citymeter.pages.dev; there, in the owner's Chrome, the overview, ย่านสยาม in 3D with CityMETER Building V4, the Hotel menu → Commercial District (`?at=BKK`) and the hub (17 cards; Land 4 · Location 8 · Living 5) showed no console error.
- Production: run 43858789203 (11:33:26, publish on): 17 sources, 8,947 files, release SHA-256 `74a35a44…acb1`, 108 / 108 live checks; the family check before upload and on the live site: hub=17, shell 0.6.2 everywhere, nothing missing or extra.
- Every page read again from citymeter.pages.dev, 11:40:08–11:40:18: 17 / 17 pages load the static key `/release.json` names, cache tag `20261116-r1`, shell 0.6.2, a menu of 17 with Commercial District in Location and nothing missing or extra against `/demos/demos.json` (17, shell 0.6.2).
- Menus opened on citymeter.pages.dev in same-origin frames, Hotel (Thai, English), Camera Shops (Thai), Restaurants (English), School (Thai), Hospital (English), each at 1440 and 393 px wide: Land 4 · Location 8 · Living 5, Commercial District in Location, 44 px tall, its link keeps the page's `at` (Camera Shops, a province-level page, hands `BKK`) and adds `lang=en` from English; English menus mark the 6 Thai-only demos.
- The live walk found the comparison framing of 0.1.1 above.
- Not verified: a real phone (393 px was a frame in a desktop Chrome), browsers other than Chrome.
