/**
 * «ช่วงไหนน่าจะคึก» (0.7.10; owner 2026-11-27 18:04, VERBATIM: “และ side panel ยังขาด heatmap ใน 7x24 daypart”; his choice,
 * VERBATIM: “เลือก 1 แต่ช่วยใช้ style เหมือน demo = shopping center”, D-V10): a hypothesis from rules in the Shopping Center
 * page's look — levels 1–5 against the neighbourhood's own busiest hour, neutral tones, never people or footfall.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT, load, readJSON} from './helpers.js';
import {decodeAround} from '../js/around.js';
import {buildNeighborhood} from '../js/profile.js';
import {renderNeighborhood} from '../js/panel.js';
import {daypartOf, daypartGroups, busiestWords, busySection, levelStrength, countStrength, signalsOf, RULES, DAYS, GRID_LEVELS, DAYPART_REACH} from '../js/daypart.js';

const ids = readdirSync(join(ROOT, 'data/people')).filter(f => f.endsWith('.json') && f !== 'meta.json').map(f => f.slice(0, -5));
const people = id => readJSON(`data/people/${id}.json`);

test('every neighbourhood has a grid of 168 hours, levels 1–5 with a busiest hour, from rules it names', () => {
  assert.equal(ids.length, 534);
  const lines = new Set();
  for (const id of ids) {
    const dp = daypartOf(people(id));
    assert.match(dp.grid, /^[1-5]{168}$/, `${id}: no level 0, an area does not close`);
    assert.ok(dp.grid.includes('5'), `${id}: a busiest hour`);
    assert.deepEqual(dp.rules.slice(0, 3).map(r => r[0]), ['base', 'friday_evening', 'sunday_early']);
    for (const [rid, st] of dp.rules) {
      assert.ok(RULES.some(r => r.id === rid), rid);
      assert.ok(st > 0 && st <= 1, `${id} ${rid} ${st}`);
    }
    assert.deepEqual(daypartOf(people(id)), dp, 'deterministic');
    lines.add(busiestWords(dp.grid)[0]);
  }
  assert.ok(lines.size > 10, `${lines.size} different busiest lines: the rules follow the data`);
});

test('strengths: (level − 40) / 50 as the Shopping Center page, counts in three steps, nothing from a measured 0', () => {
  assert.equal(levelStrength(40), 0);
  assert.equal(levelStrength(65), 0.5);
  assert.equal(levelStrength(95), 1);
  assert.equal(levelStrength(null), 0);
  assert.deepEqual([0, 1, 2, 3, 9, 10, 400].map(countStrength), [0, 0.25, 0.25, 0.5, 0.5, 1, 1]);
  const rec = people('CMN-TH-FC9F0B73B3'), s = rec.s[DAYPART_REACH], p = rec.p[DAYPART_REACH];
  const sig = signalsOf(rec);
  assert.equal(sig.res, levelStrength(p.res));
  assert.equal(sig.work, countStrength(s.n.office + s.n.governmentoffice));
  const zero = {...rec, s: {...rec.s, [DAYPART_REACH]: {...s, n: {...s.n, shoppingcenter: 0}}}};
  assert.equal(signalsOf(zero).ctr, 0, 'no centre counted: no centres rule');
  // the fold's word for a count is the one the method gives it: 1–2 slight, 3–9 moderate, 10 or more none (the whole shift)
  const word = offices => {
    const r = {...rec, s: {...rec.s, [DAYPART_REACH]: {...s, n: {...s.n, office: offices, governmentoffice: 0}}}};
    const li = busySection(r).match(/<li>พักกลางวันของคนทำงาน(?: <span class="fact-rank">\(([^)]*)\)<\/span>)?<\/li>/);
    return li && li[1];
  };
  assert.equal(word(2), 'เล็กน้อย · สำนักงานและหน่วยงานรัฐ 2 แห่ง');
  assert.equal(word(7), 'ปานกลาง · สำนักงานและหน่วยงานรัฐ 7 แห่ง');
  assert.equal(word(12), 'สำนักงานและหน่วยงานรัฐ 12 แห่ง');
});

test('the grid reads in days and hours as the Shopping Center page words it', () => {
  const g = '1'.repeat(17) + '555' + '1111';
  const grid = g.repeat(4) + '1'.repeat(24) + '1'.repeat(24) + '1'.repeat(24);
  const groups = daypartGroups(grid);
  assert.deepEqual(groups[0], {days: [0, 1, 2, 3], top: 5, ranges: [[17, 20]]});
  assert.equal(busiestWords(grid)[0], 'จ.–พฤ. 17:00–20:00 น.');
  assert.equal(DAYS.length, 7);
  assert.equal(GRID_LEVELS[5][0], 'คึกที่สุดของสัปดาห์');
});

test('the section: the busiest line, 7 × 24 cells in neutral tones, the legend, the fold; after the topic rows; the same at every distance', () => {
  const {model} = load();
  const around = decodeAround(readJSON('data/around.json'));
  const meta = readJSON('data/people/meta.json');
  const id = 'CMN-TH-FC9F0B73B3', rec = people(id);
  const render = reach => renderNeighborhood(buildNeighborhood(model, model.byId.get(id)), model, {ctx: {meta: model.meta, datasetCount: 16}, around, people: rec, peopleMeta: meta, reach});
  const html = render('1000');
  const sec = html.slice(html.indexOf('id="nb-busy"'), html.indexOf('</section>', html.indexOf('id="nb-busy"')));
  assert.ok(html.indexOf('id="nb-around"') < html.indexOf('id="nb-busy"'), 'a hypothesis after what is counted');
  assert.match(sec, /ช่วงไหนน่าจะคึก<span class="prior-badge">สมมติฐาน<\/span>/);
  assert.match(sec, /<p class="busy-peak">คึกที่สุดของสัปดาห์ /);
  assert.match(sec, /<table class="dp-grid" aria-hidden="true">/);
  assert.equal((sec.match(/<td class="g[1-5]"/g) || []).length, 168);
  assert.doesNotMatch(sec, /class="g0"/);
  assert.equal((sec.match(/<li><i class="g[1-5]" aria-hidden="true"><\/i>/g) || []).length, 5);
  assert.match(sec, /เทียบกับชั่วโมงที่คึกที่สุดของย่านนี้เอง ไม่ใช่จำนวนคน/);
  assert.match(sec, /href="DATA_METHOD\.md#daypart"/);
  const grid = reach => [...render(reach).matchAll(/<td class="g([1-5])"/g)].map(m => m[1]).join('');
  assert.equal(grid('in'), grid('5000'), 'the grid reads 1 km whatever the tiles read');
  assert.equal(busySection(null), '');
  const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
  const tones = css.match(/\.dp-grid td\.g[1-5], \.dp-legend i\.g[1-5] \{ background: var\(--[\w-]+\); \}/g) || [];
  assert.equal(tones.length, 5, 'foundation tones of the theme, as the Shopping Center page; never a data colour');
  assert.match(readFileSync(join(ROOT, 'DATA_METHOD.md'), 'utf8'), /<a id="daypart"><\/a>/);
});
