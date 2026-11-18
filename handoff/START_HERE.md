# CityMETER Commercial District — Developer Handoff

รุ่นเผยแพร่ 0.2.0 · 18 พ.ย. 2569 · ทะเบียนย่านกลางรุ่น 2026-11-17-commercial-recovery-9 อ่านและสร้างข้อมูล 18 พ.ย. 2569 (ไฟล์ส่งออกของเจ้าของ) · ข้อมูลจุดจาก 16 เดโมของ CityMETER ตาม commit ที่บันทึกใน `data/neighborhoods.json`

เริ่มอ่าน `source/handoff/README.md` จากนั้น Product Statement (`source/PRODUCT_STATEMENT.md` + `source/handoff/product-statement.json`), Product Brief และ Implementation Plan ในโฟลเดอร์ `source/handoff` ทั้ง `.md` และ `.json` ใช้คู่กัน

เข้าโฟลเดอร์ `source` แล้วรัน `npm test` และ `npm start` เปิด http://127.0.0.1:4173/ (English: `?lang=en`)

ชุดนี้มี source code (ES modules มีคอมเมนต์สัญญาทุกโมดูล ต่อยอดจาก CityMETER · University 0.1.4), datasets (ย่าน 395 ย่าน — ทะเบียน 358 และย่านที่พัก 37 — พร้อมจำนวนของ 16 ชุดข้อมูลและผลคัดย่านที่พัก ขอบย่านสำหรับแสดงผล จุดในย่าน ขอบจังหวัด 77 จังหวัด หน่วยอาคาร), unit tests บนข้อมูลจริง, JSON Schema 1.5.0, acceptance criteria AC01–AC16, สคริปต์สร้างข้อมูล/manifest/bundle ตรวจ LDS parity และตรวจ live bytes อ่าน `source/AGENTS.md` ก่อนแก้ไข

เว็บจริง: https://montri-th.github.io/commercialdistrict/
Repository: https://github.com/montri-th/commercialdistrict

`RELEASE_RECEIPT.json` (ถ้ามีในชุด) ผูกชุดส่งต่อกับ commit ผล GitHub Pages และ live attestation ส่วน `evidence/` เป็นหลักฐานหน้าจอและผลเทียบ hash ของไฟล์บนเว็บ แยกจาก source ที่ commit แล้ว
