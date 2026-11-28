/**
 * 0.9.0 — who stands out, the price level and the neighbourhoods alike (owner 2026-11-29 00:41, items 1–3, VERBATIM in
 * js/personas.js): data/profile.json pairs with the shipped data, every profile has its words, its evidence and its week,
 * the price level says what it rests on, the likeness reads mix · scale · price, and nothing is an icon grid.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {load, readJSON, readBytes, sha256} from './helpers.js';
import {decodeProfile, PERSONAS, GROUPS, shownPersonas, clearWords, priceStep, priceWord, PRICE_WORDS, priceLine, priceDetails,
  personaSection, personaLine, similarSection, weekLevels, peakHours} from '../js/personas.js';
import {decodePeople} from '../js/people.js';
import {lowLocated} from '../js/model.js';

const holes = /undefined|NaN|\bnull\b|\[object Object\]|Infinity/;
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const profile = () => decodeProfile(readJSON('data/profile.json'));

test('data/profile.json: its schema, every neighbourhood, built on the shipped files', () => {
  const {model} = load();
  const raw = readJSON('data/profile.json');
  assert.equal(raw.meta.schema, 'citymeter-commercialdistrict-profile/1');
  assert.deepEqual(Object.keys(raw.rows).sort(), model.rows.map(r => r.id).sort());
  assert.equal(raw.meta.sources.neighborhoods, sha256(readBytes('data/neighborhoods.json')), 'the inside counts it ships with');
  assert.equal(raw.meta.sources.boundaries, sha256(readBytes('data/boundaries.geojson')), 'the outlines the map draws');
  assert.equal(raw.meta.sources.around, sha256(readBytes('data/around.json')), 'the surroundings it read for parks and places of worship');
  assert.equal(decodeProfile({meta: {schema: 'x'}, rows: {}}), null, 'another schema is not read');
});

test('every profile of the file has its group, words in both languages, its evidence sentence and its week', () => {
  const p = profile();
  const seen = new Set();
  for (const [id, rec] of p.rows) {
    for (const g of GROUPS) {
      const list = rec.pe[g.id] || [];
      assert.ok(list.length <= 3, `${id} ${g.id}: at most three`);
      for (const [pid, score, facts, uses] of list) {
        const P = PERSONAS[pid];
        assert.ok(P, `${id}: ${pid} has words`);
        assert.equal(P.g, g.id, `${id} ${pid}: in its own group`);
        assert.ok(score >= 0 && score <= 100);
        const why = P.why(facts, () => '');
        assert.ok(why && !holes.test(why), `${id} ${pid}: ${why}`);
        for (const u of uses) assert.ok(Number.isInteger(u[2]) && u[2] > 0, `${id} ${pid}: a use with its count`);
        seen.add(pid);
      }
      // the lead first, the others in the order of how clearly they stand out
      for (let k = 2; k < list.length; k++) assert.ok(list[k - 1][1] >= list[k][1], `${id} ${g.id}`);
    }
  }
  for (const [pid, P] of Object.entries(PERSONAS)) {
    assert.ok(P.th && P.en && P.doTh && P.doEn && P.icon, pid);
    assert.equal(P.week.length, 2, `${pid}: weekday and weekend`);
    for (const d of P.week) { assert.equal(d.length, 24); assert.ok(d.every(v => v >= 0 && v <= 1)); }
    const lv = weekLevels(P.week);
    assert.ok(lv.flat().every(v => v >= 1 && v <= 5));
    assert.ok(lv.flat().includes(5), `${pid}: a busiest hour`);
    assert.ok(peakHours(lv[0]) || peakHours(lv[1]), `${pid}: the busiest hours in words`);
  }
  assert.ok(seen.size >= 20, `profiles in use: ${seen.size}`);
});

test('shown: the first always, then those at least clear (≥ 50), three at most; “เด่น” stays the highlights’ word', () => {
  assert.deepEqual(shownPersonas([['office', 30], ['retail', 60], ['school', 40]]).map(x => x[0]), ['office', 'retail']);
  assert.deepEqual(shownPersonas([['office', 90], ['retail', 80], ['school', 70], ['gov', 60]]).length, 3);
  assert.equal(clearWords(85), 'ชัดมาก');
  assert.equal(clearWords(55), 'ชัด');
  assert.equal(clearWords(10), 'มีให้เห็น');
  for (const w of [clearWords(85), clearWords(55), clearWords(10)]) assert.ok(!/เด่น/.test(w));
});

test('the section for every neighbourhood: three groups apart, words beside every pictogram, stars only where a dataset is short of points', () => {
  const {model} = load();
  const p = profile();
  for (const r of model.rows) {
    const rec = p.rows.get(r.id);
    const people = decodePeople(readJSON(`data/people/${r.id}.json`), r.id);
    const html = personaSection(r, model, rec, people);
    assert.ok(html, r.id);
    assert.ok(!holes.test(text(html)), `${r.id}: ${text(html).match(holes)}`);
    assert.equal((html.match(/<article class="ps-card"/g) || []).length, 3, `${r.id}: residents, visitors and people who come to work and study`);
    assert.ok(!/รวมทั้งหมด|ทั้งหมดรวม|ยอดรวม/.test(text(html)), `${r.id}: the groups are never added`);
    assert.ok(!/(?<!จุด)เด่น/.test(text(html.replace(/<details[\s\S]*?<\/details>/g, ''))), `${r.id}: no “เด่น” outside the highlights`);
    for (const m of html.matchAll(/<p class="ps-name">([\s\S]*?)<\/p>/g)) assert.ok(text(m[1]).trim().length > 4, `${r.id}: a pictogram with its words`);
    // a star follows the dataset, not the profile: none for a dataset with points for 90 % of its records or more
    for (const m of html.matchAll(/<p class="ps-why">([\s\S]*?)<\/p>/g)) {
      if (/\*/.test(m[1])) assert.ok(model.datasets.some(d => lowLocated(d)), r.id);
    }
    for (const m of html.matchAll(/<span class="ps-use">([^<*]+)(\*)?/g)) {
      const ds = model.datasets.find(d => m[1].startsWith(d.nameTh));
      if (ds && !(ds.subgroups || []).length) assert.equal(Boolean(m[2]), lowLocated(ds), `${r.id} ${ds.id}: its star`);
    }
    const strips = [...html.matchAll(/<span class="ps-cells">([\s\S]*?)<\/span>/g)].filter(m => !m[1].includes('<b>')).map(m => (m[1].match(/<i class="g[1-5]"/g) || []).length);
    assert.ok(strips.every(n => n === 24), `${r.id}: 24 hours a strip`);
  }
});

test('the price level: five steps in words, what it rests on with every reading’s unit and place, or why there is none', () => {
  const {model} = load();
  const p = profile();
  assert.deepEqual([0, 19.9, 20, 59.9, 60, 80, 100].map(priceStep), [0, 0, 1, 2, 3, 4, 4]);
  assert.equal(priceWord(85), PRICE_WORDS[4][0]);
  let withLevel = 0;
  for (const r of model.rows) {
    const rec = p.rows.get(r.id);
    const line = priceLine(rec);
    assert.ok(line && !holes.test(text(line)), r.id);
    if (rec.pr.lv == null) { assert.match(line, /ข้อมูลราคายังไม่พอบอก/, r.id); continue; }
    withLevel++;
    assert.ok(Object.keys(rec.pr.c).length >= p.meta.price.levelMin, `${r.id}: a level rests on at least ${p.meta.price.levelMin} readings`);
    assert.match(text(line), new RegExp(`${priceWord(rec.pr.lv)} ${Math.round(rec.pr.lv)}/100`));
    const det = priceDetails(rec, p.meta);
    assert.equal((det.match(/<li>/g) || []).length, Object.keys(rec.pr.c).length, r.id);
    assert.ok(!holes.test(text(det)), r.id);
    for (const [id, x] of Object.entries(rec.pr.c)) assert.ok(x[2] >= 0 && x[2] <= 100, `${r.id} ${id}`);
    assert.match(det, /ไม่ใช่ราคาวันนี้ รายได้ หรือการใช้จ่าย/);
  }
  assert.equal(withLevel, 427, 'a level in 427 of 718 (0.9.0)');
});

test('the head reads in words: the price level and the people who stand out, each a button to its section', () => {
  const p = profile();
  const siam = load().model.rows.find(r => r.name === 'สยาม');
  const line = personaLine(p.rows.get(siam.id));
  assert.equal((line.match(/data-action="goto-personas"/g) || []).length, 3, 'one lead a group');
  assert.ok(line.includes(PERSONAS[p.rows.get(siam.id).pe.gst[0][0]].th));
});

test('alike in mix, scale and price: at most five, in the order of the file, each with its three likenesses', () => {
  const {model} = load();
  const p = profile();
  let lists = 0;
  for (const r of model.rows) {
    const sim = p.rows.get(r.id).sim;
    assert.ok(sim.length <= p.meta.sim.keep);
    for (let k = 1; k < sim.length; k++) assert.ok(sim[k - 1][1] >= sim[k][1], `${r.id}: the most alike first`);
    for (const [id, all, mix, sc, pr] of sim) {
      assert.ok(model.byId.get(id) && id !== r.id, r.id);
      for (const v of [all, mix]) assert.ok(v > 0 && v <= 1, `${r.id} ${id}`);
      for (const v of [sc, pr]) assert.ok(v == null || (v >= 0 && v <= 1), `${r.id} ${id}`);
    }
    const html = similarSection(r, model, p);
    if (!sim.length) { assert.equal(html, ''); continue; }
    lists++;
    assert.ok(!holes.test(text(html)), r.id);
    assert.equal((html.match(/<li class="sm-item">/g) || []).length, sim.length);
  }
  assert.ok(lists >= 400, `lists: ${lists}`); // 0.9.0: 444 — none for a trading site (nobody's peer) or with under 8 datasets shared
  // สยาม’s alike are not the market towns of a different scale and price (the owner’s example of ศูนย์สิริกิติ์)
  const sk = model.rows.find(r => r.name === 'ศูนย์ฯ สิริกิติ์–พระราม 4');
  const names = p.rows.get(sk.id).sim.map(x => model.byId.get(x[0]).name);
  for (const n of ['ตลาดเมืองนครนายก', 'กุดป่อง–เลย', 'เรืองราษฎร์–ระนอง']) assert.ok(!names.some(x => x.includes(n.split('–')[0])), `${n} is no longer alike`);
});
