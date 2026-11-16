# CityMETER Commercial District — Implementation Plan

รุ่น 0.1.1 · 16 พ.ย. 2569 · คู่กับ `implementation-plan.json` (schema 1.5.0)

## สถาปัตยกรรม

Static site, ES modules ผ่าน import map ที่มี cache tag เดียว · MapLibre GL 5.6.2 (unpkg, SRI) · OpenFreeMap tiles · ไม่มี build step ฝั่งเว็บ · ข้อมูลสร้างด้วย `scripts/build-data.py` (shapely, pyproj, openpyxl, mapshaper)

| โมดูล | หน้าที่ |
|---|---|
| `js/app.js` | ขอบเขต สีบนแผนที่ แผง คำอธิบายแผนที่ แถบเปรียบเทียบ ตาราง กล้อง แผ่นมือถือ ที่อยู่ |
| `js/model.js` | ถอดข้อมูล สถานะของค่า ขอบเขต อันดับ |
| `js/profile.js` | view model: ภาพรวม ย่าน การเปรียบเทียบ ความคล้าย คู่ที่มาด้วยกัน |
| `js/panel.js` | HTML ของแผง บรรทัดที่มา ถ้อยคำสองภาษา |
| `js/layers.js` | ขอบย่าน หมุด จุดในย่าน กรอบจังหวัด |
| `js/scales.js` · `js/cues.js` | สเกล LDS และรูปทรงของหมวด |
| `js/shell/` | citymeter-shell (ห้ามแก้ที่นี่ที่เดียว) |

## งาน

T01 ข้อมูล → T02 model → T03 view models → T04 แผง → T05 แผนที่ → T06 orchestration → T07 tests + LDS parity → T08 publish และ family sync (รอเจ้าของอนุมัติ)

## Acceptance criteria

AC01–AC16 ใน `implementation-plan.json`: tests ผ่านบนข้อมูลจริง · ไม่มีข้อมูลไม่เป็น 0 · จำนวนรวมตรงกับจุดที่วาด · ข้อค้นพบมีตัวตั้งและตัวหาร · บรรทัดที่มาทุกมุมมอง · LDS parity 0 mismatch · back ของเบราว์เซอร์ · มือถือ 393 px · English ครบ · ตาราง · live bytes · เมนูทุกหน้าบน citymeter.pages.dev ตรงกับ hub

## Backlog

ชื่อย่านภาษาอังกฤษเมื่อทะเบียนมี · ขอบที่ตรวจภาคสนามแทนฉบับร่าง · แถวในทะเบียนชุดข้อมูลและรหัส production ของชุดนี้
