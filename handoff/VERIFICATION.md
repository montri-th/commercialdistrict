# CityMETER Commercial District — verification

## Release 0.1.1 — 16 พ.ย. 2569

Found on the live 0.1.0 (citymeter.pages.dev, the owner's Chrome, page 1710 × 871, after 18:40 ICT): “เทียบ 3 ย่านที่เด่นหลายด้าน” opened the comparison, but the camera framed the three neighbourhoods as if the tray were closed, so the southernmost (กิมหยง–ลีการ์เดนส์, Songkhla) sat under the tray. The legend moves above the tray only after it opens (`syncBottomPanel`, next frame), and the camera read the legend before it moved.

- Fix (`js/app.js`): with the comparison open on a wide screen, `cameraPadding()` frames the strip above the tray and right of the legend (the phone keeps its own rule); opening the tray from its own button frames the compared neighbourhoods again (`openInsights`). Cache tag `20261116-r2`.
- Local (Chromium through Playwright, no basemap here), the compared neighbourhoods' outlines projected with the map: all inside the strip (above the tray, below the toolbar, clear of the legend) after “เทียบ 3” and again after closing and reopening the tray — 1710 × 871, 1540 × 784 and 1440 × 900 for the whole country, 1440 × 900 in Bangkok, 393 × 852. No page error. `npm test` 131 pass, 0 fail; ESLint 0 errors.

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
