# CityMETER Commercial District — verification

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
- LDS parity (`npm run check:lds -- --lds <file>`): 130 ok, 0 failed against `Landometer-Design-System-v0.9.7.md` (SHA-256 `d3085cbc…6d96`): the density.area and count 41-sample LUTs, their anchors and the cue shapes.
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
