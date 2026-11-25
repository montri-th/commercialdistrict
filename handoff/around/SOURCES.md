# «รอบย่านนี้» — แหล่งที่ใช้สร้าง (0.4.0)

ไฟล์ข้อมูลข้างล่างตรวจด้วย SHA-256 ก่อนใช้ และ `scripts/build-around.py` หยุดเมื่อไม่ตรง: 16 ชุดข้อมูลกับค่าที่ `data/neighborhoods.json` ตรึง และ 2 ไฟล์ของ Shopping Center กับ `SC_PINNED` ในสคริปต์ · ค่าเดียวกันอยู่ใน `data/around.json` `meta.sources` · `meta.venues` · `meta.outlines` · `meta.inside` · กติการะดับใน `js/venue-locale.js` ตรวจด้วย test (บรรทัดเท่ากับ `contracts.json`) · เอกสารกำกับไม่อยู่ในการตรวจของสคริปต์

## ข้อมูลในขอบที่จับคู่ด้วย

| ไฟล์ | SHA-256 | ใช้ทำอะไร |
|---|---|---|
| `data/neighborhoods.json` (รุ่น 0.3.0 ไม่เปลี่ยนในรุ่นนี้) | `ffdf4a4daeb26dd51e47e3df4d9af9d4856ac4a22bd8f9b72e788f7b98a3be71` | จำนวนในขอบ `rows[].c` และค่าที่แหล่งบันทึก `rows[].m` |
| `data/boundaries.geojson` | `1e4f6e2a27d1b5cdbcbd4031133f6b94f7467058917174882327d4923d3b876f` | ขอบที่แผนที่วาด ใช้วัดระยะและวาดแนวรอบย่าน |
| `data/records/<รหัส>.json` | ตาม `data/build-report.json` | รายการที่ขั้นสร้างข้อมูลนับในขอบ ไม่นับซ้ำเป็นรอบย่าน |

## 16 ชุดข้อมูลเดโม (ไฟล์ที่ `data/neighborhoods.json` ตรึงไว้)

| ชุดข้อมูล | repository @ commit | ไฟล์ | SHA-256 |
|---|---|---|---|
| ที่พัก · Hotel | montri-th/hotel @ `7fde352` | `data/hotels.json` | `0d63ba36ad5c42ac3dc8f20daa64097425956c33af14030624e7edf50ffec107` |
| นิคมอุตสาหกรรม · Industrial Estate | montri-th/factory @ `2c206d1` | `industrialestate/data/estates.json` | `081dfb90adf8e165bd38d7d51f0b1beed98433b1026b8cf21a41e7db00b122c0` |
| สำนักงาน · Office | montri-th/office @ `d3bcf6b` | `data/offices.json` | `1ffb1bc072cd5f814508b7963fbe1cbaaecb36a591be1f09d08429a8bb346ea4` |
| ศูนย์การค้าและตลาด · Shopping Center | montri-th/shoppingcenter @ `3711e6e` | `data/venues.json` | `e83e3645e34090fc239c2bac8bbd66696f7feb4310af6a63e065614d21eedd8b` |
| ร้านกล้อง · Camera Shops | montri-th/camera @ `a7d211f` | `data/camera.json` | `475be1ead6c4632428a9ebc0e2f56a04f4f6047875225c2f22eee0c856abb2da` |
| โรงงาน · Factory | montri-th/factory @ `2c206d1` | `data/factories.json` | `ca774deb60e30429885cc2d73bec5a6ad796aeeeed1b323d10ded08e6dd1d713` |
| ฟิตเนส · Fitness | montri-th/fitness @ `8e74768` | `data/fitness.json` | `c72bcc31aa8a88155b1cecbfe881aae643094bbbb7af8d95841447557e1155e6` |
| ร้านค้าปลีกของใช้ · Grocery | montri-th/grocery @ `14294f3` | `data/grocery.json` | `33c07b062d5446bce73eb3a8c9f42ddc2e58f807d03ea8fbcfed666a549349c7` |
| แบรนด์หรู · Luxury Brands | montri-th/luxurybrands @ `378e58a` | `data/luxury.json` | `0b05bd3acb5dbc7ad84b77b7da205db866e03104762252c1c521c6b111407471` |
| ร้านยา · Pharmacy | montri-th/pharmacy @ `44da829` | `data/pharmacies.json` | `c188332a6b80c19d1d5198d1d3e361ab3439ad5af7bb77c83384ae07cbcbf13a` |
| ร้านอาหาร · Restaurants | montri-th/restaurant @ `ca24f2f` | `data/restaurants.json` | `a899c5982b0d2ed4febfab8755dd2d28b18c08176f1a260cc67d45a8a3a057ef` |
| หน่วยงานรัฐ · Government Office | montri-th/governmentoffice @ `102839b` | `data/offices.json` | `71c9b832d69efcf4f666599f8fe8caa45e667a878fd3963002f68171feff5d61` |
| สถานพยาบาล · Hospital | montri-th/hospital @ `c6ff706` | `data/hospitals.json` | `008ee921973fbec0bc94776517b9122c67a6548fe56c637f6ee627d6deb99ffb` |
| สถานศึกษา · School | montri-th/school @ `f253f56` | `data/schools.json` | `1d5b5cc4b75a88c7e545892c1298c0b649c22ee52f8d50470e45cb0915f8b611` |
| สถานีราง · Transit | montri-th/transit @ `25711bc` | `data/transit.json` | `0916636a7c50a8832f25c073a9b667bc440ee74aef41bdfe499e663e1cc0bb18` |
| มหาวิทยาลัย · University | montri-th/university @ `f610edb` | `data/universities.json` | `94a98d8ebe495c897d60a1d28dc3b0dd283f048ee231502dee1a08d9ccafa964` |

## ศูนย์การค้าที่มีหน้า «รอบศูนย์นี้»

| ไฟล์ | SHA-256 | หมายเหตุ |
|---|---|---|
| montri-th/shoppingcenter @ `dfcc6cd` `data/venues.json` | `c951d31c800d9b194ab0922624ae101f9fc0d92ff130130ff3c52a4fc2e472c9` | ชุดที่มีส่วน «รอบศูนย์นี้»: countable · status supply · group mall, community or outlet · located (js/venue-locale.js inLocaleSet) · 492 แห่ง |
| montri-th/shoppingcenter @ `dfcc6cd` `data/locale/meta.json` | `275bf644341761f8b4d8b33d123a586eb588e82445933f8fc8e17f099d91cdf3` | รุ่น `venue-locale-shopping-20261120-v0.2.3-rc1` · release_candidate · manifest SHA-256 `01f71879d638585cea74dbfbd26ea3425aff753fc6e500576b0cc0822c39676f` · schema `venue_locale_schema_v1` · ประเด็นที่กันรุ่น stable 12 ข้อ |
| montri-th/shoppingcenter `js/venue-locale.js` @ `dfcc6cd` | `27f3e8585eead076d493df1a210abf21a1c65eae06cfa1b63a5388e3cb90adff` | กติการะดับ `levelOf` และคำของระดับ `LEVEL_WORDS` คัดคำต่อคำลง `js/around.js` |

## เอกสารกำกับ (ไม่แจกจ่ายใน repository)

| เอกสาร | SHA-256 |
|---|---|
| Landometer-Design-System-v0.9.7.md (standalone-0.9.7-r1 · v0.9.7-owner.1 · color-srgb-10) | `d3085cbc0a50195f1cbf0c77b1d77c0d19b84364daf2948eb367348d65432d96` |
| ข้อเสนอ 02-CityMETER__commercialdistrict-neighbourhood-locale-insight-proposal__v1__2026-11-25.md (ภาคผนวก C = `plan.json`) | `plan.json` `d5d37c7c3cbea3ddefb72f14e27cd989fe758f7a2e83ac2fa33de62a51f54f94` |
