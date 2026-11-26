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
    for (const ds of Object.keys(r.c)) {
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
  assert.deepEqual(MAP_TABS, ['visit', 'work', 'res']);
  for (const v of REACHES) assert.equal(validReach(v), v);
  for (const v of ['', '400', '2000', null, undefined]) assert.equal(validReach(v), '1000');
  for (const v of MAP_TABS) assert.equal(validMap(v), v);
  for (const v of ['', 'x', null]) assert.equal(validMap(v), 'visit');
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
      for (const key of ['res', 'com', 'gst', 'ctr']) assert.match(sec, new RegExp(`data-people="${key}"`), r.id);
      assert.match(sec, new RegExp(`data-action="set-reach" data-value="${reach}" aria-pressed="true"`), r.id);
      // residents: a scale not built yet says it comes next; a built scale without a figure has no building here; never 0
      const built = (meta.residents?.scales || []).includes(reach);
      if (p.s[reach].res == null) assert.match(sec, built ? /data-people="res">[\s\S]*?ยังไม่มีข้อมูลอาคารในขอบนี้/ : /data-people="res">[\s\S]*?รอข้อมูลรอบถัดไป/, `${r.id} ${reach}`);
      // one provenance line and the method
      assert.match(sec, /class="hint people-source"/, r.id);
      assert.match(sec, /<summary>วิธีคิดตัวเลขคน<\/summary>/, r.id);
      assert.ok(!/รวมสามกลุ่ม|ยอดรวม|total/i.test(text(sec)), r.id);
    }
    for (const tab of MAP_TABS) {
      const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(), around, people: p, peopleMeta: meta, mapTab: tab});
      const sec = html.slice(html.indexOf('id="nb-map"'), html.indexOf('</section>', html.indexOf('id="nb-map"')));
      assert.ok(sec.length > 0, r.id);
      if (!p.map.res) assert.match(sec, /data-value="res"[^>]*disabled/, `${r.id}: the residents map waits for its data round`);
      if (tab === 'res' && !p.map.res) continue;
      // the cells are drawn as one path per colour (runs of a row merged): every fill is a sample of the map's own scale
      const svg = sec.slice(sec.indexOf('<svg'), sec.indexOf('</svg>'));
      const fills = new Set([...svg.matchAll(/<path d="[^"]*" fill="(#[0-9a-fA-F]{6})"/g)].map(m => m[1].toLowerCase()));
      const allowed = new Set(lut[tab].lut.map(c => c.toLowerCase()));
      for (const f of fills) assert.ok(allowed.has(f), `${r.id} ${tab}: ${f} is not a sample of ${lut[tab].scaleId}`);
      const {cells} = mapModel(p.map, tab);
      if (cells.length) assert.ok(fills.size > 0, `${r.id} ${tab}: cells drawn`);
      assert.ok(cells.every(c => c.v > 0 && c.band >= 0 && c.band <= 3), `${r.id} ${tab}`);
    }
  }
});

test('D-V6b: every topic row says a number or why there is none — never a bare 0, never a score or a total', () => {
  const {model} = load();
  const around = A();
  const meta = readJSON('data/people/meta.json');
  const WAIT = /ยังไม่มีข้อมูล|รอข้อมูลรอบถัดไป|กำลังโหลด|เลือกประเภทธุรกิจและแบรนด์|น้อยกว่า 3 ร้าน/;
  for (const r of model.rows) {
    const p = people(r.id);
    for (const distance of ['in', '400', '800']) {
      for (const axis of ['live', 'visit', 'trade']) {
        for (const t of topicsOf(axis, {row: r, model, around, people: p, peopleMeta: meta, distance})) {
          if (t.text) {
            assert.match(text(t.text), /\d/, `${r.id} ${distance} ${axis} ${t.id}: a number`);
          } else {
            assert.match(t.wait[0], WAIT, `${r.id} ${distance} ${axis} ${t.id}: why there is none`);
            assert.ok(!/(^|\s)0(\s|$)/.test(t.wait[0]), `${r.id} ${t.id}`);
          }
        }
        const html = topicsHTML(axis, {row: r, model, around, people: p, peopleMeta: meta, distance});
        assert.ok(!/คะแนน|ยอดรวม|รวมทั้งหมด|score|total/i.test(text(html)), `${r.id} ${axis}`);
      }
      // buyers: three groups side by side with “never added” beside them
      const buyers = topicsOf('trade', {row: r, model, around, people: p, peopleMeta: meta, distance}).find(t => t.id === 'buyers');
      if (buyers.text) assert.match(text(buyers.text), /สามกลุ่มไม่รวมกัน/, r.id);
    }
  }
});
