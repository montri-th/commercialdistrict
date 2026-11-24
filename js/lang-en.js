/**
 * Commercial District · English words (citymeter-shell 0.6.x, js/shell/i18n.js), keyed by the Thai the page shows: the fixed
 * words of index.html and the control titles (js/navigation.js). The sentences built from data are written in English
 * where they are built (js/panel.js, js/app.js: L(th, en)). A draft translation from the Thai source, not yet reviewed
 * (demo-platform-review §5.8); the page says so. Neighbourhood names, aliases and the registry's own notes have no
 * English in the registry: they stay Thai (js/lang.js).
 * Terms: ย่าน = neighbourhood (one of the central registry's closed draft outlines); จุดเด่น = highlight; มาด้วยกัน =
 * come together (rank correlation of density across neighbourhoods); ต่อ ตร.กม. = per km²; ชุดข้อมูล = dataset.
 */
export default {
  exact: {
    // Page and header
    'ย่านไหนเด่นเรื่องอะไร และอะไรมาด้วยกัน': 'Which neighbourhood stands out for what, and what comes together',
    'ย่านไหนเด่นเรื่องอะไร และอะไรมาด้วยกัน — ย่านกลาง 395 ย่านทั่วประเทศ รวมย่านที่พัก 37 ย่าน เทียบกับ 16 ชุดข้อมูล CityMETER ทั้ง Land Location Living บนแผนที่ 3 มิติ': 'Which neighbourhood stands out for what, and what comes together: 395 central neighbourhoods nationwide, 37 of them lodging areas, against 16 CityMETER datasets across Land, Location and Living, on a 3D map',
    // Groups of neighbourhoods (0.2.0; outline words 0.2.1)
    'ย่านที่แสดง': 'Show',
    'ทุกย่าน': 'Every neighbourhood',
    'ขอบตามหลักเกณฑ์ทะเบียน': 'Outlines by the registry\'s rules',
    'ขอบร่างจากผลคัดที่พัก': 'Draft outlines from the lodging screen',
    'ใหม่ในรุ่นนี้': 'New in this release',
    'ย่านที่พัก': 'Lodging area',
    'ขอบร่างจากผลคัดย่านที่พัก ย่านเหล่านี้รับเป็นรหัสกลางของทะเบียนแล้ว รอตรวจตามหลักเกณฑ์ขอบย่าน': 'Draft outline from the registry\'s lodging screen; these areas are central codes of the registry now, their outlines await the registry\'s rules',
    'ย่านไหนเด่นเรื่องอะไร และอะไรมาด้วยกัน — ย่านกลางทั่วประเทศเทียบกับ 16 ชุดข้อมูล CityMETER': 'Which neighbourhood stands out for what, and what comes together: central neighbourhoods nationwide against 16 CityMETER datasets',
    'กำลังโหลดข้อมูล': 'Loading the data',
    'กำลังอ่านข้อมูลย่านและขอบย่าน': 'Reading the neighbourhoods and their outlines',
    'หน้านี้ต้องใช้ JavaScript เพื่ออ่านข้อมูลและแสดงแผนที่ กรุณาเปิด JavaScript แล้วลองใหม่ หรือเปิดลิงก์เว็บสาธารณะด้านบน': 'This page needs JavaScript to read the data and show the map. Turn JavaScript on and try again, or open the public site link above.',
    'ข้อมูล': 'Data',
    'กลับ': 'Back',
    'ขยายแผ่นข้อมูล': 'Expand the sheet',
    'กลับไปแผนที่': 'Back to the map',
    'กลับไปหน้าก่อน': 'Back to the previous view',
    'เปิดแผงข้อมูลและตัวกรอง': 'Open the data panel and filters',
    'เปิดวิธีใช้': 'Open help',
    // Map
    'แผนที่ย่าน จุดเด่นของแต่ละย่าน สิ่งที่อยู่ในย่าน และอาคาร': 'Map of the neighbourhoods: their highlights, what lies inside them, and buildings',
    'เครื่องมือแผนที่': 'Map tools',
    'ดูทั้งหมด': 'Fit',
    'ทั้งประเทศ': 'Whole country',
    'ข้อค้นพบแรก': 'First finding',
    'คำอธิบายแผนที่': 'Map legend',
    'อ่านแผนที่ด้วย': 'Colour by',
    'ระบายสีย่านด้วย': 'Colour the neighbourhoods by',
    'จุดเด่นของย่าน': 'Highlights',
    'ย่าน · เด่นเรื่องแรก': 'Neighbourhood · first highlight',
    'จุดของแต่ละชุดข้อมูลในขอบย่านที่เปิด · สีและรูปทรง = หมวด Land · Location · Living · เลือกชุดจากแถบบนแผนที่เพื่อดูพร้อมชื่อ · ชี้หรือกดจุดเพื่อดูว่าคืออะไร': 'Records of each dataset inside the open neighbourhood · colour and shape = Land · Location · Living · pick a set in the bar on the map to see it with names · point at or choose a record to see what it is',
    'เลือกดูทีละชุดข้อมูล': 'One dataset at a time',
    'สิ่งที่อยู่ในย่าน': 'Inside the neighbourhood',
    'ย่านที่วางเทียบกันในแถบเปรียบเทียบ': 'Neighbourhoods set side by side in the comparison',
    'ย่านที่เทียบ': 'Compared',
    'อาคาร 3 มิติ: เข้ม = ในย่านที่เปิดและรอบ ๆ · จาง = ทั่วเมือง': '3D buildings: strong = in and round the open neighbourhood · faint = elsewhere in the city',
    'อาคาร': 'Buildings',
    'ระบบราง': 'Rail',
    'พื้นที่ย่าน (ทดลอง)': 'Wider area (trial)',
    'ปรับแผนที่ให้เห็นย่านที่เลือก หรือย่านในจังหวัดที่เลือก': 'Fit the map to the open neighbourhood, or to the province’s neighbourhoods',
    'ดูทั้งประเทศ ล้างจังหวัด ย่าน และคำค้น': 'Whole country: clear the province, the neighbourhood and the search',
    'สลับ 3 มิติ / 2 มิติ': 'Switch between 3D and 2D',
    'ระบายสีย่านตามจุดเด่น หรือตามความหนาแน่นของชุดข้อมูลหนึ่ง': 'Colour the neighbourhoods by highlight, or by the density of one dataset',
    // Compare tray and table
    'เปรียบเทียบย่าน': 'Compare neighbourhoods',
    'ล้าง': 'Clear',
    'เปิด': 'Open',
    'รายชื่อ': 'List',
    'ย่านทั้งประเทศ': 'Neighbourhoods nationwide',
    'ปิดตาราง': 'Close the table',
    'ก่อนหน้า': 'Previous',
    'ถัดไป': 'Next',
    'เปิดหรือย่อแถบเปรียบเทียบย่าน': 'Open or collapse the comparison',
    'ล้างย่านที่เปรียบเทียบทั้งหมด': 'Clear every compared neighbourhood',
    'เปิดตารางทุกย่านกับ 16 ชุดข้อมูล': 'Open the table of every neighbourhood with the 16 datasets',
    'ปิดตารางและกลับไปแผนที่': 'Close the table and go back to the map',
    'ดูหน้าก่อนหน้าของตาราง': 'Previous page of the table',
    'ดูหน้าถัดไปของตาราง': 'Next page of the table',
    // Panel
    'เส้นทางพื้นที่: ประเทศไทย › จังหวัด › ย่าน': 'Area path: Thailand › province › neighbourhood',
    'ค้นหาย่านหรือจังหวัด': 'Search a neighbourhood or province',
    'ค้นหาชื่อย่าน ชื่ออื่นของย่าน รหัสย่าน หรือจังหวัด': 'Search a neighbourhood name, another name for it, its code, or a province',
    'ตัวกรอง': 'Filters',
    'จังหวัด': 'Province',
    'ทุกจังหวัด': 'All provinces',
    'ดูเฉพาะย่านในจังหวัดนี้': 'Only the neighbourhoods of this province',
    // Help
    'ย่านกลางทั่วประเทศ เทียบกับ 16 ชุดข้อมูล CityMETER ทั้ง Land Location Living — กดย่าน จังหวัด หรือชุดข้อมูล': 'Central neighbourhoods nationwide against 16 CityMETER datasets across Land, Location and Living. Choose a neighbourhood, a province or a dataset.',
    'ข้อค้นพบ': 'Finding',
    'สัดส่วนของจุดแต่ละชุดที่อยู่ในขอบย่าน เทียบกับพื้นที่ที่ย่านกินจริง · ในจังหวัด: เทียบกับจุดของชุดนั้นในจังหวัด': 'The share of each dataset’s located records that lie inside the outlines, against the area the neighbourhoods take · in a province: against that dataset’s records in the province',
    'สีของย่าน': 'Neighbourhood colours',
    'จุดเด่นของย่าน = สีและรูปทรงตามหมวดของจุดเด่นแรก (Land · Location · Living) · เลือกชุดข้อมูลใน “อ่านแผนที่ด้วย” = สีตามจำนวนต่อ ตร.กม. 41 ระดับ สีเข้ม = แน่น · กรอบไม่มีสี = ชุดนี้ไม่มีข้อมูลในจังหวัด': 'Highlights = colour and shape of the pillar of the first highlight (Land · Location · Living) · a dataset in “Colour by” = records per km² in 41 steps, darker = denser · an outline without colour = the dataset has no data in the province',
    'จุดเด่น': 'Highlights',
    'เด่นเมื่อติดกลุ่มบนของย่านทั้งหมดที่ชุดข้อมูลครอบคลุม: มากเป็นอันดับต้น แน่นเป็นอันดับต้น มีสัดส่วนสูงของทั้งประเทศ หรือเป็นไม่กี่ย่านที่มี · ทุกอันดับบอก “จาก กี่ย่าน”': 'A highlight is a place near the top among the neighbourhoods a dataset covers: among the most, among the densest, a large share of the country, or one of the few that hold any · every rank says “of how many”',
    'อะไรมาด้วยกัน': 'What comes together',
    'คู่ชุดข้อมูลที่ขึ้นลงด้วยกันในย่านทั่วประเทศ (สหสัมพันธ์อันดับของความหนาแน่น) · ในย่าน: คู่ที่เด่นทั้งคู่ที่นี่ และบทบาทที่ทะเบียนเสนอเทียบกับข้อมูล': 'Pairs of datasets that rise and fall together across the neighbourhoods (rank correlation of density) · in a neighbourhood: the pairs that both stand out there, and the roles the registry proposes against the data',
    'ในย่าน': 'In a neighbourhood',
    'เส้นจุด = ขอบร่างจากผลคัดย่านที่พักของทะเบียน ย่านเหล่านี้รับเป็นรหัสกลางแล้ว · ในหน้าย่าน: ที่พักและบริการที่เดินถึงใน 400 และ 800 ม. ตามแบบจำลองของทะเบียน · “ย่านที่แสดง” ในตัวกรองเลือกดูขอบตามหลักเกณฑ์ทะเบียน ขอบร่างจากผลคัดที่พัก หรือย่านใหม่ในรุ่นนี้': 'Dotted outline = a draft outline from the registry\'s lodging screen; these areas are central codes now · on a neighbourhood: the lodging places and services reached within 400 and 800 m in the registry\'s walking model · “Show” in the filters picks the outlines by the registry\'s rules, the draft outlines from the lodging screen or the new ones of this release',
    'ทุกชุดข้อมูลแยก Land · Location · Living พร้อมจำนวน ต่อ ตร.กม. และอันดับ · ซูมใกล้เห็นจุดของแต่ละชุดในขอบย่านและอาคาร 3 มิติ': 'Every dataset by Land · Location · Living, with its count, per km² and rank · zoom in to see each dataset’s records inside the outline and the 3D buildings',
    'เปรียบเทียบ': 'Compare',
    'เพิ่มย่านได้ถึง 4 ย่าน วางเทียบในแถบล่างของแผนที่ · วงกรอบ = แน่นที่สุดในกลุ่มที่เทียบ · “ย่านที่ส่วนผสมคล้ายกัน” ช่วยหาย่านมาเทียบ': 'Add up to 4 neighbourhoods, side by side in the strip under the map · ringed = densest of the compared · “Neighbourhoods with a similar mix” suggests what to compare',
    'เส้นทางและตาราง': 'Path and table',
    'ประเทศไทย › จังหวัด › ย่าน · “รายชื่อ” เปิดตารางทุกย่านกับ 16 ชุดข้อมูล': 'Thailand › province › neighbourhood · “List” opens the table of every neighbourhood with the 16 datasets',
    'Tab ไปยังปุ่ม · Enter เลือก · Escape ปิด': 'Tab to a control · Enter to choose · Escape to close',
    'เว็บ Commercial District': 'Commercial District site',
    // Map controls (MapLibre locale is Thai only on a Thai page)
    'ค้นต่อใน Google': 'Search on in Google',
    'ถาม Google AI': 'Ask Google AI',
  },
  patterns: [
    // The ramp's accessible name (js/scales.js#rampLegendHTML): the unit after it is already English.
    [/^41 ระดับสีตามลำดับค่า ต่ำสุด ([\d,.]+) สูงสุด ([\d,.]+) (.+)$/, '41 colour steps by rank, lowest $1, highest $2 $3'],
    // The reader's own search text, quoted: kept as typed.
    [/^(Clear )?“([^”]+)”$/, m => m[0]],
  ],
};
