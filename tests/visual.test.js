/**
 * The visual-first panel (0.6.0; owner 2026-11-26 11:43, VERBATIM “ทำตามที่เสนอให้ครบทุกข้อพร้อม publish”,
 * handoff/visual/decisions.json): the acceptance list of the proposal (§8) over the whole shipped data —
 *   D-V2  highlights drawn by the build's own rule over the datasets with points for ≥ 90 % (parity with the file first)
 *   D-V1  one level per dataset and neighbourhood: the mean of the count level and the density level, mid-rank, among the
 *         neighbourhoods with at least 3 records — the same value in every part (D-V1c), coloured on the LDS `count` LUT (D-V1d)
 *   D-4   a starred dataset has no dot, level, colour or ring
 *   EVID-05 the cell states look different; out of scope is never 0
 *   INV-01 nothing is added across datasets, neighbourhoods or distances: a key counts datasets, never records
 *   the matrix is a real table; every cell has its words; every pictogram has its name beside it, in a title or a key
 *   D-V6b, D-V7 A the axes น่าอยู่ · น่าเที่ยว · น่าค้าขาย (0.7.0), one axis per dataset, no score, “?” for what has no data yet
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {ROOT, load, readJSON} from './helpers.js';
import {highlightsOf, togetherOf, lowLocated, cell, scopeRows} from '../js/model.js';
import {decodeAround} from '../js/around.js';
import {levelModel, cellOf, cellsOf, cellCounts, levelFill, midPct, CELL_KINDS as KINDS} from '../js/levels.js';
import {AXES, DS_ICON, axisOf, AXIS_LEAD_MIN} from '../js/axes.js';
import {COUNT_SCALE, DENSITY_SCALE} from '../js/scales.js';
import {buildNeighborhood, buildOverview, buildCompare} from '../js/profile.js';
import {renderNeighborhood, renderOverview, renderCompare} from '../js/panel.js';
import {PICTOGRAM_CONTRACT} from '../js/navigation.js';

const A = () => decodeAround(readJSON('data/around.json'));
const ctx = () => ({meta: load().model.meta, datasetCount: 16});
const STARRED = ['factory', 'fitness', 'hospital', 'industrialestate', 'office', 'pharmacy', 'school'];
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('D-V2: the build’s highlight rule, ported, gives the file’s own highlights and pairs for every row; the page keeps only complete datasets', () => {
  const {raw, model} = load();
  const rules = raw.meta.rules;
  const strong = new Set(raw.pairs.filter(p => p.rho >= rules.pairMinRho).map(p => `${p.a}|${p.b}`));
  for (const r of model.rows) {
    const all = highlightsOf(r, model.datasets, rules);
    assert.deepEqual(all, r.hlBuild, `${r.id}: the port of scripts/build-data.py`);
    assert.deepEqual(togetherOf(all, strong), r.pairsBuild, `${r.id}: pairs`);
    assert.ok(r.hl.every(h => !STARRED.includes(h.d)), `${r.id}: no starred highlight`);
    assert.ok(r.hl.length <= rules.maxHighlights);
    assert.deepEqual(r.pairs, togetherOf(r.hl, strong), r.id);
    assert.equal(r.strong, r.hl.filter(h => h.p >= 0.9).length);
  }
  const n = f => model.rows.reduce((s, r) => s + f(r), 0);
  assert.equal(n(r => r.hlBuild.length), 639); // 0.6.1: 469 outlines (599 on the 451 of 0.6.0)
  assert.equal(n(r => r.hl.length), 560, '639 less the starred, plus the complete ones the cap of four had cut (485 + 75; 459 + 70 = 529 in 0.6.0)');
  assert.equal(model.rows.filter(r => r.hl.length).length, 271); // 0.6.1 (255 in 0.6.0)
  const siam = model.rows.find(r => r.name === 'สยาม');
  assert.deepEqual(siam.hl.map(h => h.d), ['luxurybrands', 'camera', 'governmentoffice', 'transit']);
});

test('D-V1: one level per dataset and neighbourhood — the mean of two mid-rank levels among the neighbourhoods with ≥ 3 records', () => {
  // mid-rank by fixed cases: the share below, plus half of the equal ones
  assert.equal(midPct(2, [1, 2, 2, 3]), 50);
  assert.equal(midPct(3, [1, 2, 2, 3]), 87.5);
  assert.equal(midPct(1, [1, 2, 2, 3]), 12.5);
  assert.equal(midPct(5, [5]), 50);
  assert.equal(midPct(4, [1, 2, 3]), 100);
  assert.equal(midPct(1, []), null);
  const {model} = load();
  const levels = levelModel(model);
  for (const ds of model.datasets) {
    const L = levels.get(ds.id);
    if (lowLocated(ds)) { assert.equal(L, null, `${ds.id}: starred, no level`); continue; }
    const peers = model.rows.filter(r => (r.c[ds.id] || 0) >= 3);
    assert.equal(L.n, peers.length, ds.id);
    // the peers of “แน่นอันดับ k/N” on the same page (the build's density rank)
    for (const r of peers) assert.equal(cell(r, ds).ranked, L.n, `${r.id} ${ds.id}: the build ranks the same peers`);
    const counts = peers.map(r => r.c[ds.id]), dens = peers.map(r => r.density[ds.id]);
    for (const r of peers) {
      const x = L.rows.get(r.id);
      const c = midPct(r.c[ds.id], counts), d = midPct(r.density[ds.id], dens);
      assert.ok(Math.abs(x.level - (c + d) / 2) < 1e-9, `${r.id} ${ds.id}`);
      assert.equal(x.rank, 1 + peers.filter(p => L.rows.get(p.id).level > x.level + 1e-9).length);
      assert.ok(x.level > 0 && x.level <= 100);
    }
  }
  // Siam, as the proposal read it on the data of 0.4.1, now on the 469 neighbourhoods of 0.6.1 (451 in 0.5.1 and 0.6.0)
  const siam = model.rows.find(r => r.name === 'สยาม');
  const lux = cellOf(model, siam, model.dsById.get('luxurybrands'));
  assert.equal(lux.kind, 'ranked');
  assert.equal(lux.n, 10); // 0.6.1 (9 on the 451 of 0.6.0)
  assert.equal(lux.countRank, 1);
});

test('cell states (EVID-05 kept apart): every dataset of every neighbourhood, with and without the surroundings file', () => {
  const {model} = load();
  const around = A();
  const seen = new Set();
  for (const r of model.rows) for (const ds of model.datasets) for (const a of [around, null]) {
    const x = cellOf(model, r, ds, a), c = cell(r, ds);
    assert.ok(KINDS.includes(x.kind));
    seen.add(x.kind);
    if (c.state === 'out_of_scope') assert.equal(x.kind, 'out');
    else if (c.state === 'measured_zero') {
      const r800 = around.rows.get(r.id).a[ds.id][1];
      assert.equal(x.kind, a && r800 > 0 ? 'edge' : 'zero', `${r.id} ${ds.id}`);
      assert.equal(x.edgeKnown, Boolean(a));
    } else if (lowLocated(ds)) assert.equal(x.kind, 'starred');
    else assert.equal(x.kind, c.count >= 3 ? 'ranked' : 'few');
    if (x.kind !== 'ranked') assert.equal(x.level, undefined, `${r.id} ${ds.id}: a level only when ranked`);
  }
  assert.deepEqual([...seen].sort(), [...KINDS].sort(), 'every state occurs');
});

test('every neighbourhood: the fingerprint, the highlight cards, the axes and the similar matrix keep the rules', () => {
  const {model} = load();
  const around = A();
  const COUNT = new Set(COUNT_SCALE.lut), DENS = new Set(DENSITY_SCALE.lut);
  assert.equal(COUNT_SCALE.lut.length, 41);
  for (const r of model.rows) {
    const d = buildNeighborhood(model, r);
    for (const [a, distance] of [[around, 'in'], [around, '400'], [around, '800'], [null, 'in']]) {
      const html = renderNeighborhood(d, model, {ctx: ctx(), around: a, distance});
      const head = html.slice(0, html.indexOf('</section>'));
      // the fingerprint: 16 cells in Land · Location · Living order, one image named by its key; every cell has its words
      const cells = [...head.matchAll(/<span class="fp-cell k-([a-z]+)( is-hl)?"(?: style="background:(#[0-9A-F]{6});color:(#[0-9A-F]{6})")? title="([^"]+)"/g)];
      assert.equal(cells.length, 16, r.id);
      const want = cellsOf(model, r, a);
      cells.forEach((m, i) => {
        assert.equal(m[1], want[i].kind, `${r.id} cell ${i}`);
        if (m[1] === 'ranked') { assert.ok(COUNT.has(m[3]), `${r.id}: a level takes the count LUT (D-V1d)`); assert.equal(m[3], levelFill(want[i].level)); assert.ok(['#182327', '#FFFFFF'].includes(m[4])); }
        else assert.equal(m[3], undefined, `${r.id} ${want[i].ds.id}: colour only for a level`);
        if (m[2]) assert.ok(d.highlights.some(x => x.ds.id === want[i].ds.id) && !lowLocated(want[i].ds), `${r.id}: ring only on a highlight of a complete dataset`);
        assert.ok(m[5].startsWith(want[i].ds.nameTh), r.id);
      });
      // the key counts datasets in each state and they make the 16 (a number of datasets, never of records: INV-01)
      const n = cellCounts(want);
      assert.equal(n.in + n.edge + n.zero + n.out, 16);
      assert.match(head, new RegExp(`ในย่าน ${n.in} ชุด`), r.id);
      const key = text(head.slice(head.indexOf('<p class="fp-key">')));
      assert.deepEqual(key.match(/\d+(?! ชุด)(?=\D|$)/g)?.filter(x => !['800'].includes(x)) || [], [], `${r.id}: every number of the key with its unit`);
      const name = head.match(/<span class="fp fp-lg" role="img" aria-label="([^"]+)">/)[1];
      for (const part of name.split(': ')[1].split(' · ')) assert.match(part, / \d+ ชุด$/, `${r.id}: the image's name, ${part}`);
      // a counted, unranked cell keeps its dot in the head: not colour alone (the stylesheet draws it in the corner)
      for (const m of cells) if (m[1] === 'few' || m[1] === 'starred') assert.equal(m[3], undefined);
      // every data colour of the panel's dots and cells is a sample of the count LUT; none of the density LUT (the map's)
      const fills = [...html.matchAll(/class="(?:ax-dot|fp-cell[^"]*)"[^>]*style="[^"]*background:(#[0-9A-F]{6})/g)].map(m => m[1]);
      for (const hex of fills) assert.ok(COUNT.has(hex), `${r.id} ${hex}`);
      const dots = [...html.matchAll(/<b class="ax-dot" style="left:([\d.]+)%;background:(#[0-9A-F]{6})"/g)];
      assert.equal(dots.length, want.filter(x => x.kind === 'ranked').length, `${r.id}: one dot per ranked dataset, each checked`);
      for (const [, left, hex] of dots) { assert.ok(COUNT.has(hex)); assert.ok(+left > 0 && +left <= 100); }
      assert.ok(![...html.matchAll(/background:(#[0-9A-F]{6})/g)].some(([, hex]) => DENS.has(hex) && !COUNT.has(hex)), `${r.id}: no density colour without a lens`);
      // the axes: every dataset in scope once, a dot only for a ranked one, never for a starred one
      const axes = html.slice(html.indexOf('id="nb-around"'), html.indexOf('class="scope-details around-fold"'));
      for (const x of want) {
        const row = axes.match(new RegExp(`<li class="ax-row k-([a-z]+)( is-hl)?"><button type="button" class="ax-ds" id="axis-${x.ds.id}"[\\s\\S]*?</li>`));
        if (x.kind === 'ranked' || x.kind === 'few' || x.kind === 'starred') {
          assert.ok(row, `${r.id} ${x.ds.id}: a row inside`);
          assert.equal(/class="ax-dot"/.test(row[0]), x.kind === 'ranked', `${r.id} ${x.ds.id}: a dot only for a level`);
          if (x.kind === 'starred') { assert.match(row[0], /<sup aria-hidden="true">\*<\/sup>/); assert.ok(!row[2], `${r.id} ${x.ds.id}: no ring`); }
          if (x.kind === 'ranked') assert.match(row[0], new RegExp(`class="ax-rank data-number">${x.rank}/${x.n}<`));
        } else if (x.kind === 'out') {
          assert.ok(!row, `${r.id} ${x.ds.id}: no row out of scope`);
          const card = axes.match(new RegExp(`<section class="ax-card" data-axis="${axisOf(x.ds.id).id}"[\\s\\S]*?</section>`))[0];
          const line = card.match(/<p class="ax-line"><span class="ax-line-head">ไม่มีข้อมูลในจังหวัด<\/span>([\s\S]*?)<\/p>/);
          assert.ok(line && text(line[1]).includes(x.ds.nameTh), `${r.id} ${x.ds.id}: named on the line of no data, never 0`);
        } else if (distance === 'in' || !a) assert.ok(!row, `${r.id} ${x.ds.id}: none inside, named on the line`);
        else {
          const reach = around.rows.get(r.id).a[x.ds.id][distance === '400' ? 0 : 1];
          assert.equal(Boolean(row), reach > 0, `${r.id} ${x.ds.id} ${distance}: a row only beyond the edge`);
          if (row) assert.match(row[0], new RegExp(`<b class="data-number">0</b>[\\s\\S]*?class="edge-chip"[^>]*>${reach.toLocaleString('th-TH')}<`));
        }
      }
      // “ระดับสูง:” names exactly the datasets of the axis at level ≥ 75; “เด่น” is the highlights' word (D-V2), not the axes'
      assert.ok(!/(?<!จุด)เด่น/.test(text(axes)), `${r.id}: on the axes “เด่น” only as จุดเด่น, the highlights`);
      for (const ax of AXES) {
        const card = axes.match(new RegExp(`<section class="ax-card" data-axis="${ax.id}"[\\s\\S]*?</section>`))[0];
        assert.match(card, new RegExp(`<section class="ax-card" data-axis="${ax.id}" aria-labelledby="ax-${ax.id}-name">`), 'the section named by the axis alone');
        assert.match(card, new RegExp(`<b id="ax-${ax.id}-name">${ax.th}</b>`));
        const lead = card.match(/<p class="ax-lead">ระดับสูง: ([^<]*)<\/p>/);
        const top = ax.datasets.map(id => want.find(x => x.ds.id === id)).filter(x => x.kind === 'ranked' && x.level >= AXIS_LEAD_MIN).map(x => x.ds.nameTh);
        assert.deepEqual(lead ? lead[1].split(' · ') : [], top, `${r.id} ${ax.id}`);
        assert.match(card, /<span class="ax-pend" title="ยังไม่มีข้อมูล: [^"]+"><span aria-hidden="true">\?<\/span><span class="sr-only">ตัวชี้วัดที่ยังไม่มีข้อมูล: /, 'the “?” names what has no data yet');
      }
      // the 0.4.0 table is kept whole, folded (D-V5)
      assert.match(html, /<details class="scope-details around-fold"><summary>/);
      assert.equal((html.match(/class="around-ds"/g) || []).length, 16);
    }
  }
});

test('the highlight cards: one per highlight of a complete dataset, in order, each a lens with its comparison in words', () => {
  const {model} = load();
  let cards = 0;
  for (const r of model.rows) {
    const d = buildNeighborhood(model, r);
    const html = renderNeighborhood(d, model, {ctx: ctx(), around: A()});
    const list = html.match(/<ul class="hl-cards">([\s\S]*?)<\/ul>/);
    assert.equal(Boolean(list), d.highlights.length > 0, r.id);
    if (!list) continue;
    const found = [...list[1].matchAll(/<button type="button" class="hl-card" data-action="set-lens" data-value="([a-z]+)" title="([^"]+)">([\s\S]*?)<\/button>/g)];
    assert.deepEqual(found.map(m => m[1]), d.highlights.map(x => x.ds.id), `${r.id}: one card per highlight, in order`);
    found.forEach(([, id, title, body], i) => {
      const x = d.highlights[i], ds = model.dsById.get(id), n = r.c[id] || 0;
      assert.ok(!lowLocated(ds), `${r.id} ${id}: no card for a starred dataset (D-V2)`);
      const rank = text(body.match(/<span class="hl-card-rank">([\s\S]*?)<\/span>/)[1]);
      if (x.h.k === 'share') assert.ok(rank.includes(`(${n.toLocaleString('th-TH')} จาก ${ds.located.toLocaleString('th-TH')})`), `${r.id} ${id}: a share with its numerator and denominator (INV-03): ${rank}`);
      else assert.ok(rank.includes(`จาก ${x.h.of.toLocaleString('th-TH')} ย่าน`), `${r.id} ${id}: a rank with its peers (INV-04): ${rank}`);
      if ((x.shared || 1) > 1) assert.ok(rank.includes(`ร่วม ${x.shared.toLocaleString('th-TH')} ย่าน`), `${r.id} ${id}: a shared rank says so (NL-06)`);
      assert.ok(title.includes(ds.nameTh), r.id);
      assert.match(body, new RegExp(`<b class="data-number">${n.toLocaleString('th-TH')}</b>`), `${r.id} ${id}: the count inside`);
      cards++;
    });
  }
  assert.equal(cards, 560, 'the highlights of D-V2 (529 in 0.6.0)');
});

test('what comes together: a role’s evidence stays visible, ✓ by its datasets, ○ by what the data shows (DATA_METHOD §7)', () => {
  const {model} = load();
  let open = 0;
  for (const r of model.rows) {
    const html = renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(), around: A()});
    for (const [, cls, body] of html.matchAll(/<li class="rl-row( is-on)?">([\s\S]*?)<\/li>/g)) {
      const ev = body.match(/<span class="rl-ev">([\s\S]*?)<\/span>(?:<small|$)/);
      assert.ok(ev && text(ev[1]).trim(), `${r.id}: a role with its evidence in view`);
      if (!cls) { open++; assert.ok(/\d|ไม่มีชุดข้อมูลของบทบาทนี้ในจังหวัด/.test(text(ev[1])), `${r.id}: ○ says what the data shows`); }
    }
    assert.ok(!/<li class="rl-row[^"]*" title=/.test(html), `${r.id}: never only in a title`);
  }
  assert.ok(open > 0);
});

test('the matrix is a real table: a named header for every dataset, a header for every neighbourhood, words in every cell', () => {
  const {model} = load();
  const around = A();
  const check = (html, label) => {
    const tables = [...html.matchAll(/<table class="mx">([\s\S]*?)<\/table>/g)].map(m => m[1]);
    assert.ok(tables.length, label);
    for (const t of tables) {
      const cols = [...t.matchAll(/<th scope="col" class="mx-h[^"]*" title="([^"]+)">[\s\S]*?<span class="sr-only">([^<]+)<\/span><\/th>/g)];
      assert.deepEqual(cols.map(m => m[2]), model.datasets.map(d => d.nameTh), `${label}: 16 column headers, named`);
      const rows = [...t.matchAll(/<tr class="mx-r[^"]*" data-nb="([^"]+)"><th scope="row" class="mx-row">([\s\S]*?)<\/th>([\s\S]*?)<\/tr>/g)];
      assert.ok(rows.length, label);
      for (const [, id, , tds] of rows) {
        const words = [...tds.matchAll(/<td class="mx-c[^"]*" tabindex="(-1|0)"><span class="fp-cell k-[a-z]+[^"]*"[^>]*><\/span><span class="sr-only">([^<]+)<\/span><\/td>/g)];
        assert.equal(words.length, 16, `${label} ${id}: every cell with its words`);
      }
      assert.equal((t.match(/tabindex="0"/g) || []).length, 1, `${label}: one tab stop per table, the arrows move inside`);
      // a sub-row spans the whole table from the corner: no dataset's column header names it
      for (const m of t.matchAll(/<tr class="mx-sub">([\s\S]*?)<\/tr>/g)) assert.match(m[1], /^<td colspan="17">/, label);
    }
  };
  const siam = model.rows.find(r => r.name === 'สยาม');
  check(renderNeighborhood(buildNeighborhood(model, siam), model, {ctx: ctx(), around}), 'similar');
  check(renderOverview(buildOverview(model, {rows: model.rows}), model, {ctx: ctx(), around}), 'multi-strong');
  check(renderOverview(buildOverview(model, {rows: scopeRows(model, {province: 'BKK'}), province: 'BKK'}), model, {ctx: ctx(), around}), 'province list');
  const list = [siam, ...buildNeighborhood(model, siam).similar.map(x => x.row)];
  const cmp = renderCompare(buildCompare(model, list), model, {around});
  check(cmp, 'compare');
  // the compare: one shape per neighbourhood on its chip (which takes it out), its row and its dots; the old table folded
  assert.equal((cmp.match(/class="cmp-chip" data-action="cmp-remove"/g) || []).length, list.length);
  for (const [, hex] of cmp.matchAll(/class="cd-m" style="fill:(#[0-9A-F]{6})"/g)) assert.ok(COUNT_SCALE.lut.includes(hex), hex);
  assert.match(cmp, /<details class="scope-details cmp-fold">[\s\S]*<table class="compare-table">/);
  // the answer line names its peers by their number, wherever it shows (the similar mixes of every neighbourhood, a compare)
  let answers = 0;
  const siamView = renderNeighborhood(buildNeighborhood(model, siam), model, {ctx: ctx(), around});
  assert.match(siamView, /<p class="mx-answer">/, 'สยาม and its 3 closest mixes share a level above 50');
  assert.match(cmp, /<p class="mx-answer">/, 'the same four, compared');
  for (const html of [cmp, ...model.rows.map(r => renderNeighborhood(buildNeighborhood(model, r), model, {ctx: ctx(), around}))]) {
    const ans = html.match(/<p class="mx-answer">([\s\S]*?)<\/p>/);
    if (!ans) continue;
    answers++;
    const parts = text(ans[1]).split(':')[1].split(' · ');
    for (const part of parts) assert.match(part, /\(เทียบ \d+ ย่าน\)\s*$/, part);
  }
  assert.ok(answers > 2, `answer lines: ${answers}`);
});

test('the axes: น่าอยู่ · น่าเที่ยว · น่าค้าขาย, one axis per dataset, no score, a pictogram per dataset in the approved subset', () => {
  const {model} = load();
  // D-V6b (owner 2026-11-26 14:03) supersedes D-V6: the words “น่า…” return; the guard moves into the topic rows (tests/people.test.js)
  assert.deepEqual(AXES.map(a => a.th), ['น่าอยู่', 'น่าเที่ยว', 'น่าค้าขาย'], 'D-V6b');
  assert.deepEqual(AXES.map(a => a.en), ['Liveable', 'Worth visiting', 'Good for trade']);
  const placed = AXES.flatMap(a => a.datasets);
  assert.deepEqual([...placed].sort(), model.datasets.map(d => d.id).sort(), 'every dataset on exactly one axis (D-V7 A)');
  assert.equal(new Set(placed).size, placed.length);
  for (const d of model.datasets) assert.ok(axisOf(d.id));
  // the sources named for what has no data yet are open data or CityMETER's own
  const OPEN = ['CityMETER', 'GISTDA', 'กรมควบคุมมลพิษ', 'กรุงเทพมหานคร', 'Inside Airbnb', 'Thailand Tourism Directory', 'กรมพัฒนาธุรกิจการค้า', 'กรมการขนส่งทางราง', 'กรมธนารักษ์', 'GTFS', 'กรมศิลปากร'];
  for (const a of AXES) for (const p of a.pending) assert.ok(OPEN.some(o => p.source[0].includes(o)), p.source[0]);
  // each dataset's pictogram is a role of the shipped subset; the five shops and the two industrial datasets differ (D-V4 B)
  for (const role of Object.values(DS_ICON)) assert.ok(PICTOGRAM_CONTRACT.glyphs[role], role);
  for (const a of AXES) assert.ok(PICTOGRAM_CONTRACT.glyphs[a.icon], a.icon);
  const g = id => PICTOGRAM_CONTRACT.glyphs[DS_ICON[id]];
  assert.equal(new Set(model.datasets.map(d => g(d.id))).size, 16, 'sixteen distinct glyphs');
  // no score of an axis and no total anywhere on the neighbourhood view
  const siam = model.rows.find(r => r.name === 'สยาม');
  const html = renderNeighborhood(buildNeighborhood(model, siam), model, {ctx: ctx(), around: A()});
  assert.ok(!/คะแนน|ยอดรวม|รวมทั้งหมด|score|total/i.test(text(html.slice(html.indexOf('id="nb-around"'), html.indexOf('class="scope-details around-fold"')))));
});

// the pattern is built from parts, so this file does not carry the name it looks for
const PARTNER = new RegExp(`${['Travel', 'Link'].join(' ')}|\\b${['B', 'D', 'I'].join('')}\\b`);
test('no partner name or negotiation in the page or the repository (§6 rule 10)', () => {
  const skip = new Set(['.git', 'node_modules', 'evidence', 'dist', '.handoff-stage', 'data', 'amendments', 'assets']);
  const files = [];
  const walk = dir => { for (const name of readdirSync(dir)) { if (skip.has(name)) continue; const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|mjs|json|md|html|css|py)$/.test(name)) files.push(p); } };
  walk(ROOT);
  for (const p of files) {
    const t = readFileSync(p, 'utf8');
    assert.ok(!PARTNER.test(t), `${relative(ROOT, p)}: a partner's name`);
  }
});
