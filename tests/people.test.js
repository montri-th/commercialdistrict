/**
 * «ใครอยู่ตรงนี้», the round maps and the topic rows of น่าอยู่ · น่าเที่ยว · น่าค้าขาย (0.7.0; owner 2026-11-26 14:03–14:40,
 * handoff/around/decisions.json D-12…D-15 and handoff/visual/decisions.json D-V6b):
 *   D-12  the official figures spread over the neighbourhood: commuters as an at-least sum with its parts beside it,
 *         overnight visitors by recorded rooms, residents from the civil register by floor area; three groups never added
 *   D-13  1 · 3 · 5 km from the edge, inside included (straight line until the Shopping Center page's method is in hand)
 *   D-V6b every topic row says its number, unit and meaning; a topic without data says so, never 0; no score or total
 *   INV-01 one grain per dataset: the file's counts at 400 / 800 m equal the surroundings file, record for record
 *   LDS   the maps colour from the 41 samples of their own scale, nothing else
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {ROOT, load, readJSON} from './helpers.js';
import {join} from 'node:path';
import {decodeAround} from '../js/around.js';
import {buildNeighborhood} from '../js/profile.js';
import {renderNeighborhood} from '../js/panel.js';
import {REACHES, MAP_TABS, decodePeople, validReach, validMap, aboutPeople, levelOf, mapModel} from '../js/people.js';
import {topicsOf, topicsHTML} from '../js/indicators.js';
import {ACTIVITY_SCALE, COUNT_SCALE, DENSITY_SCALE} from '../js/scales.js';

const A = () => decodeAround(readJSON('data/around.json'));
const ctx = () => ({meta: load().model.meta, datasetCount: 16});
const SCALES = ['in', '400', '800', '1000', '3000', '5000'];
const PARTS = ['stu', 'uni', 'fac', 'gov'];
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const people = id => readJSON(`data/people/${id}.json`);

test('one people file per neighbourhood, every scale, and the meta file names its sources', () => {
  const {model} = load();
  const meta = readJSON('data/people/meta.json');
  assert.equal(meta.schema, 'citymeter-commercialdistrict-people/1');
  assert.equal(meta.release, readJSON('package.json').version);
  assert.equal(meta.parts.off.model.commit, '8e8d8be866f4307d581eb4d72cd64579c2724564', 'the Office file is pinned');
  assert.match(meta.parts.off.model.sha256, /^[0-9a-f]{64}$/);
  for (const k of ['stu', 'uni', 'fac', 'gov', 'off']) assert.ok(meta.parts[k].dataset && meta.parts[k].th && meta.parts[k].en, k);
  assert.match(meta.gst.source.url, /^https:\/\/www\.nso\.go\.th\//);
  assert.equal(meta.gst.source.year, 2024);
  assert.match(meta.gst.sha256, /^[0-9a-f]{64}$/);
  assert.match(meta.residents.populationMonth, /^\d{4}-\d{2}$/, 'the register month of the residents');
  assert.deepEqual(meta.residents.populationCheck.differ, [], 'popCount equals the register total of that month everywhere read');
  for (const r of model.rows) {
    assert.ok(existsSync(join(ROOT, `data/people/${r.id}.json`)), r.id);
    const p = people(r.id);
    assert.equal(p.id, r.id);
    assert.deepEqual(Object.keys(p.s).sort(), [...SCALES].sort(), r.id);
    assert.deepEqual(decodePeople(p, r.id), p);
    assert.equal(decodePeople(p, 'CMN-TH-NOPE'), null, `${r.id}: a file of another neighbourhood is refused`);
  }
});

test('the counts at 400 and 800 m equal the surroundings file, and nothing shrinks as the distance grows', () => {
  const {model} = load();
  const around = A();
  for (const r of model.rows) {
    const p = people(r.id), a = around.rows.get(r.id).a;
    // (0.8.0) the counted-only datasets (§20) are not people parts: the people file carries the demos' datasets only
    for (const ds of Object.keys(r.c).filter(d => !model.dsById.get(d)?.aggregate)) {
      assert.equal(p.s.in.n[ds], r.c[ds], `${r.id} ${ds} inside`);
      assert.equal(p.s['400'].n[ds], r.c[ds] + a[ds][0], `${r.id} ${ds} 400`);
      assert.equal(p.s['800'].n[ds], r.c[ds] + a[ds][1], `${r.id} ${ds} 800`);
    }
    for (let i = 1; i < SCALES.length; i++) {
      const lo = p.s[SCALES[i - 1]], hi = p.s[SCALES[i]];
      for (const k of [...PARTS, 'rooms', 'gst']) if (lo[k] != null) assert.ok(hi[k] >= lo[k], `${r.id} ${k} ${SCALES[i]}`);
      for (const ds of Object.keys(lo.n)) assert.ok(hi.n[ds] >= lo.n[ds], `${r.id} ${ds} ${SCALES[i]}`);
    }
  }
});

test('D-12: commuters are the sum of their parts at the low end, starred when half comes from datasets under 90 %; the three groups are never added', () => {
  const {model} = load();
  const meta = readJSON('data/people/meta.json');
  const low = new Set(meta.levels.lowLocated);
  for (const r of model.rows) {
    for (const [k, s] of Object.entries(people(r.id).s)) {
      const parts = [...PARTS.map(x => s[x]), s.off ? s.off[0] : null];
      const sum = parts.reduce((t, v) => t + (v || 0), 0);
      assert.equal(s.com, parts.every(v => v == null) ? null : sum, `${r.id} ${k}`);
      if (s.off) assert.ok(s.off[0] <= s.off[1], `${r.id} ${k} office range`);
      // a part is 0 only when no record lies within the scale; records without any figure leave it unknown, never 0
      for (const part of ['stu', 'fac', 'gov']) {
        if (s[part] === 0) assert.ok(!s[`${part}N`], `${r.id} ${k} ${part}: 0 with records in reach`);
        if (s[part] === null && s[`${part}N`]) assert.equal(s[`${part}N`][0], 0, `${r.id} ${k} ${part}`);
        if (s[`${part}N`]) assert.ok(s[`${part}N`][0] <= s[`${part}N`][1]);
      }
      if (s.uni === null && s.uniN) assert.equal(s.uniN[0], 0, `${r.id} ${k} uni`);
      if (s.uni === 0) assert.ok(!s.uniN, `${r.id} ${k} uni: 0 with universities in reach`);
      if (s.gst === 0) assert.ok(!s.roomsN, `${r.id} ${k}: 0 guests with lodging in reach`);
      if (s.gst === null && s.roomsN) assert.equal(s.roomsN[0], 0, `${r.id} ${k} rooms`);
      const lowShare = [['stu', 'school'], ['uni', 'university'], ['fac', 'factory'], ['gov', 'governmentoffice']]
        .reduce((t, [x, ds]) => t + (low.has(ds) ? s[x] || 0 : 0), 0) + (low.has('office') && s.off ? s.off[0] : 0);
      assert.equal(s.comLow, Boolean(s.com) && lowShare * 2 >= s.com, `${r.id} ${k} star`);
      // no total of residents, commuters and visitors anywhere in the file
      assert.ok(!('all' in s) && !('total' in s) && !('sum' in s), `${r.id} ${k}`);
      // visitors: none without rooms; unknown where the province has no lodging data
      if (!('hotel' in r.c)) assert.equal(s.gst, null, `${r.id} ${k}`);
      else assert.equal(s.gst === 0, s.rooms === 0, `${r.id} ${k}`);
    }
    for (const [k, p] of Object.entries(people(r.id).p)) for (const v of Object.values(p)) assert.ok(v >= 0 && v <= 100, `${r.id} ${k}`);
  }
});

test('the reading of the people address: scales and map tabs, anything else reads the default', () => {
  assert.deepEqual(REACHES, ['in', '1000', '3000', '5000']);
  assert.deepEqual(MAP_TABS, ['res', 'visit', 'work'], 'owner 2026-11-27 07:15: Resident > Visitor > Commuter');
  for (const v of REACHES) assert.equal(validReach(v), v);
  for (const v of ['', '400', '2000', null, undefined]) assert.equal(validReach(v), '1000');
  for (const v of MAP_TABS) assert.equal(validMap(v), v);
  for (const v of ['', 'x', null]) assert.equal(validMap(v), 'res');
  assert.equal(aboutPeople(32343), '32,000');
  assert.equal(aboutPeople(3221402), '3,221,000');
  assert.ok(!aboutPeople(4), 'under 10: no rounded figure (the tile writes <10)');
  assert.deepEqual([0, 19.9, 20, 59, 99, 100].map(p => levelOf(p, 1)), [1, 1, 2, 3, 5, 5]);
});

test('every neighbourhood renders «ใครอยู่ตรงนี้» with four tiles and the round map from the 41 samples of its own scale', () => {
  const {model} = load();
  const around = A();
  const meta = readJSON('data/people/meta.json');
  const lut = {visit: ACTIVITY_SCALE, work: COUNT_SCALE, res: DENSITY_SCALE};
  for (const r of model.rows) {
    const p = people(r.id);
    for (const reach of REACHES) {
      const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(), around, people: p, peopleMeta: meta, reach});
      const sec = html.slice(html.indexOf('id="nb-people"'), html.indexOf('id="nb-map"'));
      assert.equal((sec.match(/class="people-tile /g) || []).length, 4, `${r.id} ${reach}`);
      // the owner's order (2026-11-27 07:15): residents › visitors › commuters, then centres and markets
      assert.deepEqual([...sec.matchAll(/data-people="(\w+)"/g)].map(m => m[1]), ['res', 'gst', 'com', 'ctr'], r.id);
      assert.match(sec, new RegExp(`data-action="set-reach" data-value="${reach}" aria-pressed="true"`), r.id);
      // residents: a scale not built yet says it comes next; a built scale without a figure has no building here; never 0
      const built = (meta.residents?.scales || []).includes(reach);
      if (p.s[reach].res == null) assert.match(sec, built ? /data-people="res">[\s\S]*?ยังไม่มีข้อมูลอาคารในขอบนี้/ : /data-people="res">[\s\S]*?รอข้อมูลรอบถัดไป/, `${r.id} ${reach}`);
      // one provenance line and the method
      assert.match(sec, /class="hint panel-foot provenance"/, r.id);
      assert.match(sec, /<summary>วิธีคิดตัวเลขคน<\/summary>/, r.id);
      // dataset · source · date · boundary on the block's own line
      for (const part of ['dataset', 'source', 'date', 'boundary']) assert.match(sec, new RegExp(`data-prov="${part}"`), `${r.id} ${reach} ${part}`);
      // a measured 0 has no level beside it
      for (const m of sec.matchAll(/<li class="people-tile is-ready" data-people="(\w+)">([\s\S]*?)<\/li>/g)) {
        if (/<b class="data-number">0<\/b>/.test(m[2])) assert.ok(!/people-level/.test(m[2]), `${r.id} ${reach} ${m[1]}: a level beside 0`);
      }
      assert.ok(!/รวมสามกลุ่ม|ยอดรวม|total/i.test(text(sec)), r.id);
    }
    for (const tab of MAP_TABS) {
      const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(), around, people: p, peopleMeta: meta, mapTab: tab});
      const sec = html.slice(html.indexOf('id="nb-map"'), html.indexOf('</section>', html.indexOf('id="nb-map"')));
      assert.ok(sec.length > 0, r.id);
      assert.deepEqual([...sec.matchAll(/data-action="set-map" data-value="(\w+)"/g)].map(m => m[1]), ['res', 'visit', 'work'], `${r.id}: the tabs in the owner's order`);
      if (!p.map.res) assert.match(sec, /data-value="res"[^>]*disabled/, `${r.id}: the residents map waits for its data round`);
      if (tab === 'res' && !p.map.res) continue;
      // the cells are drawn as one path per colour (runs of a row merged): every fill is a sample of the map's own scale
      const svg = sec.slice(sec.indexOf('<svg'), sec.indexOf('</svg>'));
      const fills = new Set([...svg.matchAll(/<path d="[^"]*" fill="(#[0-9a-fA-F]{6})"/g)].map(m => m[1].toLowerCase()));
      const allowed = new Set(lut[tab].lut.map(c => c.toLowerCase()));
      for (const f of fills) assert.ok(allowed.has(f), `${r.id} ${tab}: ${f} is not a sample of ${lut[tab].scaleId}`);
      const {cells} = mapModel(p.map, tab);
      if (cells.length) assert.ok(fills.size > 0, `${r.id} ${tab}: cells drawn`);
      // 0.7.5: band 4 = across a river and beyond 5 km through the crossings, only where the map carries its river record
      assert.ok(cells.every(c => c.v > 0 && c.band >= 0 && c.band <= (p.map.x ? 4 : 3)), `${r.id} ${tab}`);
    }
  }
});

test('D-V6b: every topic row says a number or why there is none — never a bare 0, never a score or a total', () => {
  const {model} = load();
  const around = A();
  const meta = readJSON('data/people/meta.json');
  const WAIT = /ยังไม่มีข้อมูล|รอข้อมูลรอบถัดไป|กำลังโหลด|น้อยกว่า 3 ร้าน/;
  // the datasets each row reads: one that does not reach the province is named on its row
  // (0.8.0) the rows of 0.8.0: daily needs take banks and salons (and name pets, cars and services), gyms sit under parks,
  // shopping reads fashion and beauty too, the chain shops have a row of their own, places of worship join the variety
  const ROW_DS = {eat: ['restaurant', 'grocery'], needs: ['grocery', 'pharmacy', 'hospital', 'school', 'transit', 'governmentoffice', 'bank', 'salon', 'pet', 'car', 'services'],
    shop: ['shoppingcenter', 'apparel', 'beauty', 'luxurybrands'],
    mix: ['hotel', 'tourism', 'shoppingcenter', 'restaurant', 'apparel', 'beauty', 'luxurybrands', 'massage', 'arts', 'cinema', 'playground', 'temple'],
    biz: ['factory', 'industrialestate', 'bank'], retail: ['gold', 'optical', 'sport', 'hobby', 'furniture', 'clinic', 'nail', 'camera'],
    green: ['fitness'], spend: ['luxurybrands'], work: ['office'], stay: ['hotel'], move: ['transit']};
  // a number never stands without its unit: every bold figure is followed by a word in the same unbreakable span
  const BARE = /<b class="data-number">[^<]*<\/b>(?!\s*[^\s<])/;
  for (const r of model.rows) {
    const p = people(r.id);
    for (const distance of ['in', '400', '800']) {
      for (const axis of ['live', 'visit', 'trade']) {
        for (const t of topicsOf(axis, {row: r, model, around, people: p, peopleMeta: meta, distance})) {
          const out = (ROW_DS[t.id] || []).filter(id => !(id in r.c));
          if (t.text) {
            assert.match(text(t.text), /\d/, `${r.id} ${distance} ${axis} ${t.id}: a number`);
            assert.ok(!BARE.test(t.text), `${r.id} ${distance} ${axis} ${t.id}: a number without its unit`);
            if (out.length) assert.match(t.text, /ยังไม่มีข้อมูลในจังหวัดนี้/, `${r.id} ${distance} ${t.id}: ${out} not named`);
          } else {
            assert.match(t.wait[0], WAIT, `${r.id} ${distance} ${axis} ${t.id}: why there is none`);
            assert.ok(!/(^|\s)0(\s|$)/.test(t.wait[0]), `${r.id} ${t.id}`);
          }
        }
        const html = topicsHTML(axis, {row: r, model, around, people: p, peopleMeta: meta, distance});
        assert.ok(!/คะแนน|ยอดรวม|รวมทั้งหมด|score|total/i.test(text(html)), `${r.id} ${axis}`);
      }
      // buyers: three groups side by side with “never added” beside them; the models say so; a starred sum keeps its star
      const buyers = topicsOf('trade', {row: r, model, around, people: p, peopleMeta: meta, distance}).find(t => t.id === 'buyers');
      const s = p.s[distance];
      if (buyers.text) {
        assert.match(text(buyers.text), /สามกลุ่มไม่รวมกัน/, r.id);
        if (s.res != null || s.gst != null) assert.match(text(buyers.text), /แบบจำลอง/, `${r.id} ${distance}`);
        if (s.comLow) assert.match(buyers.text, /\*/, `${r.id} ${distance}: the star of the at-least figure`);
      }
      const crowd = topicsOf('live', {row: r, model, around, people: p, peopleMeta: meta, distance}).find(t => t.id === 'crowd');
      if (crowd.text) assert.match(text(crowd.text), /แบบจำลอง/, r.id);
    }
  }
});

test('the rows while the people file loads and when it fails: said so, never a figure or “next round”', () => {
  const {model} = load();
  const around = A();
  const r = model.rows[0];
  const pick = (axis, id, ctx) => topicsOf(axis, {row: r, model, around, distance: 'in', ...ctx}).find(t => t.id === id);
  assert.match(pick('trade', 'buyers', {people: null, peopleState: 'loading'}).wait[0], /กำลังโหลดตัวเลขคน/);
  assert.match(pick('live', 'crowd', {people: null, peopleState: 'loading'}).wait[0], /กำลังโหลดตัวเลขคน/);
  assert.match(pick('trade', 'buyers', {people: null, peopleState: 'error'}).wait[0], /โหลดตัวเลขคนไม่สำเร็จ/);
  assert.match(pick('live', 'crowd', {people: null, peopleState: 'error'}).wait[0], /โหลดตัวเลขคนไม่สำเร็จ/);
});

test('0.7.3: a university that cannot be counted reads “ยังนับไม่ได้”, the restaurant level reads 36/100 as one figure', async () => {
  const {peopleSection, peopleTiles} = await import('../js/people.js');
  const {model} = load();
  const r = model.rows.find(x => readJSON(`data/people/${x.id}.json`).s.in);
  const base = readJSON(`data/people/${r.id}.json`);
  const meta = readJSON('data/people/meta.json');
  const at = s => ({...base, s: {...base.s, in: {...base.s.in, ...s}}});
  const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const none = text(peopleSection(r, at({uni: null, uniN: [0, 2]}), meta, {reach: 'in'}));
  assert.match(none, /นักศึกษา: ยังนับไม่ได้ \(2 มหาวิทยาลัย\)/);
  assert.doesNotMatch(none, /นักศึกษา: ไม่มีตัวเลข/);
  const part = text(peopleSection(r, at({uni: 5000, uniN: [1, 2]}), meta, {reach: 'in'}));
  assert.match(part, /นับได้ 1 จาก 2 มหาวิทยาลัย/);
  // other parts keep “ไม่มีตัวเลข”: their records carry no figure
  assert.match(text(peopleSection(r, at({fac: null, facN: [0, 3]}), meta, {reach: 'in'})), /คนงานโรงงาน: ไม่มีตัวเลข \(3 โรงงาน\)/);
  assert.ok(peopleTiles(at({}), 'in', meta).length === 4);
  // the liveliness row: no space inside “36/100”
  const src = (await import('node:fs')).readFileSync(join(ROOT, 'js/indicators.js'), 'utf8');
  assert.doesNotMatch(src, /fig\(Math\.round\(rest\.level\), '\/100'\)/);
  assert.match(src, /<\/b>\/100`\)/);
});

test('0.7.3: the residents map reads its modelled figures “ราว”, rounded, “ไม่ถึง 10” under 10, and says when 5 km holds no building', async () => {
  const {mapSection} = await import('../js/people.js');
  const {model} = load();
  const r = model.rows[0];
  const base = readJSON(`data/people/${r.id}.json`);
  const meta = readJSON('data/people/meta.json');
  const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const res = [[0, 1234.5, 0], [1, 7.2, 1], [2, 40.4, 2]];
  const sec = text(mapSection(r, {...base, map: {...base.map, res}}, meta, {tab: 'res'}));
  assert.match(sec, /3 ช่องที่มี · มากสุด ราว 1,200 คนต่อช่อง/);
  assert.match(sec, /คนอยู่เป็นแบบจำลอง ปัดเป็นหลักสิบ ร้อย หรือพัน/);
  assert.match(sec, /คนของอาคารที่อยู่ห่างขอบย่านไม่เกิน 5 กม\./);
  assert.doesNotMatch(sec, /0 = ไม่พบในชุดข้อมูลที่นับ/);
  const html = mapSection(r, {...base, map: {...base.map, res}}, meta, {tab: 'res'});
  const cells = [...html.matchAll(/<td class="data-number">([^<]*)</g)].map(m => m[1]);
  assert.ok(cells.includes('ไม่ถึง 10') && cells.includes('1,200') && cells.includes('40'), cells.join(' | '));
  const empty = text(mapSection(r, {...base, map: {...base.map, res: []}}, meta, {tab: 'res'}));
  assert.match(empty, /ยังไม่มีข้อมูลอาคารในระยะ 5 กม\./);
  assert.doesNotMatch(empty, /\(0\)/);
});
