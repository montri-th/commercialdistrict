# CityMETER Commercial District — handoff

สำหรับนักพัฒนาที่รับงานต่อ เอกสารในโฟลเดอร์นี้มีสองรูปแบบที่ต้องตรงกัน: Markdown สำหรับคนอ่าน และ JSON (schema `handoff.schema.json` 1.5.0) สำหรับเครื่องตรวจ (`tests/release.test.js` ตรวจเลขรุ่นและ cache tag)

| ไฟล์ | อ่านเพื่อ |
|---|---|
| `../PRODUCT_STATEMENT.md` · `product-statement.json` | ผู้ใช้ ปัญหา คู่เทียบ กลยุทธ์ claim boundary และสมมติฐานที่ต้องทดสอบ |
| `PRODUCT_BRIEF.md` · `product-brief.json` | สัญญาของหน้าจอ: ข้อค้นพบแรก หน่วยนับ สี สถานะข้อมูล จุดเด่น คู่ที่มาด้วยกัน แผง การเปรียบเทียบ กล้อง |
| `IMPLEMENTATION_PLAN.md` · `implementation-plan.json` | สถาปัตยกรรม โมดูล งาน acceptance criteria และ backlog |
| `VERIFICATION.md` | ผลตรวจของรุ่นนี้: tests, LDS parity, render, English harvest, live |
| `around/` | (0.4.0) «ในย่านนี้» และ «รอบย่านนี้»: คำตัดสินของเจ้าของคำต่อคำ สัญญาข้อมูล แผนลงมือ NL-00 ถึง NL-14 แหล่งที่ใช้สร้าง และ CHANGELOG |
| `visual/` | (0.6.0) แผงย่านอ่านด้วยภาพก่อน: คำของเจ้าของคำต่อคำ (06:21 ถึง 11:43 น. 26 พ.ย. 2569) คำตัดสิน D-V1 ถึง D-V8 การอ่านคำสั่งของ Claude และสิ่งที่ Claude เลือกเองพร้อมเหตุผล (`decisions.json`) วิธีคิดระดับอยู่ใน `DATA_METHOD.md` §14 |
| `../DATA_METHOD.md` | ที่มาของทุกตัวเลข การวางจุด ความครอบคลุม กติกาจุดเด่น และฟิลด์ที่เผยแพร่ |
| `../AGENTS.md` | ความต้องการของเจ้าของที่เป็นสัญญา — อ่านก่อนแก้ |

## ลำดับการทำงาน

1. แก้ย่านในทะเบียนย่านกลางเท่านั้น (ไม่ commit ชีต ไฟล์ส่งออก เซลล์ หรือที่อยู่ของชีต) · ขอบย่านมาจากชุดขอบล่าสุดของเจ้าของ
2. clone เดโมทั้ง 16 repository ไว้ข้างกัน และบันทึก commit ที่อ่านใน `commits.json`
3. `python3 -I scripts/build-data.py …` ตาม `DATA_METHOD.md` §11 แล้ว `python3 -I scripts/build-around.py …` (0.4.0, `around/README.md`)
4. `npm test` และ `npm run check:lds -- --lds <LDS 0.9.7 .md>` และเดินหน้าเว็บแบบ `?lang=en` ทุกมุมมองให้ไม่มีข้อความไทยค้าง (ยกเว้นชื่อย่าน)
5. ขยับ `?v=YYYYMMDD-rN` ใน `index.html` + `package.json` + `design-intent.json` + handoff JSON
6. push `main` → GitHub Pages → `npm run handoff:manifest` → `npm run verify:live`
7. เดินเว็บจริงที่ 1440 และ 393 px ทั้ง light และ dark ไทยและอังกฤษ ก่อนบอกว่าเสร็จ
8. เมนูชุดข้อมูลของทุกเดโมต้องตรงกับหน้า “ดูเดโมทั้งหมด” (skill `citymeter-demo-family-sync`)

## จุดที่ต้องระวัง

- แต่ละชุดข้อมูลคงหน่วยของตัวเอง ห้ามบวกจำนวนข้ามชุด · ชุดที่ไม่มีจุดในจังหวัดของย่านคือ “ไม่มีข้อมูล” (—) ไม่ใช่ 0
- จุดเด่นทุกข้อต้องบอกกลุ่มเทียบและจำนวน · คู่ที่มาด้วยกันและย่านที่คล้ายกันเป็นความสัมพันธ์ ไม่ใช่เหตุและผล
- ไม่มีคำเตือนบนหน้าจอ ข้อจำกัดอยู่หลังลิงก์ “วิธีนับ” (DATA_METHOD.md)
- `js/shell/` เป็น citymeter-shell (ไบต์เดียวกันทุก repo) อย่าแก้ที่นี่ที่เดียว · MapLibre ล็อกที่ 5.6.2 พร้อม `js/shell/maplibre-guard.js`
- สีข้อมูลห้ามใส่ opacity · ซูมใกล้ (≥ 14) สีย่านย้ายไปที่เส้นขอบ เพื่อให้ถนนและอาคารอ่านได้
