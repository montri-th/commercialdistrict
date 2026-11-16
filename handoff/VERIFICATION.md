# CityMETER Commercial District — verification

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
- Not verified here: the real basemap and building tiles, a real phone.

### Live

Recorded below once the repository, its GitHub Pages site and citymeter.pages.dev carry this release.
