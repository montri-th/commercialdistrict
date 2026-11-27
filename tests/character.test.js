/**
 * «ความเป็นย่าน» (0.7.10; owner 2026-11-27 18:05, VERBATIM: “และ x-y plot แสดงความเป็นย่าน แต่รอบนี้ควรเป็น น่าอยู่ น่าเที่ยว
 * น่าค้าขาย ทำยังไงดีมี 3 แกน”; he chose «คนอยู่ · ผู้มาเยือน · ศูนย์และตลาด (แนะนำ)», D-V11, and «สามเหลี่ยมระดับ (แนะนำ)»,
 * D-V12). data/character.json is the tiles' own levels of every neighbourhood; the corners print what the tiles print; the
 * triangle refers to nothing by url(#…).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT, load, readJSON} from './helpers.js';
import {decodeAround} from '../js/around.js';
import {buildNeighborhood} from '../js/profile.js';
import {renderNeighborhood} from '../js/panel.js';
import {peopleTiles} from '../js/people.js';
import {decodeCharacter, characterModel, characterSection, typeOf, TYPES, CORNERS, VIEW, CHARACTER_SCHEMA} from '../js/character.js';

const REFS = /url\(#|<clipPath|<pattern|<mask|<defs|<use[\s>]|clip-path=|href="#/;
const people = id => readJSON(`data/people/${id}.json`);
const char = () => decodeCharacter(readJSON('data/character.json'));
const ctx = model => ({meta: model.meta, datasetCount: 16});

test('data/character.json is the tiles’ own levels of every neighbourhood: 0 for nothing counted, null without a figure', () => {
  const json = readJSON('data/character.json');
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const meta = readJSON('data/people/meta.json');
  assert.equal(json.meta.schema, CHARACTER_SCHEMA);
  assert.equal(json.meta.release, pkg.version, 'the page’s release, as the people meta');
  assert.deepEqual(json.meta.reaches, ['in', '1000', '3000', '5000']);
  assert.deepEqual(json.meta.axes, ['res', 'gst', 'ctr']);
  assert.equal(json.meta.split, 50);
  assert.deepEqual(json.meta.reference, meta.levels.reference, 'the reference set of the tiles (395)');
  const files = readdirSync(join(ROOT, 'data/people')).filter(f => f.endsWith('.json') && f !== 'meta.json').map(f => f.slice(0, -5)).sort();
  const {model} = load();
  assert.deepEqual(Object.keys(json.rows).sort(), files);
  assert.deepEqual(files, model.rows.map(r => r.id).sort(), 'one row per neighbourhood of the page');
  assert.equal(json.meta.rows, files.length);
  let zero = 0, none = 0;
  for (const id of files) {
    const rec = people(id);
    for (const reach of json.meta.reaches) {
      const s = rec.s[reach], p = rec.p?.[reach] || {}, v = json.rows[id][reach];
      const counts = [s.res, s.gst, s.n?.shoppingcenter];
      ['res', 'gst', 'ctr'].forEach((k, i) => {
        if (counts[i] == null || (counts[i] > 0 && p[k] == null)) { assert.equal(v[i], null, `${id} ${reach} ${k}: no figure`); none++; }
        else if (counts[i] === 0) { assert.equal(v[i], 0, `${id} ${reach} ${k}: nothing counted`); zero++; }
        else { assert.equal(v[i], p[k], `${id} ${reach} ${k}: the tile’s own level`); assert.ok(v[i] > 0); }
      });
    }
  }
  assert.ok(zero > 300 && none >= 8, `${zero} measured zeros, ${none} without a figure`);
});

test('the type reads the numbers the page prints; eight types; the nearest five on the three levels', () => {
  assert.equal(Object.keys(TYPES).length, 8);
  assert.equal(typeOf([49.5, 50, 49.4]), '110', 'Math.round, as the tiles print');
  assert.equal(typeOf([0, 0, 0]), '000');
  const c = char();
  for (const reach of ['in', '1000', '5000']) {
    const m = characterModel(c, 'CMN-TH-FC9F0B73B3', reach);
    assert.ok(!m.missing && TYPES[m.type]);
    assert.equal(Object.values(m.counts).reduce((a, b) => a + b, 0), m.n, 'every complete neighbourhood has one type');
    assert.equal(m.count, m.counts[m.type]);
    assert.equal(m.nearest.length, 5);
    assert.ok(!m.nearest.some(q => q.id === 'CMN-TH-FC9F0B73B3'), 'never itself');
    for (let i = 1; i < 5; i++) assert.ok(m.nearest[i].d >= m.nearest[i - 1].d);
  }
  const at1 = characterModel(c, 'CMN-TH-FC9F0B73B3', '1000');
  assert.equal(at1.type, '111', 'ปุณณวิถี at 1 km: 88 · 82 · 67');
  const miss = characterModel(c, 'CMN-TH-34566D68FC', 'in');
  assert.deepEqual(miss.missing, ['res'], 'no building of Building V4 inside: not drawn');
  assert.equal(characterModel(c, 'CMN-TH-NOPE', '1000'), null);
});

test('the corners print the tiles’ numbers; no url(#…); the reading without the picture; its own provenance line', () => {
  const {model} = load();
  const around = decodeAround(readJSON('data/around.json'));
  const meta = readJSON('data/people/meta.json');
  const c = char();
  for (const id of ['CMN-TH-FC9F0B73B3', 'CMN-TH-B87F69B09D', 'CMN-TH-E51F656E20']) {
    for (const reach of ['in', '1000', '3000', '5000']) {
      const rec = people(id);
      const html = renderNeighborhood(buildNeighborhood(model, model.byId.get(id)), model, {ctx: ctx(model), around, people: rec, peopleMeta: meta, reach, character: c});
      const sec = html.slice(html.indexOf('id="nb-character"'), html.indexOf('</section>', html.indexOf('id="nb-character"')));
      assert.ok(html.indexOf('id="nb-people"') < html.indexOf('id="nb-character"') && html.indexOf('id="nb-character"') < html.indexOf('id="nb-map"'), `${id}: under the tiles, before the map`);
      assert.doesNotMatch(sec, REFS, `${id} ${reach}`);
      const m = characterModel(c, id, reach);
      if (m.missing) { assert.doesNotMatch(sec, /<svg/); assert.match(sec, /ยังวาดไม่ได้/); continue; }
      const size = sec.match(/<svg class="chr-plot" viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
      assert.ok(size && size[3] === size[5] && size[4] === size[6] && +size[3] === VIEW.w, `${id}: width and height equal the viewBox`);
      // each corner prints what its tile prints: Math.round of the same level, or ไม่มี when nothing is counted there
      const corners = [...sec.matchAll(/<span class="chr-v [^"]+">.*?<b class="data-number">([^<]+)<\/b><\/span>/g)].map(x => x[1]);
      const tiles = peopleTiles(rec, reach, meta);
      const want = ['res', 'gst', 'ctr'].map(k => {
        const t = tiles.find(x => x.key === k);
        return t.count === 0 ? 'ไม่มี' : String(Math.round(t.p));
      });
      assert.deepEqual(corners, want, `${id} ${reach}`);
      assert.match(sec, new RegExp(`ย่านนี้เป็นแบบ “${TYPES[m.type][0].replace(/[+]/g, '\\+')}”`));
      assert.match(sec, new RegExp(`${m.count.toLocaleString('en-US')} จาก ${m.n} ย่านเป็นแบบนี้`));
      assert.match(sec, /<title id="chr-t">ระดับของย่านนี้/, 'the picture has its words');
      assert.equal((sec.match(/data-action="select-nb"/g) || []).length, 5, 'the five nearest open their neighbourhood');
      assert.match(sec, /class="hint panel-foot provenance">.*ความเป็นย่าน รุ่น/);
      assert.match(sec, /href="DATA_METHOD\.md#character"/);
      assert.equal((sec.match(/class="chr-dot"/g) || []).length + (sec.match(/class="chr-zero"/g) || []).length, 3);
    }
  }
  assert.match(readFileSync(join(ROOT, 'DATA_METHOD.md'), 'utf8'), /<a id="character"><\/a>/);
});

test('the section waits, fails with a retry, and never shows a level from another file', () => {
  const {model} = load();
  const r = model.byId.get('CMN-TH-FC9F0B73B3');
  assert.match(characterSection(r, null, {state: 'loading'}), /role="status"/);
  assert.match(characterSection(r, null, {state: 'error'}), /data-action="character-retry"/);
  assert.throws(() => decodeCharacter({meta: {schema: 'x'}, rows: {}}));
  assert.equal(CORNERS.map(c => c.th).join(' · '), 'อยู่ · เที่ยว · ค้าขาย', 'the owner’s order');
  const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
  const block = css.slice(css.indexOf('.chr-lead'), css.indexOf('.chr-method-list'));
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,6}\b|opacity/, 'foundation tones from the theme, no opacity; the dots take the LUT in the markup');
});
