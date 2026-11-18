# CityMETER Commercial District — Implementation Plan

รุ่น 0.2.3 · 18 พ.ย. 2569 · คู่กับ `implementation-plan.json` (schema 1.5.0)

## สถาปัตยกรรม

Static site, ES modules ผ่าน import map ที่มี cache tag เดียว · MapLibre GL 5.6.2 (unpkg, SRI) · OpenFreeMap tiles · ไม่มี build step ฝั่งเว็บ · ข้อมูลสร้างด้วย `scripts/build-data.py` (shapely, pyproj, openpyxl, mapshaper)

| โมดูล | หน้าที่ |
|---|---|
| `js/app.js` | ขอบเขต สีบนแผนที่ แผง คำอธิบายแผนที่ แถบเปรียบเทียบ ตาราง กล้อง แผ่นมือถือ ที่อยู่ |
| `js/model.js` | ถอดข้อมูล สถานะของค่า ขอบเขต อันดับ |
| `js/profile.js` | view model: ภาพรวม ย่าน การเปรียบเทียบ ความคล้าย คู่ที่มาด้วยกัน |
| `js/panel.js` | HTML ของแผง บรรทัดที่มา ถ้อยคำสองภาษา |
| `js/layers.js` | ขอบย่าน หมุด จุดในย่าน (ทุกชุดเท่ากัน · ชุดที่เลือกใหญ่ · ชุดอื่นเป็นจุดเทา) จุดคอนโดมิเนียม วงรอบรายการที่เปิดการ์ด กรอบจังหวัด |
| `js/records.js` | (0.1.3) รายการในย่าน: ถอด shard แถบเลือกดูทีละชุด ชื่อข้างจุด ป้ายเมื่อชี้ การ์ดรายการ รายชื่อในแผง จุดคอนโดมิเนียม · (0.1.4) `resolveChosen` เปิดย่านที่จุดเด่นอันดับแรก “ทั้งหมด” = `f.show=all` |
| `js/panel.js` · `js/model.js` (0.2.0) | ผลคัดย่านที่พักของทะเบียนในหน้าย่าน · ป้าย “ย่านที่พัก” และ “ใหม่ในรุ่นนี้” · ส่วน “ย่านใหม่ในข้อมูลรุ่นนี้” ในหน้าประเทศ · ตัวกรองย่านที่แสดง `f.kind` (`KINDS`, `kindMatch`) · (0.2.1) รหัสกลางของย่านที่พัก และ `canonicalId` ให้ลิงก์ `LP-NEW-…` เดิมเปิดย่านเดียวกัน |
| `scripts/restore-bundle-member.py` (0.2.0) | คืนไฟล์ขอบย่านที่ ZIP ของเจ้าของเก็บแบบไบต์ซ้ำ พร้อมตรวจ SHA-256 ทุกขั้น |
| `js/map-layers.js` | ป้ายชื่อย่าน/จังหวัด และ (0.1.3) ชื่อข้างจุดของชุดที่เลือก |
| `js/rail.js` · `scripts/build-rail.py` (0.2.3) | ระบบรางเป็นบริบทบนแผนที่: แนวราง สถานี ที่หยุดรถไฟทางไกล ป้ายเมื่อชี้ (สายและสถานีที่เชื่อมกัน) สีกลางสีเดียว ไม่นับรวม |
| `js/layers.js#framePoints` · `js/app.js#fitNb` (0.2.3) | เลือกย่านแล้วจัดกรอบพอดีขอบย่านในแผนที่ที่ว่าง ด้วย `fitBuilding` ของ shell |
| `js/scales.js` · `js/cues.js` | สเกล LDS และรูปทรงของหมวด |
| `js/shell/` | citymeter-shell (ห้ามแก้ที่นี่ที่เดียว) |

## งาน

T01 ข้อมูล → T02 model → T03 view models → T04 แผง → T05 แผนที่ → T06 orchestration → T07 tests + LDS parity → T08 publish และ family sync (รอเจ้าของอนุมัติ)

## Acceptance criteria

AC01–AC16 ใน `implementation-plan.json`: tests ผ่านบนข้อมูลจริง · ไม่มีข้อมูลไม่เป็น 0 · จำนวนรวมตรงกับจุดที่วาด · ข้อค้นพบมีตัวตั้งและตัวหาร · บรรทัดที่มาทุกมุมมอง · LDS parity 0 mismatch · back ของเบราว์เซอร์ · มือถือ 393 px · English ครบ · ตาราง · live bytes · เมนูทุกหน้าบน citymeter.pages.dev ตรงกับ hub

## Backlog

ชื่อย่านภาษาอังกฤษเมื่อทะเบียนมี · ขอบที่ตรวจภาคสนามแทนฉบับร่าง · แถวในทะเบียนชุดข้อมูลและรหัส production ของชุดนี้
